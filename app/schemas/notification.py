import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import NotificationKind


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    body: str
    kind: NotificationKind
    link_url: str | None = None
    is_read: bool
    created_at: datetime
    updated_at: datetime


class NotificationReadUpdate(BaseModel):
    is_read: bool = True
