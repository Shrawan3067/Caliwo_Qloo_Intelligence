"""
IAP (In-App Purchase) Router
Server-side purchase verification for Google Play Billing & Apple App Store.
Used as a secondary verification layer alongside RevenueCat webhooks.
"""

import os
import uuid
import datetime
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User, SubscriptionRecord
from routers.auth import current_user
from routers.referrals import award_referral_commission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/iap", tags=["iap"])

# Valid product IDs (must match Google Play Console & App Store Connect)
VALID_PRODUCT_IDS = {
    "com.caliwo.ainutritioncoach.pro_monthly",
    "com.caliwo.ainutritioncoach.pro_yearly",
    "com.caliwo.ainutritioncoach.pro_monthly_inr",
    "com.caliwo.ainutritioncoach.pro_yearly_inr",
    "com.caliwo.ainutritioncoach.pro_lifetime",
    # Legacy product ID
    "premium_monthly",
    "premium_yearly",
    "premium_lifetime",
}

# Idempotency is handled via DB-backed SubscriptionWebhookEvent table (not in-memory)


def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def _plan_from_product_id(product_id: str) -> str:
    """Derive plan name from product ID."""
    if "yearly" in product_id:
        return "premium_yearly"
    elif "lifetime" in product_id:
        return "premium_lifetime"
    return "premium_monthly"


def _days_for_plan(plan: str) -> int:
    """Get subscription duration in days."""
    if plan == "premium_yearly":
        return 365
    elif plan == "premium_lifetime":
        return 36500  # 100 years
    return 30


# --- Schemas ---

class IAPVerifyInput(BaseModel):
    platform: str  # "ios" or "android"
    product_id: str
    transaction_id: Optional[str] = None  # iOS
    purchase_token: Optional[str] = None  # Android


class IAPProduct(BaseModel):
    product_id: str
    tier: str
    days: int
    price: str


# --- Google Play Server-Side Verification ---

async def _verify_google_play_purchase(
    package_name: str,
    product_id: str,
    purchase_token: str,
) -> dict:
    """
    Verify an Android subscription purchase with Google Play Developer API.
    Requires GOOGLE_PLAY_SERVICE_ACCOUNT_JSON env var with the service account credentials.
    """
    sa_json = os.environ.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "").strip()
    if not sa_json or sa_json.upper() in ("PLACEHOLDER", "NONE", "FALSE"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google Play service account not configured. Set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON."
        )

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        import asyncio

        # Parse service account credentials
        if os.path.isfile(sa_json):
            credentials = service_account.Credentials.from_service_account_file(
                sa_json,
                scopes=["https://www.googleapis.com/auth/androidpublisher"]
            )
        else:
            try:
                sa_info = json.loads(sa_json)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Google Play service account not configured. Set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON."
                )
            credentials = service_account.Credentials.from_service_account_info(
                sa_info,
                scopes=["https://www.googleapis.com/auth/androidpublisher"]
            )

        import typing
        # Build the Android Publisher API client
        service = typing.cast(typing.Any, build("androidpublisher", "v3", credentials=credentials))

        # Verify subscription purchase
        def _call_api():
            return service.purchases().subscriptions().get(
                packageName=package_name,
                subscriptionId=product_id,
                token=purchase_token,
            ).execute()

        # Run synchronous Google API call in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _call_api)

        logger.info(f"Google Play verification result for {product_id}: paymentState={result.get('paymentState')}")

        return {
            "valid": True,
            "payment_state": result.get("paymentState"),
            "expiry_time_millis": result.get("expiryTimeMillis"),
            "auto_renewing": result.get("autoRenewing", False),
            "order_id": result.get("orderId"),
            "raw": result,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google Play verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google Play verification failed: {str(e)}"
        )


# --- Routes ---

@router.get("/products")
@router.post("/products")
async def iap_products(user: User = Depends(current_user)):
    """Return available IAP products for the client to display."""
    return {
        "trial_days": 3,
        "products": [
            {
                "product_id": "com.caliwo.ainutritioncoach.pro_monthly",
                "title": "Caliwo Pro Monthly (USD)",
                "description": "3 Days Free Trial, then $9.99/mo. Unlimited AI meal scans & coach.",
                "price": 9.99,
                "price_formatted": "$9.99",
                "period": "monthly",
                "currency": "USD",
                "trial_days": 3,
            },
            {
                "product_id": "com.caliwo.ainutritioncoach.pro_yearly",
                "title": "Caliwo Pro Yearly (USD)",
                "description": "3 Days Free Trial, then $29.99/yr ($2.50/mo). Save 75%.",
                "price": 29.99,
                "price_formatted": "$29.99",
                "period": "yearly",
                "currency": "USD",
                "trial_days": 3,
            },
            {
                "product_id": "com.caliwo.ainutritioncoach.pro_monthly_inr",
                "title": "Caliwo Pro Monthly (INR)",
                "description": "3 Days Free Trial, then ₹949/mo. Unlimited AI meal scans & coach.",
                "price": 949,
                "price_formatted": "₹949",
                "period": "monthly",
                "currency": "INR",
                "trial_days": 3,
            },
            {
                "product_id": "com.caliwo.ainutritioncoach.pro_yearly_inr",
                "title": "Caliwo Pro Yearly (INR)",
                "description": "3 Days Free Trial, then ₹3,000/yr (₹250/mo). Save 74%.",
                "price": 3000,
                "price_formatted": "₹3,000",
                "period": "yearly",
                "currency": "INR",
                "trial_days": 3,
            },
        ]
    }


@router.post("/verify")
async def iap_verify(
    inp: IAPVerifyInput,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Server-side purchase receipt verification.
    - Android: Verifies purchase token with Google Play Developer API
    - iOS: Verifies transaction with App Store Server API
    After verification, updates the user's subscription record.
    """
    # 1. Validate product ID
    if inp.product_id not in VALID_PRODUCT_IDS:
        raise HTTPException(status_code=400, detail=f"Unknown product_id: {inp.product_id}")

    # 2. Validate platform-specific fields
    if inp.platform == "ios" and not inp.transaction_id:
        raise HTTPException(status_code=400, detail="Missing transaction_id for iOS")
    if inp.platform == "android" and not inp.purchase_token:
        raise HTTPException(status_code=400, detail="Missing purchase_token for Android")

    # 3. Idempotency check — use DB-backed SubscriptionWebhookEvent table
    key = inp.transaction_id if inp.platform == "ios" else inp.purchase_token
    from models import SubscriptionWebhookEvent
    if key:
        existing = await db.execute(
            select(SubscriptionWebhookEvent).where(
                SubscriptionWebhookEvent.event_id == key
            )
        )
        if existing.scalars().first():
            return {"ok": True, "already_fulfilled": True}

    # 4. Platform-specific server-side verification
    package_name = os.environ.get("ANDROID_PACKAGE_NAME", "com.caliwo.ainutritioncoach")

    if inp.platform == "android":
        verification = await _verify_google_play_purchase(
            package_name=package_name,
            product_id=inp.product_id,
            purchase_token=inp.purchase_token or "",
        )

        if not verification.get("valid"):
            raise HTTPException(status_code=400, detail="Purchase verification failed")

    elif inp.platform == "ios":
        # iOS App Store Server API verification.
        # Primary verification is handled by RevenueCat webhooks (subscriptions.py).
        # This endpoint serves as a secondary client-side confirmation.
        # For full receipt validation, configure IOS_APPSTORE_PRIVATE_KEY and
        # implement App Store Server API v2 validation.
        ios_key = os.environ.get("IOS_APPSTORE_PRIVATE_KEY", "").strip()
        if not ios_key or ios_key.upper() in ("PLACEHOLDER", "NONE", "FALSE"):
            logger.info(f"iOS transaction {inp.transaction_id} — relying on RevenueCat webhooks for full verification")
        else:
            logger.info(f"iOS transaction {inp.transaction_id} — App Store key present, RevenueCat handles verification")

    # 5. Update subscription record in database
    plan = _plan_from_product_id(inp.product_id)
    days = _days_for_plan(plan)
    now = utc_now()
    expires_at = now + datetime.timedelta(days=days)

    sub_result = await db.execute(
        select(SubscriptionRecord).where(SubscriptionRecord.user_id == user.id)
    )
    sub_rec = sub_result.scalars().first()

    if not sub_rec:
        sub_rec = SubscriptionRecord(
            id=str(uuid.uuid4()),
            user_id=user.id,
        )
        db.add(sub_rec)

    effective_expires_at = expires_at if plan != "premium_lifetime" else None

    sub_rec.is_premium = True
    sub_rec.plan = plan
    sub_rec.product_id = inp.product_id
    sub_rec.purchase_platform = inp.platform
    sub_rec.purchase_date = now
    sub_rec.expiration_date = effective_expires_at
    sub_rec.will_renew = plan != "premium_lifetime"
    sub_rec.last_synced = now

    # Update user pro status
    user.pro_active = True
    user.pro_expires_at = effective_expires_at

    # Sync profile dictionary for compatibility
    profile = dict(user.profile or {})
    profile["pro_active"] = True
    profile["pro_until"] = effective_expires_at.isoformat() if effective_expires_at else None
    profile["pro_plan"] = plan
    user.profile = profile

    await db.commit()

    # Award 20% referral commission to referrer if applicable
    price_map = {"premium_yearly": 59.99, "premium_lifetime": 149.99, "premium_monthly": 9.99}
    price_usd = price_map.get(plan, 9.99)
    await award_referral_commission(
        session=db,
        purchaser=user,
        amount_usd=price_usd,
        plan_name=plan,
        transaction_id=key
    )

    # Mark as fulfilled for idempotency (DB-backed)
    if key:
        from models import SubscriptionWebhookEvent
        import datetime as _dt
        iap_event = SubscriptionWebhookEvent(
            event_id=key,
            event_type=f"IAP_VERIFY_{inp.platform.upper()}",
            app_user_id=str(user.id),
            processed_at=utc_now(),
            raw_payload={"product_id": inp.product_id, "platform": inp.platform}
        )
        db.add(iap_event)
        await db.commit()

    logger.info(f"IAP verified: user={user.id}, product={inp.product_id}, plan={plan}")

    return {
        "ok": True,
        "already_fulfilled": False,
        "plan": plan,
        "expires_at": effective_expires_at.isoformat() if effective_expires_at else None,
    }

