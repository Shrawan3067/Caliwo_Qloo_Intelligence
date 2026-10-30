import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from contextlib import asynccontextmanager

# M3: Setup structured JSON logging before anything else
from middleware import setup_structured_logging, RequestIDMiddleware
setup_structured_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    from services import qloo_service
    if not qloo_service.is_configured():
        logging.critical(
            "FATAL: QLOO_API_KEY is not set. "
            "Qloo is the foundation layer of Caliwo — the app cannot start without it. "
            "Set QLOO_API_KEY in backend/.env or set USE_QLOO_MOCK=true for testing."
        )
        raise RuntimeError(
            "QLOO_API_KEY is required (or USE_QLOO_MOCK=true). Caliwo cannot operate without Qloo cultural intelligence."
        )
    if qloo_service.is_mock_mode():
        logging.warning("⚠️ Qloo running in MOCK MODE (USE_QLOO_MOCK=true) — simulated cultural intelligence layer active.")
    else:
        logging.info("✅ Qloo API key validated — production cultural intelligence layer active.")
    logging.info("Application startup complete. Schema managed by Alembic.")
    try:
        yield
    finally:
        await qloo_service.close_qloo_http_client()
        logging.info("Qloo HTTP client connection pool closed.")


app = FastAPI(title="Caliwo API", lifespan=lifespan)

# --- M2: Request ID middleware for distributed tracing ---
app.add_middleware(RequestIDMiddleware)

# --- Rate limiting (brute-force protection on auth endpoints) ---
from starlette.requests import Request
from starlette.responses import Response
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware
from rate_limit import limiter

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

async def _rate_limit_handler(request: Request, exc: Exception) -> Response:
    return _rate_limit_exceeded_handler(request, exc)  # type: ignore[arg-type]

app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ── Router Mounts ────────────────────────────────────────────────────────
from routers import (
    auth, profile, meals, coach, push, health, plans, nutrition,
    subscriptions, groups, iap, feedback, media, milestones,
)
from routers import family, referrals, grocery, taste

app.include_router(auth.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(meals.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(coach.router, prefix="/api")
app.include_router(push.router, prefix="/api")
app.include_router(health.router, prefix="/api")
app.include_router(plans.router, prefix="/api")
app.include_router(nutrition.router, prefix="/api")
app.include_router(subscriptions.router, prefix="/api")
app.include_router(groups.router, prefix="/api")
app.include_router(iap.router, prefix="/api")
app.include_router(feedback.router)       # prefix="/api/feedback" baked in
app.include_router(milestones.router)      # prefix="/api/milestones" baked in
app.include_router(family.router, prefix="/api")
app.include_router(referrals.router, prefix="/api")
app.include_router(grocery.router, prefix="/api")
app.include_router(taste.router, prefix="/api")

# ── Static Files (uploaded media) ────────────────────────────────────────
os.makedirs("media", exist_ok=True)
from fastapi.staticfiles import StaticFiles
app.mount("/media", StaticFiles(directory="media"), name="media")




# ── Backward-compatible alias routes ─────────────────────────────────────
# These aliases preserve URLs that the frontend may still reference,
# redirecting to the canonical router endpoints.

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User
from routers.auth import current_user


@app.post("/api/demo/reset")
async def demo_reset_route():
    """Reset the demo user to canonical demonstration state (1,120 kcal consumed, 980 kcal left for dinner)."""
    from services.demo_service import reset_demo_user
    return await reset_demo_user()


@app.post("/api/demo/persona")
async def demo_persona_route(
    persona_id: str = "alex",
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    """Switch user to judge demo persona (Alex, Elena, or Marcus)."""
    from services.demo_service import switch_persona
    return await switch_persona(user, persona_id, session)


@app.get("/api/progress/summary")
async def progress_summary_alias(
    days: int = 7,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    """Alias → nutrition.progress_summary (frontend may use /api/progress/summary)."""
    return await nutrition.progress_summary(
        days=days, user=user, session=session
    )


@app.get("/api/account/export")
@app.get("/api/user/export")
async def account_export_alias(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    return await profile.account_export(user=user, session=session)


@app.delete("/api/account/delete")
@app.delete("/api/user/me")
async def account_delete_alias(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    return await profile.delete_account(user=user, session=session)


@app.get("/api/share/weekly-card")
async def share_card_alias(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    return await media.share_weekly(user=user, session=session)


# ── H7: Dashboard Aggregation Endpoint ───────────────────────────────────
# Combines profile, steps, water, meals, and subscription status into a
# single response. Reduces the home screen from 5+ API calls to 1.
# At 10K concurrent users: 50,000 req/screen → 10,000 req/screen.

from cache import cache_get, cache_set

@app.get("/api/dashboard")
async def dashboard(
    date: str | None = None,
    tz_offset: int = 0,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    """Aggregated home screen data — single endpoint for all dashboard needs."""
    import json as _json
    from timezone_utils import get_utc_now, resolve_local_date_str
    from models import DailySummary, Meal, SubscriptionRecord
    from sqlalchemy import select, func
    from datetime import datetime as _dt, timedelta, timezone as _tz

    local_date = date if date else resolve_local_date_str(get_utc_now(), tz_offset)

    # Check cache (30s TTL)
    cache_key = f"caliwo:dashboard:{user.id}:{local_date}"
    cached = await cache_get(cache_key)
    if cached:
        try:
            return _json.loads(cached)
        except Exception:
            pass

    # 1. Profile
    prof = dict(user.profile) if user.profile else {}

    # 2. Daily summary (steps, water, sleep, weight)
    sum_res = await session.execute(
        select(DailySummary).where(
            DailySummary.user_id == user.id,
            DailySummary.date_str == local_date,
        )
    )
    summary = sum_res.scalars().first()

    steps = summary.steps if summary else 0
    steps_goal = int(prof.get("steps_goal", 10000))
    water_ml = summary.water_ml if summary else 0
    sleep_hours = summary.sleep_hours if summary else 0.0

    # 3. Today's meals (last 20)
    target_date = _dt.strptime(local_date, "%Y-%m-%d").date()
    offset_delta = timedelta(minutes=-tz_offset)
    local_start = _dt.combine(target_date, _dt.min.time())
    local_end = _dt.combine(target_date, _dt.max.time())
    utc_start = local_start - offset_delta
    utc_end = local_end - offset_delta

    meals_res = await session.execute(
        select(Meal)
        .where(Meal.user_id == user.id, Meal.logged_at >= utc_start, Meal.logged_at <= utc_end)
        .order_by(Meal.logged_at.desc())
        .limit(20)
    )
    meals = meals_res.scalars().all()
    total_cal = sum(float(m.calories or 0) for m in meals)
    total_pro = sum(float(m.protein_g or 0) for m in meals)
    total_car = sum(float(m.carbs_g or 0) for m in meals)
    total_fat = sum(float(m.fat_g or 0) for m in meals)

    # 4. Subscription status (lightweight check)
    is_pro = bool(
        getattr(user, "pro_active", False) or
        prof.get("pro_active")
    )
    if not is_pro:
        sub_res = await session.execute(
            select(SubscriptionRecord).where(SubscriptionRecord.user_id == user.id)
        )
        sub_rec = sub_res.scalars().first()
        if sub_rec and sub_rec.is_premium:
            is_pro = True

    result = {
        "date": local_date,
        "profile": {
            "name": user.name,
            "onboarded": prof.get("onboarded", False),
            "taste_onboarded": prof.get("taste_onboarded", False),
            "domains_connected": prof.get("taste_dna", {}).get("domains_connected", 0),
            "daily_calories": prof.get("daily_calories"),
            "daily_protein_g": prof.get("daily_protein_g"),
            "daily_carbs_g": prof.get("daily_carbs_g"),
            "daily_fat_g": prof.get("daily_fat_g"),
        },
        "steps": {
            "steps": steps,
            "goal": steps_goal,
            "remaining": max(0, steps_goal - steps),
            "progress_pct": min(100.0, (steps / steps_goal) * 100.0) if steps_goal else 0.0,
            "goal_reached": steps >= steps_goal,
        },
        "water": {"ml": water_ml},
        "sleep": {"hours": sleep_hours},
        "nutrition": {
            "total_calories": round(total_cal, 1),
            "total_protein_g": round(total_pro, 1),
            "total_carbs_g": round(total_car, 1),
            "total_fat_g": round(total_fat, 1),
            "meal_count": len(meals),
        },
        "subscription": {"is_pro": is_pro},
    }

    await cache_set(cache_key, result, ttl=30)
    return result


# ── Health & Root ────────────────────────────────────────────────────────

# M4 fix: Split health check into lightweight liveness probe and deeper
# readiness probe. Load balancer health checks (every 30s per container)
# should hit /health (no DB connection used). /ready checks DB connectivity.

@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Liveness probe — reports unhealthy if Qloo foundation layer is missing."""
    from fastapi.responses import JSONResponse
    from services import qloo_service
    if not qloo_service.is_configured():
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "qloo_integration": "MISSING — app cannot operate",
                "error": "QLOO_API_KEY is required. Set it in backend/.env and restart.",
            },
        )
    return {
        "status": "healthy",
        "qloo_integration": "mock" if qloo_service.is_mock_mode() else "active",
        "mock_mode": qloo_service.is_mock_mode(),
    }


@app.get("/ready")
@app.get("/api/ready")
async def readiness_check():
    """Deep readiness probe — verifies DB connectivity."""
    try:
        from database import get_engine
        from sqlalchemy import text
        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return {"status": "not_ready", "database": "unreachable", "error": str(e)}


@app.get("/")
@app.get("/api/")
def read_root():
    return {"status": "ok", "service": "Caliwo API", "message": "Caliwo API"}
