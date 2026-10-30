"""
RevenueCat Webhook & Subscription Controller Router
Enterprise In-App Purchase Verification & Idempotency Engine
"""

import os
import uuid
import datetime
from typing import Optional, List, Union, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Header, status, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User, SubscriptionRecord, SubscriptionWebhookEvent
from routers.auth import current_user
from routers.referrals import award_referral_commission
from cache import cache_get, cache_set, cache_invalidate

router = APIRouter(prefix="/subscription", tags=["subscriptions"])

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "webhook_secret_placeholder_token")
_IS_PROD = os.environ.get("ENVIRONMENT", "").lower() == "production"
if _IS_PROD and WEBHOOK_SECRET == "webhook_secret_placeholder_token":
    raise RuntimeError(
        "CRITICAL: WEBHOOK_SECRET must be set to a strong random value in production! "
        "Generate with: openssl rand -hex 32"
    )

def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

def ms_to_datetime(ms: Optional[int]) -> Optional[datetime.datetime]:
    if ms and ms > 0:
        try:
            return datetime.datetime.fromtimestamp(ms / 1000.0, tz=datetime.timezone.utc).replace(tzinfo=None)
        except Exception:
            return None
    return None

# Pydantic validation schemas
class RevenueCatEventPayload(BaseModel):
    type: str
    id: str
    app_user_id: Optional[str] = None
    original_app_user_id: Optional[str] = None
    product_id: Optional[str] = None
    entitlement_ids: Optional[List[str]] = Field(default_factory=list)
    purchased_at_ms: Optional[int] = None
    expiration_at_ms: Optional[int] = None
    environment: Optional[str] = "PRODUCTION"
    store: Optional[str] = None
    will_renew: Optional[bool] = True

class RevenueCatWebhookWrapper(BaseModel):
    event: Optional[RevenueCatEventPayload] = None
    api_version: Optional[str] = "1.0"

class ClientSyncPayload(BaseModel):
    is_premium: bool
    current_plan: str
    product_id: Optional[str] = None
    expiration_date: Optional[str] = None
    purchase_platform: Optional[str] = None

@router.post("/webhooks/revenuecat", status_code=status.HTTP_200_OK)
async def handle_revenuecat_webhook(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_revenuecat_secret: Optional[str] = Header(None, alias="X-RevenueCat-Secret"),
    db: AsyncSession = Depends(get_db)
):
    """
    Production RevenueCat Webhook Endpoint
    Verifies signature authorization token and enforces idempotency.
    """
    # 1. Signature & Authorization Verification
    provided_token = None
    if authorization:
        provided_token = authorization.replace("Bearer ", "").strip()
    elif x_revenuecat_secret:
        provided_token = x_revenuecat_secret.strip()

    is_prod = os.environ.get("ENVIRONMENT") == "production"
    if (is_prod or WEBHOOK_SECRET != "webhook_secret_placeholder_token") and provided_token != WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing webhook signature token"
        )

    # 2. Parse Payload safely (nested event or flat)
    try:
        raw_json = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event_data = raw_json.get("event") if isinstance(raw_json, dict) and "event" in raw_json else raw_json

    if not isinstance(event_data, dict) or "id" not in event_data or "type" not in event_data:
        raise HTTPException(status_code=400, detail="Missing required event fields (id, type)")

    event_id = str(event_data["id"])
    event_type = str(event_data["type"])
    app_user_id = event_data.get("app_user_id") or event_data.get("original_app_user_id")

    # 3. Idempotency Check
    existing_event_result = await db.execute(
        select(SubscriptionWebhookEvent).where(SubscriptionWebhookEvent.event_id == event_id)
    )
    existing_event = existing_event_result.scalars().first()

    if existing_event:
        return {"status": "already_processed", "event_id": event_id}

    # Save event record for idempotency
    webhook_rec = SubscriptionWebhookEvent(
        event_id=event_id,
        event_type=event_type,
        app_user_id=str(app_user_id) if app_user_id else None,
        processed_at=utc_now(),
        raw_payload=raw_json
    )
    db.add(webhook_rec)

    # Ignore anonymous RevenueCat IDs or missing user IDs for DB updates
    clean_user_id = str(app_user_id) if app_user_id and not str(app_user_id).startswith("$RCAnonymousID") else None

    if not clean_user_id:
        await db.commit()
        return {"status": "success", "detail": "Event recorded, no linked user ID"}

    user_result = await db.execute(select(User).where(User.id == clean_user_id))
    user = user_result.scalars().first()

    sub_rec_result = await db.execute(select(SubscriptionRecord).where(SubscriptionRecord.user_id == clean_user_id))
    sub_rec = sub_rec_result.scalars().first()

    if not sub_rec:
        sub_rec = SubscriptionRecord(
            id=str(uuid.uuid4()),
            user_id=clean_user_id,
            is_premium=False,
            plan="free"
        )
        db.add(sub_rec)

    # 4. Process Webhook Event Types
    exp_dt = ms_to_datetime(event_data.get("expiration_at_ms"))
    purch_dt = ms_to_datetime(event_data.get("purchased_at_ms"))
    product_id = event_data.get("product_id")
    store = event_data.get("store")
    will_renew = event_data.get("will_renew", True)

    if event_type in ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"]:
        plan_name = "premium_yearly" if product_id and "yearly" in product_id else "premium_monthly"
        if product_id and "lifetime" in product_id:
            plan_name = "premium_lifetime"

        sub_rec.is_premium = True
        sub_rec.plan = plan_name
        sub_rec.product_id = product_id
        sub_rec.expiration_date = exp_dt
        sub_rec.purchase_date = purch_dt
        sub_rec.will_renew = bool(will_renew)
        sub_rec.purchase_platform = "ios" if store == "APP_STORE" else "android"
        sub_rec.last_synced = utc_now()

        if user:
            user.pro_active = True
            user.pro_expires_at = exp_dt

            # Award 20% referral commission to referrer if applicable
            price_map = {"premium_yearly": 59.99, "premium_lifetime": 149.99, "premium_monthly": 9.99}
            price_usd = price_map.get(plan_name, 9.99)
            if event_type in ["INITIAL_PURCHASE", "RENEWAL"]:
                await award_referral_commission(
                    session=db,
                    purchaser=user,
                    amount_usd=price_usd,
                    plan_name=plan_name,
                    transaction_id=event_id
                )

    elif event_type in ["EXPIRATION", "REFUND"]:
        sub_rec.is_premium = False
        sub_rec.plan = "free"
        sub_rec.will_renew = False
        sub_rec.last_synced = utc_now()

        if user:
            user.pro_active = False
            user.pro_expires_at = None

    elif event_type in ["CANCELLATION", "BILLING_ISSUE"]:
        sub_rec.will_renew = False
        sub_rec.last_synced = utc_now()

    elif event_type == "TRANSFER":
        sub_rec.last_synced = utc_now()

    await db.commit()

    # C4: Invalidate cached subscription status for affected user
    if app_user_id:
        await cache_invalidate("subscription", app_user_id)
        await cache_invalidate("dashboard", app_user_id)

    return {"status": "success", "event_id": event_id, "processed_event": event_type}

@router.get("/status")
async def get_subscription_status(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user active subscription status.
    C4 fix: Cached with 120s TTL since subscription status rarely changes.
    Uses SQL-only queries — no blocking MongoDB calls.
    Checks: SubscriptionRecord table, User.pro_active flag, and Family sharing.
    """
    import json as _json
    cache_key = f"caliwo:subscription:{user.id}"
    cached = await cache_get(cache_key)
    if cached:
        try:
            return _json.loads(cached)
        except Exception:
            pass

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    profile: dict = user.profile or {}
    family = profile.get("family")

    sub_rec_result = await db.execute(select(SubscriptionRecord).where(SubscriptionRecord.user_id == user.id))
    sub_rec = sub_rec_result.scalars().first()

    # Determine pro status from SQL sources
    is_pro = bool(
        (sub_rec and sub_rec.is_premium) or
        getattr(user, "pro_active", False) or
        profile.get("pro_active")
    )

    # Check if user has active expiration in SQL user model or profile
    if not is_pro:
        pro_exp = user.pro_expires_at or profile.get("pro_until")
        if isinstance(pro_exp, str):
            try:
                pro_exp = datetime.fromisoformat(pro_exp.replace("Z", "+00:00"))
            except Exception:
                pro_exp = None
        if isinstance(pro_exp, datetime):
            if pro_exp.tzinfo is None:
                pro_exp = pro_exp.replace(tzinfo=timezone.utc)
            if pro_exp > now:
                is_pro = True

    pro_source = "subscription" if is_pro else None

    # Family sharing: check if family owner is pro
    if not is_pro and family and family.get("family_id"):
        fam_owner_id = family.get("owner_id")
        if fam_owner_id and fam_owner_id != user.id:
            res = await db.execute(select(User).where(User.id == fam_owner_id))
            owner = res.scalar_one_or_none()
            if owner:
                owner_is_pro = bool(
                    owner.pro_active or
                    (owner.profile and owner.profile.get("pro_active"))
                )
                # Check owner's subscription record
                if not owner_is_pro:
                    owner_sub_result = await db.execute(
                        select(SubscriptionRecord).where(SubscriptionRecord.user_id == fam_owner_id)
                    )
                    owner_sub = owner_sub_result.scalars().first()
                    if owner_sub and owner_sub.is_premium:
                        owner_is_pro = True
                # Check owner expiration
                if not owner_is_pro and owner.pro_expires_at:
                    owner_exp = owner.pro_expires_at
                    if owner_exp.tzinfo is None:
                        owner_exp = owner_exp.replace(tzinfo=timezone.utc)
                    if owner_exp > now:
                        owner_is_pro = True

                if owner_is_pro:
                    is_pro = True
                    pro_source = "family"

    pro_expires_at = user.pro_expires_at.isoformat() if getattr(user, "pro_expires_at", None) else None
    if sub_rec and sub_rec.expiration_date:
        pro_expires_at = sub_rec.expiration_date.isoformat()

    result = {
        "is_pro": is_pro,
        "is_premium": is_pro,
        "pro_active": is_pro,
        "pro_source": pro_source,
        "plan": (sub_rec.plan if sub_rec and getattr(sub_rec, "plan", None) else ("pro" if is_pro else "free")),
        "entitlement": (getattr(sub_rec, "entitlement", None) if sub_rec else None) or ("pro" if is_pro else "free"),
        "product_id": sub_rec.product_id if sub_rec else None,
        "expiration_date": pro_expires_at,
        "expires_at": pro_expires_at,
        "will_renew": sub_rec.will_renew if sub_rec else True,
        "purchase_platform": sub_rec.purchase_platform if sub_rec else None,
        "last_synced": sub_rec.last_synced.isoformat() if (sub_rec and sub_rec.last_synced) else None,
        "price_usd": 9.99,
        "days_per_purchase": 30,
        "trial_days": 3,
        "has_used_trial": bool(profile.get("has_used_trial")),
        "is_trial": bool(profile.get("is_trial")),
    }

    # C4: Cache for 120 seconds
    await cache_set(cache_key, result, ttl=120)
    return result


@router.get("/pricing")
async def get_subscription_pricing(
    request: Request,
    country_code: Optional[str] = None,
    user: User = Depends(current_user),
):
    """
    Get localized subscription pricing & 3-day free trial details.
    Supports India (IN) and Rest of World (ROW).
    """
    profile: dict = user.profile or {}
    detected_country = (country_code or profile.get("country_code") or "").upper().strip()

    if not detected_country and request:
        cf_country = request.headers.get("CF-IPCountry") or request.headers.get("X-Country-Code")
        if cf_country:
            detected_country = cf_country.upper().strip()

    is_india = detected_country in ["IN", "IND", "INDIA"]
    has_used_trial = bool(profile.get("has_used_trial"))

    if is_india:
        plans = {
            "monthly": {
                "product_id": "com.caliwo.ainutritioncoach.pro_monthly_inr",
                "price": 949,
                "currency": "INR",
                "currency_symbol": "₹",
                "period": "monthly",
                "price_formatted": "₹949 / mo",
                "monthly_equivalent": "₹949 / mo",
                "title": "Monthly Pro",
                "description": "Unlimited AI meal scans, recipes, and coach access",
            },
            "yearly": {
                "product_id": "com.caliwo.ainutritioncoach.pro_yearly_inr",
                "price": 3000,
                "currency": "INR",
                "currency_symbol": "₹",
                "period": "yearly",
                "price_formatted": "₹3,000 / yr",
                "monthly_equivalent": "₹250 / mo",
                "save_percent": 74,
                "title": "Yearly Pro",
                "description": "Billed annually at ₹3,000 (Just ₹250/mo)",
            }
        }
        country_res = "IN"
        country_name = "India"
    else:
        plans = {
            "monthly": {
                "product_id": "com.caliwo.ainutritioncoach.pro_monthly",
                "price": 9.99,
                "currency": "USD",
                "currency_symbol": "$",
                "period": "monthly",
                "price_formatted": "$9.99 / mo",
                "monthly_equivalent": "$9.99 / mo",
                "title": "Monthly Pro",
                "description": "Unlimited AI meal scans, recipes, and coach access",
            },
            "yearly": {
                "product_id": "com.caliwo.ainutritioncoach.pro_yearly",
                "price": 29.99,
                "currency": "USD",
                "currency_symbol": "$",
                "period": "yearly",
                "price_formatted": "$29.99 / yr",
                "monthly_equivalent": "$2.50 / mo",
                "save_percent": 75,
                "title": "Yearly Pro",
                "description": "Billed annually at $29.99 (Just $2.50/mo)",
            }
        }
        country_res = "ROW"
        country_name = "Global"

    return {
        "country_code": country_res,
        "country_name": country_name,
        "trial_days": 3,
        "has_used_trial": has_used_trial,
        "is_trial_eligible": not has_used_trial,
        "plans": plans
    }


@router.post("/trial/start")
async def start_free_trial(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Activate 3-day free trial of Caliwo Pro for eligible user.
    """
    from sqlalchemy.orm.attributes import flag_modified
    profile: dict = dict(user.profile or {})

    if profile.get("has_used_trial"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already used your 3-day free trial."
        )

    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    trial_exp = now + datetime.timedelta(days=3)

    user.pro_active = True
    user.pro_expires_at = trial_exp

    profile["pro_active"] = True
    profile["pro_until"] = trial_exp.isoformat()
    profile["has_used_trial"] = True
    profile["is_trial"] = True
    profile["trial_ends_at"] = trial_exp.isoformat()
    user.profile = profile
    flag_modified(user, "profile")

    await db.commit()

    return {
        "ok": True,
        "trial_days": 3,
        "pro_active": True,
        "expires_at": trial_exp.isoformat(),
        "message": "🎉 Your 3-day free trial of Caliwo Pro is now active!"
    }


@router.post("/sync")
async def sync_client_subscription(
    payload: ClientSyncPayload,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Sync client RevenueCat entitlement state with backend DB
    """
    sub_rec_result = await db.execute(select(SubscriptionRecord).where(SubscriptionRecord.user_id == user.id))
    sub_rec = sub_rec_result.scalars().first()

    if not sub_rec:
        sub_rec = SubscriptionRecord(
            id=str(uuid.uuid4()),
            user_id=user.id
        )
        db.add(sub_rec)

    sub_rec.is_premium = payload.is_premium
    sub_rec.plan = payload.current_plan
    sub_rec.product_id = payload.product_id
    sub_rec.purchase_platform = payload.purchase_platform
    sub_rec.last_synced = utc_now()

    if payload.expiration_date:
        try:
            cleaned_iso = payload.expiration_date.replace("Z", "+00:00")
            dt = datetime.datetime.fromisoformat(cleaned_iso)
            sub_rec.expiration_date = dt.replace(tzinfo=None)
        except Exception:
            pass

    user.pro_active = payload.is_premium
    if sub_rec.expiration_date:
        user.pro_expires_at = sub_rec.expiration_date

    await db.commit()
    return {"status": "synced", "is_premium": payload.is_premium}

