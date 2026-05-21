import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Column, ForeignKey, String, Table, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.concert import Concert
    from app.models.user import User


band_musicians = Table(
    "band_musicians",
    Base.metadata,
    Column("band_id", UUID(as_uuid=True), ForeignKey("bands.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    UniqueConstraint("band_id", "user_id", name="uq_band_musician"),
)


class Band(TimestampMixin, Base):
    __tablename__ = "bands"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    genre: Mapped[str] = mapped_column(String(100), nullable=False)
    manager_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    manager: Mapped["User"] = relationship(back_populates="managed_bands", lazy="selectin")
    musicians: Mapped[list["User"]] = relationship(
        secondary=band_musicians,
        back_populates="bands",
        lazy="selectin",
    )
    concerts: Mapped[list["Concert"]] = relationship(
        back_populates="band",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
