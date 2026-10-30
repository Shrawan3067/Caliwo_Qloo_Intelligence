"""
Nutrition Service — shared business logic for nutrition data.

Used by:
  - GET /api/nutrition/today (REST)
"""

import uuid
import datetime as _dt
from typing import Any, Optional

from sqlalchemy import select, cast, Date as SA_Date
from sqlalchemy.ext.asyncio import AsyncSession

from models import User, Meal, DailySummary
from math_utils import calculate_water_goal
from timezone_utils import get_utc_now, resolve_local_date_str


async def get_daily_nutrition(
    session: AsyncSession,
    user: User,
    date: Optional[str] = None,
    tz_offset: int = 0,
) -> dict[str, Any]:
    """
    Get full daily nutrition summary with goals for a given date.
    Returns totals, goals, water, and meal count.
    """
    local_date = date if date else resolve_local_date_str(get_utc_now(), tz_offset)
    target_date = _dt.date.fromisoformat(local_date)

    start_dt = _dt.datetime.combine(target_date, _dt.time.min)
    end_dt = _dt.datetime.combine(target_date, _dt.time.max)

    # Fetch meals for the target date using indexed timestamp range
    meals_result = await session.execute(
        select(Meal).where(
            Meal.user_id == user.id,
            Meal.logged_at >= start_dt,
            Meal.logged_at <= end_dt,
        )
    )
    today_meals = meals_result.scalars().all()

    total_cal = sum(float(m.calories or 0) for m in today_meals)
    total_pro = sum(float(m.protein_g or 0) for m in today_meals)
    total_car = sum(float(m.carbs_g or 0) for m in today_meals)
    total_fat = sum(float(m.fat_g or 0) for m in today_meals)
    total_fib = sum(float(getattr(m, "fiber_g", 0) or 0) for m in today_meals)
    total_sug = sum(float(getattr(m, "sugar_g", 0) or 0) for m in today_meals)
    total_sod = sum(float(getattr(m, "sodium_mg", 0) or 0) for m in today_meals)
    total_mag = sum(float(getattr(m, "magnesium_mg", 0) or 0) for m in today_meals)

    # Get goals from profile
    profile: dict = user.profile if isinstance(user.profile, dict) else {}
    goals_data = profile.get("goals", {})
    goals = {
        "calories": float(goals_data.get("calories") or profile.get("daily_calories") or 2000),
        "protein_g": float(goals_data.get("protein_g") or goals_data.get("protein") or profile.get("daily_protein_g") or 150),
        "carbs_g": float(goals_data.get("carbs_g") or profile.get("daily_carbs_g") or 200),
        "fat_g": float(goals_data.get("fat_g") or profile.get("daily_fat_g") or 65),
        "fiber_g": float(goals_data.get("fiber_g") or profile.get("daily_fiber_g") or 28),
        "sugar_g": float(goals_data.get("sugar_g") or profile.get("daily_sugar_g") or 30),
        "sodium_mg": float(goals_data.get("sodium_mg") or profile.get("daily_sodium_mg") or 2000),
        "magnesium_mg": float(goals_data.get("magnesium_mg") or profile.get("daily_magnesium_mg") or 400),
    }

    # Get or create daily summary for water
    summary_result = await session.execute(
        select(DailySummary).where(
            DailySummary.user_id == user.id,
            DailySummary.date_str == local_date,
        )
    )
    summary = summary_result.scalars().first()

    water_ml = int(summary.water_ml or 0) if summary else 0
    weight_kg = float(profile.get("weight_kg", 70))
    activity_level = str(profile.get("activity_level", "lightly_active"))
    water_goal = calculate_water_goal(weight_kg, activity_level)

    return {
        "date": local_date,
        "totals": {
            "calories": round(total_cal, 1),
            "protein_g": round(total_pro, 1),
            "carbs_g": round(total_car, 1),
            "fat_g": round(total_fat, 1),
            "fiber_g": round(total_fib, 1),
            "sugar_g": round(total_sug, 1),
            "sodium_mg": round(total_sod, 1),
            "magnesium_mg": round(total_mag, 1),
        },
        "goals": goals,
        "meals_logged": len(today_meals),
        "water_ml": water_ml,
        "water_goal_ml": water_goal,
    }


async def get_remaining_calories(
    session: AsyncSession,
    user: User,
    date: Optional[str] = None,
    tz_offset: int = 0,
) -> dict[str, Any]:
    """Get remaining calories for the user today."""
    nutrition = await get_daily_nutrition(session, user, date, tz_offset)
    goal = nutrition["goals"]["calories"]
    consumed = nutrition["totals"]["calories"]
    return {
        "calorieGoal": round(goal, 1),
        "caloriesConsumed": round(consumed, 1),
        "caloriesRemaining": round(max(0, goal - consumed), 1),
        "date": nutrition["date"],
    }


async def get_nutrition_gaps(
    session: AsyncSession,
    user: User,
    date: Optional[str] = None,
    tz_offset: int = 0,
) -> dict[str, Any]:
    """Determine nutritional gaps relative to goals."""
    nutrition = await get_daily_nutrition(session, user, date, tz_offset)
    totals = nutrition["totals"]
    goals = nutrition["goals"]

    gaps = {}
    for nutrient in ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "magnesium_mg", "sodium_mg"]:
        goal_val = goals.get(nutrient, 0)
        consumed_val = totals.get(nutrient, 0)
        gaps[nutrient] = {
            "goal": round(goal_val, 1),
            "consumed": round(consumed_val, 1),
            "remaining": round(max(0, goal_val - consumed_val), 1),
            "percentage": round((consumed_val / goal_val * 100) if goal_val > 0 else 0, 1),
        }

    return {
        "date": nutrition["date"],
        "gaps": gaps,
        "meals_logged": nutrition["meals_logged"],
    }


async def get_progress_summary(
    session: AsyncSession,
    user: User,
    days: int = 7,
) -> dict[str, Any]:
    """
    Get nutrition progress summary over recent days.
    Includes daily breakdown, streaks, averages, and goal adherence.
    """
    days = max(1, min(60, days))
    today = _dt.datetime.now(_dt.timezone.utc).date()
    week_dates = [
        (today - _dt.timedelta(days=i)).isoformat()
        for i in range(days - 1, -1, -1)
    ]

    # Fetch daily summaries
    result = await session.execute(
        select(DailySummary)
        .where(
            DailySummary.user_id == user.id,
            DailySummary.date_str.in_(week_dates),
        )
        .order_by(DailySummary.date_str.asc())
    )
    summaries = list(result.scalars().all())
    sum_by_date = {str(s.date_str): s for s in summaries}

    profile: dict = user.profile if isinstance(user.profile, dict) else {}
    cal_goal = float(profile.get("goals", {}).get("calories", 2000))
    protein_goal = float(profile.get("goals", {}).get("protein", 120))

    start_date = _dt.date.fromisoformat(week_dates[0])
    end_date = _dt.date.fromisoformat(week_dates[-1])
    start_dt = _dt.datetime.combine(start_date, _dt.time.min)
    end_dt = _dt.datetime.combine(end_date, _dt.time.max)
    m_res = await session.execute(
        select(Meal).where(
            Meal.user_id == user.id,
            Meal.logged_at >= start_dt,
            Meal.logged_at <= end_dt,
        )
    )
    user_meals = m_res.scalars().all()
    meal_totals: dict[str, dict[str, float]] = {}
    for m in user_meals:
        if m.logged_at:
            md = m.logged_at.strftime("%Y-%m-%d")
            if md not in meal_totals:
                meal_totals[md] = {"cal": 0.0, "p": 0.0, "c": 0.0, "f": 0.0}
            meal_totals[md]["cal"] += float(m.calories or 0)
            meal_totals[md]["p"] += float(m.protein_g or 0)
            meal_totals[md]["c"] += float(m.carbs_g or 0)
            meal_totals[md]["f"] += float(m.fat_g or 0)

    daily: list[dict] = []
    for d in week_dates:
        s = sum_by_date.get(d)
        m_agg = meal_totals.get(d, {})
        cal = max(float(s.total_calories or 0) if s else 0, m_agg.get("cal", 0))
        prot = max(float(s.total_protein or 0) if s else 0, m_agg.get("p", 0))
        carbs = max(float(s.total_carbs or 0) if s else 0, m_agg.get("c", 0))
        fat = max(float(s.total_fat or 0) if s else 0, m_agg.get("f", 0))

        daily.append({
            "day": d,
            "calories": round(cal, 1),
            "protein_g": round(prot, 1),
            "carbs_g": round(carbs, 1),
            "fat_g": round(fat, 1),
            "hit_calorie_goal": cal > 0 and abs(cal - cal_goal) <= cal_goal * 0.1,
            "hit_protein_goal": prot >= protein_goal * 0.9,
        })

    # Streaks
    streak_dates = [
        (today - _dt.timedelta(days=i)).isoformat() for i in range(60)
    ]
    streak_result = await session.execute(
        select(DailySummary.date_str, DailySummary.total_calories).where(
            DailySummary.user_id == user.id,
            DailySummary.date_str.in_(streak_dates),
        )
    )
    streak_data = {str(row[0]): float(row[1] or 0) for row in streak_result.all()}

    logging_streak = 0
    for offset in range(60):
        k = streak_dates[offset]
        if streak_data.get(k, 0) > 0:
            logging_streak += 1
        elif offset == 0:
            if streak_data.get(streak_dates[1], 0) > 0:
                continue
            break
        else:
            break

    # Weights
    weights = []
    for s in summaries:
        if s.weight_kg is not None:
            weights.append({"weight_kg": s.weight_kg, "date": s.date_str})

    # Averages
    n = max(1, len(daily))
    avg_cal = round(sum(d["calories"] for d in daily) / n, 1)
    avg_prot = round(sum(d["protein_g"] for d in daily) / n, 1)

    cal_hit = sum(1 for d in daily if d["hit_calorie_goal"])
    prot_hit = sum(1 for d in daily if d["hit_protein_goal"])
    days_logged = sum(1 for d in daily if d["calories"] > 0)

    return {
        "range_days": days,
        "daily": daily,
        "weights": weights,
        "averages": {"calories": avg_cal, "protein_g": avg_prot},
        "streaks": {"logging_streak_days": logging_streak},
        "goals_hit": {
            "calorie_days": cal_hit,
            "protein_days": prot_hit,
            "logged_days": days_logged,
            "of_days": days,
        },
        "cal_goal": cal_goal,
        "protein_goal": protein_goal,
    }


async def get_activity_summary(
    session: AsyncSession,
    user: User,
    days: int = 7,
) -> dict[str, Any]:
    """Get activity summary including steps, water, sleep."""
    today = _dt.datetime.now(_dt.timezone.utc).date()
    date_strs = [
        (today - _dt.timedelta(days=i)).isoformat()
        for i in range(days)
    ]

    result = await session.execute(
        select(DailySummary).where(
            DailySummary.user_id == user.id,
            DailySummary.date_str.in_(date_strs),
        )
    )
    summaries = list(result.scalars().all())
    sum_by_date = {s.date_str: s for s in summaries}

    profile: dict = user.profile if isinstance(user.profile, dict) else {}
    steps_goal = int(profile.get("steps_goal", 10000))

    today_summary = sum_by_date.get(today.isoformat())

    entries = []
    for d in date_strs:
        s = sum_by_date.get(d)
        entries.append({
            "date": d,
            "steps": int(s.steps or 0) if s else 0,
            "water_ml": int(s.water_ml or 0) if s else 0,
            "sleep_hours": float(s.sleep_hours or 0) if s else 0,
        })

    return {
        "today": {
            "steps": int(today_summary.steps or 0) if today_summary else 0,
            "water_ml": int(today_summary.water_ml or 0) if today_summary else 0,
            "sleep_hours": float(today_summary.sleep_hours or 0) if today_summary else 0,
            "steps_goal": steps_goal,
        },
        "recent_days": entries,
        "averages": {
            "steps": round(sum(e["steps"] for e in entries) / max(1, len(entries))),
            "water_ml": round(sum(e["water_ml"] for e in entries) / max(1, len(entries))),
            "sleep_hours": round(sum(e["sleep_hours"] for e in entries) / max(1, len(entries)), 1),
        },
    }
