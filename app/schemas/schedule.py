import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import ConcertStatus, ParticipationStatus, ScheduleEventType


class ScheduleEventBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    event_type: ScheduleEventType
    starts_at: datetime
    ends_at: datetime
    venue: str = Field(..., min_length=1, max_length=255)
    city: str = Field(..., min_length=1, max_length=100)
    notes: str | None = Field(default=None, max_length=2000)
    status: ConcertStatus = ConcertStatus.planned

    @model_validator(mode="after")
    def validate_range(self) -> "ScheduleEventBase":
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at должен быть позже starts_at")
        return self


class ScheduleEventCreate(ScheduleEventBase):
    pass


class ScheduleEventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    event_type: ScheduleEventType | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    venue: str | None = Field(default=None, min_length=1, max_length=255)
    city: str | None = Field(default=None, min_length=1, max_length=100)
    notes: str | None = Field(default=None, max_length=2000)
    status: ConcertStatus | None = None


class ScheduleResponseDecision(BaseModel):
    status: ParticipationStatus
    comment: str | None = Field(default=None, max_length=1000)


class ScheduleResponseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_id: uuid.UUID
    user_id: uuid.UUID
    status: ParticipationStatus
    comment: str | None = None
    created_at: datetime
    updated_at: datetime


class ScheduleEventRead(ScheduleEventBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    band_id: uuid.UUID
    created_by_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ScheduleEventFeedItem(ScheduleEventRead):
    band_name: str
    my_response: ParticipationStatus = ParticipationStatus.pending
    response_comment: str | None = None
    confirmed_count: int = 0
    declined_count: int = 0
