import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import ConcertStatus


class ConcertBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    venue: str = Field(..., min_length=1, max_length=255)
    city: str = Field(..., min_length=1, max_length=100)
    date_time: datetime
    tickets_total: int = Field(..., gt=0)
    tickets_available: int | None = Field(default=None, ge=0)
    price: int = Field(..., ge=0)
    status: ConcertStatus = ConcertStatus.planned

    @model_validator(mode="after")
    def validate_ticket_amounts(self) -> "ConcertBase":
        if self.tickets_available is not None and self.tickets_available > self.tickets_total:
            raise ValueError("tickets_available не может быть больше tickets_total")
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
    status: ConcertStatus | None = None


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
    poster_url: str | None = None


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
