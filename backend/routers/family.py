"""
Family Sharing Router
PostgreSQL-backed family groups with owner, members, join/leave.
"""

import random
import string
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from database import get_db
from models import User
from routers.auth import current_user

router = APIRouter(prefix="/family", tags=["family"])


class FamilyJoinInput(BaseModel):
    code: str


@router.post("/create")
async def family_create(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    profile: dict = dict(user.profile) if user.profile else {}
    if profile.get("family") and profile["family"].get("code"):
        raise HTTPException(status_code=400, detail="User already in a family")

    code = "".join(random.choices(string.ascii_uppercase, k=6))
    family_id = "fam_" + uuid.uuid4().hex[:12]

    profile["family"] = {
        "family_id": family_id,
        "code": code,
        "owner_id": user.id,
    }
    user.profile = profile
    flag_modified(user, "profile")
    await session.commit()

    return {
        "ok": True,
        "code": code,
        "family_id": family_id,
        "owner_id": user.id,
        "family": {
            "family_id": family_id,
            "code": code,
            "owner_id": user.id,
            "member_ids": [user.id],
            "members": [
                {"user_id": user.id, "name": user.name or "Owner", "is_owner": True}
            ],
        },
    }


async def _get_family_members(
    session: AsyncSession, code: str
) -> list[tuple["User", dict]]:
    """Fetch all users whose profile.family.code matches using JSONB query."""
    from sqlalchemy import func
    result = await session.execute(
        select(User).where(
            User.profile["family"]["code"].astext == code
        )
    )
    members = []
    for u in result.scalars().all():
        u_fam = (u.profile or {}).get("family")
        if u_fam:
            members.append((u, u_fam))
    return members


def _build_family_obj(code: str, members: list[tuple["User", dict]]) -> dict:
    """Build a family response object from member list."""
    owner_id = None
    family_id = None
    member_list = []
    for u, u_fam in members:
        if u_fam.get("owner_id") == u.id:
            owner_id = u.id
        if not family_id:
            family_id = u_fam.get("family_id")
        member_list.append(
            {
                "user_id": u.id,
                "name": u.name or "User",
                "is_owner": u_fam.get("owner_id") == u.id,
            }
        )
    return {
        "family_id": family_id,
        "code": code,
        "owner_id": owner_id,
        "member_ids": [m["user_id"] for m in member_list],
        "members": member_list,
    }


@router.get("/me")
async def family_me(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    profile: dict = user.profile or {}
    fam_meta = profile.get("family")
    if not fam_meta or not fam_meta.get("code"):
        return {"family": None}

    code = fam_meta["code"]
    members = await _get_family_members(session, code)
    if not members:
        return {"family": None}

    return {"family": _build_family_obj(code, members)}


@router.post("/join")
async def family_join(
    inp: FamilyJoinInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    code = inp.code.strip().upper()
    if not code or len(code) < 4:
        raise HTTPException(status_code=400, detail="Invalid family code")

    members = await _get_family_members(session, code)
    if not members:
        raise HTTPException(status_code=404, detail="Family not found")

    if len(members) >= 6:
        raise HTTPException(
            status_code=400, detail="Family member limit reached (max 6)"
        )

    # Check if user is already in this family
    for u, _ in members:
        if u.id == user.id:
            raise HTTPException(
                status_code=400, detail="You are already in this family"
            )

    # Derive owner_id from existing members
    owner_id = None
    family_id = None
    for _, u_fam in members:
        if not owner_id:
            owner_id = u_fam.get("owner_id")
        if not family_id:
            family_id = u_fam.get("family_id")

    family_meta = {
        "family_id": family_id or "fam_" + uuid.uuid4().hex[:12],
        "code": code,
        "owner_id": owner_id or members[0][0].id,
    }

    profile: dict = dict(user.profile) if user.profile else {}
    profile["family"] = family_meta
    user.profile = profile
    flag_modified(user, "profile")
    await session.commit()

    return {"ok": True, "family": family_meta}


@router.post("/leave")
async def family_leave(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    profile: dict = dict(user.profile) if user.profile else {}
    fam_meta = profile.get("family")
    if not fam_meta or not fam_meta.get("code"):
        return {"ok": True}

    code = fam_meta["code"]
    is_owner = fam_meta.get("owner_id") == user.id

    # Remove family from this user's profile
    del profile["family"]
    user.profile = profile
    flag_modified(user, "profile")

    # Find remaining members
    members = await _get_family_members(session, code)
    remaining = [(u, f) for u, f in members if u.id != user.id]

    # If owner left and there are remaining members, transfer ownership
    if is_owner and remaining:
        new_owner = remaining[0][0]
        for u, _ in remaining:
            u_prof = dict(u.profile or {})
            if u_prof.get("family"):
                u_prof["family"]["owner_id"] = new_owner.id
                u.profile = u_prof
                flag_modified(u, "profile")

    await session.commit()
    return {"ok": True}


@router.delete("/members/{member_id}")
async def family_remove_member(
    member_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    profile: dict = user.profile or {}
    fam_meta = profile.get("family")
    if not fam_meta or fam_meta.get("owner_id") != user.id:
        raise HTTPException(
            status_code=403, detail="Only family owner can remove members"
        )

    if member_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself. Use leave instead.")

    res = await session.execute(select(User).where(User.id == member_id))
    target = res.scalar_one_or_none()
    if target and target.profile:
        t_prof = dict(target.profile)
        if "family" in t_prof:
            del t_prof["family"]
            target.profile = t_prof
            flag_modified(target, "profile")
            await session.commit()

    return {"ok": True}
