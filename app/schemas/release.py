import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ModerationStatus


class ReleaseBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    release_date: datetime
    cover_url: str | None = Field(default=None, max_length=500)
    media_url: str | None = Field(default=None, max_length=500)


class ReleaseCreate(ReleaseBase):
    pass


class ReleaseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    release_date: datetime | None = None
    cover_url: str | None = Field(default=None, max_length=500)
    media_url: str | None = Field(default=None, max_length=500)
    status: ModerationStatus | None = None
    admin_comment: str | None = Field(default=None, max_length=1000)


class ReleaseRead(ReleaseBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    band_id: uuid.UUID
    status: ModerationStatus
    admin_comment: str | None = None
    created_at: datetime
    updated_at: datetime
