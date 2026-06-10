import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ConcertStatus, ModerationStatus


class ModerationDecision(BaseModel):
    admin_comment: str | None = Field(default=None, max_length=1000)


class BandRequestBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    genre: str = Field(..., min_length=1, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    cover_url: str | None = Field(default=None, max_length=500)
    website_url: str | None = Field(default=None, max_length=500)
    instagram_url: str | None = Field(default=None, max_length=500)


class BandRequestCreate(BandRequestBase):
    pass


class BandRequestRead(BandRequestBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    manager_id: uuid.UUID
    status: ModerationStatus
    admin_comment: str | None = None
    created_at: datetime
    updated_at: datetime


class ConcertRequestBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    venue: str = Field(..., min_length=1, max_length=255)
    city: str = Field(..., min_length=1, max_length=100)
    date_time: datetime
    tickets_total: int = Field(..., gt=0)
    tickets_available: int = Field(..., ge=0)
    price: int = Field(..., ge=0)
    concert_status: ConcertStatus = ConcertStatus.planned
    description: str | None = Field(default=None, max_length=2000)
    poster_url: str | None = Field(default=None, max_length=500)
    external_url: str | None = Field(default=None, max_length=500)


class ConcertRequestCreate(ConcertRequestBase):
    pass


class ConcertRequestRead(ConcertRequestBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    band_id: uuid.UUID
    status: ModerationStatus
    admin_comment: str | None = None
    created_at: datetime
    updated_at: datetime
