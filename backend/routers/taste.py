"""
Taste Router — Qloo-powered taste onboarding and cultural recommendations.

QLOO IS THE FOUNDATION LAYER — these endpoints will raise 503 if Qloo is
not configured or unreachable. The app cannot function without Qloo.

Endpoints:
  POST /api/taste/onboarding       — Build taste DNA from user favorites
  GET  /api/taste/profile           — Get user's taste DNA
  GET  /api/taste/recommendations   — Get taste-aligned meal recommendations
  GET  /api/taste/discover          — Cross-domain cultural meal discovery
  POST /api/taste/feedback          — Update taste DNA from a logged meal
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User
from routers.auth import current_user
from services import qloo_service, taste_profile
from services.qloo_service import QlooNotConfiguredError, QlooAPIError
from services.nutrition_service import get_nutrition_gaps

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/taste", tags=["taste"])


def _handle_qloo_error(e: Exception):
    """Convert Qloo errors to HTTP 503 — service is unavailable without Qloo."""
    if isinstance(e, QlooNotConfiguredError):
        raise HTTPException(
            status_code=503,
            detail="Qloo API key is not configured. Caliwo cannot operate without Qloo.",
        )
    if isinstance(e, QlooAPIError):
        raise HTTPException(
            status_code=503,
            detail=f"Qloo API is unreachable: {e.operation}. Caliwo cannot provide recommendations.",
        )
    raise HTTPException(status_code=500, detail=str(e))


# ── Request / Response Models ────────────────────────────────────────────


class TasteOnboardingInput(BaseModel):
    favorite_restaurants: list[str] = []
    favorite_cuisines: list[str] = []
    food_influences: list[str] = []
    # Cross-domain signals (the hackathon differentiator)
    favorite_films: list[str] = []
    favorite_music: list[str] = []
    travel_destinations: list[str] = []


class TasteFeedbackInput(BaseModel):
    meal_title: str


class ToggleBlindModeInput(BaseModel):
    simulate_blind: bool


def _build_culturally_blind_recommendations(
    cal_remaining: float, pro_remaining: float, meal_type: str = "dinner"
) -> list[dict]:
    """Simulate generic culturally blind AI recommendations (without Qloo).
    Returns standard generic bro-diet fitness staples with 0% cultural fit and high abandonment risk.
    """
    dish_cal = 480.0
    dish_pro = max(40.0, pro_remaining if pro_remaining > 0 else 45.0)
    dish_fat = 6.0
    dish_carbs = round(max(30.0, (dish_cal - (dish_pro * 4.0) - (dish_fat * 9.0)) / 4.0), 1)

    return [
        {
            "name": "Plain Steamed Chicken Breast & Brown Rice",
            "dish_name": "Plain Steamed Chicken Breast & Brown Rice",
            "restaurant_anchor": "Generic Bro-Diet Staples",
            "qloo_entity_id": "",
            "cultural_alignment_score": 0,
            "macro_precision_score": 75.0,
            "bio_cultural_score": 0,
            "calories": round(dish_cal),
            "protein_g": round(dish_pro, 1),
            "carbs_g": round(dish_carbs, 1),
            "fat_g": round(dish_fat, 1),
            "fiber_g": 1.5,
            "magnesium_mg": 24.0,
            "cuisine_tags": ["Generic Bro-Diet", "Culturally Blind"],
            "menu_highlights": ["Boiled Chicken Breast", "Steamed Brown Rice", "Steamed Broccoli"],
            "key_ingredients": [
                "Skinless Chicken Breast",
                "Steamed Brown Rice",
                "Steamed Broccoli",
                "Pinch of Table Salt",
            ],
            "cultural_inspiration": (
                "Culturally blind generic diet recommendation. Completely disregards your identity, "
                "favorite films, music vibes, travel roots, and dining aesthetics."
            ),
            "macro_context": {
                "calories_budget": cal_remaining,
                "protein_target": pro_remaining,
                "magnesium_mg": 24.0,
                "calories_within_budget": True,
                "protein_gap_closed_percent": 100.0,
            },
            "qloo_source": False,
            "qloo_augmented": False,
            "blind_mode": True,
            "adherence_risk": "HIGH_ABANDONMENT_RISK",
            "abandonment_risk": "High (Culturally Alienating Meal Plan)",
            "warning_banner": "⚠️ High Abandonment Risk: Culturally Alienating Meal Plan",
        }
    ]


# ── Endpoints ────────────────────────────────────────────────────────────


@router.post("/onboarding")
async def taste_onboarding(
    inp: TasteOnboardingInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    """Build or update the user's Taste DNA via Qloo cross-domain entity resolution.
    Resolves restaurants, cuisines, films, music, travel → unified taste graph.
    REQUIRES Qloo — will 503 if unavailable.
    """
    try:
        taste_dna = await qloo_service.build_taste_dna(
            favorite_restaurants=inp.favorite_restaurants,
            favorite_cuisines=inp.favorite_cuisines,
            food_influences=inp.food_influences,
            favorite_films=inp.favorite_films,
            favorite_music=inp.favorite_music,
            travel_destinations=inp.travel_destinations,
        )

        # Merge with existing DNA if present
        existing = await taste_profile.get_taste_dna(user)
        if existing.get("entity_ids"):
            combined_ids = list(dict.fromkeys(
                existing["entity_ids"] + taste_dna["entity_ids"]
            ))
            taste_dna["entity_ids"] = combined_ids[-50:]  # keep last 50
            for tag_key in ("cuisine_affinities", "film_tags", "music_tags", "travel_tags", "cultural_tags"):
                taste_dna[tag_key] = list(dict.fromkeys(
                    existing.get(tag_key, []) + taste_dna.get(tag_key, [])
                ))
            # Merge entities_map
            merged_entities_map = dict(existing.get("entities_map", {}))
            merged_entities_map.update(taste_dna.get("entities_map", {}))
            taste_dna["entities_map"] = merged_entities_map
            # Merge cross domain signals and connected domain counts
            merged_signals = dict(existing.get("cross_domain_signals", {}))
            merged_signals.update(taste_dna.get("cross_domain_signals", {}))
            taste_dna["cross_domain_signals"] = merged_signals
            taste_dna["domains_connected"] = len(merged_signals)

        await taste_profile.save_taste_dna(session, user, taste_dna)

        return {
            "success": True,
            "taste_dna_summary": {
                "entity_count": len(taste_dna.get("entity_ids", [])),
                "entities_map": taste_dna.get("entities_map", {}),
                "cuisines": taste_dna.get("cuisine_affinities", []),
                "cultural_tags": taste_dna.get("cultural_tags", []),
                "film_tags": taste_dna.get("film_tags", []),
                "music_tags": taste_dna.get("music_tags", []),
                "travel_tags": taste_dna.get("travel_tags", []),
                "dining_matches": len(taste_dna.get("cross_domain_dining", [])),
                "domains_connected": taste_dna.get("domains_connected", 0),
            },
            "message": "Taste profile updated with Qloo cross-domain cultural intelligence.",
        }
    except (QlooNotConfiguredError, QlooAPIError) as e:
        _handle_qloo_error(e)
    except Exception as e:
        logger.error(f"Taste onboarding failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profile")
async def get_taste_profile(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    """Get the user's current Taste DNA and blind mode status.
    REQUIRES Qloo — will 503 if unavailable.
    """
    try:
        qloo_service._require_configured()
    except QlooNotConfiguredError as e:
        _handle_qloo_error(e)

    dna = await taste_profile.get_taste_dna(user)
    has_profile = bool(dna.get("entity_ids"))
    profile = user.profile if isinstance(user.profile, dict) else {}
    simulate_blind = bool(profile.get("simulate_blind", False))

    return {
        "has_taste_profile": has_profile,
        "taste_dna": dna,
        "entities_map": dna.get("entities_map", {}),
        "qloo_configured": True,
        "simulate_blind": simulate_blind,
    }


@router.get("/recommendations")
async def taste_recommendations(
    meal_type: str = "dinner",
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    simulate_blind: Optional[bool] = None,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    """Get taste-aligned meal recommendations from Qloo (or simulated culturally blind AI when active).
    Supports optional GPS location geofiltering (lat/lng) and simulate_blind toggle.
    """
    profile = user.profile if isinstance(user.profile, dict) else {}
    is_blind = (
        simulate_blind
        if simulate_blind is not None
        else bool(profile.get("simulate_blind", False))
    )

    dna = await taste_profile.get_taste_dna(user)
    has_taste = bool(dna.get("entity_ids"))

    # Get nutrition constraints
    gaps = await get_nutrition_gaps(session, user)
    cal_remaining = gaps.get("gaps", {}).get("calories", {}).get("remaining", 600)
    pro_remaining = gaps.get("gaps", {}).get("protein_g", {}).get("remaining", 30)

    # ── CULTURALLY BLIND AI MODE (THE SMOKING GUN DEMO) ──
    if is_blind:
        blind_meals = _build_culturally_blind_recommendations(
            float(cal_remaining), float(pro_remaining), meal_type
        )
        return {
            "taste_profile_active": False,
            "blind_mode": True,
            "bio_cultural_score": 0,
            "qloo_powered": False,
            "cuisine_affinities": ["Generic Bro-Diet"],
            "recommendations": blind_meals,
            "warning_banner": "⚠️ High Abandonment Risk: Culturally Alienating Meal Plan",
            "nutrition_context": {
                "calories_remaining": cal_remaining,
                "protein_remaining": pro_remaining,
                "meal_type": meal_type,
            },
            "note": (
                "⚠️ SIMULATED CULTURALLY BLIND AI (Qloo Bypassed): Without Qloo's cultural taste graph, "
                "nutrition AI defaults to bland bro-diet staples (0% cultural match, high user abandonment risk)."
            ),
        }

    nutrition_constraints = {
        "max_calories": cal_remaining,
        "min_protein_g": max(0, pro_remaining),
        "meal_type": meal_type,
    }

    location = {"lat": lat, "lng": lng} if (lat is not None and lng is not None) else None

    # Query Qloo for taste-aligned meals (MANDATORY)
    try:
        dna = await taste_profile.get_taste_dna(user)
        has_taste = bool(dna.get("entity_ids"))
        if has_taste:
            qloo_meals = await qloo_service.get_taste_aligned_meals(
                dna, nutrition_constraints, meal_type, limit=5, location=location
            )
        else:
            # Still validate Qloo is configured even without taste data
            qloo_service._require_configured()
            qloo_meals = []
    except (QlooNotConfiguredError, QlooAPIError) as e:
        _handle_qloo_error(e)

    avg_bio_score = (
        round(sum(m.get("bio_cultural_score", 92) for m in qloo_meals) / len(qloo_meals))
        if qloo_meals
        else 0
    )

    return {
        "taste_profile_active": has_taste,
        "blind_mode": False,
        "bio_cultural_score": avg_bio_score,
        "qloo_powered": bool(qloo_meals),
        "cuisine_affinities": dna.get("cuisine_affinities", []),
        "recommendations": qloo_meals,
        "nutrition_context": {
            "calories_remaining": cal_remaining,
            "protein_remaining": pro_remaining,
            "meal_type": meal_type,
        },
        "note": (
            "Recommendations ranked by cultural alignment score from Qloo taste graph."
            if qloo_meals
            else "Complete taste onboarding to get Qloo-powered personalized recommendations."
        ),
    }


@router.get("/discover")
async def discover_cultural_meals(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    simulate_blind: Optional[bool] = None,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    """Cross-domain cultural meal discovery via Qloo.
    Supports optional GPS location geofiltering (lat/lng) and simulate_blind toggle.
    REQUIRES Qloo — will 503 if unavailable.
    """
    profile = user.profile if isinstance(user.profile, dict) else {}
    is_blind = (
        simulate_blind
        if simulate_blind is not None
        else bool(profile.get("simulate_blind", False))
    )

    if is_blind:
        return {
            "qloo_powered": False,
            "blind_mode": True,
            "discoveries": [
                {
                    "name": "Plain Boiled Chicken & Rice",
                    "score": 0.0,
                    "qloo_entity_id": "",
                    "menu_highlights": ["Boiled Chicken Breast", "Brown Rice"],
                    "cuisine_tags": ["Bro-Diet"],
                }
            ],
            "cultural_tags": [],
            "warning_banner": "⚠️ High Abandonment Risk: Culturally Alienating Meal Plan",
            "cross_domain_note": (
                "⚠️ Culturally blind mode active: Cross-domain cultural connections disabled. "
                "Disregards user music, cinema, and dining identity."
            ),
        }

    dna = await taste_profile.get_taste_dna(user)
    entity_ids = dna.get("entity_ids", [])
    location = {"lat": lat, "lng": lng} if (lat is not None and lng is not None) else None

    try:
        if entity_ids:
            insights = await qloo_service.get_insights(
                entity_ids[:10], "restaurant", limit=8, location=location
            )
            discoveries = [
                {
                    "name": i.get("name", ""),
                    "score": i.get("score", 0),
                    "qloo_entity_id": i.get("id", ""),
                    "menu_highlights": i.get("menu_highlights", [])[:3],
                    "cuisine_tags": i.get("cuisine_tags", [])[:3],
                }
                for i in insights
            ]
        else:
            qloo_service._require_configured()
            # If user has not yet onboarded, provide starter cross-domain discoveries
            starter_seed = (
                ["57E97B92-9552-452D-A5EC-6B098C879918"]
                if not qloo_service.is_mock_mode()
                else ["urn:entity:concept:finedining-001"]
            )
            insights = await qloo_service.get_insights(starter_seed, "restaurant", limit=6)
            discoveries = [
                {
                    "name": i.get("name", ""),
                    "score": i.get("score", 0),
                    "qloo_entity_id": i.get("id", ""),
                    "menu_highlights": i.get("menu_highlights", [])[:3],
                    "cuisine_tags": i.get("cuisine_tags", [])[:3],
                }
                for i in insights
            ]
    except (QlooNotConfiguredError, QlooAPIError) as e:
        _handle_qloo_error(e)

    return {
        "qloo_powered": bool(discoveries),
        "blind_mode": False,
        "discoveries": discoveries,
        "cultural_tags": dna.get("cultural_tags", []),
        "cross_domain_note": (
            "These discoveries are based on cross-domain cultural connections "
            "from Qloo's taste graph — connecting your preferences across "
            "music, dining, entertainment, and lifestyle."
        ),
    }


@router.post("/toggle-blind")
async def toggle_blind_mode(
    inp: ToggleBlindModeInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    """Toggle Culturally Blind AI simulation on or off for the user.
    When ON (simulate_blind=true):
      • Bypasses Qloo Cultural Taste graph
      • Returns generic bro-diet staples (Plain Chicken & Rice)
      • Bio-Cultural score drops to 0%
      • Warning banner: ⚠️ High Abandonment Risk: Culturally Alienating Meal Plan
    When OFF (simulate_blind=false):
      • Re-enables Qloo Cultural Intelligence
      • Restores 96% Bio-Cultural score with cross-domain inspirations
    """
    from sqlalchemy.orm.attributes import flag_modified
    profile = dict(user.profile) if user.profile else {}
    profile["simulate_blind"] = inp.simulate_blind
    user.profile = profile
    flag_modified(user, "profile")
    await session.commit()

    from cache import cache_invalidate
    await cache_invalidate("profile", str(user.id))
    await cache_invalidate("dashboard", str(user.id))
    await cache_invalidate("coach_suggestions", str(user.id))

    return {
        "status": "ok",
        "success": True,
        "simulate_blind": inp.simulate_blind,
        "message": (
            "Culturally Blind AI Mode Activated: Qloo graph bypassed, 0% cultural fit, high abandonment risk."
            if inp.simulate_blind
            else "Caliwo + Qloo Cultural AI Activated: 96% bio-cultural alignment restored."
        ),
    }


@router.post("/feedback")
async def taste_feedback(
    inp: TasteFeedbackInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    """Update taste DNA when a user logs a meal (feedback loop).
    REQUIRES Qloo — will 503 if unavailable.
    """
    dna = await taste_profile.get_taste_dna(user)
    if not dna.get("entity_ids"):
        raise HTTPException(
            status_code=400,
            detail="No taste profile yet. Complete taste onboarding first.",
        )

    try:
        updated_dna = await qloo_service.update_taste_from_meal(dna, inp.meal_title)
        await taste_profile.save_taste_dna(session, user, updated_dna)
        return {
            "updated": True,
            "entity_count": len(updated_dna.get("entity_ids", [])),
        }
    except (QlooNotConfiguredError, QlooAPIError) as e:
        _handle_qloo_error(e)
    except Exception as e:
        logger.warning(f"Taste feedback update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_taste_entities(
    q: str,
    entity_type: str = "",
    limit: int = 5,
    user: User = Depends(current_user),
):
    """Search Qloo entities across dining, movies, music, destinations.
    Works seamlessly with mock layer or live Qloo API.
    """
    try:
        results = await qloo_service.search_entities(q, entity_type=entity_type, limit=limit)
        return {"results": results, "count": len(results)}
    except (QlooNotConfiguredError, QlooAPIError) as e:
        _handle_qloo_error(e)
    except Exception as e:
        logger.warning(f"Taste entity search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class SwitchPersonaInput(BaseModel):
    persona_id: str


@router.post("/persona")
async def switch_taste_persona(
    inp: SwitchPersonaInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    """Switch user to one of the 3 judge demonstration personas (Alex 🍣, Elena 🍋, Marcus 🌮).
    Instantly rewires the user's Qloo Taste DNA, daily biometrics, and coach context.
    """
    from services.demo_service import switch_persona
    return await switch_persona(user, inp.persona_id, session)


@router.get("/personas")
async def list_taste_personas():
    """List available judge demonstration personas."""
    from services.demo_service import DEMO_PERSONAS
    return {
        "personas": [
            {
                "id": p["id"],
                "name": p["name"],
                "avatar": p["avatar"],
                "tagline": p["tagline"],
                "cuisines": p["cuisines"],
                "daily_calories": p["daily_calories"],
                "daily_protein_g": p["daily_protein_g"],
                "domains_connected": p["taste_dna"]["domains_connected"],
            }
            for p in DEMO_PERSONAS.values()
        ]
    }
