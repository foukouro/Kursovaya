import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_active_user, get_session
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationRead
from app.schemas.user import UserMeUpdate, UserRead

router = APIRouter()


@router.get("/me", response_model=UserRead)
async def read_me(current_user: User = Depends(get_current_active_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserRead)
async def update_me(
    payload: UserMeUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_session),
) -> User:
    if payload.email is not None:
        normalized_email = payload.email.lower()
        existing_user = await db.execute(select(User).where(User.email == normalized_email, User.id != current_user.id))
        if existing_user.scalar_one_or_none() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Пользователь с таким email уже существует")
        current_user.email = normalized_email

    if current_user.profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Профиль пользователя не найден")

    if payload.first_name is not None:
        current_user.profile.first_name = payload.first_name
    if payload.last_name is not None:
        current_user.profile.last_name = payload.last_name
    if payload.avatar_url is not None:
        current_user.profile.avatar_url = payload.avatar_url or None

    await db.commit()
    result = await db.execute(select(User).options(selectinload(User.profile)).where(User.id == current_user.id))
    return result.scalar_one()


@router.get("/notifications", response_model=list[NotificationRead])
async def read_my_notifications(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_session),
) -> list[Notification]:
    statement = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(100)
    )
    return list((await db.execute(statement)).scalars().all())


@router.post("/notifications/{notification_id}/read", response_model=NotificationRead)
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_session),
) -> Notification:
    notification = (
        await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Уведомление не найдено")
    notification.is_read = True
    await db.commit()
    await db.refresh(notification)
    return notification
