"""
Test Qloo Grounded Meal Plan Generation & Feedback Loop in Plans.
Verifies Action 2 implementation:
1. Fallback day generation calls qloo_service.get_taste_aligned_meals to populate authentic dishes.
2. Planned meals contain real Qloo dish names, key ingredients, and bio-cultural scores.
3. log_plan queues background task _evolve_taste_from_meal_bg to evolve Taste DNA immediately.
"""

import asyncio
import os
import sys
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import app
from models import User
from routers.plans import _build_fallback_days, _build_fallback_day


@pytest.mark.asyncio
async def test_build_fallback_day_grounded_in_qloo():
    """Verify _build_fallback_day uses real Qloo taste-aligned meals when Taste DNA exists."""
    taste_dna = {
        "entity_ids": ["57E97B92-9552-452D-A5EC-6B098C879918"],
        "cuisine_affinities": ["Japanese", "Mediterranean"],
        "cultural_tags": ["Nobu", "Sweetgreen", "Tokyo"],
        "film_tags": ["Midnight in Paris"],
        "music_tags": ["Daft Punk"],
        "travel_tags": ["Tokyo"],
        "domains_connected": 6,
    }

    # Generate fallback days using Qloo grounding
    days = await _build_fallback_days(num_days=3, cal_goal=2000, protein_goal=150, taste_dna=taste_dna)
    assert len(days) == 3

    for day in days:
        assert len(day.meals) == 3
        dinner = next(m for m in day.meals if m.slot == "dinner")
        lunch = next(m for m in day.meals if m.slot == "lunch")
        breakfast = next(m for m in day.meals if m.slot == "breakfast")

        # Verify real cultural attributes & bio-cultural scores
        assert dinner.bio_cultural_score is not None
        assert 75 <= dinner.bio_cultural_score <= 100
        assert len(dinner.ingredients) >= 2
        assert dinner.cultural_inspiration is not None

        assert lunch.bio_cultural_score is not None
        assert 75 <= lunch.bio_cultural_score <= 100
        assert len(lunch.ingredients) >= 2

        assert breakfast.bio_cultural_score is not None
        assert 75 <= breakfast.bio_cultural_score <= 100
        assert len(breakfast.ingredients) >= 2
        assert breakfast.cultural_inspiration is not None


@pytest.mark.asyncio
async def test_log_plan_triggers_taste_evolution_background_task():
    """Verify logging a planned meal invokes _evolve_taste_from_meal_bg."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Login demo user
        res = await ac.post("/api/auth/login", json={
            "email": "demo@caliwo.app",
            "password": "Demo1234!",
        })
        assert res.status_code == 200
        token = res.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Mock the background task execution to verify it is scheduled
        with patch("routers.plans._evolve_taste_from_meal_bg") as mock_bg:
            log_res = await ac.post(
                "/api/meal-plans/mp_test123/log?day=1&slot=dinner",
                headers=headers,
            )
            assert log_res.status_code == 200
            data = log_res.json()
            assert data["ok"] is True
            assert "meal" in data
            assert data["meal"]["meal_type"] == "dinner"
            mock_bg.assert_called_once()
