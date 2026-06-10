import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.models.enums import ConcertStatus

if TYPE_CHECKING:
    from app.models.band import Band
    from app.models.ticket import Ticket


class Concert(TimestampMixin, Base):
    __tablename__ = "concerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    band_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bands.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    venue: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    date_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    tickets_total: Mapped[int] = mapped_column(Integer, nullable=False)
    tickets_available: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    poster_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    external_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[ConcertStatus] = mapped_column(
        Enum(ConcertStatus, name="concert_status"),
        default=ConcertStatus.planned,
        index=True,
        nullable=False,
    )

    band: Mapped["Band"] = relationship(back_populates="concerts", lazy="selectin")
    tickets: Mapped[list["Ticket"]] = relationship(back_populates="concert", lazy="selectin")
