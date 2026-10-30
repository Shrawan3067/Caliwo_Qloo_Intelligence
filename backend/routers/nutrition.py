import uuid
import typing
from datetime import datetime
from typing import Any, Optional, cast
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, get_read_db
from models import User, Meal, DailySummary
from routers.auth import current_user
from timezone_utils import get_utc_now, resolve_local_date_str
from math_utils import calculate_water_goal
from cache import cache_get, cache_set, cache_invalidate

router = APIRouter(prefix="/nutrition", tags=["nutrition"])

@router.get("/today")
async def nutrition_today(
    date: Optional[str] = None,
    tz_offset: int = 0,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_read_db)
):
    import json as _json
    local_date = date if date else resolve_local_date_str(get_utc_now(), tz_offset)

    # C4: Cache with 30s TTL
    cache_key = f"caliwo:nutrition:{user.id}:{local_date}"
    cached = await cache_get(cache_key)
    if cached:
        try:
            return _json.loads(cached)
        except Exception:
            pass
    
    # 1. Get or create DailySummary for water
    result = await session.execute(
        select(DailySummary).where(
            DailySummary.user_id == user.id,
            DailySummary.date_str == local_date
        )
    )
    summary = result.scalars().first()
    if not summary:
        summary = DailySummary(
            id="sum_" + uuid.uuid4().hex[:12],
            user_id=user.id,
            date_str=local_date
        )
        session.add(summary)
        await session.commit()
        await session.refresh(summary)

    # 2. Get Meals to calculate totals — use indexed timestamp range query
    from datetime import date as _date, time as _time

    target_date = _date.fromisoformat(local_date)
    start_dt = datetime.combine(target_date, _time.min)
    end_dt = datetime.combine(target_date, _time.max)
    meals_result = await session.execute(
        select(Meal).where(
            Meal.user_id == user.id,
            Meal.logged_at >= start_dt,
            Meal.logged_at <= end_dt,
        )
    )
    today_meals = meals_result.scalars().all()
    
    total_cal = sum((m.calories or 0) for m in today_meals)
    total_pro = sum((m.protein_g or 0) for m in today_meals)
    total_car = sum((m.carbs_g or 0) for m in today_meals)
    total_fat = sum((m.fat_g or 0) for m in today_meals)
    total_fib = sum((getattr(m, "fiber_g", 0.0) or 0.0) for m in today_meals)
    total_sug = sum((getattr(m, "sugar_g", 0.0) or 0.0) for m in today_meals)
    total_sod = sum((getattr(m, "sodium_mg", 0.0) or 0.0) for m in today_meals)
    total_mag = sum((getattr(m, "magnesium_mg", 0.0) or 0.0) for m in today_meals)

    summary.total_calories = float(total_cal)
    summary.total_protein = float(total_pro)
    summary.total_carbs = float(total_car)
    summary.total_fat = float(total_fat)
    summary.total_fiber = float(total_fib)
    summary.total_sugar = float(total_sug)
    summary.total_sodium = float(total_sod)
    summary.total_magnesium = float(total_mag)
    session.add(summary)
    await session.commit()
    
    # 3. Get Goals (synchronized with daily_* targets)
    profile: dict = user.profile or {}  # type: ignore
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

    # 4. Dynamic water goal from profile
    weight_kg = float(profile.get("weight_kg", 70))
    activity_level = str(profile.get("activity_level", "lightly_active"))
    water_goal = calculate_water_goal(weight_kg, activity_level)
    
    # 5. Construct Response
    result = {
        "day": local_date,
        "totals": {
            "calories": total_cal,
            "protein_g": total_pro,
            "carbs_g": total_car,
            "fat_g": total_fat,
            "fiber_g": total_fib,
            "sugar_g": total_sug,
            "sodium_mg": total_sod,
            "magnesium_mg": total_mag,
        },
        "goals": goals,
        "water_ml": summary.water_ml or 0,
        "water_goal_ml": water_goal
    }

    # C4: Cache for 30 seconds
    await cache_set(cache_key, result, ttl=30)
    return result


# ── Progress & Analytics ─────────────────────────────────────────────────

@router.get("/progress/summary")
async def progress_summary(
    days: int = 7,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_read_db),
):
    import datetime as _dt

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
    summaries: list[Any] = list(result.scalars().all())
    sum_by_date: dict[str, Any] = {str(s.date_str): s for s in summaries}

    profile: dict = user.profile or {}  # type: ignore
    cal_goal = int(profile.get("goals", {}).get("calories", 2000))
    protein_goal = int(profile.get("goals", {}).get("protein", 120))

    # Also aggregate from meals for accuracy — filter by date range in SQL
    from sqlalchemy import cast as sa_cast
    from sqlalchemy import Date as SA_Date
    from datetime import date as _date

    start_date = _date.fromisoformat(week_dates[0])
    end_date = _date.fromisoformat(week_dates[-1])
    m_res = await session.execute(
        select(Meal).where(
            Meal.user_id == user.id,
            sa_cast(Meal.logged_at, SA_Date) >= start_date,
            sa_cast(Meal.logged_at, SA_Date) <= end_date,
        )
    )
    user_meals = m_res.scalars().all()
    meal_totals: dict[str, dict[str, float]] = {}
    for m in user_meals:
        if m.logged_at:
            md = m.logged_at.strftime("%Y-%m-%d")
            if md not in meal_totals:
                meal_totals[md] = {"cal": 0.0, "p": 0.0, "c": 0.0, "f": 0.0}
            meal_totals[md]["cal"] += float(m.calories or 0.0)
            meal_totals[md]["p"] += float(m.protein_g or 0.0)
            meal_totals[md]["c"] += float(m.carbs_g or 0.0)
            meal_totals[md]["f"] += float(m.fat_g or 0.0)

    daily: list[dict[str, typing.Any]] = []
    for d in week_dates:
        s = sum_by_date.get(d)
        m_agg = meal_totals.get(d, {})
        cal = max(float(s.total_calories or 0.0) if s else 0.0, m_agg.get("cal", 0.0))
        prot = max(float(s.total_protein or 0.0) if s else 0.0, m_agg.get("p", 0.0))
        carbs = max(float(s.total_carbs or 0.0) if s else 0.0, m_agg.get("c", 0.0))
        fat = max(float(s.total_fat or 0.0) if s else 0.0, m_agg.get("f", 0.0))
        water = int(s.water_ml or 0) if s else 0

        daily.append({
            "day": d,
            "calories": round(cal, 1),
            "protein_g": round(prot, 1),
            "carbs_g": round(carbs, 1),
            "fat_g": round(fat, 1),
            "water_ml": water,
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
    streak_data = {str(row[0]): float(row[1] or 0.0) for row in streak_result.all()}

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

    # Weight history
    weights = []
    for s in summaries:
        if s.weight_kg is not None:
            weights.append({"weight_kg": s.weight_kg, "logged_at": f"{s.date_str}T00:00:00Z"})

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

