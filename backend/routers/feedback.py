import datetime
import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_, or_, func, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, get_read_db, Base, engine
from models import (
    User,
    FeedbackPost,
    FeedbackVote,
    FeedbackComment,
    FeedbackFollower,
    ChangelogRelease,
    FeedbackReport,
    UserNotification,
)
from routers.auth import current_user

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


async def ensure_feedback_tables_exist():
    """Tables are created at app startup via Base.metadata.create_all."""
    pass


# --- Pydantic Schemas ---

class CreateFeedbackInput(BaseModel):
    post_type: str = Field(..., description="feature_request, bug_report, error_report, general_feedback")
    title: str = Field(..., min_length=3, max_length=150)
    description: str = Field(..., min_length=10)
    category: str = Field(..., description="AI, Meal Scanning, Nutrition, Water Tracking, Workouts, Groups, Widgets, UI / UX, Performance, Notifications, Integrations, Other")
    
    # Optional diagnostic metadata
    app_version: Optional[str] = None
    platform: Optional[str] = None
    device_model: Optional[str] = None
    os_version: Optional[str] = None
    locale: Optional[str] = None
    timezone: Optional[str] = None
    steps_to_reproduce: Optional[str] = None
    expected_behaviour: Optional[str] = None
    actual_behaviour: Optional[str] = None
    media_urls: Optional[List[str]] = []


class DuplicateCheckInput(BaseModel):
    title: str
    category: Optional[str] = None


class CreateCommentInput(BaseModel):
    content: str = Field(..., min_length=1)
    parent_id: Optional[str] = None
    is_official_dev_response: Optional[bool] = False


class UpdateStatusInput(BaseModel):
    status: str = Field(..., description="under_review, planned, in_progress, testing, released, fixed, duplicate, declined, closed")
    official_response: Optional[str] = None


class CreateChangelogInput(BaseModel):
    version: str
    release_date: str
    title: str
    description: str
    new_features: Optional[List[str]] = []
    improvements: Optional[List[str]] = []
    bug_fixes: Optional[List[str]] = []
    breaking_changes: Optional[List[str]] = []


# --- Utility Helpers ---

def check_profanity(text: str) -> bool:
    """Basic profanity check helper."""
    banned_words = {"badword", "abuse", "scam"}
    lower = text.lower()
    return any(bw in lower for bw in banned_words)


# --- Endpoints ---


class QuickFeedbackInput(BaseModel):
    category: str = "general"
    message: str


@router.post("/submit", response_model=dict)
async def submit_quick_feedback(
    inp: QuickFeedbackInput,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Quick feedback submission from the profile screen modal."""
    if not inp.message or len(inp.message.strip()) < 3:
        raise HTTPException(status_code=400, detail="Feedback message too short")

    if check_profanity(inp.message):
        raise HTTPException(status_code=400, detail="Inappropriate content detected")

    post = FeedbackPost(
        id=str(uuid.uuid4()),
        user_id=user.id,
        title=f"Quick Feedback: {inp.category.title()}",
        description=inp.message.strip(),
        category=inp.category.lower(),
        status="open",
        vote_count=0,
        comment_count=0,
        created_at=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None),
    )
    db.add(post)
    await db.commit()

    return {"ok": True, "post_id": post.id}


@router.post("/check-duplicates", response_model=dict)
async def check_duplicates(
    inp: DuplicateCheckInput,
    session: AsyncSession = Depends(get_db)
):
    """Check for existing similar feedback posts to prevent duplicate submissions."""
    await ensure_feedback_tables_exist()
    query = select(FeedbackPost, User).join(User, FeedbackPost.user_id == User.id).where(FeedbackPost.is_deleted == False)
    
    # Search title keywords
    keywords = [k for k in inp.title.lower().split() if len(k) > 3]
    if keywords:
        or_conditions = [FeedbackPost.title.ilike(f"%{kw}%") for kw in keywords[:3]]
        query = query.where(or_(*or_conditions))
    
    if inp.category:
        query = query.where(FeedbackPost.category == inp.category)
        
    query = query.order_by(desc(FeedbackPost.votes_count)).limit(5)
    res = await session.execute(query)
    rows = res.all()
    
    similar = []
    for post, author in rows:
        similar.append({
            "id": post.id,
            "title": post.title,
            "category": post.category,
            "status": post.status,
            "votes_count": post.votes_count,
            "author_name": author.name or "User"
        })
        
    return {"similar_posts": similar}


@router.get("/posts", response_model=dict)
async def get_feedback_posts(
    post_type: Optional[str] = None,
    category: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    sort_by: Optional[str] = Query("most_voted", alias="sort"), # most_voted, trending, newest, recently_updated
    my_posts: Optional[bool] = False,
    page: int = 1,
    limit: int = 20,
    cursor: Optional[str] = None,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_read_db)
):
    """List and filter feedback posts with cursor-based pagination.

    H10 fix: Supports cursor-based pagination (keyset using created_at).
    The `page` param is kept for backward compatibility but `cursor` takes
    precedence when provided. OFFSET pagination degrades at scale.
    H8 fix: Routes to read replica for read-heavy listing.
    """
    await ensure_feedback_tables_exist()
    stmt = select(FeedbackPost, User).join(User, FeedbackPost.user_id == User.id).where(FeedbackPost.is_deleted == False)

    if post_type:
        stmt = stmt.where(FeedbackPost.post_type == post_type)
    if category and category != "All":
        stmt = stmt.where(FeedbackPost.category == category)
    if status_filter:
        stmt = stmt.where(FeedbackPost.status == status_filter)
    if my_posts:
        stmt = stmt.where(FeedbackPost.user_id == user.id)
    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(FeedbackPost.title.ilike(term), FeedbackPost.description.ilike(term)))

    # Sorting
    if sort_by == "most_voted":
        stmt = stmt.order_by(desc(FeedbackPost.votes_count), desc(FeedbackPost.created_at))
    elif sort_by == "trending":
        stmt = stmt.order_by(desc(FeedbackPost.trending_score), desc(FeedbackPost.created_at))
    elif sort_by == "recently_updated":
        stmt = stmt.order_by(desc(FeedbackPost.updated_at))
    else: # newest
        stmt = stmt.order_by(desc(FeedbackPost.created_at))

    # H10: Cursor-based pagination (keyset) takes precedence over page-based
    if cursor:
        try:
            cursor_dt = datetime.datetime.fromisoformat(cursor)
            stmt = stmt.where(FeedbackPost.created_at < cursor_dt)
        except (ValueError, TypeError):
            pass  # Ignore malformed cursor, fall back to page-based
    elif page > 1:
        offset = (page - 1) * limit
        stmt = stmt.offset(offset)

    stmt = stmt.limit(limit)

    res = await session.execute(stmt)
    rows = res.all()

    # Get current user votes map
    post_ids = [p.id for p, _ in rows]
    voted_set = set()
    if post_ids:
        votes_res = await session.execute(
            select(FeedbackVote.post_id).where(
                and_(FeedbackVote.user_id == user.id, FeedbackVote.post_id.in_(post_ids))
            )
        )
        voted_set = set(votes_res.scalars().all())

    posts_list = []
    for post, author in rows:
        prof = author.profile if isinstance(author.profile, dict) else {}
        posts_list.append({
            "id": post.id,
            "user_id": author.id,
            "author_name": author.name or "User",
            "author_avatar": prof.get("avatar_url", None),
            "post_type": post.post_type,
            "title": post.title,
            "description": post.description,
            "category": post.category,
            "status": post.status,
            "votes_count": post.votes_count,
            "trending_score": post.trending_score,
            "comments_count": post.comments_count,
            "has_voted": post.id in voted_set,
            "media_urls": post.media_urls or [],
            "created_at": post.created_at.isoformat(),
            "updated_at": post.updated_at.isoformat()
        })

    # H10: Return next_cursor for keyset pagination
    next_cursor = posts_list[-1]["created_at"] if len(posts_list) == limit else None
    return {"posts": posts_list, "page": page, "limit": limit, "next_cursor": next_cursor}


@router.post("/posts", response_model=dict)
async def create_feedback_post(
    inp: CreateFeedbackInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    """Create a new feature request, bug report, or feedback item."""
    await ensure_feedback_tables_exist()
    if check_profanity(inp.title) or check_profanity(inp.description):
        raise HTTPException(status_code=400, detail="Inappropriate content detected.")

    post_id = "fb_" + uuid.uuid4().hex[:12]
    new_post = FeedbackPost(
        id=post_id,
        user_id=user.id,
        post_type=inp.post_type,
        title=inp.title.strip(),
        description=inp.description.strip(),
        category=inp.category,
        app_version=inp.app_version,
        platform=inp.platform,
        device_model=inp.device_model,
        os_version=inp.os_version,
        locale=inp.locale,
        timezone=inp.timezone,
        steps_to_reproduce=inp.steps_to_reproduce,
        expected_behaviour=inp.expected_behaviour,
        actual_behaviour=inp.actual_behaviour,
        media_urls=inp.media_urls or [],
        votes_count=1, # Auto vote by author
        trending_score=10.0
    )
    session.add(new_post)

    # Auto author vote
    vote_id = "v_" + uuid.uuid4().hex[:12]
    new_vote = FeedbackVote(id=vote_id, post_id=post_id, user_id=user.id)
    session.add(new_vote)

    # Auto author follower
    follow_id = "fl_" + uuid.uuid4().hex[:12]
    new_follow = FeedbackFollower(id=follow_id, post_id=post_id, user_id=user.id)
    session.add(new_follow)

    await session.commit()
    return {"ok": True, "id": post_id, "message": "Feedback post created successfully"}


@router.get("/posts/{post_id}", response_model=dict)
async def get_feedback_post_details(
    post_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_read_db)
):
    """Get single feedback post details."""
    await ensure_feedback_tables_exist()
    res = await session.execute(
        select(FeedbackPost, User).join(User, FeedbackPost.user_id == User.id).where(FeedbackPost.id == post_id)
    )
    row = res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Feedback post not found")

    post, author = row
    prof = author.profile if isinstance(author.profile, dict) else {}

    # Check vote status
    vote_res = await session.execute(
        select(FeedbackVote).where(and_(FeedbackVote.post_id == post_id, FeedbackVote.user_id == user.id))
    )
    has_voted = vote_res.scalars().first() is not None

    # Check follow status
    follow_res = await session.execute(
        select(FeedbackFollower).where(and_(FeedbackFollower.post_id == post_id, FeedbackFollower.user_id == user.id))
    )
    is_following = follow_res.scalars().first() is not None

    return {
        "post": {
            "id": post.id,
            "user_id": author.id,
            "author_name": author.name or "User",
            "author_avatar": prof.get("avatar_url", None),
            "post_type": post.post_type,
            "title": post.title,
            "description": post.description,
            "category": post.category,
            "status": post.status,
            "votes_count": post.votes_count,
            "trending_score": post.trending_score,
            "comments_count": post.comments_count,
            "has_voted": has_voted,
            "is_following": is_following,
            "app_version": post.app_version,
            "platform": post.platform,
            "device_model": post.device_model,
            "os_version": post.os_version,
            "steps_to_reproduce": post.steps_to_reproduce,
            "expected_behaviour": post.expected_behaviour,
            "actual_behaviour": post.actual_behaviour,
            "media_urls": post.media_urls or [],
            "created_at": post.created_at.isoformat(),
            "updated_at": post.updated_at.isoformat()
        }
    }


@router.post("/posts/{post_id}/vote", response_model=dict)
async def toggle_vote(
    post_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    """Upvote or remove vote on a feedback post."""
    await ensure_feedback_tables_exist()
    post_res = await session.execute(select(FeedbackPost).where(FeedbackPost.id == post_id))
    post = post_res.scalars().first()
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found")

    vote_res = await session.execute(
        select(FeedbackVote).where(and_(FeedbackVote.post_id == post_id, FeedbackVote.user_id == user.id))
    )
    existing_vote = vote_res.scalars().first()

    if existing_vote:
        await session.delete(existing_vote)
        post.votes_count = max(0, post.votes_count - 1)
        post.trending_score = max(0.0, post.trending_score - 2.0)
        has_voted = False
    else:
        new_vote = FeedbackVote(id="v_" + uuid.uuid4().hex[:12], post_id=post_id, user_id=user.id)
        session.add(new_vote)
        post.votes_count += 1
        post.trending_score += 2.0
        has_voted = True

    await session.commit()
    return {"has_voted": has_voted, "votes_count": post.votes_count}


@router.post("/posts/{post_id}/follow", response_model=dict)
async def toggle_follow(
    post_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    """Follow or unfollow a post for notification updates."""
    await ensure_feedback_tables_exist()
    follow_res = await session.execute(
        select(FeedbackFollower).where(and_(FeedbackFollower.post_id == post_id, FeedbackFollower.user_id == user.id))
    )
    existing = follow_res.scalars().first()

    if existing:
        await session.delete(existing)
        is_following = False
    else:
        new_fl = FeedbackFollower(id="fl_" + uuid.uuid4().hex[:12], post_id=post_id, user_id=user.id)
        session.add(new_fl)
        is_following = True

    await session.commit()
    return {"is_following": is_following}


@router.get("/posts/{post_id}/comments", response_model=dict)
async def get_comments(
    post_id: str,
    session: AsyncSession = Depends(get_db)
):
    """Get threaded comments for a feedback post."""
    await ensure_feedback_tables_exist()
    stmt = (
        select(FeedbackComment, User)
        .join(User, FeedbackComment.user_id == User.id)
        .where(and_(FeedbackComment.post_id == post_id, FeedbackComment.is_deleted == False))
        .order_by(asc(FeedbackComment.created_at))
    )
    res = await session.execute(stmt)
    rows = res.all()

    comments_list = []
    for c, author in rows:
        prof = author.profile if isinstance(author.profile, dict) else {}
        comments_list.append({
            "id": c.id,
            "post_id": c.post_id,
            "user_id": author.id,
            "author_name": author.name or "User",
            "author_avatar": prof.get("avatar_url", None),
            "parent_id": c.parent_id,
            "content": c.content,
            "is_official_dev_response": c.is_official_dev_response,
            "is_accepted_answer": c.is_accepted_answer,
            "is_pinned": c.is_pinned,
            "reactions": c.reactions or {},
            "created_at": c.created_at.isoformat()
        })

    return {"comments": comments_list}


@router.post("/posts/{post_id}/comments", response_model=dict)
async def add_comment(
    post_id: str,
    inp: CreateCommentInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    """Add a comment or official developer response to a feedback post."""
    await ensure_feedback_tables_exist()
    post_res = await session.execute(select(FeedbackPost).where(FeedbackPost.id == post_id))
    post = post_res.scalars().first()
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found")

    if check_profanity(inp.content):
        raise HTTPException(status_code=400, detail="Comment blocked due to language policy.")

    cid = "fbc_" + uuid.uuid4().hex[:12]
    new_comment = FeedbackComment(
        id=cid,
        post_id=post_id,
        user_id=user.id,
        parent_id=inp.parent_id,
        content=inp.content.strip(),
        is_official_dev_response=inp.is_official_dev_response or False
    )
    session.add(new_comment)

    post.comments_count += 1
    post.trending_score += 1.0
    post.updated_at = datetime.datetime.now(datetime.timezone.utc)

    await session.commit()

    prof = user.profile if isinstance(user.profile, dict) else {}
    return {
        "comment": {
            "id": cid,
            "post_id": post_id,
            "user_id": user.id,
            "author_name": user.name or "User",
            "author_avatar": prof.get("avatar_url", None),
            "parent_id": inp.parent_id,
            "content": new_comment.content,
            "is_official_dev_response": new_comment.is_official_dev_response,
            "is_accepted_answer": False,
            "is_pinned": False,
            "reactions": {},
            "created_at": new_comment.created_at.isoformat()
        }
    }


@router.patch("/posts/{post_id}/status", response_model=dict)
async def update_post_status(
    post_id: str,
    inp: UpdateStatusInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    """Update post status and optionally post an official dev response."""
    await ensure_feedback_tables_exist()
    post_res = await session.execute(select(FeedbackPost).where(FeedbackPost.id == post_id))
    post = post_res.scalars().first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.status = inp.status
    post.updated_at = datetime.datetime.now(datetime.timezone.utc)

    if inp.official_response and inp.official_response.strip():
        cid = "fbc_" + uuid.uuid4().hex[:12]
        dev_comment = FeedbackComment(
            id=cid,
            post_id=post_id,
            user_id=user.id,
            content=inp.official_response.strip(),
            is_official_dev_response=True,
            is_pinned=True
        )
        session.add(dev_comment)
        post.comments_count += 1

    await session.commit()
    return {"ok": True, "status": post.status}


# --- Official Changelog Endpoints ---

@router.get("/changelog", response_model=dict)
async def get_changelog(
    session: AsyncSession = Depends(get_db)
):
    """Get official app changelog release history."""
    await ensure_feedback_tables_exist()
    res = await session.execute(
        select(ChangelogRelease).order_by(desc(ChangelogRelease.created_at))
    )
    releases = res.scalars().all()

    changelog = []
    for r in releases:
        changelog.append({
            "id": r.id,
            "version": r.version,
            "release_date": r.release_date,
            "title": r.title,
            "description": r.description,
            "new_features": r.new_features or [],
            "improvements": r.improvements or [],
            "bug_fixes": r.bug_fixes or [],
            "breaking_changes": r.breaking_changes or [],
            "reactions": r.reactions or {},
            "created_at": r.created_at.isoformat()
        })

    return {"releases": changelog}


@router.post("/changelog", response_model=dict)
async def publish_changelog(
    inp: CreateChangelogInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db)
):
    """Publish an official app release update in Changelog."""
    await ensure_feedback_tables_exist()
    rel_id = "rel_" + uuid.uuid4().hex[:12]
    release = ChangelogRelease(
        id=rel_id,
        version=inp.version,
        release_date=inp.release_date,
        title=inp.title,
        description=inp.description,
        new_features=inp.new_features or [],
        improvements=inp.improvements or [],
        bug_fixes=inp.bug_fixes or [],
        breaking_changes=inp.breaking_changes or []
    )
    session.add(release)
    await session.commit()
    return {"ok": True, "id": rel_id, "version": release.version}
