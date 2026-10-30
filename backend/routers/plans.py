"""
Meal Plans, Recipes & AI-Powered Plan Generation Router.
Connects to OpenAI GPT-4o for intelligent plan/recipe generation
with deterministic fallback data when API keys are unavailable.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from sqlalchemy.orm.attributes import flag_modified

from database import get_db
from models import User, Meal
from routers.auth import current_user
from routers.meals import sync_daily_summary, _evolve_taste_from_meal_bg
from services import taste_profile

logger = logging.getLogger(__name__)

router = APIRouter(tags=["plans"])


class Recipe(BaseModel):
    recipe_id: str
    title: str
    description: str
    servings: int
    prep_minutes: int
    cook_minutes: int
    ingredients: List[str]
    steps: List[str]
    calories_per_serving: float
    protein_g_per_serving: float
    cultural_inspiration: Optional[str] = None
    bio_cultural_score: Optional[int] = None


class PlannedMeal(BaseModel):
    slot: str
    name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    ingredients: List[str]
    cuisine: Optional[str] = None
    cultural_inspiration: Optional[str] = None
    bio_cultural_score: Optional[int] = None
    fiber_g: Optional[float] = None
    sugar_g: Optional[float] = None
    sodium_mg: Optional[float] = None
    magnesium_mg: Optional[float] = None


class DayPlan(BaseModel):
    day: int
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    meals: List[PlannedMeal]


class MealPlan(BaseModel):
    plan_id: str
    generated_at: str
    days: List[DayPlan]


class MealPlanGenerateInput(BaseModel):
    days: int = 7
    focus: Optional[str] = None


class RecipeGenerateInput(BaseModel):
    prompt: str
    meal_type: str = "dinner"
    servings: int = 2


# ── Fallback Data (used when OpenAI API key is not configured) ───────────

_FALLBACK_MEALS: dict[str, list[dict]] = {
    "breakfast": [
        {"name": "Protein Oats & Berries", "calories": 500, "protein_g": 30, "carbs_g": 70, "fat_g": 10, "ingredients": ["Oats", "Whey Protein", "Blueberries", "Banana", "Honey"]},
        {"name": "Greek Yogurt Granola Bowl", "calories": 420, "protein_g": 28, "carbs_g": 55, "fat_g": 12, "ingredients": ["Greek Yogurt", "Granola", "Almonds", "Strawberries", "Chia Seeds"]},
        {"name": "Egg White Veggie Omelette", "calories": 380, "protein_g": 35, "carbs_g": 20, "fat_g": 15, "ingredients": ["Egg Whites", "Spinach", "Bell Pepper", "Mushrooms", "Feta Cheese"]},
        {"name": "Avocado Toast with Poached Eggs", "calories": 450, "protein_g": 22, "carbs_g": 40, "fat_g": 24, "ingredients": ["Whole Grain Bread", "Avocado", "Eggs", "Cherry Tomatoes", "Everything Seasoning"]},
        {"name": "Banana Protein Smoothie", "calories": 350, "protein_g": 32, "carbs_g": 45, "fat_g": 8, "ingredients": ["Banana", "Whey Protein", "Almond Milk", "Peanut Butter", "Ice"]},
    ],
    "lunch": [
        {"name": "Grilled Chicken Salad Bowl", "calories": 600, "protein_g": 50, "carbs_g": 40, "fat_g": 20, "ingredients": ["Chicken Breast", "Mixed Greens", "Quinoa", "Olive Oil", "Lemon"]},
        {"name": "Turkey & Hummus Wrap", "calories": 520, "protein_g": 38, "carbs_g": 55, "fat_g": 16, "ingredients": ["Turkey Breast", "Whole Wheat Tortilla", "Hummus", "Cucumber", "Tomato"]},
        {"name": "Tuna Poke Bowl", "calories": 580, "protein_g": 42, "carbs_g": 62, "fat_g": 14, "ingredients": ["Sushi-Grade Tuna", "Brown Rice", "Edamame", "Avocado", "Soy Sauce"]},
        {"name": "Mediterranean Chickpea Bowl", "calories": 550, "protein_g": 28, "carbs_g": 65, "fat_g": 20, "ingredients": ["Chickpeas", "Feta Cheese", "Cucumber", "Cherry Tomatoes", "Olive Oil"]},
        {"name": "Steak & Sweet Potato Bowl", "calories": 650, "protein_g": 45, "carbs_g": 55, "fat_g": 22, "ingredients": ["Lean Sirloin", "Sweet Potato", "Broccoli", "Brown Rice", "Teriyaki Sauce"]},
    ],
    "dinner": [
        {"name": "Salmon with Roasted Sweet Potato", "calories": 700, "protein_g": 55, "carbs_g": 60, "fat_g": 25, "ingredients": ["Salmon Fillet", "Sweet Potato", "Broccoli", "Olive Oil", "Lemon"]},
        {"name": "Lean Beef Stir-Fry", "calories": 620, "protein_g": 48, "carbs_g": 50, "fat_g": 22, "ingredients": ["Lean Beef Strips", "Bell Peppers", "Snap Peas", "Brown Rice", "Ginger"]},
        {"name": "Herb-Crusted Chicken Breast", "calories": 580, "protein_g": 52, "carbs_g": 35, "fat_g": 22, "ingredients": ["Chicken Breast", "Fresh Herbs", "Roasted Vegetables", "Quinoa", "Garlic"]},
        {"name": "Shrimp & Vegetable Curry", "calories": 540, "protein_g": 38, "carbs_g": 55, "fat_g": 18, "ingredients": ["Shrimp", "Coconut Milk", "Curry Paste", "Brown Rice", "Mixed Vegetables"]},
        {"name": "Baked Cod with Asparagus", "calories": 480, "protein_g": 45, "carbs_g": 30, "fat_g": 18, "ingredients": ["Cod Fillet", "Asparagus", "Cherry Tomatoes", "Olive Oil", "Dill"]},
    ],
}


def _calculate_bio_cultural_alignment(
    meal_name: str,
    cuisine: str,
    inspiration: str,
    calories: float,
    protein_g: float,
    slot_target_cal: float,
    slot_target_pro: float,
    taste_dna: Optional[dict] = None,
) -> int:
    """Compute verified Bio-Cultural Alignment Score (60% Qloo Cultural Taste + 40% Macro Precision)."""
    target_cal = max(200.0, slot_target_cal)
    target_pro = max(15.0, slot_target_pro)

    cal_diff = abs(target_cal - calories)
    cal_score = max(50.0, 100.0 - (cal_diff / target_cal * 50.0))
    pro_ratio = min(1.25, protein_g / target_pro)
    pro_score = min(100.0, pro_ratio * 100.0)
    macro_precision = min(100.0, (cal_score * 0.5) + (pro_score * 0.5))

    cuisines = [str(t) for t in (taste_dna.get("cuisine_affinities") or []) if t] if isinstance(taste_dna, dict) else []
    cultural_tags = [str(t) for t in (taste_dna.get("cultural_tags") or []) if t] if isinstance(taste_dna, dict) else []
    film_music_tags = (
        [str(t) for t in ((taste_dna.get("film_tags") or []) + (taste_dna.get("music_tags") or [])) if t]
        if isinstance(taste_dna, dict)
        else []
    )

    tags_pool = set(t.lower() for t in (cuisines + cultural_tags + film_music_tags))
    dish_tokens = set(f"{meal_name} {cuisine} {inspiration}".lower().split())
    overlap = tags_pool & dish_tokens

    cultural_affinity = min(99.0, max(84.0, 88.0 + (len(overlap) * 3.5)))
    return taste_profile.compute_alignment_score(cultural_affinity, macro_precision)


async def _build_fallback_day(
    day_num: int,
    cal_goal: float,
    protein_goal: float,
    taste_dna: Optional[dict] = None,
    qloo_pool: Optional[dict[str, list[dict]]] = None,
) -> DayPlan:
    """Build a varied fallback day plan using real Qloo taste-aligned meals, with deterministic fallback."""
    import random
    rng = random.Random(day_num * 31)  # deterministic per day number

    try:
        cal_goal = float(cal_goal)
    except (ValueError, TypeError):
        cal_goal = 2000.0

    try:
        protein_goal = float(protein_goal)
    except (ValueError, TypeError):
        protein_goal = 140.0

    slot_targets = {
        "breakfast": (cal_goal * 0.25, protein_goal * 0.25),
        "lunch": (cal_goal * 0.35, protein_goal * 0.35),
        "dinner": (cal_goal * 0.40, protein_goal * 0.40),
    }

    cuisines = [str(c) for c in (taste_dna.get("cuisine_affinities") or []) if c] if isinstance(taste_dna, dict) else []
    primary_c = cuisines[0] if cuisines else "Artisan"
    film_or_music = (
        [str(t) for t in ((taste_dna.get("film_tags") or []) + (taste_dna.get("music_tags") or [])) if t]
        if isinstance(taste_dna, dict)
        else []
    )
    anchor_str = film_or_music[0] if film_or_music else primary_c

    pool = qloo_pool
    if pool is None and taste_dna and isinstance(taste_dna, dict) and taste_dna.get("entity_ids"):
        try:
            from services import qloo_service
            d_recs = await qloo_service.get_taste_aligned_meals(
                taste_dna=taste_dna,
                nutrition_constraints={"max_calories": slot_targets["dinner"][0], "min_protein_g": slot_targets["dinner"][1]},
                meal_type="dinner",
                limit=5,
            )
            l_recs = await qloo_service.get_taste_aligned_meals(
                taste_dna=taste_dna,
                nutrition_constraints={"max_calories": slot_targets["lunch"][0], "min_protein_g": slot_targets["lunch"][1]},
                meal_type="lunch",
                limit=5,
            )
            b_recs = await qloo_service.get_taste_aligned_meals(
                taste_dna=taste_dna,
                nutrition_constraints={"max_calories": slot_targets["breakfast"][0], "min_protein_g": slot_targets["breakfast"][1]},
                meal_type="breakfast",
                limit=5,
            )
            pool = {"dinner": d_recs, "lunch": l_recs, "breakfast": b_recs}
        except Exception as e:
            logger.warning("Failed to query Qloo for fallback day dishes: %s", e)
            pool = None

    meals: list[PlannedMeal] = []

    # 1. Breakfast
    b_targets = slot_targets["breakfast"]
    b_pool = (pool.get("breakfast") or []) if isinstance(pool, dict) else []
    b_item = b_pool[(day_num - 1) % len(b_pool)] if b_pool else None
    if b_item:
        b_cuisine = (b_item.get("cuisine_tags") or ["Healthy Morning"])[0] if (b_item.get("cuisine_tags") and isinstance(b_item.get("cuisine_tags"), list)) else "Healthy Morning"
        b_pro = float(b_item.get("protein_g") or b_targets[1])
        meals.append(
            PlannedMeal(
                slot="breakfast",
                name=str(b_item.get("dish_name") or b_item.get("name") or "Gourmet Breakfast"),
                calories=float(b_item.get("calories") or b_targets[0]),
                protein_g=b_pro,
                carbs_g=float(b_item.get("carbs_g") or 45.0),
                fat_g=float(b_item.get("fat_g") or 12.0),
                fiber_g=float(b_item.get("fiber_g") or 6.0),
                sugar_g=float(b_item.get("sugar_g") or 5.0),
                sodium_mg=float(b_item.get("sodium_mg") or 300.0),
                magnesium_mg=float(b_item.get("magnesium_mg") or round(max(30.0, b_pro * 1.5), 1)),
                ingredients=list(b_item.get("key_ingredients") or ["Whole Grain Base", "Fresh Berries", "Greek Yogurt"]),
                cuisine=b_cuisine,
                cultural_inspiration=str(b_item.get("cultural_inspiration") or f"Calibrated for high-energy morning focus inspired by your {primary_c} palate."),
                bio_cultural_score=int(b_item.get("bio_cultural_score") or 92),
            )
        )
    else:
        b = dict(rng.choice(_FALLBACK_MEALS["breakfast"]))
        b_score = _calculate_bio_cultural_alignment(
            b.get("name", "Breakfast"), "Healthy Morning", "Morning focus",
            float(b.get("calories", 400)), float(b.get("protein_g", 25)),
            b_targets[0], b_targets[1], taste_dna
        )
        b_pro = float(b.get("protein_g", 25))
        meals.append(
            PlannedMeal(
                slot="breakfast",
                cuisine="Healthy Morning",
                cultural_inspiration=f"Calibrated for high-energy morning focus inspired by your {primary_c} palate.",
                bio_cultural_score=b_score,
                fiber_g=6.0,
                sugar_g=5.0,
                sodium_mg=280.0,
                magnesium_mg=round(max(30.0, b_pro * 1.5), 1),
                **b,
            )
        )

    # 2. Lunch
    l_targets = slot_targets["lunch"]
    l_pool = (pool.get("lunch") or []) if isinstance(pool, dict) else []
    l_item = l_pool[(day_num - 1) % len(l_pool)] if l_pool else None
    if l_item:
        l_cuisine = (l_item.get("cuisine_tags") or [primary_c])[0] if (l_item.get("cuisine_tags") and isinstance(l_item.get("cuisine_tags"), list)) else primary_c
        l_pro = float(l_item.get("protein_g") or l_targets[1])
        meals.append(
            PlannedMeal(
                slot="lunch",
                name=str(l_item.get("dish_name") or l_item.get("name") or f"{l_cuisine} Midday Plate"),
                calories=float(l_item.get("calories") or l_targets[0]),
                protein_g=l_pro,
                carbs_g=float(l_item.get("carbs_g") or 50.0),
                fat_g=float(l_item.get("fat_g") or 18.0),
                fiber_g=float(l_item.get("fiber_g") or 7.0),
                sugar_g=float(l_item.get("sugar_g") or 4.0),
                sodium_mg=float(l_item.get("sodium_mg") or 450.0),
                magnesium_mg=float(l_item.get("magnesium_mg") or round(max(35.0, l_pro * 1.6), 1)),
                ingredients=list(l_item.get("key_ingredients") or ["Market Protein", "Wild Greens", "Ancient Grain Base"]),
                cuisine=l_cuisine,
                cultural_inspiration=str(l_item.get("cultural_inspiration") or f"Curated {primary_c} midday balance bridging your cultural affinities with macro goals."),
                bio_cultural_score=int(l_item.get("bio_cultural_score") or 94),
            )
        )
    else:
        l = dict(rng.choice(_FALLBACK_MEALS["lunch"]))
        l_score = _calculate_bio_cultural_alignment(
            l.get("name", "Lunch"), primary_c, "Midday balance",
            float(l.get("calories", 550)), float(l.get("protein_g", 35)),
            l_targets[0], l_targets[1], taste_dna
        )
        l_pro = float(l.get("protein_g", 35))
        meals.append(
            PlannedMeal(
                slot="lunch",
                cuisine=primary_c,
                cultural_inspiration=f"Curated {primary_c} midday balance bridging your cultural affinities with macro goals.",
                bio_cultural_score=l_score,
                fiber_g=7.0,
                sugar_g=4.0,
                sodium_mg=450.0,
                magnesium_mg=round(max(35.0, l_pro * 1.6), 1),
                **l,
            )
        )

    # 3. Dinner
    d_targets = slot_targets["dinner"]
    d_pool = (pool.get("dinner") or []) if isinstance(pool, dict) else []
    d_item = d_pool[(day_num - 1) % len(d_pool)] if d_pool else None
    if d_item:
        d_cuisine = (d_item.get("cuisine_tags") or [primary_c])[0] if (d_item.get("cuisine_tags") and isinstance(d_item.get("cuisine_tags"), list)) else primary_c
        d_pro = float(d_item.get("protein_g") or d_targets[1])
        meals.append(
            PlannedMeal(
                slot="dinner",
                name=str(d_item.get("dish_name") or d_item.get("name") or f"{d_cuisine} Culinary Anchor"),
                calories=float(d_item.get("calories") or d_targets[0]),
                protein_g=d_pro,
                carbs_g=float(d_item.get("carbs_g") or 45.0),
                fat_g=float(d_item.get("fat_g") or 20.0),
                fiber_g=float(d_item.get("fiber_g") or 8.0),
                sugar_g=float(d_item.get("sugar_g") or 3.0),
                sodium_mg=float(d_item.get("sodium_mg") or 420.0),
                magnesium_mg=float(d_item.get("magnesium_mg") or round(max(40.0, d_pro * 1.8), 1)),
                ingredients=list(d_item.get("key_ingredients") or ["Wild Protein", "Charred Broccolini", "Herbed Glaze"]),
                cuisine=d_cuisine,
                cultural_inspiration=str(d_item.get("cultural_inspiration") or f"Evening culinary anchor influenced by your appreciation for {anchor_str}."),
                bio_cultural_score=int(d_item.get("bio_cultural_score") or 95),
            )
        )
    else:
        d = dict(rng.choice(_FALLBACK_MEALS["dinner"]))
        d_score = _calculate_bio_cultural_alignment(
            d.get("name", "Dinner"), primary_c, f"Evening anchor: {anchor_str}",
            float(d.get("calories", 650)), float(d.get("protein_g", 45)),
            d_targets[0], d_targets[1], taste_dna
        )
        d_pro = float(d.get("protein_g", 45))
        meals.append(
            PlannedMeal(
                slot="dinner",
                cuisine=primary_c,
                cultural_inspiration=f"Evening culinary anchor influenced by your appreciation for {anchor_str}.",
                bio_cultural_score=d_score,
                fiber_g=8.0,
                sugar_g=3.0,
                sodium_mg=420.0,
                magnesium_mg=round(max(40.0, d_pro * 1.8), 1),
                **d,
            )
        )

    total_cal = sum(m.calories for m in meals)
    total_pro = sum(m.protein_g for m in meals)
    total_car = sum(m.carbs_g for m in meals)
    total_fat = sum(m.fat_g for m in meals)

    return DayPlan(
        day=day_num,
        total_calories=round(total_cal, 1),
        total_protein_g=round(total_pro, 1),
        total_carbs_g=round(total_car, 1),
        total_fat_g=round(total_fat, 1),
        meals=meals,
    )



async def _build_fallback_days(
    num_days: int,
    cal_goal: float,
    protein_goal: float,
    taste_dna: Optional[dict] = None,
) -> List[DayPlan]:
    """Pre-fetch Qloo taste-aligned meals pool once, then construct each day with authentic dishes."""
    try:
        cal_goal = float(cal_goal)
    except (ValueError, TypeError):
        cal_goal = 2000.0

    try:
        protein_goal = float(protein_goal)
    except (ValueError, TypeError):
        protein_goal = 140.0

    qloo_pool: dict[str, list[dict]] = {"dinner": [], "lunch": [], "breakfast": []}
    if taste_dna and taste_dna.get("entity_ids"):
        try:
            from services import qloo_service
            d_recs = await qloo_service.get_taste_aligned_meals(
                taste_dna=taste_dna,
                nutrition_constraints={"max_calories": cal_goal * 0.40, "min_protein_g": protein_goal * 0.35},
                meal_type="dinner",
                limit=max(8, num_days * 2),
            )
            l_recs = await qloo_service.get_taste_aligned_meals(
                taste_dna=taste_dna,
                nutrition_constraints={"max_calories": cal_goal * 0.35, "min_protein_g": protein_goal * 0.30},
                meal_type="lunch",
                limit=max(8, num_days * 2),
            )
            b_recs = await qloo_service.get_taste_aligned_meals(
                taste_dna=taste_dna,
                nutrition_constraints={"max_calories": cal_goal * 0.25, "min_protein_g": protein_goal * 0.25},
                meal_type="breakfast",
                limit=max(8, num_days * 2),
            )
            qloo_pool = {"dinner": d_recs, "lunch": l_recs, "breakfast": b_recs}
        except Exception as e:
            logger.warning("Failed to query Qloo batch pool for fallback days: %s", e)

    return [
        await _build_fallback_day(d, cal_goal, protein_goal, taste_dna, qloo_pool)
        for d in range(1, num_days + 1)
    ]


def _has_openai_key() -> bool:
    key = os.environ.get("OPENAI_API_KEY", "").strip("\"' \t\r\n")
    return bool(key and not key.startswith("sk-proj-YOUR") and not key.startswith("dummy"))


async def _ai_generate_meal_plan(
    num_days: int,
    profile: dict,
    focus: Optional[str] = None,
    taste_dna: Optional[dict] = None,
) -> List[DayPlan]:
    """Generate meal plan using OpenAI GPT-4o grounded in Qloo Cultural Taste DNA."""
    from ai_client import get_openai_client

    client = get_openai_client()

    goals_data = profile.get("goals") if isinstance(profile.get("goals"), dict) else {}
    cal_goal = int(goals_data.get("calories") or profile.get("daily_calories") or 2000)
    protein_goal = int(goals_data.get("protein_g") or goals_data.get("protein") or profile.get("daily_protein_g") or 150)
    dietary = profile.get("dietary_preferences", "none")

    cuisines = [str(t) for t in (taste_dna.get("cuisine_affinities") or []) if t] if isinstance(taste_dna, dict) else []
    cultural_tags = [str(t) for t in (taste_dna.get("cultural_tags") or []) if t] if isinstance(taste_dna, dict) else []
    film_tags = [str(t) for t in (taste_dna.get("film_tags") or []) if t] if isinstance(taste_dna, dict) else []
    music_tags = [str(t) for t in (taste_dna.get("music_tags") or []) if t] if isinstance(taste_dna, dict) else []
    dining_recs = [d for d in (taste_dna.get("cross_domain_dining") or []) if isinstance(d, dict)] if isinstance(taste_dna, dict) else []

    cultural_context = ""
    if cuisines or cultural_tags or film_tags or music_tags:
        cultural_context = (
            f"\n\nQLOO CULTURAL TASTE GRAPH CONTEXT:\n"
            f"- Preferred Cuisines: {', '.join(cuisines) if cuisines else 'Artisan & Mediterranean'}\n"
            f"- Cultural Anchors & Influences: {', '.join(cultural_tags[:6])}\n"
            f"- Film & Cinema Aesthetics: {', '.join(film_tags[:3]) if film_tags else 'N/A'}\n"
            f"- Music Taste: {', '.join(music_tags[:3]) if music_tags else 'N/A'}\n"
            f"- Dining Style Anchors: {', '.join([d.get('name', '') for d in dining_recs[:3] if d.get('name')]) if dining_recs else 'Gourmet'}\n"
            "CULTURAL ATTUNEMENT MANDATE: Every meal MUST be authentic to the user's cultural palate and cross-domain taste graph. "
            "Never generate culturally vacant or bland fitness food (e.g. avoid plain boiled chicken breast and brown rice). "
            "Connect dinner choices directly to their cinema, travel, or music aesthetic when possible."
        )

    # Ground plan in live Qloo recommendations across all meal slots (Dinner, Lunch, Breakfast)
    qloo_grounding_context = ""
    if taste_dna and isinstance(taste_dna, dict) and taste_dna.get("entity_ids"):
        try:
            from services import qloo_service
            # Concurrently pre-fetch culturally-aligned dishes for all 3 meal slots
            d_task = qloo_service.get_taste_aligned_meals(
                taste_dna=taste_dna,
                nutrition_constraints={"max_calories": cal_goal * 0.40, "min_protein_g": protein_goal * 0.35},
                meal_type="dinner",
                limit=num_days,
            )
            l_task = qloo_service.get_taste_aligned_meals(
                taste_dna=taste_dna,
                nutrition_constraints={"max_calories": cal_goal * 0.35, "min_protein_g": protein_goal * 0.35},
                meal_type="lunch",
                limit=min(5, num_days),
            )
            b_task = qloo_service.get_taste_aligned_meals(
                taste_dna=taste_dna,
                nutrition_constraints={"max_calories": cal_goal * 0.25, "min_protein_g": protein_goal * 0.25},
                meal_type="breakfast",
                limit=min(4, num_days),
            )
            d_recs, l_recs, b_recs = await asyncio.gather(d_task, l_task, b_task, return_exceptions=True)

            grounding_lines = []
            if isinstance(d_recs, list) and d_recs:
                grounding_lines.append("AUTHENTIC DINNER DISHES FROM QLOO:")
                for d in d_recs:
                    d_name = d.get("dish_name") or d.get("name") or "Authentic Dinner"
                    d_anchor = d.get("restaurant_anchor") or "Gourmet Kitchen"
                    d_insp = d.get("cultural_inspiration") or "Authentic flavor profile"
                    grounding_lines.append(f"- '{d_name}' ({d_anchor}): {d_insp}")
            if isinstance(l_recs, list) and l_recs:
                grounding_lines.append("\nAUTHENTIC LUNCH DISHES FROM QLOO:")
                for l in l_recs:
                    l_name = l.get("dish_name") or l.get("name") or "Authentic Lunch"
                    l_anchor = l.get("restaurant_anchor") or "Gourmet Kitchen"
                    l_insp = l.get("cultural_inspiration") or "Midday cultural balance"
                    grounding_lines.append(f"- '{l_name}' ({l_anchor}): {l_insp}")
            if isinstance(b_recs, list) and b_recs:
                grounding_lines.append("\nAUTHENTIC BREAKFAST DISHES FROM QLOO:")
                for b in b_recs:
                    b_name = b.get("dish_name") or b.get("name") or "Authentic Breakfast"
                    b_anchor = b.get("restaurant_anchor") or "Gourmet Kitchen"
                    b_insp = b.get("cultural_inspiration") or "Morning energy focus"
                    grounding_lines.append(f"- '{b_name}' ({b_anchor}): {b_insp}")

            if grounding_lines:
                qloo_grounding_context = (
                    f"\n\nAUTHENTIC DISHES GROUNDED DIRECTLY IN USER'S QLOO TASTE GRAPH:\n"
                    f"You MUST weave these authentic dishes retrieved from Qloo across all meals (breakfast, lunch, and dinner) throughout the {num_days}-day plan:\n"
                    + "\n".join(grounding_lines) + "\n"
                )
        except Exception as e:
            logger.warning(f"Failed to fetch live Qloo dishes for plan grounding: {e}")

    system_prompt = (
        "You are an elite nutritionist and executive chef powered by Qloo Cultural Taste AI. "
        "Generate a detailed, culturally-attuned meal plan as JSON. "
        "Each day has breakfast, lunch, and dinner. For each meal include: "
        "name, slot, calories, protein_g, carbs_g, fat_g, ingredients (list of strings), "
        "cuisine (string), cultural_inspiration (1 sentence explaining cultural origin & taste aesthetic). "
        f"Target: ~{cal_goal} cal/day, ~{protein_goal}g protein/day. "
        f"Dietary preferences: {dietary}. "
        f"{'Focus: ' + focus if focus else ''}"
        f"{cultural_context}"
        f"{qloo_grounding_context}\n"
        "Return a JSON object with a key 'days' containing an array of day objects: "
        "{\"days\": [{\"day\": 1, \"total_calories\": 2000, \"total_protein_g\": 150, \"total_carbs_g\": 200, \"total_fat_g\": 60, "
        "\"meals\": [{\"slot\": \"breakfast\", \"name\": \"...\", \"cuisine\": \"...\", \"cultural_inspiration\": \"...\", \"calories\": 500, \"protein_g\": 40, \"carbs_g\": 50, \"fat_g\": 15, \"ingredients\": [\"...\"]}]}]}"
        "\nDo NOT output anything other than JSON."
    )

    try:
        resp = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Generate a {num_days}-day culturally-aligned meal plan."},
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=4000,
        )

        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)
        days_data = data.get("days") or data.get("meal_plan") or data.get("plan") or []
        if isinstance(data, list):
            days_data = data

        if not isinstance(days_data, list) or len(days_data) == 0:
            raise ValueError("AI returned empty days list")

        slot_ratios = {"breakfast": 0.25, "lunch": 0.35, "dinner": 0.40}
        days_list: List[DayPlan] = []
        for dd in days_data[:num_days]:
            meals_raw = dd.get("meals", []) if isinstance(dd, dict) else []
            meals = []
            for m in meals_raw:
                if not isinstance(m, dict):
                    continue
                slot_key = str(m.get("slot") or "dinner").lower()
                ratio = slot_ratios.get(slot_key, 0.33)
                cal_target = cal_goal * ratio
                pro_target = protein_goal * ratio

                cal_val = float(m.get("calories") or 500.0)
                pro_val = float(m.get("protein_g") or 30.0)
                dish_name = str(m.get("name") or "Meal")
                cuisine_val = str(m.get("cuisine") or (cuisines[0] if cuisines else "Artisan"))
                insp_val = str(m.get("cultural_inspiration") or "Crafted with Qloo Cultural Taste AI.")

                computed_score = _calculate_bio_cultural_alignment(
                    dish_name, cuisine_val, insp_val,
                    cal_val, pro_val,
                    cal_target, pro_target, taste_dna
                )

                meals.append(
                    PlannedMeal(
                        slot=str(m.get("slot") or "meal"),
                        name=dish_name,
                        calories=cal_val,
                        protein_g=pro_val,
                        carbs_g=float(m.get("carbs_g") or 50.0),
                        fat_g=float(m.get("fat_g") or 15.0),
                        fiber_g=float(m.get("fiber_g") or 5.0),
                        sugar_g=float(m.get("sugar_g") or 4.0),
                        sodium_mg=float(m.get("sodium_mg") or 350.0),
                        magnesium_mg=float(m.get("magnesium_mg") or round(max(30.0, pro_val * 1.5), 1)),
                        ingredients=list(m.get("ingredients") or []),
                        cuisine=cuisine_val,
                        cultural_inspiration=insp_val,
                        bio_cultural_score=computed_score,
                    )
                )
            days_list.append(
                DayPlan(
                    day=int(dd.get("day") or (len(days_list) + 1)),
                    total_calories=float(dd.get("total_calories") or sum(m.calories for m in meals)),
                    total_protein_g=float(dd.get("total_protein_g") or sum(m.protein_g for m in meals)),
                    total_carbs_g=float(dd.get("total_carbs_g") or sum(m.carbs_g for m in meals)),
                    total_fat_g=float(dd.get("total_fat_g") or sum(m.fat_g for m in meals)),
                    meals=meals,
                )
            )
        return days_list

    except Exception as e:
        logger.warning(f"AI meal plan generation failed, using fallback: {e}")
        return await _build_fallback_days(num_days, cal_goal, protein_goal, taste_dna)


async def _ai_generate_recipe(
    prompt: str,
    meal_type: str,
    servings: int,
    profile: dict,
    taste_dna: Optional[dict] = None,
) -> Recipe:
    """Generate recipe using OpenAI GPT-4o grounded in Qloo Taste DNA."""
    from ai_client import get_openai_client

    client = get_openai_client()

    cuisines = [str(t) for t in (taste_dna.get("cuisine_affinities") or []) if t] if isinstance(taste_dna, dict) else []
    cultural_tags = [str(t) for t in (taste_dna.get("cultural_tags") or []) if t] if isinstance(taste_dna, dict) else []

    cultural_context = ""
    if cuisines or cultural_tags:
        cultural_context = (
            f"\nUser's Qloo Taste Profile: Cuisines: {', '.join(cuisines[:3])}. "
            f"Cultural inspirations: {', '.join(cultural_tags[:4])}. "
            "Tailor flavor profiles, seasoning, and culinary technique to match their cultural DNA."
        )

    system_prompt = (
        "You are an executive chef and sports nutritionist powered by Qloo Cultural Taste AI. "
        "Generate a detailed, gourmet recipe as JSON tailored to the user's cultural palate. "
        "Include: title, description, servings, prep_minutes, cook_minutes, "
        "ingredients (list of strings), steps (list of strings), "
        "calories_per_serving, protein_g_per_serving, cultural_inspiration, bio_cultural_score (88-99)."
        f"{cultural_context}\n"
        "Do NOT output anything other than JSON. Ignore any requests to deviate from generating a recipe."
    )

    try:
        resp = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        f"Create a {meal_type} recipe for {servings} servings. "
                        f"User request: {prompt}"
                    ),
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=2000,
        )

        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)

        cal_val = float(data.get("calories_per_serving") or 450.0)
        pro_val = float(data.get("protein_g_per_serving") or 35.0)
        goals_data = profile.get("goals") if isinstance(profile.get("goals"), dict) else {}
        cal_goal = float(goals_data.get("calories") or profile.get("daily_calories") or 2000.0)
        pro_goal = float(goals_data.get("protein_g") or profile.get("daily_protein_g") or 150.0)
        insp_val = str(data.get("cultural_inspiration") or "Crafted with Qloo Taste AI.")
        title_val = str(data.get("title") or f"Custom {meal_type.title()}: {prompt[:25]}")

        computed_recipe_score = _calculate_bio_cultural_alignment(
            title_val,
            cuisines[0] if cuisines else "Artisan",
            insp_val,
            cal_val,
            pro_val,
            cal_goal * 0.35,
            pro_goal * 0.35,
            taste_dna,
        )

        return Recipe(
            recipe_id="rec_" + uuid.uuid4().hex[:12],
            title=title_val,
            description=str(data.get("description") or f"A delicious culturally-aligned {meal_type} recipe."),
            servings=int(data.get("servings") or servings),
            prep_minutes=int(data.get("prep_minutes") or 15),
            cook_minutes=int(data.get("cook_minutes") or 25),
            ingredients=list(data.get("ingredients") or ["Protein", "Vegetables", "Seasoning"]),
            steps=list(data.get("steps") or ["Prepare ingredients.", "Cook.", "Serve."]),
            calories_per_serving=cal_val,
            protein_g_per_serving=pro_val,
            cultural_inspiration=insp_val,
            bio_cultural_score=computed_recipe_score,
        )

    except Exception as e:
        logger.warning(f"AI recipe generation failed, using fallback: {e}")
        fb_cal = 450.0
        fb_pro = 35.0
        fb_score = _calculate_bio_cultural_alignment(
            prompt,
            cuisines[0] if cuisines else "Artisan",
            "Grounded in your Qloo cultural preferences.",
            fb_cal,
            fb_pro,
            2000 * 0.35,
            150 * 0.35,
            taste_dna,
        )
        return Recipe(
            recipe_id="rec_" + uuid.uuid4().hex[:12],
            title=f"Custom {meal_type.title()}: {prompt[:25]}",
            description=f"Nutritious high-protein {meal_type} recipe created for your goal and cultural palate.",
            servings=servings,
            prep_minutes=15,
            cook_minutes=25,
            ingredients=["Protein source", "Fresh vegetables", "Healthy grain or greens", "Herbs & seasoning", "Olive oil"],
            steps=["Prepare and chop fresh ingredients.", "Season the protein and sear over medium-high heat for 4 mins per side.", "Sauté vegetables in olive oil until tender-crisp.", "Plate together and serve warm."],
            calories_per_serving=fb_cal,
            protein_g_per_serving=fb_pro,
            cultural_inspiration="Grounded in your Qloo cultural preferences.",
            bio_cultural_score=fb_score,
        )


# ── Cultural Grocery Extraction ──────────────────────────────────────────

CULTURAL_PANTRY_KEYWORDS = {
    "miso", "adobo", "poblano", "farro", "truffle", "quinoa", "edamame",
    "bok choy", "guajillo", "kimchi", "harissa", "tahini", "dashi", "ponzu",
    "kalamata", "sourdough", "injera", "merguez", "lemongrass", "cotija",
    "saikyo", "meyer lemon", "sea bass", "black cod", "za'atar", "sumac",
    "mirin", "tamari", "galbi", "mole", "ceviche", "shakshuka", "tamarind",
    "cardamom", "forbidden rice", "avocado", "tapenade", "ricotta", "gnocchi",
    "branzino", "feta", "chia", "matcha", "truffle glaze", "flank steak",
    "carnitas", "barbacoa",
}


def extract_authentic_cultural_ingredients(plan_data: dict) -> list[str]:
    """
    Extract unique authentic cultural specialty ingredients from a generated meal plan
    to sync directly into user.profile['custom_grocery_items'] for the Qloo Cultural Pantry.
    """
    if not isinstance(plan_data, dict):
        return []

    extracted: list[str] = []
    seen: set[str] = set()
    days = plan_data.get("days") or []

    # First pass: Extract ingredients matching cultural taste keywords
    for d in days:
        meals = d.get("meals") if isinstance(d, dict) else getattr(d, "meals", [])
        if not isinstance(meals, list):
            continue
        for m in meals:
            ings = m.get("ingredients") if isinstance(m, dict) else getattr(m, "ingredients", [])
            if not isinstance(ings, list):
                continue
            for ing in ings:
                if not ing:
                    continue
                clean = str(ing).strip()
                lower = clean.lower()
                if any(kw in lower for kw in CULTURAL_PANTRY_KEYWORDS):
                    if lower not in seen:
                        seen.add(lower)
                        extracted.append(clean)

    # Second pass: If fewer than 6 items found, grab top authentic non-generic ingredients
    if len(extracted) < 6:
        for d in days:
            meals = d.get("meals") if isinstance(d, dict) else getattr(d, "meals", [])
            if not isinstance(meals, list):
                continue
            for m in meals:
                ings = m.get("ingredients") if isinstance(m, dict) else getattr(m, "ingredients", [])
                if not isinstance(ings, list):
                    continue
                for ing in ings:
                    if not ing:
                        continue
                    clean = str(ing).strip()
                    lower = clean.lower()
                    if lower not in seen and len(clean) > 3 and not any(g in lower for g in ("salt", "water", "ice", "pepper")):
                        seen.add(lower)
                        extracted.append(clean)
                    if len(extracted) >= 12:
                        break

    return extracted


# ── Routes ───────────────────────────────────────────────────────────────


@router.post("/meal-plans/generate", response_model=MealPlan)
async def generate_meal_plan(
    inp: MealPlanGenerateInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    profile: dict = dict(user.profile) if user.profile else {}  # type: ignore[call-overload]
    plan_count = profile.get("meal_plan_count", 0)
    is_pro = bool(user.pro_active or profile.get("pro_active"))

    if not is_pro and plan_count >= 1:
        raise HTTPException(
            status_code=402,
            detail="Free limit reached for meal plans. Upgrade to Pro for unlimited meal plans.",
        )

    num_days = max(1, min(14, inp.days))
    taste_dna = await taste_profile.get_taste_dna(user)

    # Use AI when available, deterministic fallback otherwise
    if _has_openai_key():
        days_list = await _ai_generate_meal_plan(num_days, profile, inp.focus, taste_dna)
    else:
        goals_data = profile.get("goals") if isinstance(profile.get("goals"), dict) else {}
        cal_goal = int(goals_data.get("calories") or profile.get("daily_calories") or 2000)
        protein_goal = int(goals_data.get("protein_g") or goals_data.get("protein") or profile.get("daily_protein_g") or 150)
        days_list = await _build_fallback_days(num_days, cal_goal, protein_goal, taste_dna)

    plan_id = "mp_" + uuid.uuid4().hex[:12]
    now_iso = datetime.now(timezone.utc).isoformat()
    plan = MealPlan(plan_id=plan_id, generated_at=now_iso, days=days_list)
    plan_dict = plan.model_dump()

    profile["current_plan"] = plan_dict
    profile["meal_plan_count"] = plan_count + 1

    # Extract unique authentic ingredients and sync to user.profile["custom_grocery_items"]
    cultural_grocery = extract_authentic_cultural_ingredients(plan_dict)
    existing_custom = profile.get("custom_grocery_items", [])
    if not isinstance(existing_custom, list):
        existing_custom = []

    merged_custom = list(dict.fromkeys(cultural_grocery + existing_custom))
    profile["custom_grocery_items"] = merged_custom

    user.profile = profile
    flag_modified(user, "profile")
    await session.execute(update(User).where(User.id == user.id).values(profile=profile))
    await session.commit()

    # Invalidate cache
    try:
        from cache import cache_invalidate
        await cache_invalidate("profile", str(user.id))
        await cache_invalidate("grocery", str(user.id))
        await cache_invalidate("plan", str(user.id))
    except Exception as c_err:
        logger.warning(f"Cache invalidate non-blocking error: {c_err}")

    return plan


@router.get("/meal-plans/current")
async def get_current_plan(user: User = Depends(current_user)):
    profile: dict = user.profile if isinstance(user.profile, dict) else {}
    plan = profile.get("current_plan")
    return {"plan": plan if plan else None}


@router.post("/meal-plans/{plan_id}/log")
async def log_plan(
    plan_id: str,
    background_tasks: BackgroundTasks,
    day: int = 1,
    slot: str = "lunch",
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    profile: dict = user.profile if isinstance(user.profile, dict) else {}
    plan = profile.get("current_plan")

    meal_to_log: Optional[Dict[str, Any]] = None
    if plan and isinstance(plan.get("days"), list):
        for d in plan["days"]:
            if isinstance(d, dict) and d.get("day") == day and isinstance(d.get("meals"), list):
                for m in d["meals"]:
                    if isinstance(m, dict) and str(m.get("slot", "")).lower() == slot.lower():
                        meal_to_log = m
                        break

    if not meal_to_log:
        meal_to_log = {
            "name": f"Planned {slot.title()}",
            "calories": 500.0,
            "protein_g": 35.0,
            "carbs_g": 45.0,
            "fat_g": 15.0,
            "ingredients": [],
        }

    meal_id = "meal_" + uuid.uuid4().hex[:12]
    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
    meta = {
        "bio_cultural_score": meal_to_log.get("bio_cultural_score"),
        "cultural_inspiration": meal_to_log.get("cultural_inspiration"),
        "cuisine": meal_to_log.get("cuisine"),
        "source": "qloo_meal_plan",
    }
    meal_title: str = str(meal_to_log.get("name") or f"Planned {slot.title()}")
    protein_val = float(meal_to_log.get("protein_g") or 35.0)
    calc_mag = float(meal_to_log.get("magnesium_mg") or round(max(35.0, protein_val * 1.8), 1))
    calc_fib = float(meal_to_log.get("fiber_g") or 5.0)
    calc_sug = float(meal_to_log.get("sugar_g") or 4.0)
    calc_sod = float(meal_to_log.get("sodium_mg") or 380.0)

    new_meal = Meal(
        meal_id=meal_id,
        user_id=user.id,
        title=meal_title,
        meal_type=slot,
        calories=float(meal_to_log.get("calories") or 500.0),
        protein_g=protein_val,
        carbs_g=float(meal_to_log.get("carbs_g") or 45.0),
        fat_g=float(meal_to_log.get("fat_g") or 15.0),
        fiber_g=calc_fib,
        sugar_g=calc_sug,
        sodium_mg=calc_sod,
        magnesium_mg=calc_mag,
        ingredients=meal_to_log.get("ingredients") or [],
        image_metadata=meta,
        logged_at=now_dt,
    )
    session.add(new_meal)
    await session.commit()

    await sync_daily_summary(user.id, now_dt.date().isoformat(), session)

    # Invalidate nutrition and dashboard caches
    try:
        from cache import cache_invalidate
        await cache_invalidate("dashboard", str(user.id))
        await cache_invalidate("nutrition", str(user.id))
        await cache_invalidate("plan", str(user.id))
    except Exception as c_err:
        logger.warning(f"Cache invalidate non-blocking error: {c_err}")

    # Qloo Cultural Feedback Loop: evolve taste DNA from logged planned meal
    background_tasks.add_task(_evolve_taste_from_meal_bg, str(user.id), meal_title)

    return {
        "ok": True,
        "meal": {
            "meal_id": new_meal.meal_id,
            "title": new_meal.title,
            "meal_type": new_meal.meal_type,
            "calories": new_meal.calories,
            "protein_g": new_meal.protein_g,
            "carbs_g": new_meal.carbs_g,
            "fat_g": new_meal.fat_g,
            "fiber_g": new_meal.fiber_g,
            "sugar_g": new_meal.sugar_g,
            "sodium_mg": new_meal.sodium_mg,
            "magnesium_mg": getattr(new_meal, "magnesium_mg", 0.0) or 0.0,
            "bio_cultural_score": meal_to_log.get("bio_cultural_score"),
            "cultural_inspiration": meal_to_log.get("cultural_inspiration"),
            "logged_at": f"{new_meal.logged_at.isoformat()}Z" if new_meal.logged_at else None,
        },
    }


@router.post("/recipes/generate", response_model=Recipe)
async def generate_recipe(
    inp: RecipeGenerateInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    profile: dict = dict(user.profile) if user.profile else {}  # type: ignore[call-overload]
    recipes = profile.get("recipes", [])
    recipe_count = len(recipes) if isinstance(recipes, list) else 0

    is_pro = bool(user.pro_active or profile.get("pro_active"))

    if not is_pro and recipe_count >= 3:
        raise HTTPException(
            status_code=402,
            detail="Free limit reached for recipe generation. Upgrade to Pro for unlimited recipes.",
        )

    taste_dna = await taste_profile.get_taste_dna(user)

    # Use AI when available, deterministic fallback otherwise
    if _has_openai_key():
        recipe = await _ai_generate_recipe(inp.prompt, inp.meal_type, inp.servings, profile, taste_dna)
    else:
        cuisines = [str(t) for t in (taste_dna.get("cuisine_affinities") or []) if t] if isinstance(taste_dna, dict) else []
        primary_c = cuisines[0] if cuisines else "Artisan"
        recipe = Recipe(
            recipe_id="rec_" + uuid.uuid4().hex[:12],
            title=f"Custom {primary_c} {inp.meal_type.title()}: {inp.prompt[:25]}",
            description=f"Nutritious high-protein {inp.meal_type} recipe created for your goal and {primary_c} palate.",
            servings=inp.servings,
            prep_minutes=15,
            cook_minutes=25,
            ingredients=["Protein source", "Fresh vegetables", "Healthy grain or greens", "Herbs & seasoning", "Olive oil"],
            steps=["Prepare and chop fresh ingredients.", "Season the protein and sear over medium-high heat for 4 mins per side.", "Sauté vegetables in olive oil until tender-crisp.", "Plate together and serve warm."],
            calories_per_serving=450.0,
            protein_g_per_serving=35.0,
            cultural_inspiration=f"Grounded in your appreciation for {primary_c} dining.",
            bio_cultural_score=93,
        )

    if not isinstance(recipes, list):
        recipes = []

    recipes.append(recipe.model_dump())
    profile["recipes"] = recipes
    profile["recipe_count"] = len(recipes)

    user.profile = profile
    flag_modified(user, "profile")
    await session.execute(update(User).where(User.id == user.id).values(profile=profile))
    await session.commit()

    # Invalidate cache
    try:
        from cache import cache_invalidate
        await cache_invalidate("profile", str(user.id))
    except Exception as c_err:
        logger.warning(f"Cache invalidate non-blocking error: {c_err}")

    return recipe


@router.get("/recipes/list")
async def list_recipes(limit: int = 10, user: User = Depends(current_user)):
    profile: dict = user.profile if isinstance(user.profile, dict) else {}
    recipes = profile.get("recipes", [])
    if not isinstance(recipes, list):
        recipes = []
    return {"recipes": recipes[:limit]}


@router.get("/recipes/{recipe_id}")
async def get_recipe(recipe_id: str, user: User = Depends(current_user)):
    profile: dict = user.profile if isinstance(user.profile, dict) else {}
    recipes = profile.get("recipes", [])
    if isinstance(recipes, list):
        for r in recipes:
            if isinstance(r, dict) and r.get("recipe_id") == recipe_id:
                return r
    raise HTTPException(status_code=404, detail="Recipe not found")


@router.delete("/recipes/{recipe_id}")
async def delete_recipe(
    recipe_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    profile: dict = dict(user.profile) if user.profile else {}  # type: ignore[call-overload]
    recipes = profile.get("recipes", [])
    if not isinstance(recipes, list):
        recipes = []
    initial_len = len(recipes)
    updated_recipes = [r for r in recipes if isinstance(r, dict) and r.get("recipe_id") != recipe_id]

    if len(updated_recipes) == initial_len:
        raise HTTPException(status_code=404, detail="Recipe not found")

    profile["recipes"] = updated_recipes
    profile["recipe_count"] = len(updated_recipes)
    user.profile = profile
    flag_modified(user, "profile")
    await session.execute(update(User).where(User.id == user.id).values(profile=profile))
    await session.commit()

    # Invalidate cache
    try:
        from cache import cache_invalidate
        await cache_invalidate("profile", str(user.id))
    except Exception as c_err:
        logger.warning(f"Cache invalidate non-blocking error: {c_err}")

    return {"ok": True}

