import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import InvitationStatus


class BandInvitationCreate(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    message: str | None = Field(default=None, max_length=1000)


class BandInvitationDecision(BaseModel):
    response_comment: str | None = Field(default=None, max_length=1000)


class BandInvitationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    band_id: uuid.UUID
    invited_user_id: uuid.UUID
    invited_by_id: uuid.UUID
    status: InvitationStatus
    message: str | None = None
    response_comment: str | None = None
    responded_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
