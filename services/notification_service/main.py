from datetime import datetime, timezone
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from fastapi import FastAPI, Query
from pydantic import BaseModel, Field

app = FastAPI(title="Waves Notification Service", version="1.0.0")


class Channel(StrEnum):
    email = "email"
    sms = "sms"
    push = "push"


class DeliveryStatus(StrEnum):
    queued = "queued"
    sent = "sent"


class NotificationPayload(BaseModel):
    recipient: str = Field(..., min_length=3, max_length=255)
    channel: Channel
    subject: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1, max_length=4000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class NotificationRecord(NotificationPayload):
    id: UUID
    status: DeliveryStatus
    created_at: datetime


NOTIFICATION_LOG: list[NotificationRecord] = []


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/notifications/send", response_model=NotificationRecord)
async def send_notification(payload: NotificationPayload) -> NotificationRecord:
    record = NotificationRecord(
        id=uuid4(),
        status=DeliveryStatus.sent,
        created_at=datetime.now(timezone.utc),
        **payload.model_dump(),
    )
    NOTIFICATION_LOG.insert(0, record)
    del NOTIFICATION_LOG[200:]
    return record


@app.get("/api/v1/notifications/logs", response_model=list[NotificationRecord])
async def read_notification_logs(
    channel: Channel | None = None,
    limit: int = Query(20, ge=1, le=200),
) -> list[NotificationRecord]:
    records = NOTIFICATION_LOG
    if channel is not None:
        records = [item for item in records if item.channel == channel]
    return records[:limit]
