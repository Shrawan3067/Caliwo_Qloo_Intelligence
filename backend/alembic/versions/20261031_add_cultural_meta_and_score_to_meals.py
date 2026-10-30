"""Add cultural_meta and bio_cultural_score to meals table

Revision ID: 20261031_cultural_meals
Revises: 20261025_magnesium
Create Date: 2026-10-31
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = '20261031_cultural_meals'
down_revision: Union[str, None] = '20261025_magnesium'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE meals 
        ADD COLUMN IF NOT EXISTS cultural_meta JSONB DEFAULT '{}'::jsonb;
    """)
    op.execute("""
        ALTER TABLE meals 
        ADD COLUMN IF NOT EXISTS bio_cultural_score INTEGER;
    """)


def downgrade() -> None:
    op.drop_column('meals', 'cultural_meta')
    op.drop_column('meals', 'bio_cultural_score')

