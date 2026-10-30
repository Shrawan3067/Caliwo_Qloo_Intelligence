"""
Referrals Router
Production-ready referral code generation, validation, redemption, and Pro access entitlement.
"""

import hashlib
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from database import get_db
from models import User
from routers.auth import current_user

router = APIRouter(prefix="/referrals", tags=["referrals"])


def _get_referral_code(user: User) -> str:
    """Generate or retrieve a clean deterministic referral code for the user."""
    profile: dict = user.profile or {}
    stored = profile.get("referral_code")
    if stored:
        return stored.upper()
    h = hashlib.sha256(user.id.encode()).hexdigest()[:6].upper()
    return f"CALIWO{h}"



def _normalize_code(code: str) -> str:
    """Normalize user input by stripping whitespace, hyphens, and uppercase."""
    return code.strip().upper().replace(" ", "")


def _extend_pro_access(user: User, days: int = 7) -> datetime.datetime:
    """Extend or activate Pro membership for the user by N days."""
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    base = now
    if getattr(user, "pro_expires_at", None) and user.pro_expires_at > now:
        base = user.pro_expires_at
    new_expiration = base + datetime.timedelta(days=days)
    user.pro_expires_at = new_expiration
    user.pro_active = True

    prof = dict(user.profile) if user.profile else {}
    prof["pro_active"] = True
    prof["pro_until"] = new_expiration.isoformat()
    prof["referral_bonus_days"] = prof.get("referral_bonus_days", 0) + days
    user.profile = prof
    flag_modified(user, "profile")
    return new_expiration


async def award_referral_commission(
    session: AsyncSession,
    purchaser: User,
    amount_usd: float,
    plan_name: str,
    transaction_id: Optional[str] = None
) -> Optional[dict]:
    """
    Check if purchaser was referred by another user.
    If so, award 20% commission on the purchase price (e.g. $9.99 -> $2.00)
    and update referrer's profile.
    """
    profile: dict = purchaser.profile or {}
    referrer_id = profile.get("referred_by_user_id")
    if not referrer_id:
        return None

    res = await session.execute(select(User).where(User.id == referrer_id))
    referrer = res.scalar_one_or_none()
    if not referrer:
        return None

    commission_rate = 0.20
    commission_amount = round(amount_usd * commission_rate, 2)
    tx_key = transaction_id or f"tx_{purchaser.id}_{datetime.datetime.now(datetime.timezone.utc).timestamp()}"

    ref_prof = dict(referrer.profile) if referrer.profile else {}
    commission_history: list = ref_prof.get("commission_history", [])

    # Idempotency check for this transaction
    for ch in commission_history:
        if ch.get("tx_key") == tx_key:
            return None

    total_earned = round(float(ref_prof.get("total_commission_earned", 0.0)) + commission_amount, 2)
    balance = round(float(ref_prof.get("commission_balance", 0.0)) + commission_amount, 2)
    paid_conversions = int(ref_prof.get("paid_conversions", 0)) + 1

    entry = {
        "tx_key": tx_key,
        "referee_id": purchaser.id[:8] + "...",
        "plan": plan_name,
        "purchase_amount_usd": amount_usd,
        "commission_usd": commission_amount,
        "commission_rate": commission_rate,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    commission_history.append(entry)
    ref_prof["total_commission_earned"] = total_earned
    ref_prof["commission_balance"] = balance
    ref_prof["paid_conversions"] = paid_conversions
    ref_prof["commission_history"] = commission_history[-50:]  # Keep recent 50

    referrer.profile = ref_prof
    flag_modified(referrer, "profile")
    await session.commit()

    return {
        "referrer_id": referrer.id,
        "commission_usd": commission_amount,
        "total_earned": total_earned
    }


@router.get("/me")
async def get_my_referral_info(user: User = Depends(current_user)):
    """Return user's referral code, commission stats, share link, and earnings."""
    profile: dict = user.profile or {}
    code = _get_referral_code(user)

    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    pro_active = False
    days_left = 0
    if getattr(user, "pro_expires_at", None) and user.pro_expires_at > now:
        pro_active = True
        days_left = max(0, (user.pro_expires_at - now).days + 1)

    total_commission_earned = round(float(profile.get("total_commission_earned", 0.0)), 2)
    commission_balance = round(float(profile.get("commission_balance", 0.0)), 2)

    return {
        "code": code,
        "commission_rate": 0.20,
        "total_commission_earned": total_commission_earned,
        "commission_balance": commission_balance,
        "redemptions": profile.get("referrals_redeemed", 0),
        "paid_conversions": profile.get("paid_conversions", 0),
        "commission_history": profile.get("commission_history", []),
        "share_url": f"https://caliwo.app/join?ref={code}",
        "share_message": (
            f"Join me on Caliwo — your AI nutrition coach! Use my code {code} "
            f"when you sign up: https://caliwo.app/join?ref={code}"
        ),
        "already_redeemed_a_code": bool(profile.get("redeemed_code")),
        "redeemed_code": profile.get("redeemed_code"),
        "pro_active": pro_active,
        "pro_expires_at": user.pro_expires_at.isoformat() if getattr(user, "pro_expires_at", None) else None,
        "pro_days_remaining": days_left,
        "bonus_days_earned": profile.get("referral_bonus_days", 0),
        "bonus_days_per_referral": 0,
    }


class RedeemRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=30)


@router.post("/redeem")
async def redeem_referral_code(
    req: RedeemRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Redeem a referral code from a friend.
    Links the referee to the referrer so the referrer earns 20% commission on subscriptions.
    """
    profile: dict = dict(user.profile) if user.profile else {}
    if profile.get("redeemed_code"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already redeemed a referral code.",
        )

    code_clean = _normalize_code(req.code)
    if not code_clean or len(code_clean) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid referral code.",
        )

    # Check that user is not redeeming their own code
    own_code = _get_referral_code(user)
    own_clean = _normalize_code(own_code)
    if code_clean == own_clean or code_clean == own_clean.replace("CALIWO-", "") or code_clean == own_clean.replace("REF", ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot redeem your own referral code.",
        )

    # Search for referrer by code — use SQL JSONB filtering instead of loading all users
    referrer = None

    # 1. Try direct match on profile->'referral_code'
    from sqlalchemy import cast, String, func
    from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB

    # Query users where profile->>'referral_code' matches (case-insensitive)
    stmt = select(User).where(
        func.upper(User.profile["referral_code"].astext) == code_clean
    )
    result = await session.execute(stmt)
    candidates = result.scalars().all()

    for u in candidates:
        if u.id != user.id:
            referrer = u
            break

    # 2. If no direct match, check generated codes for users without stored codes
    #    (fallback for users who haven't had their code persisted yet)
    if not referrer:
        # Only scan users who DON'T have a stored referral_code (smaller set)
        stmt_no_code = select(User).where(
            or_(
                User.profile["referral_code"] == None,  # noqa: E711
                ~User.profile.has_key("referral_code"),
            )
        ).limit(500)  # Safety cap
        result2 = await session.execute(stmt_no_code)
        for u in result2.scalars().all():
            if u.id == user.id:
                continue
            u_code = _get_referral_code(u)
            u_clean = _normalize_code(u_code)
            if code_clean == u_clean or code_clean == u_clean.replace("CALIWO", ""):
                referrer = u
                # Persist the code so future lookups are O(1)
                ref_p = dict(u.profile) if u.profile else {}
                ref_p["referral_code"] = u_clean
                u.profile = ref_p
                flag_modified(u, "profile")
                break

    if not referrer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid referral code. Please check the code and try again.",
        )

    # 1. Update Referrer stats
    ref_prof = dict(referrer.profile) if referrer.profile else {}
    ref_prof["referrals_redeemed"] = ref_prof.get("referrals_redeemed", 0) + 1
    ref_history: list = ref_prof.get("referral_history", [])
    ref_history.append({
        "referee_id": user.id[:8] + "...",
        "redeemed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    })
    ref_prof["referral_history"] = ref_history[-20:]
    referrer.profile = ref_prof
    flag_modified(referrer, "profile")

    # 2. Link Redeemer to Referrer
    profile = dict(user.profile) if user.profile else {}
    profile["redeemed_code"] = code_clean
    profile["referred_by_user_id"] = referrer.id
    user.profile = profile
    flag_modified(user, "profile")

    await session.commit()

    return {
        "ok": True,
        "commission_rate": 0.20,
        "message": "Referral code redeemed successfully! Your friend will receive a 20% commission reward when you subscribe.",
    }

