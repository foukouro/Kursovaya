import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.concert import Concert
    from app.models.user import User


class Ticket(TimestampMixin, Base):
    __tablename__ = "tickets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    concert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("concerts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    purchase_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    qr_code_data: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    user: Mapped["User"] = relationship(back_populates="tickets", lazy="selectin")
    concert: Mapped["Concert"] = relationship(back_populates="tickets", lazy="selectin")
