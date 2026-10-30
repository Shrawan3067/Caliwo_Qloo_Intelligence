"""Milestones & Gamification Router for Caliwo backend.

Provides server-authoritative badge evaluation, user achievement state management,
event processing, progress updates, celebration status tracking, and sync endpoints.
"""

import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from database import get_db
from models import User, UserMilestone, Meal, DailySummary, utc_now
from milestones_defs import MILESTONE_DEFS, BADGE_MAP_BY_ID
from routers.auth import current_user

router = APIRouter(prefix="/api/milestones", tags=["milestones"])


class EventEvaluateRequest(BaseModel):
    event_type: str  # MEAL_LOGGED, CALORIE_GOAL_HIT, PROTEIN_GOAL_HIT, WATER_GOAL_HIT, STEP_SYNCED, REFERRAL_COMPLETED, etc.
    payload: Optional[Dict[str, Any]] = None


class MarkSeenRequest(BaseModel):
    badge_ids: List[str]


class OfflineSyncRequest(BaseModel):
    events: List[EventEvaluateRequest]


async def compute_user_metrics(user: User, session: AsyncSession) -> Dict[str, Any]:
    """Compute current dynamic metrics for user from authoritative database records."""
    profile: dict = user.profile or {}
    cal_goal = int(profile.get("goals", {}).get("calories", 2000))
    protein_goal = int(profile.get("goals", {}).get("protein", 120))
    water_goal = int(profile.get("goals", {}).get("water_ml", 2500))

    # 1. Total meals count & aggregate per date
    meals_res = await session.execute(
        select(Meal).where(Meal.user_id == user.id)
    )
    all_meals = list(meals_res.scalars().all())
    total_meals = len(all_meals)

    meal_metrics_by_date = {}
    for m in all_meals:
        if m.logged_at:
            d_str = m.logged_at.date().isoformat()
            if d_str not in meal_metrics_by_date:
                meal_metrics_by_date[d_str] = {"calories": 0.0, "protein": 0.0}
            meal_metrics_by_date[d_str]["calories"] += float(m.calories or 0.0)
            meal_metrics_by_date[d_str]["protein"] += float(m.protein_g or 0.0)

    # 2. Daily summaries
    summaries_res = await session.execute(
        select(DailySummary).where(DailySummary.user_id == user.id).order_by(DailySummary.date_str.asc())
    )
    summaries = list(summaries_res.scalars().all())
    sum_by_date = {str(s.date_str): s for s in summaries}

    combined_by_date = {}
    all_dates = set(sum_by_date.keys()).union(set(meal_metrics_by_date.keys()))

    for d_str in all_dates:
        s = sum_by_date.get(d_str)
        m = meal_metrics_by_date.get(d_str, {"calories": 0.0, "protein": 0.0})
        cal = max(float(s.total_calories or 0.0) if s else 0.0, m["calories"])
        pro = max(float(s.total_protein or 0.0) if s else 0.0, m["protein"])
        water = int(s.water_ml or 0) if s else 0
        combined_by_date[d_str] = {"calories": cal, "protein": pro, "water": water}

    # 3. Streaks
    today = datetime.datetime.now(datetime.timezone.utc).date()
    streak_dates = [(today - datetime.timedelta(days=i)).isoformat() for i in range(1100)]

    sorted_dates = sorted(list(combined_by_date.keys()))
    current_streak = 0
    longest_streak = 0
    temp_streak = 0

    for d_str in sorted_dates:
        c_val = combined_by_date[d_str]["calories"]
        w_val = combined_by_date[d_str]["water"]
        if c_val > 0 or w_val > 0:
            temp_streak += 1
            if temp_streak > longest_streak:
                longest_streak = temp_streak
        else:
            temp_streak = 0

    for offset in range(1100):
        d = streak_dates[offset]
        data_d = combined_by_date.get(d, {"calories": 0.0, "water": 0})
        if data_d["calories"] > 0 or data_d["water"] > 0:
            current_streak += 1
        elif offset == 0:
            yesterday_d = streak_dates[1]
            data_prev = combined_by_date.get(yesterday_d, {"calories": 0.0, "water": 0})
            if data_prev["calories"] > 0 or data_prev["water"] > 0:
                continue
            break
        else:
            break

    # Goal hits
    calorie_hits = sum(
        1 for d_str, v in combined_by_date.items()
        if v["calories"] > 0 and abs(v["calories"] - cal_goal) <= cal_goal * 0.1
    )
    protein_hits = sum(
        1 for d_str, v in combined_by_date.items()
        if v["protein"] >= protein_goal * 0.9
    )
    water_goal_days = sum(
        1 for d_str, v in combined_by_date.items()
        if v["water"] >= water_goal
    )
    water_logs_count = sum(
        1 for d_str, v in combined_by_date.items()
        if v["water"] > 0
    )
    dumpster_diver_unlocked = 1 if profile.get("dumpster_diver_unlocked", False) else 0

    lifetime_steps = int(profile.get("lifetime_steps", 0))
    referrals_count = int(profile.get("referrals_redeemed", 0))
    veggie_meals_count = int(profile.get("veggie_meals_count", 0))
    active_days_total = len([d_str for d_str, v in combined_by_date.items() if v["calories"] > 0 or v["water"] > 0])

    return {
        "streak_days": longest_streak,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "total_meals": total_meals,
        "calorie_goal_days": calorie_hits,
        "protein_goal_days": protein_hits,
        "water_goal_days": water_goal_days,
        "water_logs": water_logs_count,
        "dumpster_diver": dumpster_diver_unlocked,
        "lifetime_steps": lifetime_steps,
        "referrals": referrals_count,
        "veggie_meals": veggie_meals_count,
        "active_days_total": active_days_total,
    }


@router.get("")
async def get_milestones(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    """Retrieve full categorized badge catalog with user progress and unlocked state."""
    metrics = await compute_user_metrics(user, session)

    # Fetch stored user_milestones for earned_at and seen flags
    stored_res = await session.execute(
        select(UserMilestone).where(UserMilestone.user_id == user.id)
    )
    stored_map = {m.badge_id: m for m in stored_res.scalars().all()}

    badges = []
    unlocked_count = 0
    newly_earned_unseen = []

    new_milestones_created = False
    for b in MILESTONE_DEFS:
        vid = b["id"]
        metric_key = b["metric"]
        threshold = b["threshold"]
        curr_val = float(metrics.get(metric_key, 0))

        # Check if threshold reached
        is_earned = curr_val >= threshold
        progress = min(curr_val, threshold)

        stored = stored_map.get(vid)
        earned_at_str = None
        seen_status = True

        if is_earned:
            unlocked_count += 1
            if stored and stored.earned_at:
                earned_at_str = stored.earned_at.isoformat()
                seen_status = stored.seen
            elif stored:
                earned_at_str = utc_now().isoformat()
                seen_status = stored.seen
            else:
                now = utc_now()
                earned_at_str = now.isoformat()
                seen_status = False
                new_m = UserMilestone(
                    id=f"{user.id}_{vid}",
                    user_id=user.id,
                    badge_id=vid,
                    badge_name=b["name"],
                    category=b["category"],
                    rarity="rare" if threshold >= 30 else "common",
                    progress=threshold,
                    threshold=threshold,
                    earned=True,
                    earned_at=now,
                    unlocked_at=now,
                    seen=False,
                )
                session.add(new_m)
                new_milestones_created = True

            if not seen_status:
                newly_earned_unseen.append(vid)

        badge_obj = {
            **b,
            "progress": progress,
            "threshold": threshold,
            "unlocked": is_earned,
            "earned": is_earned,
            "earned_at": earned_at_str,
            "seen": seen_status,
        }
        badges.append(badge_obj)

    if new_milestones_created:
        await session.commit()

    return {
        "current_streak": metrics["current_streak"],
        "longest_streak": metrics["longest_streak"],
        "unlocked": unlocked_count,
        "total": len(MILESTONE_DEFS),
        "badges": badges,
        "unseen_celebrations": newly_earned_unseen,
    }


@router.get("/summary")
async def get_milestones_summary(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    """Lightweight summary endpoint for home screen and profile stats."""
    metrics = await compute_user_metrics(user, session)
    unlocked_count = 0

    for b in MILESTONE_DEFS:
        metric_key = b["metric"]
        threshold = b["threshold"]
        if float(metrics.get(metric_key, 0)) >= threshold:
            unlocked_count += 1

    return {
        "current_streak": metrics["current_streak"],
        "longest_streak": metrics["longest_streak"],
        "earned_count": unlocked_count,
        "total_count": len(MILESTONE_DEFS),
    }


@router.post("/evaluate")
async def evaluate_milestones(
    req: EventEvaluateRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    """Server-authoritative evaluation engine. Idempotently awards badges on events."""
    metrics = await compute_user_metrics(user, session)

    # Fetch stored user_milestones
    stored_res = await session.execute(
        select(UserMilestone).where(UserMilestone.user_id == user.id)
    )
    stored_map = {m.badge_id: m for m in stored_res.scalars().all()}

    newly_unlocked = []

    for b in MILESTONE_DEFS:
        vid = b["id"]
        metric_key = b["metric"]
        threshold = b["threshold"]
        curr_val = float(metrics.get(metric_key, 0))

        if curr_val >= threshold:
            stored = stored_map.get(vid)
            if not stored or not stored.earned:
                # Award new badge
                now = utc_now()
                if not stored:
                    stored = UserMilestone(
                        id=f"{user.id}_{vid}",
                        user_id=user.id,
                        badge_id=vid,
                        badge_name=b["name"],
                        category=b["category"],
                        rarity="rare" if threshold >= 30 else "common",
                        progress=curr_val,
                        threshold=threshold,
                        earned=True,
                        earned_at=now,
                        unlocked_at=now,
                        seen=False,
                    )
                    session.add(stored)
                else:
                    stored.earned = True
                    stored.earned_at = now
                    stored.unlocked_at = now
                    stored.progress = curr_val
                    stored.seen = False

                newly_unlocked.append({
                    **b,
                    "unlocked": True,
                    "earned": True,
                    "earned_at": now.isoformat(),
                    "seen": False,
                })

    if newly_unlocked:
        await session.commit()

    return {
        "ok": True,
        "event_type": req.event_type,
        "newly_unlocked": newly_unlocked,
    }


@router.post("/seen")
async def mark_badges_seen(
    req: MarkSeenRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    """Mark badge celebration modal as seen for given badge IDs."""
    if not req.badge_ids:
        return {"ok": True}

    stored_res = await session.execute(
        select(UserMilestone).where(
            and_(UserMilestone.user_id == user.id, UserMilestone.badge_id.in_(req.badge_ids))
        )
    )
    existing_map = {m.badge_id: m for m in stored_res.scalars().all()}
    now = utc_now()

    for badge_id in req.badge_ids:
        if badge_id in existing_map:
            existing_map[badge_id].seen = True
            session.add(existing_map[badge_id])
        else:
            b_def = BADGE_MAP_BY_ID.get(badge_id)
            if b_def:
                new_m = UserMilestone(
                    id=f"{user.id}_{badge_id}",
                    user_id=user.id,
                    badge_id=badge_id,
                    badge_name=b_def["name"],
                    category=b_def["category"],
                    rarity="rare" if b_def["threshold"] >= 30 else "common",
                    progress=b_def["threshold"],
                    threshold=b_def["threshold"],
                    earned=True,
                    earned_at=now,
                    unlocked_at=now,
                    seen=True,
                )
                session.add(new_m)

    await session.commit()
    return {"ok": True, "updated": req.badge_ids}


@router.post("/sync")
async def sync_offline_milestones(
    req: OfflineSyncRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    """Reconcile offline-queued achievement events and return updated milestone state."""
    for event in req.events:
        await evaluate_milestones(event, user, session)

    return await get_milestones(user, session)
