"""Add magnesium_mg to meals and total_magnesium to daily_summaries

Revision ID: 20261025_magnesium
Revises: 20261025_telemetry
Create Date: 2026-10-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20261025_magnesium'
down_revision: Union[str, None] = '20261025_telemetry'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE meals 
        ADD COLUMN IF NOT EXISTS magnesium_mg FLOAT DEFAULT 0.0;
    """)
    op.execute("""
        ALTER TABLE daily_summaries 
        ADD COLUMN IF NOT EXISTS total_magnesium FLOAT DEFAULT 0.0;
    """)


def downgrade() -> None:
    op.drop_column('meals', 'magnesium_mg')
    op.drop_column('daily_summaries', 'total_magnesium')
