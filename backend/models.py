from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text, Date, JSON, Index, UniqueConstraint
from sqlalchemy.orm import relationship
import datetime
from typing import Any

try:
    from sqlalchemy.dialects.postgresql import JSONB
except ImportError:
    JSONB = JSON

try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    Vector: Any = lambda dim: JSON

from database import Base

def utc_now() -> datetime.datetime:
    """Return naive UTC datetime matching database TIMESTAMP WITHOUT TIME ZONE columns."""
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

class User(Base):
    __tablename__ = "users"

    id: Any = Column(String, primary_key=True, index=True)
    email: Any = Column(String, unique=True, index=True, nullable=False)
    password_hash: Any = Column(String, nullable=False)
    name: Any = Column(String, nullable=True)
    created_at: Any = Column(DateTime, default=utc_now)

    # Profile Data (stored as JSONB for flexibility during migration, can be normalized later)
    profile: Any = Column(JSONB, default=dict)
    
    # Pro Status
    pro_active: Any = Column(Boolean, default=False)
    pro_expires_at: Any = Column(DateTime, nullable=True)

    meals = relationship("Meal", back_populates="user", cascade="all, delete-orphan")
    daily_summaries = relationship("DailySummary", back_populates="user", cascade="all, delete-orphan")
    memories = relationship("UserMemory", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        Index("idx_chat_messages_user_session_created", "user_id", "session_id", "created_at"),
    )

    id: Any = Column(String, primary_key=True, index=True)
    user_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    session_id: Any = Column(String, index=True, nullable=False)
    role: Any = Column(String, nullable=False) # 'user' or 'assistant'
    content: Any = Column(Text, nullable=False)
    agent_telemetry: Any = Column(JSONB, nullable=True)
    created_at: Any = Column(DateTime, default=utc_now, index=True)

    user = relationship("User", back_populates="chat_messages")

class UserMemory(Base):
    """Permanent vector memory for RAG."""
    __tablename__ = "user_memories"

    id: Any = Column(String, primary_key=True, index=True)
    user_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    
    # Textual context (e.g. "User is allergic to peanuts")
    content: Any = Column(Text, nullable=False)
    
    # 1536 is standard for text-embedding-3-small
    embedding: Any = Column(Vector(1536), nullable=False)
    
    created_at: Any = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="memories")

class Meal(Base):
    __tablename__ = "meals"
    __table_args__ = (
        Index("idx_meals_user_logged", "user_id", "logged_at"),
    )

    meal_id: Any = Column(String, primary_key=True, index=True)
    user_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    title: Any = Column(String, nullable=False)
    meal_type: Any = Column(String, nullable=False) # e.g. breakfast, lunch, dinner, snack
    
    calories: Any = Column(Float, default=0.0)
    protein_g: Any = Column(Float, default=0.0)
    carbs_g: Any = Column(Float, default=0.0)
    fat_g: Any = Column(Float, default=0.0)
    fiber_g: Any = Column(Float, default=0.0)
    sugar_g: Any = Column(Float, default=0.0)
    sodium_mg: Any = Column(Float, default=0.0)
    magnesium_mg: Any = Column(Float, default=0.0)
    
    ingredients: Any = Column(JSONB, default=list) # List of recognized ingredients
    
    # Image Storage Metadata
    image_key: Any = Column(String, nullable=True, index=True)
    thumbnail_key: Any = Column(String, nullable=True)
    image_width: Any = Column(Integer, nullable=True)
    image_height: Any = Column(Integer, nullable=True)
    image_content_type: Any = Column(String, nullable=True)
    image_size_bytes: Any = Column(Integer, nullable=True)
    image_uploaded_at: Any = Column(DateTime, nullable=True)
    image_metadata: Any = Column(JSONB, nullable=True)

    # Qloo Cultural Intelligence Telemetry
    cultural_meta: Any = Column(JSONB, nullable=True, default=dict)
    bio_cultural_score: Any = Column(Integer, nullable=True)
    
    logged_at: Any = Column(DateTime, default=utc_now, index=True)

    user = relationship("User", back_populates="meals")

class DailySummary(Base):
    """Stores aggregated daily stats per user in their local timezone."""
    __tablename__ = "daily_summaries"
    __table_args__ = (
        Index("idx_daily_summary_user_date", "user_id", "date_str"),
        UniqueConstraint("user_id", "date_str", name="uq_daily_summary_user_date"),
    )

    id: Any = Column(String, primary_key=True, index=True)
    user_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    
    # The literal local date string (e.g. '2026-07-26')
    date_str: Any = Column(String, index=True, nullable=False)

    # Aggregates
    total_calories: Any = Column(Float, default=0.0)
    total_protein: Any = Column(Float, default=0.0)
    total_carbs: Any = Column(Float, default=0.0)
    total_fat: Any = Column(Float, default=0.0)
    total_fiber: Any = Column(Float, default=0.0)
    total_sugar: Any = Column(Float, default=0.0)
    total_sodium: Any = Column(Float, default=0.0)
    total_magnesium: Any = Column(Float, default=0.0)

    # Water
    water_ml: Any = Column(Integer, default=0)
    
    # Steps
    steps: Any = Column(Integer, default=0)
    
    # Sleep
    sleep_hours: Any = Column(Float, default=0.0)
    sleep_quality: Any = Column(String, nullable=True)  # H4: moved from profile JSONB

    # Weight
    weight_kg: Any = Column(Float, nullable=True)

    user = relationship("User", back_populates="daily_summaries")

class SubscriptionRecord(Base):
    """Production Subscription Schema matching Firestore & SQL DB requirements."""
    __tablename__ = "subscription_records"

    id: Any = Column(String, primary_key=True, index=True)
    user_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    is_premium: Any = Column(Boolean, default=False)
    plan: Any = Column(String, default="free") # free, premium_monthly, premium_yearly, premium_lifetime
    entitlement: Any = Column(String, default="premium")
    purchase_platform: Any = Column(String, nullable=True) # ios, android, web
    purchase_date: Any = Column(DateTime, nullable=True)
    expiration_date: Any = Column(DateTime, nullable=True)
    will_renew: Any = Column(Boolean, default=True)
    product_id: Any = Column(String, nullable=True)
    environment: Any = Column(String, default="PRODUCTION")
    original_app_user_id: Any = Column(String, nullable=True)
    last_synced: Any = Column(DateTime, default=utc_now)
    customer_info_version: Any = Column(String, default="v1")

class SubscriptionWebhookEvent(Base):
    """Idempotency tracking model to prevent duplicate webhook processing."""
    __tablename__ = "subscription_webhook_events"

    event_id: Any = Column(String, primary_key=True, index=True)
    event_type: Any = Column(String, nullable=False, index=True)
    app_user_id: Any = Column(String, index=True, nullable=True)
    processed_at: Any = Column(DateTime, default=utc_now)
    raw_payload: Any = Column(JSONB, default=dict)


class SocialGroup(Base):
    """Production Social Community Groups Schema."""
    __tablename__ = "social_groups"

    id: Any = Column(String, primary_key=True, index=True)
    name: Any = Column(String, nullable=False, index=True)
    description: Any = Column(Text, nullable=False)
    image_url: Any = Column(String, nullable=True)
    cover_image_url: Any = Column(String, nullable=True)
    category: Any = Column(String, nullable=False, index=True)
    privacy: Any = Column(String, default="public", index=True) # public, private
    max_members: Any = Column(Integer, nullable=True)
    invite_code: Any = Column(String, unique=True, index=True, nullable=False)
    rules: Any = Column(JSONB, default=list) # list of rule strings
    owner_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    activity_score: Any = Column(Float, default=0.0, index=True)
    created_at: Any = Column(DateTime, default=utc_now, index=True)
    updated_at: Any = Column(DateTime, default=utc_now)


class GroupMember(Base):
    """Group Membership & Roles."""
    __tablename__ = "group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_member"),
    )

    id: Any = Column(String, primary_key=True, index=True)
    group_id: Any = Column(String, ForeignKey("social_groups.id"), index=True, nullable=False)
    user_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    role: Any = Column(String, default="member", index=True) # owner, moderator, member
    status: Any = Column(String, default="active", index=True) # active, muted, banned
    mute_until: Any = Column(DateTime, nullable=True)
    joined_at: Any = Column(DateTime, default=utc_now, index=True)


class GroupJoinRequest(Base):
    """Join requests for private groups."""
    __tablename__ = "group_join_requests"

    id: Any = Column(String, primary_key=True, index=True)
    group_id: Any = Column(String, ForeignKey("social_groups.id"), index=True, nullable=False)
    user_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    status: Any = Column(String, default="pending", index=True) # pending, approved, rejected
    created_at: Any = Column(DateTime, default=utc_now, index=True)


class GroupMessage(Base):
    """Group Chat Messages."""
    __tablename__ = "group_messages"
    __table_args__ = (
        Index("idx_group_messages_group_created", "group_id", "created_at"),
    )

    id: Any = Column(String, primary_key=True, index=True)
    group_id: Any = Column(String, ForeignKey("social_groups.id"), index=True, nullable=False)
    user_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    content: Any = Column(Text, nullable=False)
    media_type: Any = Column(String, nullable=True) # image, sticker, gif
    media_url: Any = Column(String, nullable=True)
    parent_id: Any = Column(String, ForeignKey("group_messages.id"), nullable=True, index=True)
    is_edited: Any = Column(Boolean, default=False)
    is_deleted: Any = Column(Boolean, default=False)
    is_pinned: Any = Column(Boolean, default=False)
    pinned_at: Any = Column(DateTime, nullable=True)
    pinned_by: Any = Column(String, nullable=True)
    created_at: Any = Column(DateTime, default=utc_now, index=True)


class MessageReaction(Base):
    """Emoji Reactions on Messages."""
    __tablename__ = "message_reactions"

    id: Any = Column(String, primary_key=True, index=True)
    message_id: Any = Column(String, ForeignKey("group_messages.id"), index=True, nullable=False)
    user_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    emoji: Any = Column(String, nullable=False)
    created_at: Any = Column(DateTime, default=utc_now)


class GroupAuditLog(Base):
    """Group Audit & Moderation Logs."""
    __tablename__ = "group_audit_logs"

    id: Any = Column(String, primary_key=True, index=True)
    group_id: Any = Column(String, ForeignKey("social_groups.id"), index=True, nullable=False)
    actor_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    action: Any = Column(String, nullable=False) # kick, ban, mute, promote, demote, delete_msg
    details: Any = Column(JSONB, default=dict)
    created_at: Any = Column(DateTime, default=utc_now, index=True)


class GroupReport(Base):
    """User and Content Reports."""
    __tablename__ = "group_reports"

    id: Any = Column(String, primary_key=True, index=True)
    reporter_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    group_id: Any = Column(String, ForeignKey("social_groups.id"), index=True, nullable=False)
    target_user_id: Any = Column(String, nullable=True)
    message_id: Any = Column(String, nullable=True)
    reason: Any = Column(String, nullable=False)
    details: Any = Column(Text, nullable=True)
    status: Any = Column(String, default="pending") # pending, reviewed, dismissed
    created_at: Any = Column(DateTime, default=utc_now, index=True)


class UserMilestone(Base):
    """User Achievements and Badges persistence table."""
    __tablename__ = "user_milestones"
    __table_args__ = (
        UniqueConstraint("user_id", "badge_id", name="uq_user_milestone"),
    )

    id: Any = Column(String, primary_key=True, index=True)
    user_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    badge_id: Any = Column(String, nullable=False, index=True)
    badge_name: Any = Column(String, nullable=False)
    category: Any = Column(String, nullable=False, index=True)
    rarity: Any = Column(String, default="common") # common, rare, epic, legendary
    progress: Any = Column(Float, default=0.0)
    threshold: Any = Column(Float, default=1.0)
    unlocked_at: Any = Column(DateTime, default=utc_now)
    earned: Any = Column(Boolean, default=False, index=True)
    earned_at: Any = Column(DateTime, nullable=True, index=True)
    seen: Any = Column(Boolean, default=False)
    created_at: Any = Column(DateTime, default=utc_now)
    updated_at: Any = Column(DateTime, default=utc_now, onupdate=utc_now)


class UserNotification(Base):
    """In-app User Notifications."""
    __tablename__ = "user_notifications"

    id: Any = Column(String, primary_key=True, index=True)
    user_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    title: Any = Column(String, nullable=False)
    body: Any = Column(Text, nullable=False)
    type: Any = Column(String, nullable=False) # join, mention, reply, milestone, rank, invite
    data: Any = Column(JSONB, default=dict)
    is_read: Any = Column(Boolean, default=False)
    created_at: Any = Column(DateTime, default=utc_now, index=True)


class FeedbackPost(Base):
    """In-App Feedback & Feature Request Posts."""
    __tablename__ = "feedback_posts"

    id: Any = Column(String, primary_key=True, index=True)
    user_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    post_type: Any = Column(String, nullable=False, index=True) # feature_request, bug_report, error_report, general_feedback
    title: Any = Column(String, nullable=False, index=True)
    description: Any = Column(Text, nullable=False)
    category: Any = Column(String, nullable=False, index=True) # AI, Meal Scanning, Nutrition, Water Tracking, Workouts, Groups, Challenges, Widgets, Premium, UI / UX, Performance, Notifications, Integrations, Other
    status: Any = Column(String, default="under_review", index=True) # under_review, planned, in_progress, testing, released, fixed, duplicate, needs_info, declined, closed
    votes_count: Any = Column(Integer, default=0, index=True)
    trending_score: Any = Column(Float, default=0.0, index=True)
    comments_count: Any = Column(Integer, default=0)

    # Diagnostic metadata
    app_version: Any = Column(String, nullable=True)
    platform: Any = Column(String, nullable=True)
    device_model: Any = Column(String, nullable=True)
    os_version: Any = Column(String, nullable=True)
    locale: Any = Column(String, nullable=True)
    timezone: Any = Column(String, nullable=True)
    steps_to_reproduce: Any = Column(Text, nullable=True)
    expected_behaviour: Any = Column(Text, nullable=True)
    actual_behaviour: Any = Column(Text, nullable=True)
    media_urls: Any = Column(JSONB, default=list)

    is_deleted: Any = Column(Boolean, default=False)
    created_at: Any = Column(DateTime, default=utc_now, index=True)
    updated_at: Any = Column(DateTime, default=utc_now, onupdate=utc_now)


class FeedbackVote(Base):
    """Upvotes on Feedback Posts."""
    __tablename__ = "feedback_votes"
    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_feedback_vote"),
    )

    id: Any = Column(String, primary_key=True, index=True)
    post_id: Any = Column(String, ForeignKey("feedback_posts.id"), index=True, nullable=False)
    user_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    created_at: Any = Column(DateTime, default=utc_now)


class FeedbackComment(Base):
    """Threaded Comments & Official Dev Replies on Feedback Posts."""
    __tablename__ = "feedback_comments"

    id: Any = Column(String, primary_key=True, index=True)
    post_id: Any = Column(String, ForeignKey("feedback_posts.id"), index=True, nullable=False)
    user_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    parent_id: Any = Column(String, nullable=True, index=True)
    content: Any = Column(Text, nullable=False)
    is_official_dev_response: Any = Column(Boolean, default=False)
    is_accepted_answer: Any = Column(Boolean, default=False)
    is_pinned: Any = Column(Boolean, default=False)
    reactions: Any = Column(JSONB, default=dict)
    is_deleted: Any = Column(Boolean, default=False)
    created_at: Any = Column(DateTime, default=utc_now, index=True)
    updated_at: Any = Column(DateTime, default=utc_now, onupdate=utc_now)


class FeedbackFollower(Base):
    """Post Follow Subscriptions for Notifications."""
    __tablename__ = "feedback_followers"

    id: Any = Column(String, primary_key=True, index=True)
    post_id: Any = Column(String, ForeignKey("feedback_posts.id"), index=True, nullable=False)
    user_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    created_at: Any = Column(DateTime, default=utc_now)


class ChangelogRelease(Base):
    """Official App Release Notes & Version Updates."""
    __tablename__ = "changelog_releases"

    id: Any = Column(String, primary_key=True, index=True)
    version: Any = Column(String, nullable=False, unique=True, index=True)
    release_date: Any = Column(String, nullable=False)
    title: Any = Column(String, nullable=False)
    description: Any = Column(Text, nullable=False)
    new_features: Any = Column(JSONB, default=list)
    improvements: Any = Column(JSONB, default=list)
    bug_fixes: Any = Column(JSONB, default=list)
    breaking_changes: Any = Column(JSONB, default=list)
    reactions: Any = Column(JSONB, default=dict)
    created_at: Any = Column(DateTime, default=utc_now, index=True)


class FeedbackReport(Base):
    """Moderation Reports for Feedback Posts & Comments."""
    __tablename__ = "feedback_reports"

    id: Any = Column(String, primary_key=True, index=True)
    post_id: Any = Column(String, nullable=True, index=True)
    comment_id: Any = Column(String, nullable=True, index=True)
    reporter_id: Any = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    reason: Any = Column(String, nullable=False)
    details: Any = Column(Text, nullable=True)
    status: Any = Column(String, default="pending") # pending, reviewed, dismissed
    created_at: Any = Column(DateTime, default=utc_now)


class UserStreak(Base):
    """Pre-computed user streak data (H1 fix).

    Updated on meal log/delete via background task instead of computing
    O(N) on every group member list / leaderboard call.
    """
    __tablename__ = "user_streaks"

    user_id: Any = Column(String, ForeignKey("users.id"), primary_key=True, index=True)
    current_streak: Any = Column(Integer, default=1)
    longest_streak: Any = Column(Integer, default=1)
    total_meals: Any = Column(Integer, default=0)
    last_active_date: Any = Column(String, nullable=True)  # YYYY-MM-DD
    updated_at: Any = Column(DateTime, default=utc_now,
                             onupdate=utc_now)

