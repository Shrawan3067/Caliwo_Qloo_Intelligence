"""Add agent_telemetry column to chat_messages

Revision ID: 20261025_telemetry
Revises: 20261016_scale
Create Date: 2026-10-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = '20261025_telemetry'
down_revision: Union[str, None] = '20261016_scale'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE chat_messages 
        ADD COLUMN IF NOT EXISTS agent_telemetry JSONB;
    """)


def downgrade() -> None:
    op.drop_column('chat_messages', 'agent_telemetry')
