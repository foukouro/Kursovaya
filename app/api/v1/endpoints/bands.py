import uuid
import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import check_band_ownership, get_current_active_user, get_manager, get_musician, get_session
from app.models.band import Band, band_musicians
from app.models.concert import Concert
from app.models.enums import (
    ConcertStatus,
    InvitationStatus,
    ModerationStatus,
    NotificationKind,
    ParticipationStatus,
    ScheduleEventType,
    UserRole,
)
from app.models.invitation import BandInvitation
from app.models.release import Release
from app.models.request import BandRequest, ConcertRequest
from app.models.schedule import ScheduleEvent, ScheduleResponse
from app.models.user import User
from app.schemas.band import BandRead, BandRoster, BandStats, BandUpdate
from app.schemas.common import MessageResponse
from app.schemas.concert import ConcertCreate, ConcertRead, validate_concert_constraints
from app.schemas.invitation import BandInvitationCreate, BandInvitationDecision, BandInvitationRead
from app.schemas.release import ReleaseCreate, ReleaseRead
from app.schemas.request import BandRequestCreate, BandRequestRead, ConcertRequestCreate, ConcertRequestRead
from app.schemas.schedule import (
    ScheduleEventCreate,
    ScheduleEventFeedItem,
    ScheduleEventRead,
    ScheduleEventUpdate,
    ScheduleResponseDecision,
)
from app.schemas.user import RosterMember, UserEmailLookup, UserPublic
from app.services.workflow import add_action_log, add_notification, deliver_external_notification

router = APIRouter()


async def send_bulk_email_notifications(
    deliveries: list[tuple[str | None, str, str, dict[str, str]]],
) -> None:
    await asyncio.gather(
        *[
            deliver_external_notification(
                recipient=recipient,
                subject=subject,
                message=message,
                metadata=metadata,
            )
            for recipient, subject, message, metadata in deliveries
        ],
        return_exceptions=True,
    )


def schedule_feed_item(
    event: ScheduleEvent,
    band_name: str,
    current_user_id: uuid.UUID,
    responses: list[ScheduleResponse],
) -> ScheduleEventFeedItem:
    my_response = next((item for item in responses if item.user_id == current_user_id), None)
    confirmed_count = sum(1 for item in responses if item.status == ParticipationStatus.confirmed)
    declined_count = sum(1 for item in responses if item.status == ParticipationStatus.declined)
    return ScheduleEventFeedItem(
        **ScheduleEventRead.model_validate(event, from_attributes=True).model_dump(),
        band_name=band_name,
        my_response=my_response.status if my_response is not None else ParticipationStatus.pending,
        response_comment=my_response.comment if my_response is not None else None,
        confirmed_count=confirmed_count,
        declined_count=declined_count,
    )


async def load_schedule_event_for_manager(
    event_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> ScheduleEvent:
    event = (
        await db.execute(
            select(ScheduleEvent)
            .options(selectinload(ScheduleEvent.band))
            .join(Band, ScheduleEvent.band_id == Band.id)
            .where(ScheduleEvent.id == event_id)
        )
    ).scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Событие расписания не найдено")
    if event.band.manager_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Можно управлять только событиями своих групп")
    return event


@router.get("/managed", response_model=list[BandRead])
async def read_managed_bands(
    current_user: User = Depends(get_manager),
    db: AsyncSession = Depends(get_session),
) -> list[Band]:
    statement = select(Band).where(Band.manager_id == current_user.id).order_by(Band.name.asc())
    return list((await db.execute(statement)).scalars().all())


@router.get("/my", response_model=list[BandRead])
async def read_my_bands(
    current_user: User = Depends(get_musician),
    db: AsyncSession = Depends(get_session),
) -> list[Band]:
    statement = (
        select(Band)
        .join(band_musicians, band_musicians.c.band_id == Band.id)
        .where(band_musicians.c.user_id == current_user.id)
        .order_by(Band.name.asc())
    )
    return list((await db.execute(statement)).scalars().all())


@router.get("/requests/my", response_model=list[BandRequestRead])
async def read_my_band_requests(
    current_user: User = Depends(get_manager),
    db: AsyncSession = Depends(get_session),
) -> list[BandRequest]:
    statement = (
        select(BandRequest)
        .where(BandRequest.manager_id == current_user.id)
        .order_by(BandRequest.created_at.desc())
    )
    return list((await db.execute(statement)).scalars().all())


@router.get("/concert-requests/my", response_model=list[ConcertRequestRead])
async def read_my_concert_requests(
    current_user: User = Depends(get_manager),
    db: AsyncSession = Depends(get_session),
) -> list[ConcertRequest]:
    statement = (
        select(ConcertRequest)
        .join(Band, ConcertRequest.band_id == Band.id)
        .where(Band.manager_id == current_user.id)
        .order_by(ConcertRequest.created_at.desc())
    )
    return list((await db.execute(statement)).scalars().all())


@router.post("/requests", response_model=BandRequestRead, status_code=status.HTTP_201_CREATED)
async def create_band_request(
    payload: BandRequestCreate,
    current_user: User = Depends(get_manager),
    db: AsyncSession = Depends(get_session),
) -> BandRequest:
    existing_band = (await db.execute(select(Band).where(Band.name == payload.name))).scalar_one_or_none()
    if existing_band is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Группа с таким именем уже существует")

    existing_request = (
        await db.execute(
            select(BandRequest).where(
                BandRequest.name == payload.name,
                BandRequest.status == ModerationStatus.pending,
            )
        )
    ).scalar_one_or_none()
    if existing_request is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Заявка на эту группу уже ожидает решения")

    band_request = BandRequest(manager_id=current_user.id, **payload.model_dump())
    db.add(band_request)
    add_notification(
        db,
        user_id=current_user.id,
        title="Заявка на группу создана",
        body=f"Группа «{payload.name}» отправлена на модерацию администрации.",
        kind=NotificationKind.moderation,
    )
    add_action_log(
        db,
        actor=current_user,
        action="band_request_created",
        target_type="band_request",
        target_id=band_request.id,
        summary=f"Создана заявка на группу «{payload.name}».",
    )
    await db.commit()
    await db.refresh(band_request)
    return band_request


@router.put("/{band_id}", response_model=BandRead)
async def update_band(
    payload: BandUpdate,
    band: Band = Depends(check_band_ownership),
    db: AsyncSession = Depends(get_session),
) -> Band:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(band, field, value)
    await db.commit()
    await db.refresh(band)
    return band


@router.post("/{band_id}/concert-requests", response_model=ConcertRequestRead, status_code=status.HTTP_201_CREATED)
async def create_concert_request(
    payload: ConcertRequestCreate,
    current_user: User = Depends(get_manager),
    band: Band = Depends(check_band_ownership),
    db: AsyncSession = Depends(get_session),
) -> ConcertRequest:
    validate_concert_constraints(
        payload.date_time,
        payload.concert_status,
        payload.tickets_total,
        payload.tickets_available,
    )
    concert_request = ConcertRequest(band_id=band.id, **payload.model_dump())
    db.add(concert_request)
    add_notification(
        db,
        user_id=band.manager_id,
        title="Заявка на концерт создана",
        body=f"Концерт «{payload.title}» отправлен на модерацию.",
        kind=NotificationKind.moderation,
    )
    add_action_log(
        db,
        actor=current_user,
        action="concert_request_created",
        target_type="concert_request",
        target_id=concert_request.id,
        summary=f"Создана заявка на концерт «{payload.title}» для группы «{band.name}».",
    )
    await db.commit()
    await db.refresh(concert_request)
    return concert_request


@router.get("/{band_id}/releases", response_model=list[ReleaseRead])
async def read_band_releases(
    band_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_session),
) -> list[Release]:
    band = (
        await db.execute(
            select(Band)
            .options(selectinload(Band.musicians))
            .where(Band.id == band_id)
        )
    ).scalar_one_or_none()
    if band is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Группа не найдена")

    has_access = (
        current_user.role == UserRole.admin
        or band.manager_id == current_user.id
        or any(musician.id == current_user.id for musician in band.musicians)
    )
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к релизам группы")

    statement = select(Release).where(Release.band_id == band_id).order_by(Release.release_date.desc())
    return list((await db.execute(statement)).scalars().all())


@router.post("/{band_id}/releases", response_model=ReleaseRead, status_code=status.HTTP_201_CREATED)
async def create_release(
    payload: ReleaseCreate,
    current_user: User = Depends(get_manager),
    band: Band = Depends(check_band_ownership),
    db: AsyncSession = Depends(get_session),
) -> Release:
    release = Release(band_id=band.id, **payload.model_dump())
    db.add(release)
    add_notification(
        db,
        user_id=band.manager_id,
        title="Релиз отправлен на модерацию",
        body=f"Релиз «{payload.title}» ожидает решения администрации.",
        kind=NotificationKind.moderation,
    )
    add_action_log(
        db,
        actor=current_user,
        action="release_created",
        target_type="release",
        target_id=release.id,
        summary=f"Создан релиз «{payload.title}» для группы «{band.name}».",
    )
    await db.commit()
    await db.refresh(release)
    return release


@router.get("/{band_id}/invitations", response_model=list[BandInvitationRead])
async def read_band_invitations(
    band: Band = Depends(check_band_ownership),
    db: AsyncSession = Depends(get_session),
) -> list[BandInvitation]:
    statement = (
        select(BandInvitation)
        .where(BandInvitation.band_id == band.id)
        .order_by(BandInvitation.created_at.desc())
    )
    return list((await db.execute(statement)).scalars().all())


@router.post("/{band_id}/invitations", response_model=BandInvitationRead, status_code=status.HTTP_201_CREATED)
async def create_band_invitation(
    payload: BandInvitationCreate,
    current_user: User = Depends(get_manager),
    band: Band = Depends(check_band_ownership),
    db: AsyncSession = Depends(get_session),
) -> BandInvitation:
    invited_user = (
        await db.execute(
            select(User).where(User.email.ilike(payload.email.strip()))
        )
    ).scalar_one_or_none()
    if invited_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь с таким email не найден")
    if any(musician.id == invited_user.id for musician in band.musicians):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Музыкант уже состоит в группе")

    existing_invitation = (
        await db.execute(
            select(BandInvitation).where(
                BandInvitation.band_id == band.id,
                BandInvitation.invited_user_id == invited_user.id,
                BandInvitation.status == InvitationStatus.pending,
            )
        )
    ).scalar_one_or_none()
    if existing_invitation is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Приглашение уже ожидает ответа")

    invitation = BandInvitation(
        band_id=band.id,
        invited_user_id=invited_user.id,
        invited_by_id=current_user.id,
        message=payload.message,
    )
    db.add(invitation)
    add_notification(
        db,
        user_id=invited_user.id,
        title="Новое приглашение в группу",
        body=f"Менеджер пригласил вас в группу «{band.name}».",
        kind=NotificationKind.invitation,
        link_url="/cabinet",
    )
    add_action_log(
        db,
        actor=current_user,
        action="band_invitation_created",
        target_type="band_invitation",
        target_id=invitation.id,
        summary=f"Приглашение в группу «{band.name}» отправлено пользователю {invited_user.email}.",
    )
    await db.commit()
    await db.refresh(invitation)
    await deliver_external_notification(
        recipient=invited_user.email,
        subject="Новое приглашение в группу",
        message=f"Менеджер пригласил вас в группу «{band.name}» в сервисе Waves.",
        metadata={"band_id": str(band.id), "invitation_id": str(invitation.id)},
    )
    return invitation


@router.get("/my-invitations", response_model=list[BandInvitationRead])
async def read_my_invitations(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_session),
) -> list[BandInvitation]:
    statement = (
        select(BandInvitation)
        .where(BandInvitation.invited_user_id == current_user.id)
        .order_by(BandInvitation.created_at.desc())
    )
    return list((await db.execute(statement)).scalars().all())


@router.post("/invitations/{invitation_id}/accept", response_model=BandInvitationRead)
async def accept_invitation(
    invitation_id: uuid.UUID,
    payload: BandInvitationDecision,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_session),
) -> BandInvitation:
    invitation = (
        await db.execute(
            select(BandInvitation)
            .where(
                BandInvitation.id == invitation_id,
                BandInvitation.invited_user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Приглашение не найдено")
    if invitation.status != InvitationStatus.pending:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Приглашение уже обработано")

    band = (
        await db.execute(
            select(Band)
            .options(selectinload(Band.musicians))
            .where(Band.id == invitation.band_id)
        )
    ).scalar_one_or_none()
    if band is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Группа не найдена")

    invitation.status = InvitationStatus.accepted
    invitation.response_comment = payload.response_comment
    invitation.responded_at = datetime.now(timezone.utc)
    if current_user.role != UserRole.musician:
        current_user.role = UserRole.musician
    if all(musician.id != current_user.id for musician in band.musicians):
        band.musicians.append(current_user)
    existing_response_event_ids = set(
        (
            await db.execute(
                select(ScheduleResponse.event_id).where(ScheduleResponse.user_id == current_user.id)
            )
        ).scalars().all()
    )
    future_events = list(
        (
            await db.execute(
                select(ScheduleEvent).where(
                    ScheduleEvent.band_id == band.id,
                    ScheduleEvent.starts_at >= datetime.now(timezone.utc),
                )
            )
        ).scalars().all()
    )
    for event in future_events:
        if event.id not in existing_response_event_ids:
            db.add(
                ScheduleResponse(
                    event_id=event.id,
                    user_id=current_user.id,
                    status=ParticipationStatus.pending,
                )
            )
    add_notification(
        db,
        user_id=band.manager_id,
        title="Приглашение принято",
        body=f"Пользователь {current_user.email} принял приглашение в группу «{band.name}».",
        kind=NotificationKind.invitation,
    )
    add_action_log(
        db,
        actor=current_user,
        action="band_invitation_accepted",
        target_type="band_invitation",
        target_id=invitation.id,
        summary=f"Пользователь {current_user.email} принял приглашение в группу «{band.name}».",
    )
    await db.commit()
    await db.refresh(invitation)
    manager = await db.get(User, band.manager_id)
    await deliver_external_notification(
        recipient=manager.email if manager is not None else None,
        subject="Приглашение принято",
        message=f"Пользователь {current_user.email} принял приглашение в группу «{band.name}».",
        metadata={"band_id": str(band.id), "invitation_id": str(invitation.id), "status": "accepted"},
    )
    return invitation


@router.post("/invitations/{invitation_id}/reject", response_model=BandInvitationRead)
async def reject_invitation(
    invitation_id: uuid.UUID,
    payload: BandInvitationDecision,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_session),
) -> BandInvitation:
    invitation = (
        await db.execute(
            select(BandInvitation).where(
                BandInvitation.id == invitation_id,
                BandInvitation.invited_user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Приглашение не найдено")
    if invitation.status != InvitationStatus.pending:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Приглашение уже обработано")

    band = (await db.execute(select(Band).where(Band.id == invitation.band_id))).scalar_one_or_none()
    if band is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Группа не найдена")

    invitation.status = InvitationStatus.rejected
    invitation.response_comment = payload.response_comment
    invitation.responded_at = datetime.now(timezone.utc)
    add_notification(
        db,
        user_id=band.manager_id,
        title="Приглашение отклонено",
        body=f"Пользователь {current_user.email} отклонил приглашение в группу «{band.name}».",
        kind=NotificationKind.invitation,
    )
    add_action_log(
        db,
        actor=current_user,
        action="band_invitation_rejected",
        target_type="band_invitation",
        target_id=invitation.id,
        summary=f"Пользователь {current_user.email} отклонил приглашение в группу «{band.name}».",
    )
    await db.commit()
    await db.refresh(invitation)
    manager = await db.get(User, band.manager_id)
    await deliver_external_notification(
        recipient=manager.email if manager is not None else None,
        subject="Приглашение отклонено",
        message=f"Пользователь {current_user.email} отклонил приглашение в группу «{band.name}».",
        metadata={"band_id": str(band.id), "invitation_id": str(invitation.id), "status": "rejected"},
    )
    return invitation


@router.get("/{band_id}/schedule", response_model=list[ScheduleEventFeedItem])
async def read_band_schedule(
    band: Band = Depends(check_band_ownership),
    current_user: User = Depends(get_manager),
    db: AsyncSession = Depends(get_session),
) -> list[ScheduleEventFeedItem]:
    events = list(
        (
            await db.execute(
                select(ScheduleEvent)
                .where(ScheduleEvent.band_id == band.id)
                .order_by(ScheduleEvent.starts_at.asc())
            )
        ).scalars().all()
    )
    event_ids = [event.id for event in events]
    responses = []
    if event_ids:
        responses = list(
            (
                await db.execute(
                    select(ScheduleResponse).where(ScheduleResponse.event_id.in_(event_ids))
                )
            ).scalars().all()
        )
    responses_by_event: dict[uuid.UUID, list[ScheduleResponse]] = {}
    for item in responses:
        responses_by_event.setdefault(item.event_id, []).append(item)
    return [schedule_feed_item(event, band.name, current_user.id, responses_by_event.get(event.id, [])) for event in events]


@router.get("/my-schedule", response_model=list[ScheduleEventFeedItem])
async def read_my_schedule(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_session),
) -> list[ScheduleEventFeedItem]:
    if current_user.role == UserRole.manager:
        statement = (
            select(ScheduleEvent, Band.name.label("band_name"))
            .join(Band, ScheduleEvent.band_id == Band.id)
            .where(Band.manager_id == current_user.id)
            .order_by(ScheduleEvent.starts_at.asc())
        )
    else:
        statement = (
            select(ScheduleEvent, Band.name.label("band_name"))
            .join(Band, ScheduleEvent.band_id == Band.id)
            .join(band_musicians, band_musicians.c.band_id == Band.id)
            .where(band_musicians.c.user_id == current_user.id)
            .order_by(ScheduleEvent.starts_at.asc())
        )
    rows = (await db.execute(statement)).all()
    event_ids = [event.id for event, _ in rows]
    responses = []
    if event_ids:
        responses = list(
            (
                await db.execute(
                    select(ScheduleResponse).where(ScheduleResponse.event_id.in_(event_ids))
                )
            ).scalars().all()
        )
    responses_by_event: dict[uuid.UUID, list[ScheduleResponse]] = {}
    for item in responses:
        responses_by_event.setdefault(item.event_id, []).append(item)
    return [
        schedule_feed_item(event, band_name, current_user.id, responses_by_event.get(event.id, []))
        for event, band_name in rows
    ]


@router.post("/{band_id}/schedule", response_model=ScheduleEventRead, status_code=status.HTTP_201_CREATED)
async def create_schedule_event(
    payload: ScheduleEventCreate,
    current_user: User = Depends(get_manager),
    band: Band = Depends(check_band_ownership),
    db: AsyncSession = Depends(get_session),
) -> ScheduleEvent:
    schedule_event = ScheduleEvent(
        band_id=band.id,
        created_by_id=current_user.id,
        **payload.model_dump(),
    )
    db.add(schedule_event)
    await db.flush()
    for musician in band.musicians:
        db.add(
            ScheduleResponse(
                event_id=schedule_event.id,
                user_id=musician.id,
                status=ParticipationStatus.pending,
            )
        )
        add_notification(
            db,
            user_id=musician.id,
            title="Новое событие в расписании",
            body=f"Для группы «{band.name}» добавлено событие «{payload.title}».",
            kind=NotificationKind.schedule,
            link_url="/cabinet",
        )
    add_notification(
        db,
        user_id=band.manager_id,
        title="Событие расписания создано",
        body=f"Событие «{payload.title}» добавлено в расписание группы «{band.name}».",
        kind=NotificationKind.schedule,
    )
    add_action_log(
        db,
        actor=current_user,
        action="schedule_event_created",
        target_type="schedule_event",
        target_id=schedule_event.id,
        summary=f"Создано событие «{payload.title}» для группы «{band.name}».",
    )
    await db.commit()
    await db.refresh(schedule_event)
    await send_bulk_email_notifications(
        [
            (
                musician.email,
                "Новое событие в расписании",
                f"Для группы «{band.name}» добавлено событие «{payload.title}». Проверьте детали в Waves.",
                {"band_id": str(band.id), "schedule_event_id": str(schedule_event.id)},
            )
            for musician in band.musicians
        ]
    )
    return schedule_event


@router.put("/schedule/{event_id}", response_model=ScheduleEventRead)
async def update_schedule_event(
    event_id: uuid.UUID,
    payload: ScheduleEventUpdate,
    current_user: User = Depends(get_manager),
    db: AsyncSession = Depends(get_session),
) -> ScheduleEvent:
    event = await load_schedule_event_for_manager(event_id, current_user, db)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)
    if event.ends_at <= event.starts_at:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Дата окончания должна быть позже даты начала")

    band = event.band
    musician_ids = [musician.id for musician in band.musicians]
    for musician_id in musician_ids:
        add_notification(
            db,
            user_id=musician_id,
            title="Расписание обновлено",
            body=f"Событие «{event.title}» в группе «{band.name}» было изменено.",
            kind=NotificationKind.schedule,
            link_url="/cabinet",
        )
    add_action_log(
        db,
        actor=current_user,
        action="schedule_event_updated",
        target_type="schedule_event",
        target_id=event.id,
        summary=f"Обновлено событие «{event.title}» для группы «{band.name}».",
    )
    await db.commit()
    await db.refresh(event)
    await send_bulk_email_notifications(
        [
            (
                musician.email,
                "Расписание обновлено",
                f"Событие «{event.title}» для группы «{band.name}» было изменено.",
                {"band_id": str(band.id), "schedule_event_id": str(event.id)},
            )
            for musician in band.musicians
        ]
    )
    return event


@router.post("/schedule/{event_id}/respond", response_model=MessageResponse)
async def respond_to_schedule_event(
    event_id: uuid.UUID,
    payload: ScheduleResponseDecision,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    response_row = (
        await db.execute(
            select(ScheduleResponse).where(
                ScheduleResponse.event_id == event_id,
                ScheduleResponse.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if response_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Событие расписания не найдено для этого пользователя")

    event = (
        await db.execute(
            select(ScheduleEvent)
            .options(selectinload(ScheduleEvent.band))
            .where(ScheduleEvent.id == event_id)
        )
    ).scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Событие расписания не найдено")

    response_row.status = payload.status
    response_row.comment = payload.comment
    add_notification(
        db,
        user_id=event.band.manager_id,
        title="Изменен ответ на событие",
        body=f"Пользователь {current_user.email} обновил участие в событии «{event.title}».",
        kind=NotificationKind.schedule,
    )
    add_action_log(
        db,
        actor=current_user,
        action="schedule_response_updated",
        target_type="schedule_event",
        target_id=event.id,
        summary=f"Пользователь {current_user.email} обновил участие в событии «{event.title}».",
    )
    await db.commit()
    return MessageResponse(detail="Ответ на событие сохранен")


@router.get("/{band_id}/roster", response_model=BandRoster)
async def read_roster(
    band_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_session),
) -> BandRoster:
    band = (
        await db.execute(
            select(Band)
            .options(selectinload(Band.musicians).selectinload(User.profile))
            .where(Band.id == band_id)
        )
    ).scalar_one_or_none()
    if band is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Группа не найдена")

    has_access = (
        current_user.role == UserRole.admin
        or band.manager_id == current_user.id
        or any(musician.id == current_user.id for musician in band.musicians)
    )
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к составу группы")

    return BandRoster(
        band_id=band.id,
        musicians=[
            RosterMember(
                id=musician.id,
                first_name=musician.profile.first_name,
                last_name=musician.profile.last_name,
                avatar_url=musician.profile.avatar_url,
            )
            for musician in band.musicians
            if musician.profile is not None
        ],
    )


@router.post("/{band_id}/concerts", response_model=ConcertRead, status_code=status.HTTP_201_CREATED)
async def create_concert(
    payload: ConcertCreate,
    band: Band = Depends(check_band_ownership),
    db: AsyncSession = Depends(get_session),
) -> Concert:
    tickets_available = payload.tickets_available if payload.tickets_available is not None else payload.tickets_total
    try:
        validate_concert_constraints(
            payload.date_time,
            payload.status,
            payload.tickets_total,
            tickets_available,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    concert = Concert(
        band_id=band.id,
        title=payload.title,
        venue=payload.venue,
        city=payload.city,
        date_time=payload.date_time,
        tickets_total=payload.tickets_total,
        tickets_available=tickets_available,
        price=payload.price,
        description=payload.description,
        poster_url=payload.poster_url,
        external_url=payload.external_url,
        status=payload.status,
    )
    db.add(concert)
    await db.commit()
    await db.refresh(concert)
    return concert


@router.get("/{band_id}/stats", response_model=BandStats)
async def read_band_stats(
    band: Band = Depends(check_band_ownership),
    db: AsyncSession = Depends(get_session),
) -> BandStats:
    sold_expression = Concert.tickets_total - Concert.tickets_available
    statement = select(
        func.coalesce(func.sum(sold_expression), 0),
        func.coalesce(func.sum(sold_expression * Concert.price), 0),
    ).where(
        Concert.band_id == band.id,
        Concert.date_time > datetime.now(timezone.utc),
        Concert.status == ConcertStatus.planned,
    )
    future_tickets_sold, revenue = (await db.execute(statement)).one()
    return BandStats(band_id=band.id, future_tickets_sold=future_tickets_sold, revenue=revenue)


@router.get("/{band_id}/candidate-musicians", response_model=list[UserPublic])
async def read_candidate_musicians(
    email: str | None = None,
    band: Band = Depends(check_band_ownership),
    db: AsyncSession = Depends(get_session),
) -> list[User]:
    current_musician_ids = [musician.id for musician in band.musicians]
    statement = (
        select(User)
        .options(selectinload(User.profile))
        .where(
            User.is_active.is_(True),
            User.role.in_([UserRole.registered_user, UserRole.musician]),
        )
        .order_by(User.created_at.desc())
        .limit(50)
    )
    if email:
        statement = statement.where(User.email.ilike(f"%{email.strip()}%"))
    if current_musician_ids:
        statement = statement.where(User.id.not_in(current_musician_ids))
    return list((await db.execute(statement)).scalars().all())


@router.post("/{band_id}/musicians/by-email", response_model=MessageResponse)
async def add_musician_by_email(
    payload: UserEmailLookup,
    current_user: User = Depends(get_manager),
    band: Band = Depends(check_band_ownership),
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    user = (
        await db.execute(
            select(User).where(User.email.ilike(payload.email.strip()))
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь с таким email не найден")
    if user.role != UserRole.musician:
        user.role = UserRole.musician
    if all(musician.id != user.id for musician in band.musicians):
        band.musicians.append(user)
    add_notification(
        db,
        user_id=user.id,
        title="Вы добавлены в группу",
        body=f"Вас сразу добавили в состав группы «{band.name}».",
        kind=NotificationKind.invitation,
    )
    add_action_log(
        db,
        actor=current_user,
        action="musician_added_by_email",
        target_type="band",
        target_id=band.id,
        summary=f"Музыкант {user.email} добавлен в группу «{band.name}» по email.",
    )
    await db.commit()
    return MessageResponse(detail="Музыкант добавлен в группу")


@router.post("/{band_id}/musicians/{user_id}", response_model=MessageResponse)
async def add_musician(
    user_id: uuid.UUID,
    current_user: User = Depends(get_manager),
    band: Band = Depends(check_band_ownership),
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    if user.role != UserRole.musician:
        user.role = UserRole.musician
    if all(musician.id != user.id for musician in band.musicians):
        band.musicians.append(user)
    add_notification(
        db,
        user_id=user.id,
        title="Вы добавлены в группу",
        body=f"Вас добавили в состав группы «{band.name}».",
        kind=NotificationKind.invitation,
    )
    add_action_log(
        db,
        actor=current_user,
        action="musician_added",
        target_type="band",
        target_id=band.id,
        summary=f"Музыкант {user.email} добавлен в группу «{band.name}».",
    )
    await db.commit()
    return MessageResponse(detail="Музыкант добавлен в группу")


@router.delete("/{band_id}/musicians/{user_id}", response_model=MessageResponse)
async def remove_musician(
    user_id: uuid.UUID,
    current_user: User = Depends(get_manager),
    band: Band = Depends(check_band_ownership),
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    musician = next((item for item in band.musicians if item.id == user_id), None)
    if musician is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Музыкант не найден в группе")
    band.musicians.remove(musician)
    add_notification(
        db,
        user_id=musician.id,
        title="Состав группы обновлен",
        body=f"Вас убрали из состава группы «{band.name}».",
        kind=NotificationKind.invitation,
    )
    add_action_log(
        db,
        actor=current_user,
        action="musician_removed",
        target_type="band",
        target_id=band.id,
        summary=f"Музыкант {musician.email} удален из группы «{band.name}».",
    )
    await db.commit()
    return MessageResponse(detail="Музыкант удален из группы")
