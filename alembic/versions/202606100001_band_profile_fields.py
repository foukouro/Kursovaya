"""add band profile fields

Revision ID: 202606100001
Revises: 202605120001
Create Date: 2026-06-10 18:40:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202606100001"
down_revision: str | None = "202605120001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("bands", sa.Column("city", sa.String(length=100), nullable=True))
    op.add_column("bands", sa.Column("description", sa.String(length=2000), nullable=True))
    op.add_column("bands", sa.Column("cover_url", sa.String(length=500), nullable=True))
    op.add_column("bands", sa.Column("website_url", sa.String(length=500), nullable=True))
    op.add_column("bands", sa.Column("instagram_url", sa.String(length=500), nullable=True))

    op.execute(
        """
        UPDATE bands
        SET city = sub.city
        FROM (
            SELECT DISTINCT ON (band_id) band_id, city
            FROM concerts
            ORDER BY band_id, date_time ASC
        ) AS sub
        WHERE bands.id = sub.band_id
          AND bands.city IS NULL
        """
    )
    op.execute(
        """
        UPDATE bands
        SET description = CONCAT(
            name,
            ' is a live project in the ',
            genre,
            ' genre',
            COALESCE(CONCAT(', based in ', city), ''),
            '.'
        )
        WHERE description IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("bands", "instagram_url")
    op.drop_column("bands", "website_url")
    op.drop_column("bands", "cover_url")
    op.drop_column("bands", "description")
    op.drop_column("bands", "city")
