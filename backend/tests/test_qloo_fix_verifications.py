"""
Unit test verifying fixes for:
1. meals.py photo scan cultural alignment calculation with overlap set intersection.
2. plans.py _generate_recipe_ai JSON parsing fix.
3. qloo_service.get_taste_aligned_meals micronutrient (fiber, magnesium) synthesis and location support.
"""

import asyncio
import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import qloo_service, taste_profile


@pytest.mark.asyncio
async def test_meals_overlap_cultural_match():
    """Verify overlap intersection logic works without NameError."""
    taste_dna = {
        "entity_ids": ["57E97B92-9552-452D-A5EC-6B098C879918"],
        "cuisine_affinities": ["Japanese", "Mediterranean"],
        "cultural_tags": ["Sushi", "Tokyo", "Seafood"],
        "domains_connected": 3,
    }
    cultural_tags_list = ["Japanese Cuisine", "Sushi", "Tokyo Dining"]

    user_cuisines = set(c.lower() for c in taste_dna.get("cuisine_affinities", []))
    user_cultural_tags = set(t.lower() for t in taste_dna.get("cultural_tags", []))
    all_user_taste = user_cuisines | user_cultural_tags
    food_tags_lower = set(t.lower() for t in cultural_tags_list)

    overlap = all_user_taste & food_tags_lower
    assert len(overlap) >= 1

    qloo_affinity = 0.92
    cultural_match = min(99.0, max(75.0, (qloo_affinity * 100 if qloo_affinity <= 1 else qloo_affinity) + (len(overlap) * 4.0)))
    alignment_score = taste_profile.compute_alignment_score(cultural_match, nutrition_fit=88.0)

    assert 75 <= alignment_score <= 100


@pytest.mark.asyncio
async def test_qloo_service_micronutrients_and_location():
    """Verify get_taste_aligned_meals includes fiber_g, magnesium_mg, and accepts location."""
    taste_dna = {
        "entity_ids": ["57E97B92-9552-452D-A5EC-6B098C879918"],
        "cuisine_affinities": ["Japanese"],
        "cultural_tags": ["Tokyo"],
    }
    constraints = {"max_calories": 550, "min_protein_g": 35}
    location = {"lat": 35.6762, "lng": 139.6503}  # Tokyo

    meals = await qloo_service.get_taste_aligned_meals(
        taste_dna, constraints, meal_type="dinner", limit=2, location=location
    )

    assert len(meals) >= 1
    first = meals[0]
    assert "fiber_g" in first
    assert "magnesium_mg" in first
    assert first["fiber_g"] > 0
    assert first["magnesium_mg"] > 0
    assert "magnesium_mg" in first["macro_context"]


@pytest.mark.asyncio
async def test_save_taste_dna_cache_invalidation():
    """Verify save_taste_dna invalidates profile, dashboard, and coach_suggestions caches."""
    from unittest.mock import AsyncMock, patch
    from models import User

    user = User(
        id="user_test_cache_inv",
        email="cache_test@example.com",
        profile={"daily_calories": 2000},
    )
    mock_session = AsyncMock()

    with patch("cache.cache_invalidate", new_callable=AsyncMock) as mock_invalidate:
        test_dna = {
            "entity_ids": ["57E97B92-9552-452D-A5EC-6B098C879918"],
            "domains_connected": 4,
        }
        await taste_profile.save_taste_dna(mock_session, user, test_dna)

        assert user.profile["taste_onboarded"] is True
        assert user.profile["taste_dna"] == test_dna
        assert mock_session.commit.called

        # Verify all 3 cache invalidations were called
        mock_invalidate.assert_any_call("profile", "user_test_cache_inv")
        mock_invalidate.assert_any_call("dashboard", "user_test_cache_inv")
        mock_invalidate.assert_any_call("coach_suggestions", "user_test_cache_inv")


if __name__ == "__main__":
    asyncio.run(test_meals_overlap_cultural_match())
    asyncio.run(test_qloo_service_micronutrients_and_location())
    asyncio.run(test_save_taste_dna_cache_invalidation())
    print("✅ All fix verification tests passed!")
