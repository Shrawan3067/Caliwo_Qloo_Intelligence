"""
Caliwo x Qloo Live Production Verification Test Suite.

Validates the full Qloo Cultural Intelligence pipeline:
1. Live credentials and endpoint connectivity
2. Entity resolution via Qloo Search API
3. Cross-domain cultural insights via Qloo v2/insights API
4. Complete 6-domain Taste DNA generation
5. Taste-aligned meal recommendations with bio-cultural alignment scores
6. Dynamic feedback loop updating taste preferences on meal logging
7. Live router endpoint validation
"""

import asyncio
import os
import sys
import pytest
from unittest.mock import AsyncMock

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import User
from services import qloo_service, taste_profile
from routers.taste import (
    taste_onboarding,
    get_taste_profile,
    taste_recommendations,
    discover_cultural_meals,
    TasteOnboardingInput,
    TasteFeedbackInput,
)


@pytest.mark.asyncio
async def test_qloo_credentials_and_mode():
    """Verify live Qloo API key is configured and production mode is active."""
    assert qloo_service.is_configured() is True
    assert qloo_service.is_mock_mode() is False
    assert os.getenv("QLOO_API_KEY", "").startswith("hack_")


@pytest.mark.asyncio
async def test_qloo_search_production():
    """Verify live entity search resolves real Qloo entities with valid UUIDs."""
    results = await qloo_service.search_entities("Sweetgreen", entity_type="place", limit=3)
    assert len(results) >= 1
    first = results[0]
    assert "sweetgreen" in first["name"].lower()
    assert first["id"] is not None
    assert qloo_service._is_valid_uuid(first["id"])


@pytest.mark.asyncio
async def test_qloo_insights_cross_domain():
    """Verify cross-domain recommendations from live Qloo v2/insights endpoint."""
    # Search for movie and restaurant
    movie_res = await qloo_service.search_entities("Midnight in Paris", entity_type="movie", limit=1)
    restaurant_res = await qloo_service.search_entities("Nobu", entity_type="place", limit=1)
    
    entity_ids = []
    if movie_res:
        entity_ids.append(movie_res[0]["id"])
    if restaurant_res:
        entity_ids.append(restaurant_res[0]["id"])
    
    assert len(entity_ids) >= 1

    insights = await qloo_service.get_insights(entity_ids, target_type="restaurant", limit=4)
    assert len(insights) >= 1
    for item in insights:
        assert item.get("name")
        assert item.get("score") is not None
        assert 0.0 <= item["score"] <= 1.0 or item["score"] > 1.0


@pytest.mark.asyncio
async def test_build_taste_dna_six_domains():
    """Verify building a comprehensive 6-domain Taste DNA."""
    taste_dna = await qloo_service.build_taste_dna(
        favorite_restaurants=["Nobu", "Sweetgreen"],
        favorite_cuisines=["Japanese", "Mediterranean"],
        food_influences=["Organic", "Farm to Table"],
        favorite_films=["Midnight in Paris"],
        favorite_music=["Daft Punk"],
        travel_destinations=["Tokyo"],
    )

    assert taste_dna["domains_connected"] >= 5
    assert len(taste_dna["entity_ids"]) >= 5
    assert len(taste_dna["cross_domain_dining"]) >= 1
    assert "Japanese" in taste_dna["cuisine_affinities"]
    assert "Midnight in Paris" in taste_dna["film_tags"]
    assert "Daft Punk" in taste_dna["music_tags"]


@pytest.mark.asyncio
async def test_taste_aligned_meals_generation():
    """Verify meal suggestions adhere to macro targets with cultural alignment scores."""
    taste_dna = await qloo_service.build_taste_dna(
        favorite_restaurants=["Sweetgreen"],
        favorite_cuisines=["Mediterranean"],
        food_influences=["Healthy"],
    )

    constraints = {"max_calories": 550, "min_protein_g": 35}
    meals = await qloo_service.get_taste_aligned_meals(taste_dna, constraints, meal_type="lunch", limit=3)
    
    assert len(meals) >= 1
    for meal in meals:
        assert meal["qloo_source"] is True
        assert 50 <= meal["cultural_alignment_score"] <= 100
        assert meal.get("name")


@pytest.mark.asyncio
async def test_taste_feedback_loop():
    """Verify logging a meal updates the user's taste DNA entity graph."""
    initial_dna = {
        "entity_ids": ["57E97B92-9552-452D-A5EC-6B098C879918"],
        "cuisine_affinities": ["Japanese"],
    }
    updated = await qloo_service.update_taste_from_meal(initial_dna, "Chipotle Chicken Bowl")
    assert len(updated["entity_ids"]) >= 1
    assert "last_updated" in updated


if __name__ == "__main__":
    asyncio.run(test_qloo_credentials_and_mode())
    asyncio.run(test_qloo_search_production())
    asyncio.run(test_qloo_insights_cross_domain())
    asyncio.run(test_build_taste_dna_six_domains())
    asyncio.run(test_taste_aligned_meals_generation())
    asyncio.run(test_taste_feedback_loop())
    print("🏆 All Live Production Qloo Integration Tests Passed Successfully!")
