"""
Taste Profile Management.
Manages the user's Taste DNA stored in user.profile["taste_dna"].
"""

from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from models import User


async def get_taste_dna(user: User) -> dict[str, Any]:
    profile = user.profile if isinstance(user.profile, dict) else {}
    return profile.get("taste_dna", {})


async def save_taste_dna(
    session: AsyncSession, user: User, taste_dna: dict
) -> None:
    profile = dict(user.profile) if user.profile else {}
    profile["taste_dna"] = taste_dna
    profile["taste_onboarded"] = True
    user.profile = profile
    flag_modified(user, "profile")
    await session.commit()

    # Invalidate cached profile and dashboard immediately
    from cache import cache_invalidate
    await cache_invalidate("profile", str(user.id))
    await cache_invalidate("dashboard", str(user.id))
    await cache_invalidate("coach_suggestions", str(user.id))


async def has_taste_profile(user: User) -> bool:
    dna = await get_taste_dna(user)
    return bool(dna.get("entity_ids"))


def compute_alignment_score(
    qloo_score: float, nutrition_fit: float
) -> int:
    """0-100 blended score: 60% cultural taste + 40% nutrition fit."""
    cultural = min(100, max(0, qloo_score * 100 if qloo_score <= 1 else qloo_score))
    nutritional = min(100, max(0, nutrition_fit))
    return int(cultural * 0.6 + nutritional * 0.4)
