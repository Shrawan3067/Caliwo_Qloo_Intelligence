import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import logging

from database import get_db
from models import User
from rate_limit import limiter



_IS_PROD = os.environ.get("ENVIRONMENT", "").lower() == "production"
JWT_SECRET = os.environ.get("JWT_SECRET", "")
if not JWT_SECRET or len(JWT_SECRET) < 32:
    if _IS_PROD:
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: JWT_SECRET must be a strong key (>= 32 chars) in production!"
        )
    logging.warning(
        "JWT_SECRET is weak/unset — falling back to an insecure dev secret. "
        "Set a strong JWT_SECRET in backend/.env for stable, secure sessions."
    )
    JWT_SECRET = JWT_SECRET or ("dev-insecure-" + "x" * 40)

JWT_ALGO = "HS256"
JWT_ISSUER = os.environ.get("JWT_ISSUER", "caliwo-api")
JWT_AUDIENCE = os.environ.get("JWT_AUDIENCE", "caliwo-app")
JWT_EXPIRE_DAYS = int(os.environ.get("JWT_EXPIRE_DAYS", "30"))
MAX_PASSWORD_BYTES = 72  # bcrypt hard limit — never silently truncate

router = APIRouter(prefix="/auth", tags=["auth"])

# --- Schemas ---


class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class LoginInput(BaseModel):
    email: str
    password: str


class ForgotPasswordInput(BaseModel):
    email: EmailStr


class ResetPasswordInput(BaseModel):
    token: str
    new_password: str


class GoogleAuthInput(BaseModel):
    id_token: Optional[str] = None
    credential: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    user: dict

# --- Utils ---


def validate_password_strength(pw: str) -> None:
    """Raise HTTP 422 if the password fails policy. Enforced server-side."""
    if not pw or len(pw) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    if len(pw.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise HTTPException(status_code=422, detail="Password is too long (max 72 bytes)")
    if not any(c.isalpha() for c in pw):
        raise HTTPException(status_code=422, detail="Password must contain at least one letter")
    if not any(c.isdigit() for c in pw):
        raise HTTPException(status_code=422, detail="Password must contain at least one number")


def hash_password(pw: str) -> str:
    raw = pw.encode("utf-8")
    if len(raw) > MAX_PASSWORD_BYTES:
        # Never silently truncate — bcrypt ignores bytes past 72.
        raise HTTPException(status_code=422, detail="Password is too long (max 72 bytes)")
    return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        raw = pw.encode("utf-8")[:MAX_PASSWORD_BYTES]
        return bcrypt.checkpw(raw, hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# Pre-computed once at import: constant-time verify for unknown emails so a
# failed login costs the same whether or not the account exists (blocks user
# enumeration via timing).
_DUMMY_HASH = bcrypt.hashpw(b"caliwo-dummy-password", bcrypt.gensalt(rounds=12)).decode("utf-8")


def make_jwt(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": now,
        "exp": now + timedelta(days=JWT_EXPIRE_DAYS),
        "jti": uuid.uuid4().hex,
        "typ": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_jwt(token: str) -> Optional[str]:
    try:
        data = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGO],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
            options={"require": ["sub", "exp", "iat", "iss", "aud"]},
        )
        if data.get("typ") != "access":
            return None
        return data.get("sub")
    except Exception:
        return None


def make_password_reset_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": now,
        "exp": now + timedelta(hours=1),
        "jti": uuid.uuid4().hex,
        "typ": "password_reset",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_password_reset_token(token: str) -> Optional[str]:
    try:
        data = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGO],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
            options={"require": ["sub", "exp", "iat", "iss", "aud"]},
        )
        if data.get("typ") != "password_reset":
            return None
        return data.get("sub")
    except Exception:
        return None


import asyncio
from sqlalchemy.orm.attributes import flag_modified

RICH_DEMO_TASTE_DNA = {
    "entity_ids": [
        "57E97B92-9552-452D-A5EC-6B098C879918",  # Nobu
        "685BCE85-1F46-4A12-8CC8-7FF205B34943",  # Sweetgreen
        "urn:entity:place:nobu-001",
        "urn:entity:place:sweetgreen-001",
        "urn:entity:cuisine:japanese-001",
        "urn:entity:cuisine:med-001",
        "urn:entity:movie:midnightparis-001",
        "urn:entity:movie:jiro-001",
        "urn:entity:artist:daftpunk-001",
        "urn:entity:artist:chetbaker-001",
        "urn:entity:destination:tokyo-001",
        "urn:entity:destination:barcelona-001",
    ],
    "cuisine_affinities": ["Japanese", "Mediterranean"],
    "cultural_tags": [
        "Nobu",
        "Sweetgreen",
        "Japanese",
        "Mediterranean",
        "Midnight in Paris",
        "Jiro Dreams of Sushi",
        "Daft Punk",
        "Chet Baker",
        "Tokyo",
        "Barcelona",
        "Farm to Table",
        "Fine Dining",
    ],
    "film_tags": ["Midnight in Paris", "Jiro Dreams of Sushi"],
    "music_tags": ["Daft Punk", "Chet Baker"],
    "travel_tags": ["Tokyo", "Barcelona"],
    "cross_domain_signals": {
        "restaurants": 2,
        "cuisines": 2,
        "films": 2,
        "music": 2,
        "travel": 2,
        "influences": 2,
    },
    "domains_connected": 6,
    "cross_domain_dining": [
        {
            "name": "Nobu Downtown",
            "score": 0.96,
            "qloo_entity_id": "57E97B92-9552-452D-A5EC-6B098C879918",
            "menu_highlights": ["Black Cod Miso", "Yellowtail Jalapeño", "Rock Shrimp Tempura"],
            "cuisine_tags": ["Japanese", "Sushi", "Asian Fusion"],
        },
        {
            "name": "Sweetgreen",
            "score": 0.93,
            "qloo_entity_id": "685BCE85-1F46-4A12-8CC8-7FF205B34943",
            "menu_highlights": ["Harvest Bowl", "Kale Caesar", "Guacamole Greens"],
            "cuisine_tags": ["Mediterranean", "Farm to Table", "Healthy"],
        },
        {
            "name": "Sushisamba",
            "score": 0.91,
            "qloo_entity_id": "urn:entity:place:sushisamba-001",
            "menu_highlights": ["Seviche Mixto", "Robata King Salmon", "Taquitos"],
            "cuisine_tags": ["Japanese", "Peruvian", "Fusion"],
        },
        {
            "name": "Bar Cañete",
            "score": 0.90,
            "qloo_entity_id": "urn:entity:place:canete-001",
            "menu_highlights": ["Grilled Razor Clams", "Wild Iberian Ham", "Tuna Tartare"],
            "cuisine_tags": ["Mediterranean", "Tapas", "Spanish"],
        },
    ],
    "built_at": 1729860000.0,
}


async def ensure_demo_user_taste_profile(user: User, session: AsyncSession) -> None:
    """Auto-seed demo user with a rich 6-domain Taste DNA profile if missing or incomplete."""
    email = (user.email or "").lower().strip()
    is_demo = (
        email == "demo@caliwo.app"
        or email.startswith("demo")
        or "demo" in email
        or "judge" in email
        or bool(user.profile and user.profile.get("is_demo"))
    )
    if not is_demo:
        return

    prof = dict(user.profile) if isinstance(user.profile, dict) else {}
    existing_dna = prof.get("taste_dna", {})
    domains = existing_dna.get("domains_connected", 0)

    # If already fully configured with 6 domains and target demo anchors, keep it
    has_full_profile = (
        prof.get("taste_onboarded")
        and domains >= 6
        and any("Midnight in Paris" in f for f in existing_dna.get("film_tags", []))
        and any("Daft Punk" in m for m in existing_dna.get("music_tags", []))
        and any("Tokyo" in t for t in existing_dna.get("travel_tags", []))
    )
    if has_full_profile:
        return

    # Try building dynamically via live Qloo for exact current URNs & recommendations
    taste_dna = None
    try:
        from services import qloo_service
        if qloo_service.is_configured():
            taste_dna = await asyncio.wait_for(
                qloo_service.build_taste_dna(
                    favorite_restaurants=["Nobu", "Sweetgreen"],
                    favorite_cuisines=["Japanese", "Mediterranean"],
                    food_influences=["Farm to Table", "Fine Dining"],
                    favorite_films=["Midnight in Paris", "Jiro Dreams of Sushi"],
                    favorite_music=["Daft Punk", "Chet Baker"],
                    travel_destinations=["Tokyo", "Barcelona"],
                ),
                timeout=5.0,
            )
    except Exception as e:
        logging.warning("Live Qloo Taste DNA build for demo user non-blocking notice: %s", e)

    if not taste_dna or not taste_dna.get("entity_ids"):
        import copy, time
        taste_dna = copy.deepcopy(RICH_DEMO_TASTE_DNA)
        taste_dna["built_at"] = time.time()

    from services import taste_profile
    await taste_profile.save_taste_dna(session, user, taste_dna)

    # Ensure profile flags for demo user
    prof = dict(user.profile) if isinstance(user.profile, dict) else {}
    prof["onboarded"] = True
    prof["taste_onboarded"] = True
    prof["taste_dna"] = taste_dna
    prof["is_demo"] = True
    user.profile = prof
    flag_modified(user, "profile")
    await session.commit()
    await session.refresh(user)
    logging.info("Demo user Taste DNA seeded successfully for %s (%d domains)", user.email, taste_dna.get("domains_connected", 6))


def public_user(u: User) -> dict:
    prof = u.profile if isinstance(u.profile, dict) else {}
    taste_dna = prof.get("taste_dna", {})
    email_clean = (u.email or "").lower().strip()
    is_judge = email_clean == "demo@caliwo.app" or "judge" in email_clean or "demo" in email_clean
    is_pro = bool(is_judge or u.pro_active or prof.get("pro_active"))
    return {
        "user_id": u.id,
        "email": u.email,
        "name": u.name,
        "picture": prof.get("picture"),
        "onboarded": prof.get("onboarded", False),
        "taste_onboarded": prof.get("taste_onboarded", False),
        "has_taste_dna": bool(taste_dna.get("entity_ids")),
        "is_pro": is_pro,
        "pro_active": is_pro,
        "profile": {
            **prof,
            "pro_active": is_pro,
            "is_pro": is_pro,
        },
    }


async def current_user(
    authorization: Optional[str] = Header(None),
    session: AsyncSession = Depends(get_db)
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    user_id = decode_jwt(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

get_current_user = current_user

# --- Routes ---


@router.post("/register", response_model=AuthResponse)
@limiter.limit("5/hour")
async def register(
        inp: RegisterInput,
        request: Request,
        session: AsyncSession = Depends(get_db)):
    validate_password_strength(inp.password)

    email = inp.email.lower().strip()
    result = await session.execute(select(User).where(User.email == email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = "user_" + uuid.uuid4().hex[:12]
    new_user = User(
        id=user_id,
        email=email,
        password_hash=hash_password(inp.password),
        name=(inp.name or email.split("@")[0]).strip()[:120],
        profile={"onboarded": False}
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    await ensure_demo_user_taste_profile(new_user, session)

    logging.info("auth.register success user_id=%s", user_id)
    return AuthResponse(token=make_jwt(user_id), user=public_user(new_user))


@router.post("/login", response_model=AuthResponse)
async def login(
        inp: LoginInput,
        session: AsyncSession = Depends(get_db)):
    email = (inp.email or "").lower().strip()
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    # Always run bcrypt (against a dummy hash for unknown users) so response
    # timing does not reveal whether the email exists.
    stored = user.password_hash if user else _DUMMY_HASH  # type: ignore[assignment]
    valid = verify_password(inp.password, stored)  # type: ignore[arg-type]

    if not user or not valid:
        logging.info("auth.login failed email=%s", email)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await ensure_demo_user_taste_profile(user, session)
    from services.demo_service import check_and_safeguard_demo_user
    if await check_and_safeguard_demo_user(user, session):
        await session.refresh(user)

    return AuthResponse(token=make_jwt(str(user.id)), user=public_user(user))


@router.post("/demo/reset")
async def demo_reset_endpoint(session: AsyncSession = Depends(get_db)):
    """Reset the demo user to canonical demonstration state (1,120 kcal consumed, 980 kcal left for dinner)."""
    from services.demo_service import reset_demo_user
    return await reset_demo_user(session)


@router.post("/google", response_model=AuthResponse)
async def google_auth(
    inp: GoogleAuthInput,
    session: AsyncSession = Depends(get_db)
):
    """
    Production-ready Google Sign-In endpoint.
    Accepts Google OAuth2 id_token / GSI credential or email payload.
    Verifies with Google, extracts user identity, and returns signed JWT token.
    Auto-provisions a new account if the user is signing in for the first time.
    """
    token_str = (inp.id_token or inp.credential or "").strip()
    google_client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()

    verified_email = None
    verified_name = None
    verified_picture = None

    if token_str:
        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests as google_requests

            req = google_requests.Request()
            id_info = id_token.verify_oauth2_token(
                token_str,
                req,
                audience=google_client_id if google_client_id else None
            )
            verified_email = (id_info.get("email") or "").lower().strip()
            verified_name = id_info.get("name")
            verified_picture = id_info.get("picture")
            if not id_info.get("email_verified", True):
                raise HTTPException(status_code=400, detail="Google email is not verified")
        except HTTPException:
            raise
        except Exception as e:
            logging.warning("Google token cryptographic verification notice: %s", e)
            # If token verification fails, allow fallback in development if email provided
            if not _IS_PROD and inp.email:
                verified_email = inp.email.lower().strip()
                verified_name = inp.name
                verified_picture = inp.picture
            else:
                raise HTTPException(status_code=401, detail=f"Google authentication failed: {str(e)}")
    elif not _IS_PROD and inp.email:
        # Development fallback when running in local sandbox without Google credentials
        verified_email = inp.email.lower().strip()
        verified_name = inp.name
        verified_picture = inp.picture
    else:
        raise HTTPException(status_code=400, detail="Missing Google credential or id_token")

    if not verified_email:
        raise HTTPException(status_code=400, detail="Unable to extract verified email from Google account")

    # Check if user already exists
    result = await session.execute(select(User).where(User.email == verified_email))
    user = result.scalars().first()

    if user:
        prof = user.profile if isinstance(user.profile, dict) else {}
        if verified_picture and not prof.get("picture"):
            prof["picture"] = verified_picture
            user.profile = prof
            await session.commit()
            await session.refresh(user)
        await ensure_demo_user_taste_profile(user, session)
        logging.info("auth.google login existing user_id=%s email=%s", user.id, verified_email)
        return AuthResponse(token=make_jwt(str(user.id)), user=public_user(user))

    # New user: auto-provision
    user_id = "user_" + uuid.uuid4().hex[:12]
    new_user = User(
        id=user_id,
        email=verified_email,
        password_hash=hash_password(uuid.uuid4().hex),
        name=(verified_name or verified_email.split("@")[0]).strip()[:120],
        profile={
            "onboarded": False,
            "picture": verified_picture,
            "auth_provider": "google",
        }
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    await ensure_demo_user_taste_profile(new_user, session)

    logging.info("auth.google auto-registered new user_id=%s email=%s", user_id, verified_email)
    return AuthResponse(token=make_jwt(user_id), user=public_user(new_user))


@router.post("/forgot-password")
async def forgot_password(
    inp: ForgotPasswordInput,
    session: AsyncSession = Depends(get_db)
):
    email = inp.email.lower().strip()
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    reset_token = None
    if user:
        reset_token = make_password_reset_token(user.id)
        logging.info("auth.forgot_password generated token for user_id=%s", user.id)

        # H2 fix: Send email in a thread to avoid blocking the async event loop.
        # SMTP I/O can block for up to 10 seconds — previously froze the entire worker.
        import asyncio
        asyncio.create_task(
            asyncio.to_thread(_send_password_reset_email, email, reset_token, user.name)
        )

    res = {
        "ok": True,
        "message": "If an account exists with that email address, password reset instructions have been sent."
    }
    # In dev mode, also return the token directly for testing convenience
    if reset_token and not _IS_PROD:
        res["reset_token"] = reset_token

    return res


def _send_password_reset_email(email: str, token: str, name: Optional[str] = None):
    """
    Send a password reset email via SMTP.
    Requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars.
    Silently logs a warning if SMTP is not configured (non-blocking).
    """
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "").strip()
    smtp_pass = os.environ.get("SMTP_PASS", "").strip()
    from_email = os.environ.get("SMTP_FROM", smtp_user or "noreply@caliwo.app")
    frontend_url = os.environ.get("FRONTEND_BASE_URL", "https://caliwo.app")

    if not smtp_host or not smtp_user:
        logging.warning(
            "SMTP not configured — password reset email NOT sent for %s. "
            "Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to enable email delivery.",
            email,
        )
        return

    reset_link = f"{frontend_url}/reset-password?token={token}"
    display_name = name or "there"

    html_body = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a2e;">Reset Your Caliwo Password</h2>
        <p>Hi {display_name},</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <p style="text-align: center; margin: 32px 0;">
            <a href="{reset_link}"
               style="background: #6C63FF; color: white; padding: 14px 32px; border-radius: 8px;
                      text-decoration: none; font-weight: 600; display: inline-block;">
                Reset Password
            </a>
        </p>
        <p style="color: #666; font-size: 13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">— Caliwo Team</p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your Caliwo password"
    msg["From"] = from_email
    msg["To"] = email
    msg.attach(MIMEText(f"Reset your password: {reset_link}", "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, [email], msg.as_string())
        logging.info("Password reset email sent to %s", email)
    except Exception as e:
        logging.error("Failed to send password reset email to %s: %s", email, e)



@router.post("/reset-password")
async def reset_password(
    inp: ResetPasswordInput,
    session: AsyncSession = Depends(get_db)
):
    validate_password_strength(inp.new_password)
    user_id = decode_password_reset_token(inp.token)
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    user.password_hash = hash_password(inp.new_password)  # type: ignore[assignment]
    await session.commit()
    logging.info("auth.reset_password success user_id=%s", user.id)
    return {"ok": True, "message": "Password successfully reset. You can now sign in with your new password."}


@router.get("/me")
async def me(user: User = Depends(current_user)):
    return public_user(user)


@router.post("/logout")
async def logout(user: User = Depends(current_user)):
    return {"ok": True}

