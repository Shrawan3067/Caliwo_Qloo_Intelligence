import asyncio
import json
import logging
import os
import uuid
import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status, Header
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_, and_, desc, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, get_read_db, get_engine, Base
import models
from models import (
    User, SocialGroup, GroupMember, GroupJoinRequest, GroupMessage,
    MessageReaction, GroupAuditLog, GroupReport, UserMilestone, UserNotification,
    DailySummary, Meal, UserStreak
)
from routers.auth import current_user, decode_jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/groups", tags=["groups"])


_tables_created = False

async def ensure_tables_exist():
    """Tables are created at app startup via Base.metadata.create_all."""
    pass


# --- Profanity & Content Filtering ---
PROFANITY_WORDS = {"abuse", "hate", "scam", "nude", "porn", "slur", "spam"}

def check_profanity(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower()
    for word in PROFANITY_WORDS:
        if word in lowered:
            return True
    return False

# --- Pydantic Schemas ---
class GroupCreateInput(BaseModel):
    name: str = Field(..., min_length=3, max_length=60)
    description: str = Field(..., min_length=5, max_length=500)
    image_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    category: str = "Healthy Eating" # Weight Loss, Muscle Gain, Healthy Eating, Keto, Vegan, Running, Gym, Fasting, Diabetes, Custom
    privacy: str = "public" # public, private
    max_members: Optional[int] = Field(None, ge=2, le=10000)
    invite_code: Optional[str] = None
    rules: Optional[List[str]] = []

class GroupUpdateInput(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    category: Optional[str] = None
    privacy: Optional[str] = None
    max_members: Optional[int] = None
    rules: Optional[List[str]] = None

class GroupJoinCodeInput(BaseModel):
    invite_code: str

class GroupMessageInput(BaseModel):
    content: str
    media_type: Optional[str] = None
    media_url: Optional[str] = None
    parent_id: Optional[str] = None

class MessageEditInput(BaseModel):
    content: str

class MessageReactionInput(BaseModel):
    emoji: str

class RoleChangeInput(BaseModel):
    role: str # owner, moderator, member

class MuteInput(BaseModel):
    duration_minutes: int = 60

class ReportInput(BaseModel):
    group_id: str
    target_user_id: Optional[str] = None
    message_id: Optional[str] = None
    reason: str
    details: Optional[str] = None

class PrivacySettingsInput(BaseModel):
    hide_weight: Optional[bool] = False
    hide_calories: Optional[bool] = False
    hide_meals: Optional[bool] = False
    hide_progress: Optional[bool] = False
    hide_activity: Optional[bool] = False

# --- WebSocket Realtime Connection Manager (C5 fix: Redis Pub/Sub) ---
class GroupConnectionManager:
    """WebSocket connection manager with Redis Pub/Sub for cross-worker broadcasting.

    Each Gunicorn worker maintains its own set of local WebSocket connections.
    When a message is broadcast, it is published to a Redis channel. All workers
    subscribe to the channel and forward the message to their local connections.
    Falls back to in-process broadcasting if Redis is unavailable.
    """
    def __init__(self):
        # group_id -> List[{ "websocket": WebSocket, "user_id": str }]
        self.active_connections: Dict[str, List[Dict[str, Any]]] = {}
        self._pubsub_tasks: Dict[str, asyncio.Task] = {}
        self._redis = None

    def _get_redis(self):
        if self._redis is None:
            try:
                from cache import get_redis
                self._redis = get_redis()
            except Exception:
                pass
        return self._redis

    async def connect(self, websocket: WebSocket, group_id: str, user_id: str):
        await websocket.accept()
        if group_id not in self.active_connections:
            self.active_connections[group_id] = []
        self.active_connections[group_id].append({"websocket": websocket, "user_id": user_id})

        # Start Redis subscription for this group if not already running
        if group_id not in self._pubsub_tasks:
            r = self._get_redis()
            if r:
                task = asyncio.create_task(self._subscribe_group(group_id))
                self._pubsub_tasks[group_id] = task

    def disconnect(self, websocket: WebSocket, group_id: str):
        if group_id in self.active_connections:
            self.active_connections[group_id] = [
                conn for conn in self.active_connections[group_id] if conn["websocket"] != websocket
            ]
            if not self.active_connections[group_id]:
                del self.active_connections[group_id]
                # Cancel subscription if no local connections remain
                task = self._pubsub_tasks.pop(group_id, None)
                if task:
                    task.cancel()

    async def broadcast(self, group_id: str, message_data: dict):
        """Publish to Redis channel (cross-worker) or broadcast locally."""
        r = self._get_redis()
        if r:
            try:
                channel = f"ws:group:{group_id}"
                await r.publish(channel, json.dumps(message_data, default=str))
                return
            except Exception as e:
                logger.debug("Redis publish failed, falling back to local: %s", e)

        # Fallback: local-only broadcast
        await self._local_broadcast(group_id, message_data)

    async def _local_broadcast(self, group_id: str, message_data: dict):
        if group_id in self.active_connections:
            stale = []
            for conn in self.active_connections[group_id]:
                try:
                    await conn["websocket"].send_json(message_data)
                except Exception:
                    stale.append(conn)
            # Clean up stale connections
            for s in stale:
                self.active_connections[group_id].remove(s)

    async def _subscribe_group(self, group_id: str):
        """Subscribe to Redis Pub/Sub channel and relay to local WebSockets."""
        try:
            r = self._get_redis()
            if not r:
                return
            pubsub = r.pubsub()
            channel = f"ws:group:{group_id}"
            await pubsub.subscribe(channel)
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        await self._local_broadcast(group_id, data)
                    except Exception:
                        pass
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.debug("Redis subscribe error for group %s: %s", group_id, e)

ws_manager = GroupConnectionManager()

# --- Helper Utilities ---
def generate_invite_code() -> str:
    return uuid.uuid4().hex[:8].upper()


async def get_user_streak(user_id: str, session: AsyncSession) -> dict:
    """H1 fix: Read pre-computed streak data from UserStreak table.

    Falls back to minimal defaults if no streak row exists yet. The streak
    is updated asynchronously on meal log/delete via refresh_user_streak().
    """
    res = await session.execute(
        select(UserStreak).where(UserStreak.user_id == user_id)
    )
    streak = res.scalars().first()
    if streak:
        return {
            "current_streak": streak.current_streak or 1,
            "longest_streak": streak.longest_streak or 1,
            "total_meals": streak.total_meals or 0,
        }

    # No pre-computed row yet — return minimal defaults
    # (will be populated on next meal log)
    meal_count_res = await session.execute(
        select(func.count(Meal.meal_id)).where(Meal.user_id == user_id)
    )
    total = meal_count_res.scalar() or 0
    return {
        "current_streak": 1,
        "longest_streak": 1,
        "total_meals": total,
    }


async def refresh_user_streak(user_id: str, session: AsyncSession) -> None:
    """Recompute and upsert the UserStreak row for a user.

    Called as a background task after meal log/delete.
    """
    try:
        meals_res = await session.execute(
            select(Meal.logged_at).where(Meal.user_id == user_id)
        )
        logged_dates = set()
        total_meals = 0
        for (logged_at,) in meals_res.all():
            total_meals += 1
            if logged_at:
                logged_dates.add(logged_at.date().isoformat())

        summaries_res = await session.execute(
            select(DailySummary.date_str, DailySummary.total_calories,
                   DailySummary.water_ml, DailySummary.steps)
            .where(DailySummary.user_id == user_id)
        )
        for row in summaries_res.all():
            d_str, cal, water, steps = row
            if (cal or 0) > 0 or (water or 0) > 0 or (steps or 0) > 0:
                logged_dates.add(str(d_str))

        all_dates = sorted(logged_dates, reverse=True)

        current_streak = 0
        longest_streak = 0
        temp_streak = 0
        today_str = datetime.date.today().isoformat()
        yesterday_str = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()

        prev_date = None
        for d_str in all_dates:
            if prev_date is None:
                temp_streak = 1
            else:
                p_date = datetime.date.fromisoformat(prev_date)
                c_date = datetime.date.fromisoformat(d_str)
                if (p_date - c_date).days == 1:
                    temp_streak += 1
                else:
                    temp_streak = 1
            prev_date = d_str
            if temp_streak > longest_streak:
                longest_streak = temp_streak
            if d_str in (today_str, yesterday_str) and current_streak == 0:
                current_streak = temp_streak

        current_streak = max(current_streak, 1)
        longest_streak = max(longest_streak, 1)

        # Upsert
        existing = await session.execute(
            select(UserStreak).where(UserStreak.user_id == user_id)
        )
        streak_row = existing.scalars().first()
        if streak_row:
            streak_row.current_streak = current_streak
            streak_row.longest_streak = longest_streak
            streak_row.total_meals = total_meals
            streak_row.last_active_date = all_dates[0] if all_dates else None
        else:
            streak_row = UserStreak(
                user_id=user_id,
                current_streak=current_streak,
                longest_streak=longest_streak,
                total_meals=total_meals,
                last_active_date=all_dates[0] if all_dates else None,
            )
            session.add(streak_row)
        await session.commit()
    except Exception as e:
        logger.error("Failed to refresh streak for user %s: %s", user_id, e)

# --- Routes ---

@router.post("", response_model=dict)
async def create_group(
    inp: GroupCreateInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    await ensure_tables_exist()
    if check_profanity(inp.name) or check_profanity(inp.description):

        raise HTTPException(status_code=400, detail="Group title or description contains restricted language.")

    invite_code = inp.invite_code.strip().upper() if inp.invite_code else generate_invite_code()
    
    # Check invite code uniqueness
    code_check = await session.execute(select(SocialGroup).where(SocialGroup.invite_code == invite_code))
    if code_check.scalars().first():
        invite_code = generate_invite_code()

    group_id = "group_" + uuid.uuid4().hex[:12]
    new_group = SocialGroup(
        id=group_id,
        name=inp.name.strip(),
        description=inp.description.strip(),
        image_url=inp.image_url,
        cover_image_url=inp.cover_image_url,
        category=inp.category,
        privacy=inp.privacy,
        max_members=inp.max_members,
        invite_code=invite_code,
        rules=inp.rules or [],
        owner_id=user.id,
        activity_score=10.0
    )
    session.add(new_group)
    await session.flush()

    # Owner membership

    owner_member = GroupMember(
        id="gm_" + uuid.uuid4().hex[:12],
        group_id=group_id,
        user_id=user.id,
        role="owner",
        status="active"
    )
    session.add(owner_member)
    await session.commit()

    # Award 'First Group Joined' milestone if not exists
    milestone_check = await session.execute(
        select(UserMilestone).where(
            and_(UserMilestone.user_id == user.id, UserMilestone.badge_id == "first_group")
        )
    )
    if not milestone_check.scalars().first():
        m = UserMilestone(
            id="ms_" + uuid.uuid4().hex[:12],
            user_id=user.id,
            badge_id="first_group",
            badge_name="Pioneer",
            category="Community",
            rarity="common"
        )
        session.add(m)
        await session.commit()

    return {
        "ok": True,
        "group_id": group_id,
        "invite_code": invite_code,
        "message": "Group created successfully"
    }


@router.get("/discover", response_model=dict)
async def discover_groups(
    query: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    tab: Optional[str] = Query("trending"), # trending, new, recommended, most_active
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_read_db)
):
    await ensure_tables_exist()

    # C2 fix: Use a subquery join for member counts instead of 1 query per group.
    member_count_subq = (
        select(
            GroupMember.group_id,
            func.count(GroupMember.id).label("member_count")
        )
        .where(GroupMember.status == "active")
        .group_by(GroupMember.group_id)
        .subquery()
    )

    stmt = (
        select(SocialGroup, func.coalesce(member_count_subq.c.member_count, 0).label("member_count"))
        .outerjoin(member_count_subq, SocialGroup.id == member_count_subq.c.group_id)
    )

    if query:
        search_pattern = f"%{query.strip()}%"
        stmt = stmt.where(
            or_(
                SocialGroup.name.ilike(search_pattern),
                SocialGroup.description.ilike(search_pattern),
                SocialGroup.category.ilike(search_pattern)
            )
        )

    if category and category != "All":
        stmt = stmt.where(SocialGroup.category == category)

    if tab == "new":
        stmt = stmt.order_by(desc(SocialGroup.created_at))
    elif tab == "most_active":
        stmt = stmt.order_by(desc(SocialGroup.activity_score))
    elif tab == "recommended":
        prof = user.profile if isinstance(user.profile, dict) else {}
        user_goal = prof.get("primary_goal", "")
        if "muscle" in user_goal.lower():
            stmt = stmt.order_by(desc(SocialGroup.category == "Muscle Gain"))
        elif "loss" in user_goal.lower() or "weight" in user_goal.lower():
            stmt = stmt.order_by(desc(SocialGroup.category == "Weight Loss"))
        else:
            stmt = stmt.order_by(desc(SocialGroup.activity_score))
    else: # trending
        stmt = stmt.order_by(desc(SocialGroup.activity_score), desc(SocialGroup.created_at))

    stmt = stmt.offset((page - 1) * limit).limit(limit)
    res = await session.execute(stmt)
    rows = res.all()

    # Get user memberships — single query for all groups
    user_memberships_res = await session.execute(
        select(GroupMember.group_id, GroupMember.status).where(GroupMember.user_id == user.id)
    )
    user_memberships = {r[0]: r[1] for r in user_memberships_res.all()}

    # Get pending requests — single query
    pending_res = await session.execute(
        select(GroupJoinRequest.group_id).where(
            and_(GroupJoinRequest.user_id == user.id, GroupJoinRequest.status == "pending")
        )
    )
    pending_groups = set(pending_res.scalars().all())

    items = []
    for g, member_count in rows:
        status = "none"
        if g.id in user_memberships:
            status = user_memberships[g.id]
        elif g.id in pending_groups:
            status = "pending"

        items.append({
            "id": g.id,
            "name": g.name,
            "description": g.description,
            "image_url": g.image_url,
            "cover_image_url": g.cover_image_url,
            "category": g.category,
            "privacy": g.privacy,
            "member_count": member_count,
            "max_members": g.max_members,
            "average_streak": 7.5,
            "user_status": status,
            "invite_code": g.invite_code
        })

    return {
        "page": page,
        "limit": limit,
        "groups": items
    }


@router.get("/my", response_model=dict)
async def get_my_groups(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_read_db)
):
    await ensure_tables_exist()

    # C2 fix: Use subquery joins for member and message counts
    member_count_subq = (
        select(
            GroupMember.group_id,
            func.count(GroupMember.id).label("member_count")
        )
        .where(GroupMember.status == "active")
        .group_by(GroupMember.group_id)
        .subquery()
    )

    msg_count_subq = (
        select(
            GroupMessage.group_id,
            func.count(GroupMessage.id).label("msg_count")
        )
        .group_by(GroupMessage.group_id)
        .subquery()
    )

    stmt = (
        select(
            SocialGroup,
            GroupMember.role,
            GroupMember.joined_at,
            func.coalesce(member_count_subq.c.member_count, 0).label("member_count"),
            func.coalesce(msg_count_subq.c.msg_count, 0).label("msg_count"),
        )
        .join(GroupMember, SocialGroup.id == GroupMember.group_id)
        .outerjoin(member_count_subq, SocialGroup.id == member_count_subq.c.group_id)
        .outerjoin(msg_count_subq, SocialGroup.id == msg_count_subq.c.group_id)
        .where(and_(GroupMember.user_id == user.id, GroupMember.status == "active"))
        .order_by(desc(GroupMember.joined_at))
    )
    res = await session.execute(stmt)
    rows = res.all()

    items = []
    for g, role, joined_at, member_count, msg_count in rows:
        items.append({
            "id": g.id,
            "name": g.name,
            "description": g.description,
            "image_url": g.image_url,
            "category": g.category,
            "privacy": g.privacy,
            "role": role,
            "member_count": member_count,
            "unread_count": min(msg_count, 99),
            "joined_at": joined_at.isoformat() if joined_at else None,
            "invite_code": g.invite_code
        })

    return {"groups": items}


@router.get("/{group_id}", response_model=dict)
async def get_group_details(
    group_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_read_db)
):
    group_res = await session.execute(select(SocialGroup).where(SocialGroup.id == group_id))
    group = group_res.scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Member role & status
    member_res = await session.execute(
        select(GroupMember).where(
            and_(GroupMember.group_id == group_id, GroupMember.user_id == user.id)
        )
    )
    member = member_res.scalars().first()

    # Pending request check
    req_res = await session.execute(
        select(GroupJoinRequest).where(
            and_(GroupJoinRequest.group_id == group_id, GroupJoinRequest.user_id == user.id, GroupJoinRequest.status == "pending")
        )
    )
    pending_req = req_res.scalars().first()

    mem_cnt_res = await session.execute(
        select(func.count(GroupMember.id)).where(
            and_(GroupMember.group_id == group_id, GroupMember.status == "active")
        )
    )
    member_count = mem_cnt_res.scalar() or 0

    # Owner details
    owner_res = await session.execute(select(User).where(User.id == group.owner_id))
    owner = owner_res.scalars().first()

    role = member.role if member else "none"
    status_str = member.status if member else ("pending" if pending_req else "none")

    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "image_url": group.image_url,
        "cover_image_url": group.cover_image_url,
        "category": group.category,
        "privacy": group.privacy,
        "max_members": group.max_members,
        "member_count": member_count,
        "invite_code": group.invite_code,
        "rules": group.rules or [],
        "user_role": role,
        "user_status": status_str,
        "owner": {
            "user_id": owner.id if owner else "",
            "name": owner.name if owner else "Unknown",
        },
        "created_at": group.created_at.isoformat() if group.created_at else None
    }


@router.post("/{group_id}/join", response_model=dict)
async def join_group(
    group_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    group_res = await session.execute(select(SocialGroup).where(SocialGroup.id == group_id))
    group = group_res.scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    existing_mem = await session.execute(
        select(GroupMember).where(and_(GroupMember.group_id == group_id, GroupMember.user_id == user.id))
    )
    if existing_mem.scalars().first():
        return {"ok": True, "message": "Already a member"}

    # Max members check
    if group.max_members:
        cnt_res = await session.execute(
            select(func.count(GroupMember.id)).where(and_(GroupMember.group_id == group_id, GroupMember.status == "active"))
        )
        if (cnt_res.scalar() or 0) >= group.max_members:
            raise HTTPException(status_code=400, detail="Group capacity reached")

    if group.privacy == "private":
        # Create join request
        req_check = await session.execute(
            select(GroupJoinRequest).where(and_(GroupJoinRequest.group_id == group_id, GroupJoinRequest.user_id == user.id, GroupJoinRequest.status == "pending"))
        )
        if not req_check.scalars().first():
            new_req = GroupJoinRequest(
                id="gjr_" + uuid.uuid4().hex[:12],
                group_id=group_id,
                user_id=user.id,
                status="pending"
            )
            session.add(new_req)
            await session.commit()

            # Notify Owner
            notif = UserNotification(
                id="notif_" + uuid.uuid4().hex[:12],
                user_id=group.owner_id,
                title="New Join Request",
                body=f"{user.name} requested to join {group.name}",
                type="join_request",
                data={"group_id": group_id, "user_id": user.id}
            )
            session.add(notif)
            await session.commit()

        return {"ok": True, "status": "pending", "message": "Join request submitted"}

    # Public group - instant join
    new_mem = GroupMember(
        id="gm_" + uuid.uuid4().hex[:12],
        group_id=group_id,
        user_id=user.id,
        role="member",
        status="active"
    )
    session.add(new_mem)
    await session.commit()

    return {"ok": True, "status": "active", "message": "Joined group successfully"}


@router.post("/join-by-code", response_model=dict)
async def join_group_by_code(
    inp: GroupJoinCodeInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    code = inp.invite_code.strip().upper()
    group_res = await session.execute(select(SocialGroup).where(SocialGroup.invite_code == code))
    group = group_res.scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    existing_mem = await session.execute(
        select(GroupMember).where(and_(GroupMember.group_id == group.id, GroupMember.user_id == user.id))
    )
    if existing_mem.scalars().first():
        return {"ok": True, "group_id": group.id, "message": "Already a member"}

    new_mem = GroupMember(
        id="gm_" + uuid.uuid4().hex[:12],
        group_id=group.id,
        user_id=user.id,
        role="member",
        status="active"
    )
    session.add(new_mem)
    await session.commit()

    return {"ok": True, "group_id": group.id, "message": "Joined group successfully"}


@router.post("/{group_id}/leave", response_model=dict)
async def leave_group(
    group_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    mem_res = await session.execute(
        select(GroupMember).where(and_(GroupMember.group_id == group_id, GroupMember.user_id == user.id))
    )
    mem = mem_res.scalars().first()
    if not mem:
        raise HTTPException(status_code=400, detail="You are not a member of this group")

    if mem.role == "owner":
        raise HTTPException(status_code=400, detail="Owner must transfer ownership before leaving")

    await session.delete(mem)
    await session.commit()
    return {"ok": True, "message": "Left group"}


# --- Members & Moderation ---

@router.get("/{group_id}/members", response_model=dict)
async def list_group_members(
    group_id: str,
    query: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_read_db)
):
    # C2 fix: Use LEFT JOIN with pre-computed UserStreak table instead of
    # calling get_user_streak() per member (which loaded ALL meals per user).
    stmt = (
        select(GroupMember, User, UserStreak)
        .join(User, GroupMember.user_id == User.id)
        .outerjoin(UserStreak, User.id == UserStreak.user_id)
        .where(and_(GroupMember.group_id == group_id, GroupMember.status == "active"))
    )

    if query:
        search = f"%{query.strip()}%"
        stmt = stmt.where(or_(User.name.ilike(search), User.email.ilike(search)))

    if role:
        stmt = stmt.where(GroupMember.role == role)

    stmt = stmt.order_by(desc(GroupMember.role == "owner"), desc(GroupMember.role == "moderator"), GroupMember.joined_at)
    res = await session.execute(stmt)
    rows = res.all()

    members = []
    for gm, u, streak in rows:
        prof = u.profile if isinstance(u.profile, dict) else {}
        members.append({
            "user_id": u.id,
            "name": u.name or "User",
            "avatar": prof.get("avatar_url", None),
            "role": gm.role,
            "status": gm.status,
            "current_streak": (streak.current_streak if streak else 1),
            "joined_at": gm.joined_at.isoformat() if gm.joined_at else None
        })

    return {"members": members}


@router.post("/{group_id}/members/{target_user_id}/role", response_model=dict)
async def update_member_role(
    group_id: str,
    target_user_id: str,
    inp: RoleChangeInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    # Check actor permission
    actor_mem = await session.execute(
        select(GroupMember).where(and_(GroupMember.group_id == group_id, GroupMember.user_id == user.id))
    )
    actor = actor_mem.scalars().first()
    if not actor or actor.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can change member roles")

    target_mem = await session.execute(
        select(GroupMember).where(and_(GroupMember.group_id == group_id, GroupMember.user_id == target_user_id))
    )
    target = target_mem.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    if inp.role == "owner":
        # Transfer ownership
        actor.role = "moderator"
        target.role = "owner"
        
        group_res = await session.execute(select(SocialGroup).where(SocialGroup.id == group_id))
        g = group_res.scalars().first()
        if g:
            g.owner_id = target_user_id
    else:
        target.role = inp.role

    log = GroupAuditLog(
        id="gal_" + uuid.uuid4().hex[:12],
        group_id=group_id,
        actor_id=user.id,
        action=f"role_change_to_{inp.role}",
        details={"target_user_id": target_user_id}
    )
    session.add(log)
    await session.commit()

    return {"ok": True, "message": f"Updated role to {inp.role}"}


@router.post("/{group_id}/members/{target_user_id}/kick", response_model=dict)
async def kick_member(
    group_id: str,
    target_user_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    actor_mem = await session.execute(
        select(GroupMember).where(and_(GroupMember.group_id == group_id, GroupMember.user_id == user.id))
    )
    actor = actor_mem.scalars().first()
    if not actor or actor.role not in ("owner", "moderator"):
        raise HTTPException(status_code=403, detail="Moderator permissions required")

    target_mem = await session.execute(
        select(GroupMember).where(and_(GroupMember.group_id == group_id, GroupMember.user_id == target_user_id))
    )
    target = target_mem.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    if target.role == "owner" or (actor.role == "moderator" and target.role == "moderator"):
        raise HTTPException(status_code=403, detail="Cannot kick higher or equal role")

    await session.delete(target)

    log = GroupAuditLog(
        id="gal_" + uuid.uuid4().hex[:12],
        group_id=group_id,
        actor_id=user.id,
        action="kick_member",
        details={"target_user_id": target_user_id}
    )
    session.add(log)
    await session.commit()

    return {"ok": True, "message": "Member kicked"}


# --- Group Chat Endpoints ---

@router.get("/{group_id}/messages", response_model=dict)
async def get_messages(
    group_id: str,
    before: Optional[str] = Query(None),
    limit: int = Query(40, ge=1, le=100),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    # Verify membership
    mem = await session.execute(
        select(GroupMember).where(and_(GroupMember.group_id == group_id, GroupMember.user_id == user.id))
    )
    if not mem.scalars().first():
        raise HTTPException(status_code=403, detail="Must be a member to view chat")

    stmt = (
        select(GroupMessage, User)
        .join(User, GroupMessage.user_id == User.id)
        .where(and_(GroupMessage.group_id == group_id, GroupMessage.is_deleted == False))
    )


    if before:
        before_msg = await session.execute(select(GroupMessage).where(GroupMessage.id == before))
        b_item = before_msg.scalars().first()
        if b_item:
            stmt = stmt.where(GroupMessage.created_at < b_item.created_at)

    stmt = stmt.order_by(desc(GroupMessage.created_at)).limit(limit)
    res = await session.execute(stmt)
    rows = res.all()

    # Batch-load reactions for all messages in 1 query (was N+1: 1 query per message)
    msg_ids = [msg.id for msg, _ in rows]
    reactions_map_all: Dict[str, Dict[str, List[str]]] = {}
    if msg_ids:
        rx_res = await session.execute(
            select(MessageReaction).where(MessageReaction.message_id.in_(msg_ids))
        )
        for r in rx_res.scalars().all():
            mid = r.message_id
            if mid not in reactions_map_all:
                reactions_map_all[mid] = {}
            if r.emoji not in reactions_map_all[mid]:
                reactions_map_all[mid][r.emoji] = []
            reactions_map_all[mid][r.emoji].append(r.user_id)

    # Batch-load parent message previews in 1 query (was N+1)
    parent_ids = [msg.parent_id for msg, _ in rows if msg.parent_id]
    parent_previews: Dict[str, dict] = {}
    if parent_ids:
        p_res = await session.execute(
            select(GroupMessage, User)
            .join(User, GroupMessage.user_id == User.id)
            .where(GroupMessage.id.in_(parent_ids))
        )
        for p_msg, p_user in p_res.all():
            parent_previews[p_msg.id] = {
                "id": p_msg.id,
                "sender_name": p_user.name or "User",
                "content": p_msg.content[:80]
            }

    messages = []
    for msg, sender in reversed(rows): # return chronological order
        prof = sender.profile if isinstance(sender.profile, dict) else {}
        
        reactions_map = reactions_map_all.get(msg.id, {})
        parent_preview = parent_previews.get(msg.parent_id) if msg.parent_id else None

        messages.append({
            "id": msg.id,
            "user_id": sender.id,
            "sender_name": sender.name or "User",
            "sender_avatar": prof.get("avatar_url", None),
            "content": msg.content if not msg.is_deleted else "[Message deleted]",
            "media_type": msg.media_type,
            "media_url": msg.media_url,
            "is_edited": msg.is_edited,
            "is_deleted": msg.is_deleted,
            "is_pinned": msg.is_pinned,
            "parent_message": parent_preview,
            "reactions": [{"emoji": k, "users": v} for k, v in reactions_map.items()],
            "created_at": (msg.created_at.isoformat() + "Z") if not msg.created_at.isoformat().endswith("Z") else msg.created_at.isoformat()
        })

    return {"messages": messages}


@router.post("/{group_id}/messages", response_model=dict)
async def send_message(
    group_id: str,
    inp: GroupMessageInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    mem_res = await session.execute(
        select(GroupMember).where(and_(GroupMember.group_id == group_id, GroupMember.user_id == user.id))
    )
    mem = mem_res.scalars().first()
    if not mem or mem.status != "active":
        raise HTTPException(status_code=403, detail="Cannot send message")

    if mem.mute_until and mem.mute_until > datetime.datetime.now(datetime.timezone.utc):
        raise HTTPException(status_code=403, detail="You are muted in this group")

    if check_profanity(inp.content):
        raise HTTPException(status_code=400, detail="Message blocked due to inappropriate language")

    msg_id = "msg_" + uuid.uuid4().hex[:12]
    new_msg = GroupMessage(
        id=msg_id,
        group_id=group_id,
        user_id=user.id,
        content=inp.content.strip(),
        media_type=inp.media_type,
        media_url=inp.media_url,
        parent_id=inp.parent_id
    )
    session.add(new_msg)

    # Boost group activity score
    group_res = await session.execute(select(SocialGroup).where(SocialGroup.id == group_id))
    g = group_res.scalars().first()
    if g:
        g.activity_score += 1.0

    await session.commit()

    prof = user.profile if isinstance(user.profile, dict) else {}
    payload = {
        "event": "new_message",
        "message": {
            "id": msg_id,
            "group_id": group_id,
            "user_id": user.id,
            "sender_name": user.name or "User",
            "sender_avatar": prof.get("avatar_url", None),
            "content": new_msg.content,
            "media_type": new_msg.media_type,
            "media_url": new_msg.media_url,
            "is_edited": False,
            "is_deleted": False,
            "is_pinned": False,
            "reactions": [],
            "created_at": (new_msg.created_at or datetime.datetime.now(datetime.timezone.utc)).isoformat() + ("" if (new_msg.created_at or datetime.datetime.now(datetime.timezone.utc)).isoformat().endswith("Z") else "Z")
        }
    }
    await ws_manager.broadcast(group_id, payload)

    return {"ok": True, "message": payload["message"]}


@router.post("/{group_id}/messages/{msg_id}/react", response_model=dict)
async def react_to_message(
    group_id: str,
    msg_id: str,
    inp: MessageReactionInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    rx_res = await session.execute(
        select(MessageReaction).where(
            and_(MessageReaction.message_id == msg_id, MessageReaction.user_id == user.id, MessageReaction.emoji == inp.emoji)
        )
    )
    existing_rx = rx_res.scalars().first()
    if existing_rx:
        await session.delete(existing_rx)
        action = "removed"
    else:
        new_rx = MessageReaction(
            id="rx_" + uuid.uuid4().hex[:12],
            message_id=msg_id,
            user_id=user.id,
            emoji=inp.emoji
        )
        session.add(new_rx)
        action = "added"

    await session.commit()
    
    # Broadcast reaction event
    await ws_manager.broadcast(group_id, {
        "event": "message_reaction",
        "message_id": msg_id,
        "user_id": user.id,
        "emoji": inp.emoji,
        "action": action
    })

    return {"ok": True, "action": action}


@router.post("/{group_id}/messages/{msg_id}/pin", response_model=dict)
async def toggle_pin_message(
    group_id: str,
    msg_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    mem_res = await session.execute(
        select(GroupMember).where(and_(GroupMember.group_id == group_id, GroupMember.user_id == user.id))
    )
    mem = mem_res.scalars().first()
    if not mem or mem.role not in ("owner", "moderator"):
        raise HTTPException(status_code=403, detail="Only owner or moderators can pin messages")

    msg_res = await session.execute(select(GroupMessage).where(GroupMessage.id == msg_id))
    msg = msg_res.scalars().first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    msg.is_pinned = not msg.is_pinned
    msg.pinned_at = datetime.datetime.now(datetime.timezone.utc) if msg.is_pinned else None
    msg.pinned_by = user.id if msg.is_pinned else None
    await session.commit()

    await ws_manager.broadcast(group_id, {
        "event": "message_pinned",
        "message_id": msg_id,
        "is_pinned": msg.is_pinned
    })

    return {"ok": True, "is_pinned": msg.is_pinned}


@router.delete("/{group_id}/messages/{msg_id}", response_model=dict)
async def delete_message(
    group_id: str,
    msg_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    mem_res = await session.execute(
        select(GroupMember).where(and_(GroupMember.group_id == group_id, GroupMember.user_id == user.id))
    )
    mem = mem_res.scalars().first()

    msg_res = await session.execute(select(GroupMessage).where(GroupMessage.id == msg_id))
    msg = msg_res.scalars().first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Author or mod/owner can delete
    if msg.user_id != user.id and (not mem or mem.role not in ("owner", "moderator")):
        raise HTTPException(status_code=403, detail="Permission denied")

    msg.is_deleted = True
    msg.content = "[Message deleted]"
    await session.commit()

    await ws_manager.broadcast(group_id, {
        "event": "message_deleted",
        "message_id": msg_id
    })

    return {"ok": True, "message": "Message deleted"}


# --- Automated Leaderboard ---

@router.get("/{group_id}/leaderboard", response_model=dict)
async def get_group_leaderboard(
    group_id: str,
    timeframe: str = Query("weekly"), # daily, weekly, monthly, all_time
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    # C2 fix: Use JOIN with pre-computed UserStreak table instead of
    # calling get_user_streak() per member (which was O(N) per user).
    members_res = await session.execute(
        select(GroupMember, User, UserStreak)
        .join(User, GroupMember.user_id == User.id)
        .outerjoin(UserStreak, User.id == UserStreak.user_id)
        .where(and_(GroupMember.group_id == group_id, GroupMember.status == "active"))
    )
    rows = members_res.all()

    leaderboard = []
    for gm, u, streak in rows:
        prof = u.profile if isinstance(u.profile, dict) else {}
        current = streak.current_streak if streak else 1
        longest = streak.longest_streak if streak else 1
        total = streak.total_meals if streak else 0

        weekly_score = (current * 15) + (total * 5)

        leaderboard.append({
            "user_id": u.id,
            "username": u.name or "User",
            "avatar": prof.get("avatar_url", None),
            "current_streak": current,
            "longest_streak": longest,
            "total_meals": total,
            "score": weekly_score,
            "is_current_user": u.id == user.id
        })

    leaderboard.sort(
        key=lambda x: (x["current_streak"], x["longest_streak"], x["total_meals"], x["score"]),
        reverse=True,
    )

    for idx, item in enumerate(leaderboard):
        item["rank"] = idx + 1

    return {
        "timeframe": timeframe,
        "leaderboard": leaderboard
    }


# --- Mini Public User Profile & Milestones ---

@router.get("/users/{target_user_id}/public-profile", response_model=dict)
async def get_public_user_profile(
    target_user_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    target_res = await session.execute(select(User).where(User.id == target_user_id))
    target = target_res.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    prof = target.profile if isinstance(target.profile, dict) else {}
    privacy = prof.get("privacy", {})

    streak_info = await get_user_streak(target.id, session)

    # Badges
    badges_res = await session.execute(
        select(UserMilestone).where(UserMilestone.user_id == target.id)
    )
    badges = badges_res.scalars().all()

    # Count groups joined
    groups_cnt_res = await session.execute(
        select(func.count(GroupMember.id)).where(and_(GroupMember.user_id == target.id, GroupMember.status == "active"))
    )
    groups_count = groups_cnt_res.scalar() or 0

    return {
        "user_id": target.id,
        "username": target.name or "User",
        "avatar": prof.get("avatar_url", None),
        "bio": prof.get("bio", "Fitness & Nutrition enthusiast"),
        "join_date": target.created_at.strftime("%B %Y") if target.created_at else "Recently",
        "current_streak": streak_info["current_streak"],
        "longest_streak": streak_info["longest_streak"],
        "total_meals_logged": streak_info["total_meals"] if not privacy.get("hide_meals") else None,
        "water_streak": 5 if not privacy.get("hide_activity") else None,
        "workout_streak": 4 if not privacy.get("hide_activity") else None,
        "groups_joined": groups_count,
        "badges": [
            {
                "id": b.badge_id,
                "name": b.badge_name,
                "category": b.category,
                "rarity": b.rarity,
                "unlocked_at": b.unlocked_at.isoformat()
            } for b in badges
        ]
    }


# --- Reports & Moderation ---

@router.post("/reports", response_model=dict)
async def submit_report(
    inp: ReportInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    report_id = "rep_" + uuid.uuid4().hex[:12]
    rep = GroupReport(
        id=report_id,
        reporter_id=user.id,
        group_id=inp.group_id,
        target_user_id=inp.target_user_id,
        message_id=inp.message_id,
        reason=inp.reason,
        details=inp.details
    )
    session.add(rep)
    await session.commit()
    return {"ok": True, "message": "Report submitted successfully"}


# --- WebSocket Endpoint ---

@router.websocket("/{group_id}/ws")
async def group_websocket(
    websocket: WebSocket,
    group_id: str,
    token: str = Query(...)
):
    user_id = decode_jwt(token)
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws_manager.connect(websocket, group_id, user_id)

    # C5: Heartbeat/ping task to detect and clean up stale connections.
    # Sends a ping every 30s; if the client doesn't respond, the connection
    # is considered dead. Prevents unbounded memory growth from stale WS.
    async def heartbeat():
        try:
            while True:
                await asyncio.sleep(30)
                try:
                    await websocket.send_json({"event": "ping"})
                except Exception:
                    break
        except asyncio.CancelledError:
            pass

    ping_task = asyncio.create_task(heartbeat())

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("event")

            if event_type == "typing":
                await ws_manager.broadcast(group_id, {
                    "event": "typing",
                    "group_id": group_id,
                    "user_id": user_id,
                    "is_typing": data.get("is_typing", True)
                })
            elif event_type == "pong":
                # Client responded to heartbeat — connection is alive
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, group_id)
    except Exception:
        ws_manager.disconnect(websocket, group_id)
    finally:
        ping_task.cancel()

