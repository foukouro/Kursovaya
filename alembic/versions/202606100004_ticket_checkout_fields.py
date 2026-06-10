"""add checkout fields for guest and authenticated ticket purchases

Revision ID: 202606100004
Revises: 202606100003
Create Date: 2026-06-10 23:40:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202606100004"
down_revision: str | None = "202606100003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("tickets", "user_id", existing_type=sa.UUID(), nullable=True)
    op.add_column("tickets", sa.Column("customer_email", sa.String(length=255), nullable=True))
    op.add_column("tickets", sa.Column("customer_name", sa.String(length=255), nullable=True))
    op.add_column("tickets", sa.Column("customer_phone", sa.String(length=40), nullable=True))
    op.add_column("tickets", sa.Column("payment_cardholder", sa.String(length=255), nullable=True))
    op.add_column("tickets", sa.Column("payment_last4", sa.String(length=4), nullable=True))
    op.add_column("tickets", sa.Column("payment_brand", sa.String(length=32), nullable=True))
    op.create_index(op.f("ix_tickets_customer_email"), "tickets", ["customer_email"], unique=False)

    op.execute(
        """
        UPDATE tickets
        SET customer_email = users.email,
            customer_name = COALESCE(user_profiles.first_name || ' ' || user_profiles.last_name, users.email),
            customer_phone = 'not-provided',
            payment_cardholder = COALESCE(user_profiles.first_name || ' ' || user_profiles.last_name, users.email),
            payment_last4 = '0000',
            payment_brand = 'Legacy'
        FROM users
        LEFT JOIN user_profiles ON user_profiles.user_id = users.id
        WHERE tickets.user_id = users.id
        """
    )

    op.alter_column("tickets", "customer_email", existing_type=sa.String(length=255), nullable=False)
    op.alter_column("tickets", "customer_name", existing_type=sa.String(length=255), nullable=False)
    op.alter_column("tickets", "customer_phone", existing_type=sa.String(length=40), nullable=False)
    op.alter_column("tickets", "payment_cardholder", existing_type=sa.String(length=255), nullable=False)
    op.alter_column("tickets", "payment_last4", existing_type=sa.String(length=4), nullable=False)
    op.alter_column("tickets", "payment_brand", existing_type=sa.String(length=32), nullable=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_tickets_customer_email"), table_name="tickets")
    op.drop_column("tickets", "payment_brand")
    op.drop_column("tickets", "payment_last4")
    op.drop_column("tickets", "payment_cardholder")
    op.drop_column("tickets", "customer_phone")
    op.drop_column("tickets", "customer_name")
    op.drop_column("tickets", "customer_email")
    op.alter_column("tickets", "user_id", existing_type=sa.UUID(), nullable=False)
