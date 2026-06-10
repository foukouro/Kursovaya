"""add moderation workflows and release entities

Revision ID: 202606100002
Revises: 202606100001
Create Date: 2026-06-10 19:10:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202606100002"
down_revision: str | None = "202606100001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


moderation_status = postgresql.ENUM(
    "pending",
    "approved",
    "rejected",
    name="moderation_status",
    create_type=False,
)
concert_status = postgresql.ENUM(
    "planned",
    "completed",
    "cancelled",
    name="concert_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    moderation_status.create(bind, checkfirst=True)
    concert_status.create(bind, checkfirst=True)

    op.add_column("concerts", sa.Column("description", sa.String(length=2000), nullable=True))
    op.add_column("concerts", sa.Column("poster_url", sa.String(length=500), nullable=True))
    op.add_column("concerts", sa.Column("external_url", sa.String(length=500), nullable=True))

    op.create_table(
        "band_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("genre", sa.String(length=100), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("description", sa.String(length=2000), nullable=True),
        sa.Column("cover_url", sa.String(length=500), nullable=True),
        sa.Column("website_url", sa.String(length=500), nullable=True),
        sa.Column("instagram_url", sa.String(length=500), nullable=True),
        sa.Column("status", moderation_status, nullable=False),
        sa.Column("admin_comment", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["manager_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_band_requests_manager_id"), "band_requests", ["manager_id"], unique=False)
    op.create_index(op.f("ix_band_requests_status"), "band_requests", ["status"], unique=False)

    op.create_table(
        "concert_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("band_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("venue", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("date_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tickets_total", sa.Integer(), nullable=False),
        sa.Column("tickets_available", sa.Integer(), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("concert_status", concert_status, nullable=False),
        sa.Column("description", sa.String(length=2000), nullable=True),
        sa.Column("poster_url", sa.String(length=500), nullable=True),
        sa.Column("external_url", sa.String(length=500), nullable=True),
        sa.Column("status", moderation_status, nullable=False),
        sa.Column("admin_comment", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["band_id"], ["bands.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_concert_requests_band_id"), "concert_requests", ["band_id"], unique=False)
    op.create_index(op.f("ix_concert_requests_status"), "concert_requests", ["status"], unique=False)

    op.create_table(
        "releases",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("band_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=2000), nullable=True),
        sa.Column("release_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cover_url", sa.String(length=500), nullable=True),
        sa.Column("media_url", sa.String(length=500), nullable=True),
        sa.Column("status", moderation_status, nullable=False),
        sa.Column("admin_comment", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["band_id"], ["bands.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_releases_band_id"), "releases", ["band_id"], unique=False)
    op.create_index(op.f("ix_releases_status"), "releases", ["status"], unique=False)

    op.execute(
        """
        UPDATE concerts
        SET description = CONCAT(title, ' at ', venue, ' in ', city, '.')
        WHERE description IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_releases_status"), table_name="releases")
    op.drop_index(op.f("ix_releases_band_id"), table_name="releases")
    op.drop_table("releases")
    op.drop_index(op.f("ix_concert_requests_status"), table_name="concert_requests")
    op.drop_index(op.f("ix_concert_requests_band_id"), table_name="concert_requests")
    op.drop_table("concert_requests")
    op.drop_index(op.f("ix_band_requests_status"), table_name="band_requests")
    op.drop_index(op.f("ix_band_requests_manager_id"), table_name="band_requests")
    op.drop_table("band_requests")
    op.drop_column("concerts", "external_url")
    op.drop_column("concerts", "poster_url")
    op.drop_column("concerts", "description")

    moderation_status.drop(op.get_bind(), checkfirst=True)
