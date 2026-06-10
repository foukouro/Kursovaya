import logging
import uuid
from typing import Any

import httpx

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.action_log import ActionLog
from app.models.enums import NotificationKind
from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger(__name__)


def add_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    title: str,
    body: str,
    kind: NotificationKind = NotificationKind.system,
    link_url: str | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        body=body,
        kind=kind,
        link_url=link_url,
    )
    db.add(notification)
    return notification


async def deliver_external_notification(
    *,
    recipient: str | None,
    subject: str,
    message: str,
    channel: str = "email",
    metadata: dict[str, Any] | None = None,
) -> None:
    if not recipient:
        return

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(
                f"{settings.NOTIFICATION_SERVICE_URL}/api/v1/notifications/send",
                json={
                    "recipient": recipient,
                    "channel": channel,
                    "subject": subject,
                    "message": message,
                    "metadata": metadata or {},
                },
            )
    except httpx.HTTPError as exc:
        logger.warning("Notification service delivery failed for %s: %s", recipient, exc)


def add_action_log(
    db: AsyncSession,
    *,
    actor: User | None,
    action: str,
    target_type: str,
    target_id: uuid.UUID | None,
    summary: str,
) -> ActionLog:
    log_row = ActionLog(
        actor_id=actor.id if actor is not None else None,
        actor_email=actor.email if actor is not None else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        summary=summary,
    )
    db.add(log_row)
    return log_row
