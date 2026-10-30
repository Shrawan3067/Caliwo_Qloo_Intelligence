from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from cache import cache_get, cache_set, cache_invalidate
from database import get_db
from math_utils import age_from_dob, compute_plan
from models import User
from routers.auth import current_user, public_user

router = APIRouter(prefix="/profile", tags=["profile"])

# Only these keys are ever written to the profile JSON from client input.
# Anything else (e.g. pro_until, entitlements, is_admin) is dropped to prevent
# mass-assignment / privilege escalation.
_ALLOWED_PROFILE_KEYS = {
    "sex", "gender", "date_of_birth", "height_cm", "weight_kg",
    "desired_weight_kg", "goal_weight_kg", "goal", "target_speed",
    "workouts_per_week", "activity_level", "works_with_coach",
    "dietary_preferences", "diet", "obstacles", "accomplishments",
    "add_burned_back", "rollover_calories", "committed", "plan_deadline",
    "daily_calories", "daily_protein_g", "daily_carbs_g", "daily_fat_g",
}

_VALID_SEX = {"male", "female", "other"}
_VALID_GOAL = {"lose", "maintain", "gain"}
_VALID_SPEED = {"slow", "recommended", "fast"}
_VALID_WORKOUTS = {"0-2", "3-5", "6+"}


class OnboardingInput(BaseModel):
    # extra="ignore" => unknown/sensitive keys are silently dropped, never stored.
    model_config = ConfigDict(extra="ignore")

    sex: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=13, le=120)
    height_cm: Optional[float] = Field(default=None, ge=90, le=260)
    weight_kg: Optional[float] = Field(default=None, ge=25, le=400)
    desired_weight_kg: Optional[float] = Field(default=None, ge=25, le=400)
    goal_weight_kg: Optional[float] = Field(default=None, ge=25, le=400)
    goal: Optional[str] = "maintain"
    target_speed: Optional[str] = "recommended"
    workouts_per_week: Optional[str] = None
    activity_level: Optional[str] = None
    works_with_coach: Optional[bool] = None
    add_burned_back: Optional[bool] = None
    rollover_calories: Optional[bool] = None
    committed: Optional[bool] = None
    diet: Optional[str] = None
    plan_deadline: Optional[str] = None
    daily_calories: Optional[float] = None
    daily_protein_g: Optional[float] = None
    daily_carbs_g: Optional[float] = None
    daily_fat_g: Optional[float] = None
    dietary_preferences: List[str] = Field(default_factory=list)
    obstacles: List[str] = Field(default_factory=list)
    accomplishments: List[str] = Field(default_factory=list)

    @field_validator("sex", "gender")
    @classmethod
    def _norm_sex(cls, v):
        if v is None:
            return v
        vv = str(v).strip().lower()
        if vv not in _VALID_SEX:
            raise ValueError("sex must be one of male, female, other")
        return vv

    @field_validator("goal")
    @classmethod
    def _norm_goal(cls, v):
        if v is None:
            return "maintain"
        if v not in _VALID_GOAL:
            raise ValueError("goal must be one of lose, maintain, gain")
        return v

    @field_validator("target_speed")
    @classmethod
    def _norm_speed(cls, v):
        if v is None:
            return "recommended"
        if v not in _VALID_SPEED:
            raise ValueError("target_speed must be one of slow, recommended, fast")
        return v

    @field_validator("workouts_per_week")
    @classmethod
    def _norm_workouts(cls, v):
        if v is None:
            return v
        if v not in _VALID_WORKOUTS:
            raise ValueError("workouts_per_week must be one of 0-2, 3-5, 6+")
        return v

    @field_validator("date_of_birth")
    @classmethod
    def _validate_dob(cls, v):
        if not v:
            return v
        age = age_from_dob(v)
        if age < 13 or age > 120:
            raise ValueError("Age derived from date_of_birth must be between 13 and 120")
        return v


def _resolve_age(profile: dict) -> int:
    dob = profile.get("date_of_birth")
    if dob:
        try:
            return age_from_dob(str(dob))
        except Exception:
            pass
    if profile.get("age"):
        try:
            a = int(profile["age"])
            if 13 <= a <= 120:
                return a
        except (ValueError, TypeError):
            pass
    return int(profile.get("age") or 25)


def _apply_plan(profile: dict, explicit_custom: bool = False) -> dict:
    """Recompute authoritative calorie + macro targets from raw stats.
    If explicit_custom is True, custom overrides provided in payload take precedence."""
    custom_cal = profile.get("daily_calories") if explicit_custom else None
    custom_p = profile.get("daily_protein_g") if explicit_custom else None
    custom_c = profile.get("daily_carbs_g") if explicit_custom else None
    custom_f = profile.get("daily_fat_g") if explicit_custom else None

    if not profile.get("weight_kg") or not profile.get("height_cm"):
        return profile  # not enough data yet; leave targets unset
    plan = compute_plan(
        sex=str(profile.get("sex") or profile.get("gender") or "male"),
        weight_kg=float(profile["weight_kg"]),
        height_cm=float(profile["height_cm"]),
        age=_resolve_age(profile),
        workouts_per_week=str(profile.get("workouts_per_week") or "0-2"),
        goal=str(profile.get("goal") or "maintain"),
        target_speed=str(profile.get("target_speed") or "recommended"),
    )
    profile.update(plan)

    if custom_cal is not None:
        profile["daily_calories"] = custom_cal
    if custom_p is not None:
        profile["daily_protein_g"] = custom_p
    if custom_c is not None:
        profile["daily_carbs_g"] = custom_c
    if custom_f is not None:
        profile["daily_fat_g"] = custom_f

    profile["daily_protein"] = profile["daily_protein_g"]  # legacy alias
    profile["goals"] = {
        "calories": profile["daily_calories"],
        "protein": profile["daily_protein_g"],
        "protein_g": profile["daily_protein_g"],
        "carbs_g": profile["daily_carbs_g"],
        "fat_g": profile["daily_fat_g"],
    }
    return profile


@router.post("/onboarding")
async def save_onboarding(
        inp: OnboardingInput,
        user: User = Depends(current_user),
        session: AsyncSession = Depends(get_db)):
    # Only allowlisted, validated keys are merged.
    incoming = {k: v for k, v in inp.model_dump(exclude_none=True).items()
                if k in _ALLOWED_PROFILE_KEYS}

    new_profile = dict(user.profile) if user.profile else {}  # type: ignore[call-overload]
    new_profile.update(incoming)
    new_profile["onboarded"] = True
    new_profile.setdefault("goal", "maintain")

    _apply_plan(new_profile, explicit_custom=("daily_calories" in incoming))

    user.profile = new_profile  # type: ignore[assignment]
    flag_modified(user, "profile")
    await session.commit()

    # C4: Invalidate cached profile and dependent caches
    await cache_invalidate("profile", str(user.id))
    await cache_invalidate("coach_suggestions", str(user.id))
    await cache_invalidate("dashboard", str(user.id))

    return {"ok": True, "profile": new_profile}


class ProfileUpdateInput(OnboardingInput):
    """Same validated, allowlisted fields — used to edit settings later."""
    pass


@router.put("/me")
async def update_profile(
        inp: ProfileUpdateInput,
        user: User = Depends(current_user),
        session: AsyncSession = Depends(get_db)):
    """Edit core stats/goals after onboarding. Recomputes targets so a user can
    never be left in an inconsistent state (e.g. new weight, stale calories)."""
    if not user.profile or not user.profile.get("onboarded"):  # type: ignore[union-attr]
        raise HTTPException(status_code=400, detail="Complete onboarding first")

    incoming = {k: v for k, v in inp.model_dump(exclude_none=True).items()
                if k in _ALLOWED_PROFILE_KEYS}

    new_profile = dict(user.profile)  # type: ignore[call-overload]
    new_profile.update(incoming)
    _apply_plan(new_profile, explicit_custom=("daily_calories" in incoming))

    user.profile = new_profile  # type: ignore[assignment]
    flag_modified(user, "profile")
    await session.commit()

    # C4: Invalidate cached profile and dependent caches
    await cache_invalidate("profile", str(user.id))
    await cache_invalidate("coach_suggestions", str(user.id))
    await cache_invalidate("dashboard", str(user.id))

    return {"ok": True, "profile": new_profile}



@router.get("/me")
async def get_profile(user: User = Depends(current_user)):
    # C4: Check Redis cache first (60s TTL)
    import json as _json
    cache_key = f"caliwo:profile:{user.id}"
    cached = await cache_get(cache_key)
    if cached:
        try:
            return _json.loads(cached)
        except Exception:
            pass

    prof = dict(user.profile) if user.profile else {}  # type: ignore[call-overload]
    result = {"user": public_user(user), "profile": prof}

    # Store in cache
    await cache_set(cache_key, result, ttl=60)
    return result


@router.delete("/me")
@router.post("/delete")
async def delete_account(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    """
    Cascade Account Deletion Endpoint.

    Fully purges user account and all personal data to satisfy:
    - Apple App Store Guideline 5.1.1(v) (In-app Account Deletion)
    - Google Play Store Data Safety & Account Deletion Policy
    """
    from sqlalchemy import delete
    from models import (
        Meal, DailySummary, UserMilestone,
        SubscriptionRecord, SubscriptionWebhookEvent,
        ChatMessage, UserMemory,
        GroupMember, GroupMessage, MessageReaction,
        GroupJoinRequest, GroupAuditLog, GroupReport,
        FeedbackPost, FeedbackVote, FeedbackComment,
        FeedbackFollower, FeedbackReport, UserNotification,
        UserStreak,
    )

    user_id = user.id

    # Core data
    await session.execute(delete(Meal).where(Meal.user_id == user_id))
    await session.execute(delete(DailySummary).where(DailySummary.user_id == user_id))
    await session.execute(delete(UserMilestone).where(UserMilestone.user_id == user_id))
    await session.execute(delete(SubscriptionRecord).where(SubscriptionRecord.user_id == user_id))
    await session.execute(delete(SubscriptionWebhookEvent).where(SubscriptionWebhookEvent.app_user_id == user_id))
    await session.execute(delete(ChatMessage).where(ChatMessage.user_id == user_id))
    await session.execute(delete(UserMemory).where(UserMemory.user_id == user_id))

    # Social / community data
    await session.execute(delete(MessageReaction).where(MessageReaction.user_id == user_id))
    await session.execute(delete(GroupMessage).where(GroupMessage.user_id == user_id))
    await session.execute(delete(GroupMember).where(GroupMember.user_id == user_id))
    await session.execute(delete(GroupJoinRequest).where(GroupJoinRequest.user_id == user_id))
    await session.execute(delete(GroupAuditLog).where(GroupAuditLog.actor_id == user_id))
    await session.execute(delete(GroupReport).where(GroupReport.reporter_id == user_id))

    # Feedback data
    await session.execute(delete(FeedbackVote).where(FeedbackVote.user_id == user_id))
    await session.execute(delete(FeedbackComment).where(FeedbackComment.user_id == user_id))
    await session.execute(delete(FeedbackFollower).where(FeedbackFollower.user_id == user_id))
    await session.execute(delete(FeedbackReport).where(FeedbackReport.reporter_id == user_id))
    await session.execute(delete(FeedbackPost).where(FeedbackPost.user_id == user_id))

    # Notifications
    await session.execute(delete(UserNotification).where(UserNotification.user_id == user_id))

    # Pre-computed data (H1)
    await session.execute(delete(UserStreak).where(UserStreak.user_id == user_id))

    # Finally the user record
    await session.execute(delete(User).where(User.id == user_id))

    await session.commit()

    # C4: Invalidate all cache keys for the deleted user
    await cache_invalidate("profile", str(user_id))
    await cache_invalidate("subscription", str(user_id))
    await cache_invalidate("dashboard", str(user_id))
    await cache_invalidate("steps", str(user_id))

    return {
        "ok": True,
        "message": "Account and all associated personal data have been permanently deleted."
    }


# ── Account Export ───────────────────────────────────────────────────────

@router.get("/export")
async def account_export(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from models import Meal, DailySummary

    m_res = await session.execute(select(Meal).where(Meal.user_id == user.id))
    meals = [
        {
            "meal_id": m.meal_id,
            "title": m.title,
            "meal_type": m.meal_type,
            "calories": m.calories,
            "protein_g": m.protein_g,
            "carbs_g": m.carbs_g,
            "fat_g": m.fat_g,
            "logged_at": f"{m.logged_at.isoformat()}Z" if m.logged_at else None,
        }
        for m in m_res.scalars().all()
    ]

    s_res = await session.execute(
        select(DailySummary).where(DailySummary.user_id == user.id)
    )
    summaries = s_res.scalars().all()
    sleep_logs = [
        {"date": s.date_str, "hours": s.sleep_hours}
        for s in summaries
        if s.sleep_hours is not None
    ]
    step_entries = [
        {"date": s.date_str, "steps": s.steps}
        for s in summaries
        if s.steps is not None
    ]

    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "profile": user.profile or {},
        },
        "meals": meals,
        "sleep_logs": sleep_logs,
        "step_entries": step_entries,
    }
