import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from database import get_db, get_read_db
from models import DailySummary, User
from routers.auth import current_user
from timezone_utils import get_utc_now, resolve_local_date_str
from cache import cache_get, cache_set, cache_invalidate

router = APIRouter(tags=["health"])


class WaterLog(BaseModel):
    ml: int
    tz_offset: int = 0
    date: Optional[str] = None



class StepEntry(BaseModel):
    date: str
    steps: int
    distance_m: Optional[float] = None
    calories: Optional[float] = None

class StepSync(BaseModel):
    platform: Optional[str] = "manual"
    source: Optional[str] = "manual"
    entries: List[StepEntry]


class SleepLog(BaseModel):
    hours: float
    quality: Optional[str] = "good"
    tz_offset: int = 0
    date: Optional[str] = None


async def get_or_create_summary(
        session: AsyncSession,
        user_id: str,
        tz_offset: int,
        date: Optional[str] = None) -> DailySummary:
    local_date = date if date else resolve_local_date_str(get_utc_now(), tz_offset)
    result = await session.execute(
        select(DailySummary).where(
            DailySummary.user_id == user_id,
            DailySummary.date_str == local_date
        )
    )
    summary = result.scalars().first()
    if not summary:
        summary = DailySummary(
            id="sum_" + uuid.uuid4().hex[:12],
            user_id=user_id,
            date_str=local_date
        )
        session.add(summary)
        await session.commit()
        await session.refresh(summary)
    return summary


@router.post("/water/log")
async def log_water(
        inp: WaterLog,
        session: AsyncSession = Depends(get_db),
        user: User = Depends(current_user)):
    summary = await get_or_create_summary(session, str(user.id), inp.tz_offset, inp.date)
    summary.water_ml = int((summary.water_ml or 0) + inp.ml)  # type: ignore[assignment]
    await session.commit()

    # C4: Invalidate dashboard and nutrition caches on write
    await cache_invalidate("dashboard", str(user.id))
    await cache_invalidate("nutrition", str(user.id))

    return {"ok": True, "water_ml": summary.water_ml, "total_ml": summary.water_ml}


class WeightLog(BaseModel):
    weight_kg: Optional[float] = None
    weight: Optional[float] = None
    unit: Optional[str] = "kg"  # "kg" or "lbs"
    tz_offset: int = 0
    date: Optional[str] = None
    notes: Optional[str] = None


class SetWeightGoalInput(BaseModel):
    goal_weight_kg: Optional[float] = None
    desired_weight_kg: Optional[float] = None
    unit: Optional[str] = "kg"


def _compute_bmi_category(bmi: Optional[float]) -> Optional[str]:
    if bmi is None:
        return None
    if bmi < 18.5:
        return "Underweight"
    elif bmi < 25.0:
        return "Normal weight"
    elif bmi < 30.0:
        return "Overweight"
    else:
        return "Obese"


@router.post("/weight/log")
async def log_weight(
        inp: WeightLog,
        session: AsyncSession = Depends(get_db),
        user: User = Depends(current_user)):
    from sqlalchemy.orm.attributes import flag_modified

    # Resolve weight value in kg
    target_kg: Optional[float] = None
    if inp.weight_kg is not None:
        target_kg = float(inp.weight_kg)
    elif inp.weight is not None:
        if (inp.unit or "kg").lower() == "lbs":
            target_kg = round(float(inp.weight) * 0.45359237, 2)
        else:
            target_kg = float(inp.weight)

    if target_kg is None or target_kg < 20.0 or target_kg > 400.0:
        raise HTTPException(
            status_code=400,
            detail="Weight must be between 20 kg (44 lbs) and 400 kg (880 lbs)."
        )

    target_kg = round(target_kg, 2)
    weight_lbs = round(target_kg * 2.20462, 1)

    summary = await get_or_create_summary(session, str(user.id), inp.tz_offset, inp.date)
    summary.weight_kg = target_kg  # type: ignore[assignment]

    prof = dict(user.profile or {})
    w_logs = list(prof.get("weight_logs", []))
    now_iso = datetime.now(timezone.utc).isoformat()

    # Deduplicate or insert in date order
    existing_idx = next((i for i, item in enumerate(w_logs) if str(item.get("date")) == str(summary.date_str)), None)
    new_entry = {
        "weight_kg": target_kg,
        "weight": target_kg,
        "weight_lbs": weight_lbs,
        "date": summary.date_str,
        "logged_at": now_iso,
        "notes": inp.notes or ""
    }

    if existing_idx is not None:
        w_logs[existing_idx] = new_entry
    else:
        w_logs.append(new_entry)

    # Sort chronologically by date
    w_logs.sort(key=lambda x: str(x.get("date", "")))

    # H4: Cap weight_logs to last 90 entries to prevent unbounded JSONB growth.
    # Full history is already preserved in DailySummary.weight_kg and merged
    # by the /weight/history endpoint.
    if len(w_logs) > 90:
        w_logs = w_logs[-90:]

    # Update profile state
    prof["weight_logs"] = w_logs
    prof["weight_kg"] = target_kg
    prof["weight"] = target_kg
    user.profile = prof
    flag_modified(user, "profile")
    await session.commit()

    # Calculate BMI if height available
    height_cm = prof.get("height_cm")
    bmi: Optional[float] = None
    if height_cm and float(height_cm) > 50:
        bmi = round(target_kg / ((float(height_cm) / 100.0) ** 2), 1)

    # Calculate goal distance
    goal_kg = prof.get("desired_weight_kg") or prof.get("goal_weight_kg")
    diff_to_goal = round(target_kg - float(goal_kg), 2) if goal_kg else None

    return {
        "ok": True,
        "weight_kg": target_kg,
        "weight_lbs": weight_lbs,
        "date": summary.date_str,
        "bmi": bmi,
        "bmi_category": _compute_bmi_category(bmi),
        "diff_to_goal_kg": diff_to_goal,
        "log": new_entry
    }


@router.get("/weight/history")
async def weight_history(
        days: int = 90,
        session: AsyncSession = Depends(get_read_db),
        user: User = Depends(current_user)):
    prof = dict(user.profile or {})
    w_logs = list(prof.get("weight_logs", []))

    # Also query DailySummary records for complete merge
    result = await session.execute(
        select(DailySummary)
        .where(DailySummary.user_id == user.id, DailySummary.weight_kg.isnot(None))
        .order_by(DailySummary.date_str.asc())
        .limit(days)
    )
    db_summaries = result.scalars().all()

    # Merge records by date
    merged_by_date: dict[str, dict] = {}
    for h in db_summaries:
        if h.weight_kg:
            w_kg = round(float(h.weight_kg), 2)
            merged_by_date[str(h.date_str)] = {
                "date": str(h.date_str),
                "weight": w_kg,
                "weight_kg": w_kg,
                "weight_lbs": round(w_kg * 2.20462, 1),
                "logged_at": f"{h.date_str}T00:00:00Z",
                "notes": ""
            }

    for log in w_logs:
        d = str(log.get("date", ""))
        w_kg = round(float(log.get("weight_kg") or log.get("weight") or 0.0), 2)
        if d and w_kg > 0:
            merged_by_date[d] = {
                "date": d,
                "weight": w_kg,
                "weight_kg": w_kg,
                "weight_lbs": round(w_kg * 2.20462, 1),
                "logged_at": log.get("logged_at", f"{d}T00:00:00Z"),
                "notes": log.get("notes", "")
            }

    sorted_logs = sorted(merged_by_date.values(), key=lambda x: x["date"])

    # Compute enriched changes
    height_cm = prof.get("height_cm")
    start_kg = sorted_logs[0]["weight_kg"] if sorted_logs else prof.get("weight_kg")
    current_kg = sorted_logs[-1]["weight_kg"] if sorted_logs else prof.get("weight_kg")
    goal_kg = prof.get("desired_weight_kg") or prof.get("goal_weight_kg")

    enriched_logs = []
    prev_kg = start_kg
    for entry in sorted_logs:
        curr = entry["weight_kg"]
        entry["change_prev_kg"] = round(curr - prev_kg, 2) if prev_kg else 0.0
        entry["change_start_kg"] = round(curr - start_kg, 2) if start_kg else 0.0
        if height_cm and float(height_cm) > 50:
            entry["bmi"] = round(curr / ((float(height_cm) / 100.0) ** 2), 1)
        prev_kg = curr
        enriched_logs.append(entry)

    # Current BMI
    current_bmi: Optional[float] = None
    if current_kg and height_cm and float(height_cm) > 50:
        current_bmi = round(float(current_kg) / ((float(height_cm) / 100.0) ** 2), 1)

    total_change_kg = round(float(current_kg) - float(start_kg), 2) if (current_kg and start_kg) else 0.0

    stats = {
        "current_weight_kg": current_kg,
        "current_weight_lbs": round(float(current_kg) * 2.20462, 1) if current_kg else None,
        "starting_weight_kg": start_kg,
        "starting_weight_lbs": round(float(start_kg) * 2.20462, 1) if start_kg else None,
        "goal_weight_kg": goal_kg,
        "goal_weight_lbs": round(float(goal_kg) * 2.20462, 1) if goal_kg else None,
        "total_change_kg": total_change_kg,
        "total_change_lbs": round(total_change_kg * 2.20462, 1),
        "bmi": current_bmi,
        "bmi_category": _compute_bmi_category(current_bmi),
        "logs_count": len(enriched_logs)
    }

    return {
        "history": enriched_logs,
        "logs": enriched_logs,
        "stats": stats
    }


@router.delete("/weight/log")
@router.delete("/weight/log/{date_str}")
async def delete_weight_log(
        date_str: Optional[str] = None,
        date: Optional[str] = None,
        session: AsyncSession = Depends(get_db),
        user: User = Depends(current_user)):
    from sqlalchemy.orm.attributes import flag_modified
    target_date = date_str or date
    if not target_date:
        raise HTTPException(status_code=400, detail="Date is required to delete a weight log.")

    # 1. Update DailySummary
    res = await session.execute(
        select(DailySummary).where(
            DailySummary.user_id == user.id,
            DailySummary.date_str == target_date
        )
    )
    summary = res.scalars().first()
    if summary:
        summary.weight_kg = None  # type: ignore[assignment]

    # 2. Update user.profile["weight_logs"]
    prof = dict(user.profile or {})
    w_logs = [log for log in prof.get("weight_logs", []) if str(log.get("date")) != target_date]
    prof["weight_logs"] = w_logs

    # Update latest weight
    if w_logs:
        w_logs.sort(key=lambda x: str(x.get("date", "")))
        latest_kg = w_logs[-1].get("weight_kg") or w_logs[-1].get("weight")
        prof["weight_kg"] = latest_kg
        prof["weight"] = latest_kg

    user.profile = prof
    flag_modified(user, "profile")
    await session.commit()
    return {"ok": True, "deleted_date": target_date, "remaining_logs": len(w_logs)}


@router.get("/weight/goal")
async def get_weight_goal(user: User = Depends(current_user)):
    prof = dict(user.profile or {})
    goal_kg = prof.get("desired_weight_kg") or prof.get("goal_weight_kg")
    return {
        "goal_weight_kg": goal_kg,
        "goal_weight_lbs": round(float(goal_kg) * 2.20462, 1) if goal_kg else None
    }


@router.post("/weight/goal")
async def set_weight_goal(
        inp: SetWeightGoalInput,
        session: AsyncSession = Depends(get_db),
        user: User = Depends(current_user)):
    from sqlalchemy.orm.attributes import flag_modified
    target_kg: Optional[float] = None
    if inp.goal_weight_kg is not None:
        target_kg = float(inp.goal_weight_kg)
    elif inp.desired_weight_kg is not None:
        target_kg = float(inp.desired_weight_kg)

    if (inp.unit or "kg").lower() == "lbs" and target_kg is not None:
        target_kg = round(target_kg * 0.45359237, 2)

    if target_kg is not None and (target_kg < 20.0 or target_kg > 400.0):
        raise HTTPException(
            status_code=400,
            detail="Goal weight must be between 20 kg and 400 kg."
        )

    prof = dict(user.profile or {})
    prof["desired_weight_kg"] = target_kg
    prof["goal_weight_kg"] = target_kg
    user.profile = prof
    flag_modified(user, "profile")
    await session.commit()
    return {
        "ok": True,
        "goal_weight_kg": target_kg,
        "goal_weight_lbs": round(float(target_kg) * 2.20462, 1) if target_kg else None
    }


@router.post("/steps/sync")
async def sync_steps(
        inp: StepSync,
        session: AsyncSession = Depends(get_db),
        user: User = Depends(current_user)):
    import uuid
    from sqlalchemy import update
    synced = 0
    for entry in inp.entries:
        result = await session.execute(
            select(DailySummary).where(
                DailySummary.user_id == user.id, 
                DailySummary.date_str == entry.date
            )
        )
        summary = result.scalars().first()
        if not summary:
            summary = DailySummary(
                id="sum_" + uuid.uuid4().hex[:12],
                user_id=user.id,
                date_str=entry.date
            )
            session.add(summary)
        
        # Idempotent max merge
        current_steps = summary.steps or 0
        summary.steps = max(current_steps, entry.steps)  # type: ignore[assignment]
        synced += 1

    profile: dict = dict(user.profile) if user.profile else {}  # type: ignore[call-overload]
    if inp.source:
        profile["steps_source"] = inp.source
    profile["steps_last_sync"] = get_utc_now().isoformat()
    await session.execute(update(User).where(User.id == user.id).values(profile=profile))

    await session.commit()

    # C4: Invalidate steps and dashboard cache on sync
    for entry in inp.entries:
        await cache_invalidate("steps", f"{user.id}:{entry.date}")
    await cache_invalidate("dashboard", str(user.id))

    return {"ok": True, "synced": synced}


@router.get("/steps/today")
async def get_steps_today(
        date: Optional[str] = None,
        tz_offset: int = 0,
        session: AsyncSession = Depends(get_read_db),
        user: User = Depends(current_user)):
    profile: dict = user.profile or {} # type: ignore
    is_disconnected = bool(profile.get("steps_disconnected"))
    goal = int(profile.get("steps_goal", 10000))

    if is_disconnected:
        return {
            "steps": 0,
            "goal": goal,
            "remaining": goal,
            "progress_pct": 0.0,
            "source": "disconnected",
            "last_sync": None,
            "distance_m": 0.0,
            "calories": 0.0,
            "goal_reached": False,
            "disconnected": True
        }

    local_date = date if date else resolve_local_date_str(get_utc_now(), tz_offset)

    # C4: Check cache (15s TTL — high-frequency polling endpoint)
    import json as _json
    cache_key = f"caliwo:steps:{user.id}:{local_date}"
    cached = await cache_get(cache_key)
    if cached:
        try:
            return _json.loads(cached)
        except Exception:
            pass

    result = await session.execute(
        select(DailySummary).where(DailySummary.user_id == user.id, DailySummary.date_str == local_date)
    )
    summary = result.scalars().first()
    
    steps = summary.steps if summary else 0
    source = profile.get("steps_source", "pedometer_ios")
    last_sync = profile.get("steps_last_sync", get_utc_now().isoformat())
    
    response = {
        "steps": steps,
        "goal": goal,
        "remaining": max(0, goal - steps),
        "progress_pct": min(100.0, (steps / goal) * 100.0) if goal else 0.0,
        "source": source,
        "last_sync": last_sync,
        "distance_m": round(steps * 0.75, 1),
        "calories": round(steps * 0.04, 1),
        "goal_reached": steps >= goal,
        "disconnected": False
    }

    # C4: Cache for 15 seconds
    await cache_set(cache_key, response, ttl=15)
    return response



@router.post("/sleep/log")
async def log_sleep(
        inp: SleepLog,
        session: AsyncSession = Depends(get_db),
        user: User = Depends(current_user)):
    from fastapi import HTTPException
    from sqlalchemy.orm.attributes import flag_modified
    if inp.hours < 0 or inp.hours > 24:
        raise HTTPException(status_code=400, detail="Invalid sleep hours")
    
    summary = await get_or_create_summary(session, str(user.id), inp.tz_offset, inp.date)
    summary.sleep_hours = inp.hours  # type: ignore[assignment]
    # H4: Store sleep quality in DailySummary column (not profile JSONB)
    summary.sleep_quality = inp.quality or "good"  # type: ignore[assignment]
    
    # Backward-compat: keep last 7 days in profile JSONB for old clients,
    # but trim older entries to prevent unbounded growth (H4 fix)
    profile: dict = dict(user.profile or {})
    sleep_qualities = dict(profile.get("sleep_qualities", {}))
    sleep_qualities[summary.date_str] = inp.quality or "good"
    # Trim to last 7 entries to cap JSONB size
    if len(sleep_qualities) > 7:
        sorted_dates = sorted(sleep_qualities.keys())
        for old_date in sorted_dates[:-7]:
            del sleep_qualities[old_date]
    profile["sleep_qualities"] = sleep_qualities
    user.profile = profile # type: ignore[assignment]
    flag_modified(user, "profile")

    await session.commit()

    # C4: Invalidate dashboard cache
    await cache_invalidate("dashboard", str(user.id))

    return {
        "ok": True,
        "sleep_hours": summary.sleep_hours,
        "log": {
            "hours": summary.sleep_hours,
            "quality": inp.quality or "good",
            "date": summary.date_str
        }
    }


@router.get("/sleep/today")
async def get_sleep_today(
        date: Optional[str] = None,
        tz_offset: int = 0,
        session: AsyncSession = Depends(get_db),
        user: User = Depends(current_user)):
    local_date = date if date else resolve_local_date_str(get_utc_now(), tz_offset)
    result = await session.execute(
        select(DailySummary).where(DailySummary.user_id == user.id, DailySummary.date_str == local_date)
    )
    summary = result.scalars().first()
    
    profile: dict = user.profile or {} # type: ignore
    goal_hours = float(profile.get("sleep_goal", 8.0))
    hours = float(summary.sleep_hours or 0.0) if summary else 0.0

    # H4: Read quality from DailySummary column first, fall back to profile JSONB
    quality = None
    if summary and getattr(summary, "sleep_quality", None):
        quality = summary.sleep_quality
    if not quality:
        sleep_qualities = profile.get("sleep_qualities", {})
        quality = sleep_qualities.get(local_date, "good" if hours >= 7 else "Needs Improvement")
    
    return {
        "hours": hours,
        "goal_hours": goal_hours,
        "progress_pct": min(100.0, (hours / goal_hours) * 100.0) if goal_hours else 0.0,
        "quality": quality,
        "logged": bool(summary and summary.sleep_hours is not None and summary.sleep_hours > 0)
    }


# ── Steps Analytics ──────────────────────────────────────────────────────

@router.get("/steps/history")
async def steps_history(
    days: int = 7,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_read_db),
):
    import datetime as _dt

    days = max(1, min(90, days))
    today = _dt.datetime.now(_dt.timezone.utc).date()
    dates = [(today - _dt.timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]

    result = await session.execute(
        select(DailySummary).where(
            DailySummary.user_id == user.id,
            DailySummary.date_str.in_(dates),
        )
    )
    summaries = {s.date_str: int(s.steps or 0) for s in result.scalars().all()}
    profile: dict = user.profile or {}
    goal = int(profile.get("steps_goal", 10000))

    entries = []
    for d in dates:
        st = summaries.get(d, 0)
        entries.append({"date": d, "steps": st, "goal_reached": st >= goal})

    return {"goal": goal, "entries": entries, "history": entries}


@router.get("/steps/analytics/weekly")
async def steps_weekly(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    import datetime as _dt

    profile: dict = user.profile or {}
    goal = int(profile.get("steps_goal", 10000))

    today = _dt.datetime.now(_dt.timezone.utc).date()
    week_dates = [(today - _dt.timedelta(days=i)).isoformat() for i in range(6, -1, -1)]
    prev_week_dates = [(today - _dt.timedelta(days=i)).isoformat() for i in range(13, 6, -1)]

    result = await session.execute(
        select(DailySummary).where(
            DailySummary.user_id == user.id,
            DailySummary.date_str.in_(week_dates + prev_week_dates),
        )
    )
    summaries = {s.date_str: int(s.steps or 0) for s in result.scalars().all()}

    entries = []
    curr_total = 0
    highest = 0
    lowest = float("inf") if any(d in summaries for d in week_dates) else 0
    days_goal_hit = 0

    for d in week_dates:
        st = summaries.get(d, 0)
        curr_total += st
        if st > highest:
            highest = st
        if st < lowest:
            lowest = st
        if st >= goal:
            days_goal_hit += 1
        entries.append({"date": d, "steps": st})

    if lowest == float("inf"):
        lowest = 0

    n_days = max(1, len(entries))
    avg = round(curr_total / n_days)

    prev_total = sum(summaries.get(d, 0) for d in prev_week_dates)
    trend_pct = 0.0
    if prev_total > 0:
        trend_pct = round(((curr_total - prev_total) / prev_total) * 100.0, 1)

    # Streaks
    all_dates = [(today - _dt.timedelta(days=i)).isoformat() for i in range(60)]
    all_res = await session.execute(
        select(DailySummary.date_str, DailySummary.steps).where(
            DailySummary.user_id == user.id,
            DailySummary.date_str.in_(all_dates),
        )
    )
    all_sum = {str(r[0]): int(r[1] or 0) for r in all_res.all()}

    longest_streak = 0
    temp_streak = 0
    for d in reversed(all_dates):
        if all_sum.get(d, 0) >= goal:
            temp_streak += 1
            if temp_streak > longest_streak:
                longest_streak = temp_streak
        else:
            temp_streak = 0

    current_streak = 0
    for offset in range(60):
        d = all_dates[offset]
        st = all_sum.get(d, 0)
        if st >= goal:
            current_streak += 1
        elif offset == 0:
            if all_sum.get(all_dates[1], 0) >= goal:
                continue
            break
        else:
            break

    return {
        "goal": goal,
        "entries": entries,
        "stats": {
            "total": curr_total,
            "average": avg,
            "highest": highest,
            "lowest": lowest,
            "days_goal_hit": days_goal_hit,
            "current_streak": current_streak,
            "longest_streak": longest_streak,
        },
        "trend_vs_prev_week_pct": trend_pct,
    }


@router.get("/steps/analytics/monthly")
async def steps_monthly(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    import datetime as _dt

    profile: dict = user.profile or {}
    goal = int(profile.get("steps_goal", 10000))

    today = _dt.datetime.now(_dt.timezone.utc).date()
    dates = [(today - _dt.timedelta(days=i)).isoformat() for i in range(29, -1, -1)]

    result = await session.execute(
        select(DailySummary).where(
            DailySummary.user_id == user.id,
            DailySummary.date_str.in_(dates),
        )
    )
    summaries = {s.date_str: int(s.steps or 0) for s in result.scalars().all()}

    entries = []
    curr_total = 0
    highest = 0
    lowest = float("inf") if any(d in summaries for d in dates) else 0
    days_goal_hit = 0
    best_day = None

    for d in dates:
        st = summaries.get(d, 0)
        curr_total += st
        if st > highest:
            highest = st
            best_day = {"date": d, "steps": st}
        if st < lowest:
            lowest = st
        if st >= goal:
            days_goal_hit += 1
        entries.append({"date": d, "steps": st})

    if lowest == float("inf"):
        lowest = 0

    n_days = max(1, len(entries))
    avg = round(curr_total / n_days)

    return {
        "goal": goal,
        "entries": entries,
        "stats": {
            "total": curr_total,
            "average": avg,
            "highest": highest,
            "lowest": lowest,
            "days_goal_hit": days_goal_hit,
            "current_streak": 0,
            "longest_streak": 0,
        },
        "best_day": best_day,
    }


class SetStepGoalInput(BaseModel):
    daily_goal: int


@router.get("/steps/goal")
async def steps_goal(user: User = Depends(current_user)):
    profile: dict = user.profile or {}
    return {"daily_goal": int(profile.get("steps_goal", 10000))}


@router.post("/steps/goal")
async def set_steps_goal(
    inp: SetStepGoalInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):

    if inp.daily_goal < 1000 or inp.daily_goal > 100000:
        raise HTTPException(status_code=400, detail="Goal out of range (1,000 - 100,000)")

    profile: dict = dict(user.profile) if user.profile else {}
    profile["steps_goal"] = inp.daily_goal
    user.profile = profile
    flag_modified(user, "profile")
    await session.commit()
    return {"ok": True, "daily_goal": inp.daily_goal}


@router.delete("/steps/disconnect")
async def steps_disconnect(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):

    profile: dict = dict(user.profile) if user.profile else {}
    profile["steps_disconnected"] = True
    user.profile = profile
    flag_modified(user, "profile")
    await session.commit()
    return {"ok": True, "disconnected": True}


# ── Sleep Goal & History ─────────────────────────────────────────────────

class SetSleepGoalInput(BaseModel):
    daily_goal_hours: float


@router.get("/sleep/goal")
async def sleep_goal_get(user: User = Depends(current_user)):
    profile: dict = user.profile or {}
    return {"daily_goal_hours": float(profile.get("sleep_goal", 8.0))}


@router.post("/sleep/goal")
async def set_sleep_goal(
    inp: SetSleepGoalInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):

    if inp.daily_goal_hours < 3.0 or inp.daily_goal_hours > 14.0:
        raise HTTPException(
            status_code=400, detail="Daily goal hours must be between 3.0 and 14.0"
        )

    profile: dict = dict(user.profile) if user.profile else {}
    profile["sleep_goal"] = inp.daily_goal_hours
    user.profile = profile
    flag_modified(user, "profile")
    await session.commit()
    return {"ok": True, "daily_goal_hours": inp.daily_goal_hours}


@router.get("/sleep/history")
async def sleep_history(
    days: int = 7,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_read_db),
):
    import datetime as _dt

    days = max(1, min(90, days))
    today = _dt.datetime.now(_dt.timezone.utc).date()
    dates = [(today - _dt.timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]

    result = await session.execute(
        select(DailySummary).where(
            DailySummary.user_id == user.id,
            DailySummary.date_str.in_(dates),
        )
    )
    summaries = {s.date_str: float(s.sleep_hours or 0.0) for s in result.scalars().all()}

    profile: dict = user.profile or {}
    goal_hours = float(profile.get("sleep_goal", 8.0))

    entries = []
    logged_days = 0
    total_hours = 0.0
    for d in dates:
        h = summaries.get(d, 0.0)
        if h > 0:
            logged_days += 1
            total_hours += h
        entries.append({"date": d, "hours": h})

    avg_hours = round(total_hours / logged_days, 1) if logged_days > 0 else 0.0

    return {
        "history": entries,
        "entries": entries,
        "logged_days": logged_days,
        "avg_hours": avg_hours,
        "goal_hours": goal_hours,
    }
