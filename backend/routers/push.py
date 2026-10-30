from typing import Optional

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User
from routers.auth import current_user

router = APIRouter(prefix="/push", tags=["push"])


class PushTokenInput(BaseModel):
    token: str


@router.post("/register")
async def register_push_token(
        inp: PushTokenInput,
        user: User = Depends(current_user),
        session: AsyncSession = Depends(get_db)):
    # Store in profile JSON
    current_profile = dict(user.profile) if user.profile else {}  # type: ignore[call-overload]
    current_profile["push_token"] = inp.token

    stmt = update(User).where(
        User.id == user.id).values(
        profile=current_profile)
    await session.execute(stmt)
    await session.commit()

    return {"ok": True}

# Internal utility to send Expo push (in a real app, this would run in a
# celery worker or APScheduler)


async def send_expo_push(token: str, title: str, body: str, data: Optional[dict] = None):
    if not token.startswith("ExponentPushToken"):
        return False

    async with httpx.AsyncClient() as client:
        payload = {
            "to": token,
            "title": title,
            "body": body,
            "data": data or {}
        }
        resp = await client.post("https://exp.host/--/api/v2/push/send", json=payload)
        return resp.status_code == 200
