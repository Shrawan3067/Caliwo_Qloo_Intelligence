"""scalability_fixes_user_streaks_and_indexes

Add UserStreak table and missing indexes/constraints from scalability audit.

Revision ID: 20261016_scale
Revises: (auto-detected)
Create Date: 2026-10-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261016_scale'
down_revision: Union[str, None] = '9b6fe0c7c585'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # H1: Create user_streaks table for pre-computed streak data (safe if already exists)
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_streaks (
            user_id VARCHAR NOT NULL PRIMARY KEY REFERENCES users (id),
            current_streak INTEGER DEFAULT 1,
            longest_streak INTEGER DEFAULT 1,
            total_meals INTEGER DEFAULT 0,
            last_active_date VARCHAR,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_user_streaks_user_id ON user_streaks (user_id);
    """)

    # H5: Add missing unique constraints (with IF NOT EXISTS safety)
    # GroupMember (group_id, user_id) — prevent duplicate memberships
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_group_member'
            ) THEN
                ALTER TABLE group_members ADD CONSTRAINT uq_group_member UNIQUE (group_id, user_id);
            END IF;
        END $$;
    """)

    # UserMilestone (user_id, badge_id) — prevent duplicate milestone awards
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_milestone'
            ) THEN
                ALTER TABLE user_milestones ADD CONSTRAINT uq_user_milestone UNIQUE (user_id, badge_id);
            END IF;
        END $$;
    """)

    # FeedbackVote (post_id, user_id) — prevent duplicate votes
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_feedback_vote'
            ) THEN
                ALTER TABLE feedback_votes ADD CONSTRAINT uq_feedback_vote UNIQUE (post_id, user_id);
            END IF;
        END $$;
    """)

    # DailySummary (user_id, date_str) — prevent duplicate daily rows
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_daily_summary_user_date'
            ) THEN
                ALTER TABLE daily_summaries ADD CONSTRAINT uq_daily_summary_user_date UNIQUE (user_id, date_str);
            END IF;
        END $$;
    """)

    # H5: Add missing composite index for chat pagination
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_group_messages_group_created
        ON group_messages (group_id, created_at);
    """)

    # H4: Add sleep_quality column to daily_summaries
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='daily_summaries' AND column_name='sleep_quality'
            ) THEN
                ALTER TABLE daily_summaries ADD COLUMN sleep_quality VARCHAR;
            END IF;
        END $$;
    """)

    # H4: Add weight_kg column to daily_summaries
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='daily_summaries' AND column_name='weight_kg'
            ) THEN
                ALTER TABLE daily_summaries ADD COLUMN weight_kg FLOAT;
            END IF;
        END $$;
    """)

    # H10: Add index on meals.logged_at for cursor-based pagination
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_meals_user_logged_at
        ON meals (user_id, logged_at DESC);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_meals_user_logged_at")
    op.execute("ALTER TABLE daily_summaries DROP COLUMN IF EXISTS weight_kg")
    op.execute("ALTER TABLE daily_summaries DROP COLUMN IF EXISTS sleep_quality")
    op.execute("DROP INDEX IF EXISTS idx_group_messages_group_created")
    op.execute("ALTER TABLE daily_summaries DROP CONSTRAINT IF EXISTS uq_daily_summary_user_date")
    op.execute("ALTER TABLE feedback_votes DROP CONSTRAINT IF EXISTS uq_feedback_vote")
    op.execute("ALTER TABLE user_milestones DROP CONSTRAINT IF EXISTS uq_user_milestone")
    op.execute("ALTER TABLE group_members DROP CONSTRAINT IF EXISTS uq_group_member")
    op.drop_table('user_streaks')
