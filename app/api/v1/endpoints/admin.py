import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_admin, get_session
from app.models.action_log import ActionLog
from app.models.band import Band
from app.models.concert import Concert
from app.models.enums import ModerationStatus, NotificationKind, UserRole
from app.models.release import Release
from app.models.request import BandRequest, ConcertRequest
from app.models.user import User
from app.schemas.action_log import ActionLogRead
from app.schemas.band import BandCreate, BandRead
from app.schemas.common import MessageResponse
from app.schemas.release import ReleaseRead, ReleaseUpdate
from app.schemas.request import BandRequestRead, ConcertRequestRead, ModerationDecision
from app.schemas.user import UserRead, UserRoleUpdate
from app.services.workflow import add_action_log, add_notification, deliver_external_notification

router = APIRouter(dependencies=[Depends(get_admin)])


async def user_email(db: AsyncSession, user_id: uuid.UUID) -> str | None:
    user = await db.get(User, user_id)
    return user.email if user is not None else None


@router.get("/users", response_model=list[UserRead])
async def read_users(
    role: UserRole | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_session),
) -> list[User]:
    statement = (
        select(User)
        .options(selectinload(User.profile))
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if role is not None:
        statement = statement.where(User.role == role)
    return list((await db.execute(statement)).scalars().all())


@router.put("/users/{user_id}/role", response_model=UserRead)
async def update_user_role(
    user_id: uuid.UUID,
    payload: UserRoleUpdate,
    current_user: User = Depends(get_admin),
    db: AsyncSession = Depends(get_session),
) -> User:
    user = (
        await db.execute(select(User).options(selectinload(User.profile)).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    user.role = payload.role
    add_action_log(
        db,
        actor=current_user,
        action="user_role_updated",
        target_type="user",
        target_id=user.id,
        summary=f"Роль пользователя {user.email} изменена на {payload.role}.",
    )
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/bands", response_model=BandRead, status_code=status.HTTP_201_CREATED)
async def create_band(payload: BandCreate, db: AsyncSession = Depends(get_session)) -> Band:
    manager = (await db.execute(select(User).where(User.id == payload.manager_id))).scalar_one_or_none()
    if manager is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Менеджер не найден")
    if manager.role != UserRole.manager:
        manager.role = UserRole.manager

    existing_band = (await db.execute(select(Band).where(Band.name == payload.name))).scalar_one_or_none()
    if existing_band is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Группа с таким именем уже существует")

    band = Band(
        name=payload.name,
        genre=payload.genre,
        city=payload.city,
        description=payload.description,
        cover_url=payload.cover_url,
        website_url=payload.website_url,
        instagram_url=payload.instagram_url,
        manager_id=manager.id,
    )
    db.add(band)
    await db.commit()
    await db.refresh(band)
    return band


@router.get("/bands", response_model=list[BandRead])
async def read_bands(db: AsyncSession = Depends(get_session)) -> list[Band]:
    statement = select(Band).order_by(Band.name.asc())
    return list((await db.execute(statement)).scalars().all())


@router.get("/band-requests", response_model=list[BandRequestRead])
async def read_band_requests(
    status_filter: ModerationStatus | None = None,
    db: AsyncSession = Depends(get_session),
) -> list[BandRequest]:
    statement = select(BandRequest).order_by(BandRequest.created_at.desc())
    if status_filter is not None:
        statement = statement.where(BandRequest.status == status_filter)
    return list((await db.execute(statement)).scalars().all())


@router.post("/band-requests/{request_id}/approve", response_model=BandRead)
async def approve_band_request(
    request_id: uuid.UUID,
    payload: ModerationDecision,
    current_user: User = Depends(get_admin),
    db: AsyncSession = Depends(get_session),
) -> Band:
    band_request = (await db.execute(select(BandRequest).where(BandRequest.id == request_id))).scalar_one_or_none()
    if band_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка на группу не найдена")
    if band_request.status == ModerationStatus.approved:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Заявка уже одобрена")

    existing_band = (await db.execute(select(Band).where(Band.name == band_request.name))).scalar_one_or_none()
    if existing_band is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Группа с таким именем уже существует")

    band = Band(
        name=band_request.name,
        genre=band_request.genre,
        city=band_request.city,
        description=band_request.description,
        cover_url=band_request.cover_url,
        website_url=band_request.website_url,
        instagram_url=band_request.instagram_url,
        manager_id=band_request.manager_id,
    )
    band_request.status = ModerationStatus.approved
    band_request.admin_comment = payload.admin_comment
    db.add(band)
    add_notification(
        db,
        user_id=band_request.manager_id,
        title="Группа одобрена",
        body=f"Заявка на группу «{band_request.name}» была одобрена администрацией.",
        kind=NotificationKind.moderation,
        link_url="/cabinet",
    )
    add_action_log(
        db,
        actor=current_user,
        action="band_request_approved",
        target_type="band_request",
        target_id=band_request.id,
        summary=f"Одобрена заявка на группу «{band_request.name}».",
    )
    await db.commit()
    await db.refresh(band)
    await deliver_external_notification(
        recipient=await user_email(db, band_request.manager_id),
        subject="Заявка на группу одобрена",
        message=f"Заявка на группу «{band_request.name}» одобрена администрацией Waves.",
        metadata={"band_request_id": str(band_request.id), "status": "approved"},
    )
    return band


@router.post("/band-requests/{request_id}/reject", response_model=BandRequestRead)
async def reject_band_request(
    request_id: uuid.UUID,
    payload: ModerationDecision,
    current_user: User = Depends(get_admin),
    db: AsyncSession = Depends(get_session),
) -> BandRequest:
    band_request = (await db.execute(select(BandRequest).where(BandRequest.id == request_id))).scalar_one_or_none()
    if band_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка на группу не найдена")
    band_request.status = ModerationStatus.rejected
    band_request.admin_comment = payload.admin_comment
    add_notification(
        db,
        user_id=band_request.manager_id,
        title="Группа отклонена",
        body=f"Заявка на группу «{band_request.name}» была отклонена. {payload.admin_comment or ''}".strip(),
        kind=NotificationKind.moderation,
        link_url="/cabinet",
    )
    add_action_log(
        db,
        actor=current_user,
        action="band_request_rejected",
        target_type="band_request",
        target_id=band_request.id,
        summary=f"Отклонена заявка на группу «{band_request.name}».",
    )
    await db.commit()
    await db.refresh(band_request)
    await deliver_external_notification(
        recipient=await user_email(db, band_request.manager_id),
        subject="Заявка на группу отклонена",
        message=f"Заявка на группу «{band_request.name}» отклонена. {payload.admin_comment or 'Проверьте комментарий модератора в кабинете.'}".strip(),
        metadata={"band_request_id": str(band_request.id), "status": "rejected"},
    )
    return band_request


@router.get("/concert-requests", response_model=list[ConcertRequestRead])
async def read_concert_requests(
    status_filter: ModerationStatus | None = None,
    db: AsyncSession = Depends(get_session),
) -> list[ConcertRequest]:
    statement = select(ConcertRequest).order_by(ConcertRequest.created_at.desc())
    if status_filter is not None:
        statement = statement.where(ConcertRequest.status == status_filter)
    return list((await db.execute(statement)).scalars().all())


@router.post("/concert-requests/{request_id}/approve", response_model=MessageResponse)
async def approve_concert_request(
    request_id: uuid.UUID,
    payload: ModerationDecision,
    current_user: User = Depends(get_admin),
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    concert_request = (await db.execute(select(ConcertRequest).where(ConcertRequest.id == request_id))).scalar_one_or_none()
    if concert_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка на концерт не найдена")
    if concert_request.status == ModerationStatus.approved:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Заявка уже одобрена")

    concert = Concert(
        band_id=concert_request.band_id,
        title=concert_request.title,
        venue=concert_request.venue,
        city=concert_request.city,
        date_time=concert_request.date_time,
        tickets_total=concert_request.tickets_total,
        tickets_available=concert_request.tickets_available,
        price=concert_request.price,
        description=concert_request.description,
        poster_url=concert_request.poster_url,
        external_url=concert_request.external_url,
        status=concert_request.concert_status,
    )
    concert_request.status = ModerationStatus.approved
    concert_request.admin_comment = payload.admin_comment
    db.add(concert)
    band = (await db.execute(select(Band).where(Band.id == concert_request.band_id))).scalar_one()
    add_notification(
        db,
        user_id=band.manager_id,
        title="Концерт одобрен",
        body=f"Концерт «{concert_request.title}» опубликован после модерации.",
        kind=NotificationKind.moderation,
        link_url="/cabinet",
    )
    add_action_log(
        db,
        actor=current_user,
        action="concert_request_approved",
        target_type="concert_request",
        target_id=concert_request.id,
        summary=f"Одобрена заявка на концерт «{concert_request.title}».",
    )
    await db.commit()
    await deliver_external_notification(
        recipient=await user_email(db, band.manager_id),
        subject="Концерт одобрен",
        message=f"Концерт «{concert_request.title}» прошел модерацию и опубликован в Waves.",
        metadata={"concert_request_id": str(concert_request.id), "status": "approved"},
    )
    return MessageResponse(detail="Концерт одобрен и опубликован")


@router.post("/concert-requests/{request_id}/reject", response_model=ConcertRequestRead)
async def reject_concert_request(
    request_id: uuid.UUID,
    payload: ModerationDecision,
    current_user: User = Depends(get_admin),
    db: AsyncSession = Depends(get_session),
) -> ConcertRequest:
    concert_request = (await db.execute(select(ConcertRequest).where(ConcertRequest.id == request_id))).scalar_one_or_none()
    if concert_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка на концерт не найдена")
    concert_request.status = ModerationStatus.rejected
    concert_request.admin_comment = payload.admin_comment
    band = (await db.execute(select(Band).where(Band.id == concert_request.band_id))).scalar_one()
    add_notification(
        db,
        user_id=band.manager_id,
        title="Концерт отклонен",
        body=f"Заявка на концерт «{concert_request.title}» отклонена. {payload.admin_comment or ''}".strip(),
        kind=NotificationKind.moderation,
        link_url="/cabinet",
    )
    add_action_log(
        db,
        actor=current_user,
        action="concert_request_rejected",
        target_type="concert_request",
        target_id=concert_request.id,
        summary=f"Отклонена заявка на концерт «{concert_request.title}».",
    )
    await db.commit()
    await db.refresh(concert_request)
    await deliver_external_notification(
        recipient=await user_email(db, band.manager_id),
        subject="Концерт отклонен",
        message=f"Заявка на концерт «{concert_request.title}» отклонена. {payload.admin_comment or 'Подробности доступны в кабинете.'}".strip(),
        metadata={"concert_request_id": str(concert_request.id), "status": "rejected"},
    )
    return concert_request


@router.get("/releases", response_model=list[ReleaseRead])
async def read_releases(
    status_filter: ModerationStatus | None = None,
    db: AsyncSession = Depends(get_session),
) -> list[Release]:
    statement = select(Release).order_by(Release.release_date.desc())
    if status_filter is not None:
        statement = statement.where(Release.status == status_filter)
    return list((await db.execute(statement)).scalars().all())


@router.put("/releases/{release_id}", response_model=ReleaseRead)
async def update_release(
    release_id: uuid.UUID,
    payload: ReleaseUpdate,
    current_user: User = Depends(get_admin),
    db: AsyncSession = Depends(get_session),
) -> Release:
    release = (await db.execute(select(Release).where(Release.id == release_id))).scalar_one_or_none()
    if release is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Релиз не найден")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(release, field, value)
    add_action_log(
        db,
        actor=current_user,
        action="release_updated",
        target_type="release",
        target_id=release.id,
        summary=f"Релиз «{release.title}» обновлен администратором.",
    )
    await db.commit()
    await db.refresh(release)
    return release


@router.delete("/releases/{release_id}", response_model=MessageResponse)
async def delete_release(
    release_id: uuid.UUID,
    current_user: User = Depends(get_admin),
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    release = (await db.execute(select(Release).where(Release.id == release_id))).scalar_one_or_none()
    if release is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Релиз не найден")
    band = (await db.execute(select(Band).where(Band.id == release.band_id))).scalar_one_or_none()
    if band is not None:
        add_notification(
            db,
            user_id=band.manager_id,
            title="Релиз удален",
            body=f"Релиз «{release.title}» был удален администрацией.",
            kind=NotificationKind.moderation,
            link_url="/cabinet",
        )
    add_action_log(
        db,
        actor=current_user,
        action="release_deleted",
        target_type="release",
        target_id=release.id,
        summary=f"Релиз «{release.title}» удален администратором.",
    )
    await db.delete(release)
    await db.commit()
    return MessageResponse(detail="Релиз удален")


@router.post("/releases/{release_id}/approve", response_model=ReleaseRead)
async def approve_release(
    release_id: uuid.UUID,
    payload: ModerationDecision,
    current_user: User = Depends(get_admin),
    db: AsyncSession = Depends(get_session),
) -> Release:
    release = (await db.execute(select(Release).where(Release.id == release_id))).scalar_one_or_none()
    if release is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Релиз не найден")
    release.status = ModerationStatus.approved
    release.admin_comment = payload.admin_comment
    band = (await db.execute(select(Band).where(Band.id == release.band_id))).scalar_one_or_none()
    if band is not None:
        add_notification(
            db,
            user_id=band.manager_id,
            title="Релиз одобрен",
            body=f"Релиз «{release.title}» одобрен для публикации.",
            kind=NotificationKind.moderation,
            link_url="/cabinet",
        )
    add_action_log(
        db,
        actor=current_user,
        action="release_approved",
        target_type="release",
        target_id=release.id,
        summary=f"Релиз «{release.title}» одобрен администратором.",
    )
    await db.commit()
    await db.refresh(release)
    if band is not None:
        await deliver_external_notification(
            recipient=await user_email(db, band.manager_id),
            subject="Релиз одобрен",
            message=f"Релиз «{release.title}» одобрен и доступен для публикации.",
            metadata={"release_id": str(release.id), "status": "approved"},
        )
    return release


@router.post("/releases/{release_id}/reject", response_model=ReleaseRead)
async def reject_release(
    release_id: uuid.UUID,
    payload: ModerationDecision,
    current_user: User = Depends(get_admin),
    db: AsyncSession = Depends(get_session),
) -> Release:
    release = (await db.execute(select(Release).where(Release.id == release_id))).scalar_one_or_none()
    if release is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Релиз не найден")
    release.status = ModerationStatus.rejected
    release.admin_comment = payload.admin_comment
    band = (await db.execute(select(Band).where(Band.id == release.band_id))).scalar_one_or_none()
    if band is not None:
        add_notification(
            db,
            user_id=band.manager_id,
            title="Релиз отклонен",
            body=f"Релиз «{release.title}» отклонен. {payload.admin_comment or ''}".strip(),
            kind=NotificationKind.moderation,
            link_url="/cabinet",
        )
    add_action_log(
        db,
        actor=current_user,
        action="release_rejected",
        target_type="release",
        target_id=release.id,
        summary=f"Релиз «{release.title}» отклонен администратором.",
    )
    await db.commit()
    await db.refresh(release)
    if band is not None:
        await deliver_external_notification(
            recipient=await user_email(db, band.manager_id),
            subject="Релиз отклонен",
            message=f"Релиз «{release.title}» отклонен. {payload.admin_comment or 'Проверьте комментарий администрации в кабинете.'}".strip(),
            metadata={"release_id": str(release.id), "status": "rejected"},
        )
    return release


@router.get("/action-log", response_model=list[ActionLogRead])
async def read_action_log(
    limit: int = Query(100, ge=1, le=300),
    db: AsyncSession = Depends(get_session),
) -> list[ActionLog]:
    statement = select(ActionLog).order_by(ActionLog.created_at.desc()).limit(limit)
    return list((await db.execute(statement)).scalars().all())
