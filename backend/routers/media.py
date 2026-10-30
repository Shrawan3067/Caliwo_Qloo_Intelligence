from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from models import User
from routers.auth import current_user
from database import get_db
from media import validate_image_file, process_image, generate_object_keys
from storage import storage_provider
import datetime

router = APIRouter(prefix="/media", tags=["Media"])

@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Handles production-grade multipart file uploads.
    Validates, processes (WebP conversion/resizing), and uploads to S3.
    Returns metadata and keys to be attached to subsequent API calls.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file provided")

    # 1. Validate file (MIME type, size, magic numbers)
    validate_image_file(file_bytes)

    # 2. Process image (EXIF strip, correct orientation, resize, WebP conversion)
    standard_bytes, thumb_bytes, metadata = process_image(file_bytes)

    # 3. Generate predictable S3 object keys
    standard_key, thumb_key = generate_object_keys(str(user.id))

    # 4. Upload to Storage Provider
    success_std = await storage_provider.upload_file(
        standard_bytes, 
        standard_key, 
        metadata["content_type"]
    )
    
    success_thumb = await storage_provider.upload_file(
        thumb_bytes, 
        thumb_key, 
        metadata["content_type"]
    )

    if not success_std or not success_thumb:
        # Rollback partial uploads if possible
        if success_std:
            await storage_provider.delete_file(standard_key)
        if success_thumb:
            await storage_provider.delete_file(thumb_key)
            
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to upload image to storage provider."
        )

    return {
        "ok": True,
        "image_key": standard_key,
        "thumbnail_key": thumb_key,
        "width": metadata["width"],
        "height": metadata["height"],
        "content_type": metadata["content_type"],
        "size_bytes": metadata["size_bytes"],
        "uploaded_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }


# ── Share Card ───────────────────────────────────────────────────────────

@router.get("/share/weekly-card")
async def share_weekly(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    from typing import Any
    from sqlalchemy import select
    from models import DailySummary

    today = datetime.datetime.now(datetime.timezone.utc).date()
    week_dates = [
        (today - datetime.timedelta(days=i)).isoformat()
        for i in range(6, -1, -1)
    ]

    profile: dict = user.profile or {}  # type: ignore
    cal_goal = int(profile.get("goals", {}).get("calories", 2000))
    step_goal = int(profile.get("steps_goal", 10000))
    sleep_goal = float(profile.get("sleep_goal", 8.0))

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

    total_cal = sum(float(s.total_calories or 0.0) for s in summaries)
    total_protein = sum(float(s.total_protein or 0.0) for s in summaries)

    meals_logged = 0
    on_target_days = 0
    streak = 0

    for d in reversed(week_dates):
        if sum_by_date.get(d) and float(sum_by_date[d].total_calories or 0.0) > 0:
            streak += 1
        else:
            break

    for d in week_dates:
        s = sum_by_date.get(d)
        if s and float(s.total_calories or 0.0) > 0:
            meals_logged += 1
            cal = float(s.total_calories or 0.0)
            if 0.6 * cal_goal <= cal <= 1.15 * cal_goal:
                on_target_days += 1

    step_total = sum(int(s.steps or 0) for s in summaries)
    step_days = sum(1 for s in summaries if int(s.steps or 0) > 0)
    step_avg = round(step_total / step_days) if step_days else 0

    sleep_total = sum(float(s.sleep_hours or 0.0) for s in summaries)
    sleep_days = sum(1 for s in summaries if float(s.sleep_hours or 0.0) > 0)
    sleep_avg = round(sleep_total / sleep_days, 1) if sleep_days else 0.0

    weight_history = [
        float(s.weight_kg) for s in summaries if s.weight_kg is not None
    ]
    weight_change_kg = None
    if len(weight_history) >= 2:
        weight_change_kg = round(weight_history[-1] - weight_history[0], 1)

    return {
        "week_range": {"from": week_dates[0], "to": week_dates[-1]},
        "user": {
            "name": str(user.name) if user.name else "You",
            "picture": None,
        },
        "meals": {
            "logged": meals_logged * 3,
            "on_target_days": on_target_days,
            "total_calories": round(total_cal),
            "total_protein_g": round(total_protein),
            "daily_calorie_goal": cal_goal,
        },
        "steps": {
            "total": step_total,
            "average": step_avg,
            "goal": step_goal,
            "logged_days": step_days,
        },
        "sleep": {
            "average_hours": sleep_avg,
            "goal_hours": sleep_goal,
            "logged_days": sleep_days,
        },
        "weight_change_kg": weight_change_kg,
        "streak_days": streak,
        "brand": "Caliwo",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
