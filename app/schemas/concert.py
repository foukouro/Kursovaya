import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import ConcertStatus


def validate_concert_constraints(
    date_time: datetime,
    status: ConcertStatus,
    tickets_total: int,
    tickets_available: int | None,
) -> None:
    if tickets_available is not None and tickets_available > tickets_total:
        raise ValueError("tickets_available не может быть больше tickets_total")

    normalized_date = date_time if date_time.tzinfo is not None else date_time.replace(tzinfo=timezone.utc)
    if status == ConcertStatus.planned and normalized_date <= datetime.now(timezone.utc):
        raise ValueError("Запланированный концерт должен быть в будущем")


class ConcertBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    venue: str = Field(..., min_length=1, max_length=255)
    city: str = Field(..., min_length=1, max_length=100)
    date_time: datetime
    tickets_total: int = Field(..., gt=0)
    tickets_available: int | None = Field(default=None, ge=0)
    price: int = Field(..., ge=0)
    description: str | None = Field(default=None, max_length=2000)
    poster_url: str | None = Field(default=None, max_length=500)
    external_url: str | None = Field(default=None, max_length=500)
    status: ConcertStatus = ConcertStatus.planned

    @model_validator(mode="after")
    def validate_ticket_amounts(self) -> "ConcertBase":
        validate_concert_constraints(
            self.date_time,
            self.status,
            self.tickets_total,
            self.tickets_available,
        )
        return self


class ConcertCreate(ConcertBase):
    pass


class ConcertUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    venue: str | None = Field(default=None, min_length=1, max_length=255)
    city: str | None = Field(default=None, min_length=1, max_length=100)
    date_time: datetime | None = None
    tickets_total: int | None = Field(default=None, gt=0)
    tickets_available: int | None = Field(default=None, ge=0)
    price: int | None = Field(default=None, ge=0)
    description: str | None = Field(default=None, max_length=2000)
    poster_url: str | None = Field(default=None, max_length=500)
    external_url: str | None = Field(default=None, max_length=500)
    status: ConcertStatus | None = None

    @model_validator(mode="after")
    def validate_partial_ticket_amounts(self) -> "ConcertUpdate":
        if (
            self.tickets_total is not None
            and self.tickets_available is not None
            and self.tickets_available > self.tickets_total
        ):
            raise ValueError("tickets_available не может быть больше tickets_total")
        return self


class ConcertRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    band_id: uuid.UUID
    title: str
    venue: str
    city: str
    date_time: datetime
    tickets_total: int
    tickets_available: int
    price: int
    description: str | None = None
    poster_url: str | None = None
    external_url: str | None = None
    status: ConcertStatus
    created_at: datetime
    updated_at: datetime


class ConcertSearch(BaseModel):
    id: uuid.UUID
    band_name: str
    title: str
    city: str
    venue: str
    date_time: datetime
    price: int
    tickets_available: int
    description: str | None = None
    poster_url: str | None = None


class ConcertDetail(ConcertSearch):
    band_id: uuid.UUID
    genre: str
    status: ConcertStatus
    tickets_total: int
    description: str
    external_url: str | None = None


class RecommendedConcert(ConcertSearch):
    genre: str
    score: float
    reasons: list[str] = Field(default_factory=list)


class ExternalConcert(BaseModel):
    source: str
    source_url: str
    artist_name: str
    title: str
    city: str
    venue: str
    date_time: datetime | None = None
    poster_url: str | None = None


class MyConcert(ConcertRead):
    band_name: str
