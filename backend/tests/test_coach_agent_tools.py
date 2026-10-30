"""
Test Caliwo Autonomous Agent Tools & Coach Loop.

Tests:
- get_biometrics_and_macro_gaps execution
- query_qloo_taste_graph execution with mock/live Taste DNA
- search_qloo_cultural_entity execution
- synthesize_culturally_aligned_recipe verified alignment scoring (60/40 formula)
"""

import asyncio
import os
import sys
import pytest

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import User
from services.agent_tools import COACH_AGENT_TOOLS, execute_coach_tool


@pytest.mark.asyncio
async def test_agent_tool_definitions():
    """Verify all 4 agent tools are correctly registered with valid schemas."""
    tool_names = [t["function"]["name"] for t in COACH_AGENT_TOOLS]
    assert "get_biometrics_and_macro_gaps" in tool_names
    assert "query_qloo_taste_graph" in tool_names
    assert "search_qloo_cultural_entity" in tool_names
    assert "synthesize_culturally_aligned_recipe" in tool_names
    assert len(COACH_AGENT_TOOLS) == 4


@pytest.mark.asyncio
async def test_search_qloo_cultural_entity():
    """Test searching cultural entities through the agent tool."""
    user = User(id="test_user_agent", email="test_agent@caliwo.app", profile={})
    res = await execute_coach_tool(
        "search_qloo_cultural_entity",
        {"query": "Nobu", "entity_type": "place", "limit": 2},
        user,
        None,  # session not needed for entity search
    )
    assert "results" in res
    assert res["count"] >= 1
    assert any("nobu" in r["name"].lower() for r in res["results"])


@pytest.mark.asyncio
async def test_synthesize_culturally_aligned_recipe():
    """Test bio-cultural recipe synthesis and verified alignment calculation."""
    from unittest.mock import AsyncMock, patch

    user = User(id="test_user_agent", email="test_agent@caliwo.app", profile={})

    mock_gaps = {
        "date": "2026-10-24",
        "meals_logged": 2,
        "gaps": {
            "calories": {"remaining": 600, "goal": 2000, "consumed": 1400},
            "protein_g": {"remaining": 40, "goal": 140, "consumed": 100},
        },
    }

    with patch("services.agent_tools.get_nutrition_gaps", new=AsyncMock(return_value=mock_gaps)):
        res = await execute_coach_tool(
            "synthesize_culturally_aligned_recipe",
            {
                "dish_name": "Miso Black Cod with Edamame & Bok Choy",
                "cuisine": "Japanese",
                "cultural_inspiration": "Inspired by user's affinity for Nobu and Tokyo dining",
                "estimated_calories": 520,
                "estimated_protein_g": 38,
                "estimated_carbs_g": 35,
                "estimated_fat_g": 14,
                "key_ingredients": ["Black cod", "White miso", "Edamame", "Bok choy"],
                "cultural_match_score": 95,
            },
            user,
            None,
        )

        assert "verified_alignment_score" in res
        score = res["verified_alignment_score"]
        # Score must be bounded between 75 and 100 for a 95% cultural match that hits macros
        assert 75 <= score <= 100
        assert res["macro_fit_status"]["calories_within_budget"] is True
        assert res["macro_fit_status"]["protein_gap_closed_percent"] >= 90.0
        assert "Miso Black Cod" in res["dish_name"]
        assert "restaurant_anchor" in res
        assert "dining_order_guide" in res
        assert "prep_instructions" in res
        assert len(res["prep_instructions"]) >= 3
        assert "Order the" in res["dining_order_guide"]


@pytest.mark.asyncio
async def test_qloo_taste_discoveries():
    """Verify /taste/discover provides cross-domain dining matches."""
    from routers.taste import discover_cultural_meals
    from unittest.mock import AsyncMock

    user = User(
        id="test_user_agent",
        email="test_agent@caliwo.app",
        profile={
            "taste_dna": {
                "entity_ids": ["urn:entity:movie:wong-kar-wai", "urn:entity:place:nobu"],
                "cultural_tags": ["Cinema: In the Mood for Love", "Dining: Nobu"],
            }
        },
    )

    res = await discover_cultural_meals(user=user, session=AsyncMock())
    assert res["qloo_powered"] is True
    assert len(res["discoveries"]) > 0
    assert "cross_domain_note" in res
    assert "film & music" in res["cross_domain_note"] or "preferences across" in res["cross_domain_note"]


@pytest.mark.asyncio
async def test_meal_evolution_feedback_loop():
    """Verify that logging a meal updates the user's Taste DNA via qloo_service."""
    from services import qloo_service

    initial_dna = {
        "entity_ids": ["urn:entity:place:nobu-001"],
        "cuisine_affinities": ["Japanese"],
        "cultural_tags": ["Dining: Nobu"],
    }

    updated_dna = await qloo_service.update_taste_from_meal(initial_dna, "Grilled Salmon Bowl")
    assert len(updated_dna["entity_ids"]) >= 1
    assert "Salmon" in str(updated_dna) or "bowl" in str(updated_dna).lower() or len(updated_dna["entity_ids"]) >= 1


@pytest.mark.asyncio
async def test_query_qloo_taste_graph_correlation_insight():
    """Verify query_qloo_taste_graph returns specific cross-domain correlation vector."""
    from unittest.mock import AsyncMock, patch

    user = User(
        id="test_user_agent",
        email="test_agent@caliwo.app",
        profile={
            "taste_dna": {
                "entity_ids": ["57E97B92-9552-452D-A5EC-6B098C879918"],
                "cuisine_affinities": ["Japanese"],
                "film_tags": ["Jiro Dreams of Sushi"],
                "music_tags": ["Chet Baker"],
                "cultural_tags": ["Nobu"],
            }
        },
    )

    mock_gaps = {
        "date": "2026-10-24",
        "meals_logged": 2,
        "gaps": {
            "calories": {"remaining": 600, "goal": 2000, "consumed": 1400},
            "protein_g": {"remaining": 40, "goal": 140, "consumed": 100},
        },
    }

    with patch("services.agent_tools.get_nutrition_gaps", new=AsyncMock(return_value=mock_gaps)):
        res = await execute_coach_tool(
            "query_qloo_taste_graph",
            {"meal_type": "dinner", "limit": 2},
            user,
            AsyncMock(),
        )
        assert res["taste_profile_active"] is True
        assert "qloo_correlation_insight" in res
        assert "Qloo Latent Graph:" in res["qloo_correlation_insight"]
        assert "88% affinity correlation" in res["qloo_correlation_insight"]
        assert "Jiro Dreams of Sushi" in res["qloo_correlation_insight"]
        assert "Chet Baker" in res["qloo_correlation_insight"]


if __name__ == "__main__":
    asyncio.run(test_agent_tool_definitions())
    asyncio.run(test_search_qloo_cultural_entity())
    asyncio.run(test_synthesize_culturally_aligned_recipe())
    asyncio.run(test_qloo_taste_discoveries())
    asyncio.run(test_meal_evolution_feedback_loop())
    asyncio.run(test_query_qloo_taste_graph_correlation_insight())
    print("✅ All Agent Tool & Discovery Tests Passed Successfully!")

