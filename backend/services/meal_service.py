"""
Meal Service — shared business logic for meal operations.

Used by:
  - POST /api/meals/log (REST)
  - POST /api/meals/recognize (REST)
"""

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select, cast, Date as SA_Date
from sqlalchemy.ext.asyncio import AsyncSession

from models import Meal, User, DailySummary

logger = logging.getLogger(__name__)


async def log_meal(
    session: AsyncSession,
    user: User,
    title: str,
    meal_type: str,
    calories: float,
    protein_g: float,
    carbs_g: float,
    fat_g: float,
    fiber_g: float = 0.0,
    sugar_g: float = 0.0,
    sodium_mg: float = 0.0,
    foods: Optional[list] = None,
    logged_at: Optional[str] = None,
) -> dict[str, Any]:
    """Log a meal into the database and update daily summary."""
    meal_id = "meal_" + uuid.uuid4().hex[:12]
    log_time = datetime.now(timezone.utc)

    if logged_at:
        try:
            dt = datetime.fromisoformat(logged_at.replace("Z", "+00:00"))
            if dt.tzinfo is not None:
                log_time = dt.astimezone(timezone.utc)
            else:
                log_time = dt.replace(tzinfo=timezone.utc)
        except Exception:
            pass

    if log_time.tzinfo is not None:
        log_time = log_time.astimezone(timezone.utc).replace(tzinfo=None)

    new_meal = Meal(
        meal_id=meal_id,
        user_id=user.id,
        title=title,
        meal_type=meal_type,
        calories=calories,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
        fiber_g=fiber_g,
        sugar_g=sugar_g,
        sodium_mg=sodium_mg,
        ingredients=foods or [],
        logged_at=log_time,
    )

    session.add(new_meal)

    # Fast path: update DailySummary in the same transaction for a single atomic commit
    date_str = log_time.date().isoformat()
    try:
        sum_res = await session.execute(
            select(DailySummary).where(
                DailySummary.user_id == user.id,
                DailySummary.date_str == date_str,
            )
        )
        summary = sum_res.scalars().first()
        if not summary:
            summary = DailySummary(
                id="sum_" + uuid.uuid4().hex[:12],
                user_id=user.id,
                date_str=date_str,
                total_calories=0.0,
                total_protein=0.0,
                total_carbs=0.0,
                total_fat=0.0,
                total_fiber=0.0,
                total_sugar=0.0,
                total_sodium=0.0,
            )
            session.add(summary)

        summary.total_calories = round(float(summary.total_calories or 0.0) + float(calories or 0.0), 1)
        summary.total_protein = round(float(summary.total_protein or 0.0) + float(protein_g or 0.0), 1)
        summary.total_carbs = round(float(summary.total_carbs or 0.0) + float(carbs_g or 0.0), 1)
        summary.total_fat = round(float(summary.total_fat or 0.0) + float(fat_g or 0.0), 1)
        summary.total_fiber = round(float(summary.total_fiber or 0.0) + float(fiber_g or 0.0), 1)
        summary.total_sugar = round(float(summary.total_sugar or 0.0) + float(sugar_g or 0.0), 1)
        summary.total_sodium = round(float(summary.total_sodium or 0.0) + float(sodium_mg or 0.0), 1)
    except Exception as e:
        logger.warning(f"Could not inline update DailySummary: {e}")

    # Single atomic commit for both meal and summary
    await session.commit()

    # Invalidate cache asynchronously
    try:
        from cache import cache_invalidate
        await cache_invalidate("nutrition", str(user.id))
        await cache_invalidate("dashboard", str(user.id))
    except Exception:
        pass

    return {
        "success": True,
        "meal_id": new_meal.meal_id,
        "title": new_meal.title,
        "meal_type": new_meal.meal_type,
        "calories": round(float(new_meal.calories or 0), 1),
        "protein_g": round(float(new_meal.protein_g or 0), 1),
        "carbs_g": round(float(new_meal.carbs_g or 0), 1),
        "fat_g": round(float(new_meal.fat_g or 0), 1),
        "logged_at": f"{new_meal.logged_at.isoformat()}Z" if new_meal.logged_at else None,
    }


async def get_meals_for_date(
    session: AsyncSession,
    user: User,
    date_str: str,
) -> list[dict[str, Any]]:
    """Get all meals for a user on a given date using index-friendly range scan."""
    from datetime import date as _date, time as _time

    target_date = _date.fromisoformat(date_str)
    start_dt = datetime.combine(target_date, _time.min)
    end_dt = datetime.combine(target_date, _time.max)
    result = await session.execute(
        select(Meal).where(
            Meal.user_id == user.id,
            Meal.logged_at >= start_dt,
            Meal.logged_at <= end_dt,
        ).order_by(Meal.logged_at.asc())
    )
    meals = result.scalars().all()

    return [
        {
            "meal_id": m.meal_id,
            "title": m.title,
            "meal_type": m.meal_type,
            "calories": round(float(m.calories or 0), 1),
            "protein_g": round(float(m.protein_g or 0), 1),
            "carbs_g": round(float(m.carbs_g or 0), 1),
            "fat_g": round(float(m.fat_g or 0), 1),
            "logged_at": f"{m.logged_at.isoformat()}Z" if m.logged_at else None,
        }
        for m in meals
    ]


async def _sync_daily_summary(
    session: AsyncSession,
    user_id: str,
    date_str: str,
) -> None:
    """Sync aggregated daily nutrition from meals."""
    try:
        from datetime import date as _date, time as _time

        target_date = _date.fromisoformat(date_str)
        start_dt = datetime.combine(target_date, _time.min)
        end_dt = datetime.combine(target_date, _time.max)
        meals_res = await session.execute(
            select(Meal).where(
                Meal.user_id == user_id,
                Meal.logged_at >= start_dt,
                Meal.logged_at <= end_dt,
            )
        )
        day_meals = meals_res.scalars().all()

        tot_cal = sum(float(m.calories or 0) for m in day_meals)
        tot_pro = sum(float(m.protein_g or 0) for m in day_meals)
        tot_car = sum(float(m.carbs_g or 0) for m in day_meals)
        tot_fat = sum(float(m.fat_g or 0) for m in day_meals)
        tot_fib = sum(float(getattr(m, "fiber_g", 0) or 0) for m in day_meals)
        tot_sug = sum(float(getattr(m, "sugar_g", 0) or 0) for m in day_meals)
        tot_sod = sum(float(getattr(m, "sodium_mg", 0) or 0) for m in day_meals)

        sum_res = await session.execute(
            select(DailySummary).where(
                DailySummary.user_id == user_id,
                DailySummary.date_str == date_str,
            )
        )
        summary = sum_res.scalars().first()
        if not summary:
            summary = DailySummary(
                id="sum_" + uuid.uuid4().hex[:12],
                user_id=user_id,
                date_str=date_str,
            )
            session.add(summary)

        summary.total_calories = tot_cal
        summary.total_protein = tot_pro
        summary.total_carbs = tot_car
        summary.total_fat = tot_fat
        summary.total_fiber = tot_fib
        summary.total_sugar = tot_sug
        summary.total_sodium = tot_sod
        session.add(summary)
        await session.commit()
    except Exception as e:
        logger.error(f"Error syncing daily summary: {e}")
