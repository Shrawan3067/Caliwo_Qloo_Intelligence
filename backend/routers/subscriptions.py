"""
Subscription Controller Router
Standalone Access Controller & Entitlement Management for Caliwo
"""

import uuid
import datetime
from typing import Optional, List, Union, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Header, status, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User, SubscriptionRecord
from routers.auth import current_user
from cache import cache_get, cache_set, cache_invalidate

router = APIRouter(prefix="/subscription", tags=["subscriptions"])

def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

class ClientSyncPayload(BaseModel):
    is_premium: bool = True
    current_plan: str = "pro"
    product_id: Optional[str] = "caliwo_pro_unlocked"
    expiration_date: Optional[str] = None
    purchase_platform: Optional[str] = "hackathon_unlocked"


@router.get("/status")
async def get_subscription_status(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user active subscription status.
    All users have full pro access unlocked for evaluation.
    """
    import json as _json
    cache_key = f"caliwo:subscription:{user.id}"
    cached = await cache_get(cache_key)
    if cached:
        try:
            return _json.loads(cached)
        except Exception:
            pass

    # Ensure user has pro_active set
    if not user.pro_active:
        user.pro_active = True
        await db.commit()

    result = {
        "is_pro": True,
        "is_premium": True,
        "pro_active": True,
        "pro_source": "hackathon_unlocked",
        "plan": "pro",
        "entitlement": "pro",
        "product_id": "caliwo_pro_unlocked",
        "expiration_date": None,
        "expires_at": None,
        "will_renew": True,
        "purchase_platform": "standalone",
        "last_synced": utc_now().isoformat(),
        "price_usd": 0.0,
        "days_per_purchase": 365,
        "trial_days": 3,
        "has_used_trial": False,
        "is_trial": False,
    }

    await cache_set(cache_key, result, ttl=120)
    return result


@router.get("/pricing")
async def get_subscription_pricing(
    request: Request,
    country_code: Optional[str] = None,
    user: User = Depends(current_user),
):
    """
    Get localized subscription pricing & trial details.
    """
    profile: dict = user.profile or {}
    detected_country = (country_code or profile.get("country_code") or "").upper().strip()

    if not detected_country and request:
        cf_country = request.headers.get("CF-IPCountry") or request.headers.get("X-Country-Code")
        if cf_country:
            detected_country = cf_country.upper().strip()

    is_india = detected_country in ["IN", "IND", "INDIA"]

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
        "has_used_trial": False,
        "is_trial_eligible": True,
        "plans": plans
    }


@router.post("/trial/start")
async def start_free_trial(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Activate free trial of Caliwo Pro for eligible user.
    """
    user.pro_active = True
    await db.commit()

    return {
        "ok": True,
        "trial_days": 3,
        "pro_active": True,
        "expires_at": None,
        "message": "🎉 Caliwo Pro is active with full access!"
    }


@router.post("/sync")
async def sync_client_subscription(
    payload: ClientSyncPayload,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Sync client entitlement state with backend DB
    """
    user.pro_active = True
    await db.commit()
    return {"status": "synced", "is_premium": True}
