"""add workspace notifications, invitations, schedules, and action log

Revision ID: 202606100003
Revises: 202606100002
Create Date: 2026-06-10 22:55:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202606100003"
down_revision: str | None = "202606100002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


concert_status = postgresql.ENUM(
    "planned",
    "completed",
    "cancelled",
    name="concert_status",
    create_type=False,
)
invitation_status = postgresql.ENUM(
    "pending",
    "accepted",
    "rejected",
    name="invitation_status",
    create_type=False,
)
schedule_event_type = postgresql.ENUM(
    "concert",
    "rehearsal",
    "meeting",
    "other",
    name="schedule_event_type",
    create_type=False,
)
participation_status = postgresql.ENUM(
    "pending",
    "confirmed",
    "declined",
    name="participation_status",
    create_type=False,
)
notification_kind = postgresql.ENUM(
    "moderation",
    "invitation",
    "schedule",
    "system",
    name="notification_kind",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    concert_status.create(bind, checkfirst=True)
    invitation_status.create(bind, checkfirst=True)
    schedule_event_type.create(bind, checkfirst=True)
    participation_status.create(bind, checkfirst=True)
    notification_kind.create(bind, checkfirst=True)

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.String(length=2000), nullable=False),
        sa.Column("kind", notification_kind, nullable=False),
        sa.Column("link_url", sa.String(length=500), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)
    op.create_index(op.f("ix_notifications_kind"), "notifications", ["kind"], unique=False)

    op.create_table(
        "action_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_email", sa.String(length=255), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target_type", sa.String(length=100), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("summary", sa.String(length=2000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_action_logs_actor_id"), "action_logs", ["actor_id"], unique=False)
    op.create_index(op.f("ix_action_logs_action"), "action_logs", ["action"], unique=False)
    op.create_index(op.f("ix_action_logs_target_type"), "action_logs", ["target_type"], unique=False)

    op.create_table(
        "band_invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("band_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invited_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invited_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", invitation_status, nullable=False),
        sa.Column("message", sa.String(length=1000), nullable=True),
        sa.Column("response_comment", sa.String(length=1000), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["band_id"], ["bands.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("band_id", "invited_user_id", "status", name="uq_band_invitation_state"),
    )
    op.create_index(op.f("ix_band_invitations_band_id"), "band_invitations", ["band_id"], unique=False)
    op.create_index(op.f("ix_band_invitations_invited_by_id"), "band_invitations", ["invited_by_id"], unique=False)
    op.create_index(op.f("ix_band_invitations_invited_user_id"), "band_invitations", ["invited_user_id"], unique=False)
    op.create_index(op.f("ix_band_invitations_status"), "band_invitations", ["status"], unique=False)

    op.create_table(
        "schedule_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("band_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("event_type", schedule_event_type, nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("venue", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        sa.Column("status", concert_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["band_id"], ["bands.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_schedule_events_band_id"), "schedule_events", ["band_id"], unique=False)
    op.create_index(op.f("ix_schedule_events_created_by_id"), "schedule_events", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_schedule_events_event_type"), "schedule_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_schedule_events_status"), "schedule_events", ["status"], unique=False)

    op.create_table(
        "schedule_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", participation_status, nullable=False),
        sa.Column("comment", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["schedule_events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "user_id", name="uq_schedule_response_user"),
    )
    op.create_index(op.f("ix_schedule_responses_event_id"), "schedule_responses", ["event_id"], unique=False)
    op.create_index(op.f("ix_schedule_responses_status"), "schedule_responses", ["status"], unique=False)
    op.create_index(op.f("ix_schedule_responses_user_id"), "schedule_responses", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_schedule_responses_user_id"), table_name="schedule_responses")
    op.drop_index(op.f("ix_schedule_responses_status"), table_name="schedule_responses")
    op.drop_index(op.f("ix_schedule_responses_event_id"), table_name="schedule_responses")
    op.drop_table("schedule_responses")
    op.drop_index(op.f("ix_schedule_events_status"), table_name="schedule_events")
    op.drop_index(op.f("ix_schedule_events_event_type"), table_name="schedule_events")
    op.drop_index(op.f("ix_schedule_events_created_by_id"), table_name="schedule_events")
    op.drop_index(op.f("ix_schedule_events_band_id"), table_name="schedule_events")
    op.drop_table("schedule_events")
    op.drop_index(op.f("ix_band_invitations_status"), table_name="band_invitations")
    op.drop_index(op.f("ix_band_invitations_invited_user_id"), table_name="band_invitations")
    op.drop_index(op.f("ix_band_invitations_invited_by_id"), table_name="band_invitations")
    op.drop_index(op.f("ix_band_invitations_band_id"), table_name="band_invitations")
    op.drop_table("band_invitations")
    op.drop_index(op.f("ix_action_logs_target_type"), table_name="action_logs")
    op.drop_index(op.f("ix_action_logs_action"), table_name="action_logs")
    op.drop_index(op.f("ix_action_logs_actor_id"), table_name="action_logs")
    op.drop_table("action_logs")
    op.drop_index(op.f("ix_notifications_kind"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_table("notifications")

    notification_kind.drop(op.get_bind(), checkfirst=True)
    participation_status.drop(op.get_bind(), checkfirst=True)
    schedule_event_type.drop(op.get_bind(), checkfirst=True)
    invitation_status.drop(op.get_bind(), checkfirst=True)
