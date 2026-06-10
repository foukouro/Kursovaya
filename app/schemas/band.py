import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import RosterMember, UserPublic


class BandBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    genre: str = Field(..., min_length=1, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    cover_url: str | None = Field(default=None, max_length=500)
    website_url: str | None = Field(default=None, max_length=500)
    instagram_url: str | None = Field(default=None, max_length=500)


class BandCreate(BandBase):
    manager_id: uuid.UUID


class BandRead(BandBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    manager_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class BandUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    genre: str | None = Field(default=None, min_length=1, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    cover_url: str | None = Field(default=None, max_length=500)
    website_url: str | None = Field(default=None, max_length=500)
    instagram_url: str | None = Field(default=None, max_length=500)


class BandWithMusicians(BandRead):
    musicians: list[UserPublic] = []


class BandRoster(BaseModel):
    band_id: uuid.UUID
    musicians: list[RosterMember]


class BandStats(BaseModel):
    band_id: uuid.UUID
    future_tickets_sold: int
    revenue: int
