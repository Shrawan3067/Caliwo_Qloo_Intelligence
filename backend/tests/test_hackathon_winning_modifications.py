"""
Test Suite for Hackathon Winning Modifications:
1. Zero-Failure Resilient Fallback in qloo_service.py
2. Multi-Slot Meal Plan Grounding (Dinner, Lunch, Breakfast) in plans.py
3. 1-Click Judge Persona Switcher (Alex, Elena, Marcus) in demo_service.py & taste.py
"""

import asyncio
import os
import sys
import pytest
from unittest.mock import AsyncMock, patch

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import AsyncSessionLocal
from models import User
from services import qloo_service
from services.demo_service import DEMO_PERSONAS, switch_persona, reset_demo_user, DEMO_USER_ID
from routers.taste import switch_taste_persona, list_taste_personas, SwitchPersonaInput


@pytest.mark.asyncio
async def test_qloo_resilient_fallback_on_empty_insights():
    """Verify that get_taste_aligned_meals never returns empty even if primary insights query is empty."""
    taste_dna = {
        "entity_ids": ["non_existent_obscure_id_99999"],
        "cuisine_affinities": ["Japanese"],
    }
    constraints = {"max_calories": 600, "min_protein_g": 35}

    # Should trigger the resilient fallback to verified core seeds
    meals = await qloo_service.get_taste_aligned_meals(taste_dna, constraints, meal_type="dinner", limit=3)
    assert len(meals) >= 1
    assert meals[0]["qloo_source"] is True
    assert meals[0]["bio_cultural_score"] >= 50
    assert meals[0]["dish_name"]


@pytest.mark.asyncio
async def test_qloo_resilient_fallback_location_retry():
    """Verify location-restricted queries retry globally if 0 results in geo-zone."""
    taste_dna = {
        "entity_ids": ["57E97B92-9552-452D-A5EC-6B098C879918"],
        "cuisine_affinities": ["Japanese"],
    }
    # Antarctica coordinates where no restaurants exist
    antarctica_location = {"lat": -82.8628, "lng": 135.0}
    constraints = {"max_calories": 600, "min_protein_g": 35}

    meals = await qloo_service.get_taste_aligned_meals(
        taste_dna, constraints, meal_type="dinner", limit=3, location=antarctica_location
    )
    assert len(meals) >= 1
    assert meals[0]["dish_name"]


@pytest.mark.asyncio
async def test_multi_slot_meal_plan_grounding_context():
    """Verify that plans.py grounds all 3 meal slots (breakfast, lunch, dinner) in authentic Qloo dishes."""
    from routers import plans
    taste_dna = DEMO_PERSONAS["alex"]["taste_dna"]

    # Pre-fetch for the 3 slots
    d_recs = await qloo_service.get_taste_aligned_meals(taste_dna, {"max_calories": 800, "min_protein_g": 45}, "dinner", limit=2)
    l_recs = await qloo_service.get_taste_aligned_meals(taste_dna, {"max_calories": 700, "min_protein_g": 40}, "lunch", limit=2)
    b_recs = await qloo_service.get_taste_aligned_meals(taste_dna, {"max_calories": 500, "min_protein_g": 30}, "breakfast", limit=2)

    assert len(d_recs) >= 1
    assert len(l_recs) >= 1
    assert len(b_recs) >= 1

    # Verify breakfast formatting adaptations
    assert b_recs[0]["dish_name"]
    assert "breakfast" in b_recs[0]["dish_name"].lower() or any(
        w in b_recs[0]["dish_name"].lower() for w in ("scramble", "plate", "bowl", "morning", "egg", "oat", "salmon", "toast")
    )


@pytest.mark.asyncio
async def test_judge_persona_switching_full_cycle():
    """Verify switching between Alex (Tokyo), Elena (Amalfi), and Marcus (Oaxaca),
    with automatic 7-day meal plan and grocery re-hydration with authentic Qloo ingredients."""
    from routers.grocery import grocery_current
    from routers.plans import get_current_plan

    async with AsyncSessionLocal() as session:
        # Reset to base demo state
        await reset_demo_user(session)

        # 1. Fetch user & verify initial pristine demo state (Alex)
        from sqlalchemy import select
        res = await session.execute(select(User).where(User.id == DEMO_USER_ID))
        user = res.scalars().first()
        assert user is not None
        assert user.pro_active is True
        assert user.profile.get("pro_active") is True
        assert user.profile.get("is_pro") is True

        # Verify initial Alex 7-day meal plan & grocery list
        alex_plan = (await get_current_plan(user=user))["plan"]
        assert alex_plan is not None
        assert len(alex_plan["days"]) == 7
        alex_grocery = await grocery_current(user=user, session=session)
        alex_item_names = [it["name"] for it in alex_grocery["items"]]
        assert any("Saikyo Sweet Miso" in name for name in alex_item_names)
        assert any("Forbidden Black Rice" in name for name in alex_item_names)

        # 2. Switch to Elena (Mediterranean Minimalist & Amalfi Coast)
        elena_res = await switch_persona(user, "elena", session)
        assert elena_res["status"] == "success"
        assert elena_res["active_persona"] == "elena"
        assert user.name == "Elena"
        assert user.pro_active is True
        assert user.profile["pro_active"] is True
        assert user.profile["is_pro"] is True
        assert "Mediterranean" in user.profile["cuisine_affinities"]
        assert "Amalfi Coast" in user.profile["taste_dna"]["travel_tags"]
        assert user.profile["daily_calories"] == 1850

        # Verify Elena's 7-day meal plan & grocery hydration with authentic Qloo ingredients
        elena_plan = (await get_current_plan(user=user))["plan"]
        assert elena_plan is not None
        assert len(elena_plan["days"]) == 7
        elena_grocery = await grocery_current(user=user, session=session)
        elena_item_names = [it["name"] for it in elena_grocery["items"]]
        assert any("Ancient Farro" in name for name in elena_item_names)
        assert any("Kalamata Olives in Brine" in name for name in elena_item_names)

        # 3. Switch to Marcus (Oaxacan Smoke & Strength)
        marcus_res = await switch_persona(user, "marcus", session)
        assert marcus_res["status"] == "success"
        assert marcus_res["active_persona"] == "marcus"
        assert user.name == "Marcus"
        assert user.pro_active is True
        assert user.profile["pro_active"] is True
        assert user.profile["is_pro"] is True
        assert "Mexican" in user.profile["cuisine_affinities"]
        assert "Oaxaca" in user.profile["taste_dna"]["travel_tags"]
        assert user.profile["daily_calories"] == 2400
        assert user.profile["daily_protein_g"] == 175

        # Verify Marcus's 7-day meal plan & grocery hydration with authentic Qloo ingredients
        marcus_plan = (await get_current_plan(user=user))["plan"]
        assert marcus_plan is not None
        assert len(marcus_plan["days"]) == 7
        marcus_grocery = await grocery_current(user=user, session=session)
        marcus_item_names = [it["name"] for it in marcus_grocery["items"]]
        assert any("Guajillo Chili Adobo" in name for name in marcus_item_names)
        assert any("Charred Poblano Peppers" in name for name in marcus_item_names)

        # 4. Switch back to Alex (Tokyo Omakase & Cinema)
        alex_res = await switch_persona(user, "alex", session)
        assert alex_res["status"] == "success"
        assert alex_res["active_persona"] == "alex"
        assert user.name == "Alex"
        assert user.pro_active is True
        assert user.profile["pro_active"] is True
        assert user.profile["is_pro"] is True
        assert "Japanese" in user.profile["cuisine_affinities"]

        alex_grocery_restored = await grocery_current(user=user, session=session)
        restored_names = [it["name"] for it in alex_grocery_restored["items"]]
        assert any("Saikyo Sweet Miso" in name for name in restored_names)


@pytest.mark.asyncio
async def test_judge_vip_pass_auth_and_paywall_bypass():
    """Verify VIP Judge Pass:
    - demo@caliwo.app and any email containing 'judge' automatically bypasses all paywall checks.
    - User serialization via public_user guarantees is_pro=True and pro_active=True."""
    from routers.auth import public_user

    judge_user_1 = User(
        id="usr_judge_01",
        email="judge.qloo@hackathon.org",
        name="Hackathon Judge",
        pro_active=False,
        profile={"plan": "free"},
    )
    res_1 = public_user(judge_user_1)
    assert res_1["is_pro"] is True
    assert res_1["pro_active"] is True
    assert res_1["profile"]["pro_active"] is True
    assert res_1["profile"]["is_pro"] is True

    demo_user = User(
        id="usr_demo_01",
        email="demo@caliwo.app",
        name="Alex",
        pro_active=False,
        profile={},
    )
    res_demo = public_user(demo_user)
    assert res_demo["is_pro"] is True
    assert res_demo["pro_active"] is True

    regular_free_user = User(
        id="usr_regular_01",
        email="regular@example.com",
        name="Regular User",
        pro_active=False,
        profile={"pro_active": False},
    )
    res_reg = public_user(regular_free_user)
    assert res_reg["is_pro"] is False
    assert res_reg["pro_active"] is False


@pytest.mark.asyncio
async def test_persona_endpoints():
    """Verify router endpoints for listing and switching personas."""
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        res = await session.execute(select(User).where(User.id == DEMO_USER_ID))
        user = res.scalars().first()
        assert user is not None

        # Test list_taste_personas
        personas_data = await list_taste_personas()
        assert len(personas_data["personas"]) == 3
        ids = [p["id"] for p in personas_data["personas"]]
        assert "alex" in ids and "elena" in ids and "marcus" in ids

        # Test switch_taste_persona endpoint
        inp = SwitchPersonaInput(persona_id="elena")
        switched = await switch_taste_persona(inp, user=user, session=session)
        assert switched["status"] == "success"
        assert switched["active_persona"] == "elena"


@pytest.mark.asyncio
async def test_culturally_blind_ai_toggle_and_recommendations():
    """Verify Modification 1: Global Culturally Blind AI Toggle.
    - When enabled, bio-cultural score drops to 0%, dish reverts to Plain Steamed Chicken Breast & Brown Rice.
    - UI warning banner is returned: ⚠️ High Abandonment Risk: Culturally Alienating Meal Plan.
    - When disabled, restores 96% authentic cultural recommendations.
    """
    from routers.taste import (
        toggle_blind_mode,
        ToggleBlindModeInput,
        taste_recommendations,
        get_taste_profile,
    )

    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        res = await session.execute(select(User).where(User.id == DEMO_USER_ID))
        user = res.scalars().first()
        assert user is not None

        # 1. Activate Culturally Blind AI Mode
        toggle_res = await toggle_blind_mode(
            ToggleBlindModeInput(simulate_blind=True),
            user=user,
            session=session,
        )
        assert toggle_res["status"] == "ok"
        assert toggle_res["simulate_blind"] is True
        assert user.profile.get("simulate_blind") is True

        # 2. Verify Profile endpoint reports simulate_blind = True
        prof = await get_taste_profile(user=user, session=session)
        assert prof.get("simulate_blind") is True

        # 3. Recommendations under Blind Mode
        recs = await taste_recommendations(
            user=user,
            session=session,
        )
        assert recs["blind_mode"] is True
        assert recs["bio_cultural_score"] == 0
        assert "⚠️ High Abandonment Risk: Culturally Alienating Meal Plan" in recs["warning_banner"]
        assert len(recs["recommendations"]) >= 1

        top_rec = recs["recommendations"][0]
        assert top_rec["dish_name"] == "Plain Steamed Chicken Breast & Brown Rice"
        assert top_rec["cultural_alignment_score"] == 0
        assert top_rec["adherence_risk"] == "HIGH_ABANDONMENT_RISK"
        assert top_rec["qloo_augmented"] is False

        # 4. Explicit query parameter ?simulate_blind=true also triggers blind mode
        query_recs = await taste_recommendations(
            simulate_blind=True,
            user=user,
            session=session,
        )
        assert query_recs["blind_mode"] is True
        assert query_recs["bio_cultural_score"] == 0

        # 5. Disable Culturally Blind Mode (Restore Caliwo + Qloo Mode)
        restore_res = await toggle_blind_mode(
            ToggleBlindModeInput(simulate_blind=False),
            user=user,
            session=session,
        )
        assert restore_res["status"] == "ok"
        assert restore_res["simulate_blind"] is False
        assert user.profile.get("simulate_blind") is False

        # 6. Verify instant cultural revival
        restored_recs = await taste_recommendations(
            user=user,
            session=session,
        )
        assert restored_recs["blind_mode"] is False
        assert restored_recs["bio_cultural_score"] >= 80
        assert restored_recs["recommendations"][0]["cultural_alignment_score"] >= 75
        assert restored_recs["recommendations"][0]["dish_name"] != "Plain Steamed Chicken Breast & Brown Rice"


@pytest.mark.asyncio
async def test_coach_message_under_culturally_blind_mode():
    """Verify that Caliwo Coach returns 0% cultural fit and bro-diet response when Blind Mode is active."""
    from starlette.requests import Request
    from routers.taste import toggle_blind_mode, ToggleBlindModeInput
    from routers.coach import coach_message, CoachMessageInput

    mock_request = Request({
        "type": "http",
        "path": "/api/coach/message",
        "method": "POST",
        "client": ("127.0.0.1", 8000),
        "headers": [],
    })

    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        res = await session.execute(select(User).where(User.id == DEMO_USER_ID))
        user = res.scalars().first()
        assert user is not None

        # Turn on blind mode
        await toggle_blind_mode(
            ToggleBlindModeInput(simulate_blind=True),
            user=user,
            session=session,
        )

        coach_res = await coach_message(
            CoachMessageInput(message="Suggest a dinner that hits my protein goal"),
            mock_request,
            user=user,
            session=session,
        )

        assert "⚠️ High Abandonment Risk: Culturally Alienating Meal Plan" in coach_res["reply"]
        assert "Plain Steamed Chicken Breast & Brown Rice" in coach_res["reply"]
        assert "0% Cultural Fit" in coach_res["reply"]

        telemetry = coach_res.get("agent_telemetry", {})
        assert telemetry.get("bio_cultural_score") == 0
        assert "culturally_blind_ai_bypass" in telemetry.get("tools_called", [])

        synth = telemetry.get("synthesized_recipe", {})
        assert synth.get("dish_name") == "Plain Steamed Chicken Breast & Brown Rice"
        assert synth.get("verified_alignment_score") == 0

        # Cleanup: restore Qloo mode
        await toggle_blind_mode(
            ToggleBlindModeInput(simulate_blind=False),
            user=user,
            session=session,
        )


@pytest.mark.asyncio
async def test_dynamic_entities_map_urns():
    """Verify Modification 2: Dynamic Entity URNs in Taste DNA & Cultural Taste Graph.
    - build_taste_dna returns entities_map with film, music, travel, and restaurants items.
    - Each entity item has name, live Qloo UUID (id), and affinity score.
    - Profile endpoint and DEMO_PERSONAS expose entities_map for CulturalTasteGraphExplorer.tsx.
    """
    from services import qloo_service
    from services.demo_service import DEMO_PERSONAS, DEMO_PROFILE
    from routers.taste import get_taste_profile

    # 1. Verify live build_taste_dna includes entities_map
    dna = await qloo_service.build_taste_dna(
        favorite_restaurants=["Nobu"],
        favorite_cuisines=["Japanese"],
        food_influences=["Chef"],
        favorite_films=["Jiro Dreams of Sushi"],
        favorite_music=["Chet Baker"],
        travel_destinations=["Tokyo"],
    )

    assert "entities_map" in dna
    entities_map = dna["entities_map"]
    assert "film" in entities_map
    assert "music" in entities_map
    assert "travel" in entities_map
    assert "restaurants" in entities_map

    # Verify structure of entity items (name, id, score)
    for cat in ("film", "music", "travel", "restaurants"):
        items = entities_map[cat]
        assert isinstance(items, list)
        if items:
            first = items[0]
            assert "name" in first
            assert "id" in first
            assert "score" in first
            assert isinstance(first["score"], (int, float))

    # 2. Verify DEMO_PERSONAS have entities_map with live Qloo UUIDs
    for persona_id in ("alex", "elena", "marcus"):
        p_dna = DEMO_PERSONAS[persona_id]["taste_dna"]
        assert "entities_map" in p_dna
        p_map = p_dna["entities_map"]
        assert "film" in p_map and "music" in p_map and "travel" in p_map and "restaurants" in p_map
        assert p_map["restaurants"][0]["id"]  # Real Qloo UUID exists
        assert p_map["restaurants"][0]["score"] >= 0.90

    # 3. Verify DEMO_PROFILE has entities_map
    assert "entities_map" in DEMO_PROFILE["taste_dna"]

    # 4. Verify get_taste_profile router endpoint returns entities_map
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        res = await session.execute(select(User).where(User.id == DEMO_USER_ID))
        user = res.scalars().first()
        assert user is not None

        profile_data = await get_taste_profile(user=user, session=session)
        assert "entities_map" in profile_data
        assert "restaurants" in profile_data["entities_map"]
        assert profile_data["entities_map"]["restaurants"][0]["id"]


@pytest.mark.asyncio
async def test_cultural_grocery_categorization_and_specialties():
    """Verify that grocery.py categorizes cultural ingredients into 'Global Pantry & Cultural Specialties 🌐' and maps micronutrients."""
    from routers.grocery import (
        _categorize_ingredient,
        _get_micronutrient_benefit,
        CULTURAL_SPECIALTY_KEYWORDS,
    )

    # 1. Verify keywords list exists and contains cultural staples
    assert "miso" in CULTURAL_SPECIALTY_KEYWORDS
    assert "bok choy" in CULTURAL_SPECIALTY_KEYWORDS
    assert "farro" in CULTURAL_SPECIALTY_KEYWORDS
    assert "guajillo" in CULTURAL_SPECIALTY_KEYWORDS
    assert "tahini" in CULTURAL_SPECIALTY_KEYWORDS

    # 2. Test multi-word and single-word cultural specialty categorization
    cultural_test_items = [
        ("Saikyo Sweet Miso", "Global Pantry & Cultural Specialties 🌐"),
        ("Baby Bok Choy", "Global Pantry & Cultural Specialties 🌐"),
        ("Guajillo Chili Adobo", "Global Pantry & Cultural Specialties 🌐"),
        ("Organic Farro Grain", "Global Pantry & Cultural Specialties 🌐"),
        ("Fresh Fermented Kimchi", "Global Pantry & Cultural Specialties 🌐"),
        ("Toasted Tahini Paste", "Global Pantry & Cultural Specialties 🌐"),
        ("Artisan Sourdough Loaf", "Global Pantry & Cultural Specialties 🌐"),
        ("Kalamata Olives in Brine", "Global Pantry & Cultural Specialties 🌐"),
    ]

    for item_name, expected_category in cultural_test_items:
        cat = _categorize_ingredient(item_name)
        assert cat == expected_category, f"Expected '{item_name}' to be '{expected_category}', got '{cat}'"

    # 3. Test standard non-cultural items fall into traditional categories
    standard_items = [
        ("Fresh Spinach Leaves", "Produce 🥦"),
        ("Greek Yogurt", "Dairy & Eggs 🥛"),
        ("Wild Alaskan Salmon", "Meat & Seafood 🥩"),
        ("Rolled Oatmeal", "Pantry & Grains 🌾"),
        ("Cold Brew Coffee", "Beverages ☕"),
    ]

    for item_name, expected_category in standard_items:
        cat = _categorize_ingredient(item_name)
        assert cat == expected_category, f"Expected '{item_name}' to be '{expected_category}', got '{cat}'"

    # 4. Test micronutrient bridge benefits
    assert "zinc" in _get_micronutrient_benefit("Saikyo Sweet Miso").lower()
    assert "calcium" in _get_micronutrient_benefit("Baby Bok Choy").lower()
    assert "magnesium" in _get_micronutrient_benefit("Farro Grain").lower()
    assert _get_micronutrient_benefit("Unknown Item X") is None


@pytest.mark.asyncio
async def test_cultural_recipe_micronutrient_rationale_enrichment():
    """Verify that synthesize_culturally_aligned_recipe enriches cultural inspiration with micronutrient rationale."""
    from services.agent_tools import execute_coach_tool

    user = User(id="test_user_mod3", email="mod3@caliwo.app", profile={})

    mock_gaps = {
        "date": "2026-10-26",
        "meals_logged": 1,
        "gaps": {
            "calories": {"remaining": 650, "goal": 2000, "consumed": 1350},
            "protein_g": {"remaining": 45, "goal": 150, "consumed": 105},
        },
    }

    with patch("services.agent_tools.get_nutrition_gaps", new=AsyncMock(return_value=mock_gaps)):
        res = await execute_coach_tool(
            "synthesize_culturally_aligned_recipe",
            {
                "dish_name": "Pan-Seared Halibut with Guajillo Adobo & Quinoa",
                "cuisine": "Oaxacan-Coastal",
                "cultural_inspiration": "Inspired by Oaxacan wood-fired adobo techniques",
                "estimated_calories": 540,
                "estimated_protein_g": 42,
                "estimated_carbs_g": 38,
                "estimated_fat_g": 14,
                "estimated_magnesium_mg": 92,
                "key_ingredients": ["Halibut", "Guajillo adobo", "Quinoa", "Poblano"],
                "cultural_match_score": 96,
            },
            user,
            None,
        )

        assert "cultural_inspiration" in res
        assert "Rich in natural magnesium and dietary fiber to aid muscular recovery" in res["cultural_inspiration"]
        assert "without exceeding your daily sodium ceiling" in res["cultural_inspiration"]
        assert "micronutrient_rationale" in res
        assert res["verified_alignment_score"] >= 80.0



