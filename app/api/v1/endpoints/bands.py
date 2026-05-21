import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import check_band_ownership, get_current_active_user, get_musician, get_session
from app.models.band import Band, band_musicians
from app.models.concert import Concert
from app.models.enums import ConcertStatus, UserRole
from app.models.user import User
from app.schemas.band import BandRead, BandRoster, BandStats
from app.schemas.common import MessageResponse
from app.schemas.concert import ConcertCreate, ConcertRead
from app.schemas.user import RosterMember

router = APIRouter()


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
    concert = Concert(
        band_id=band.id,
        title=payload.title,
        venue=payload.venue,
        city=payload.city,
        date_time=payload.date_time,
        tickets_total=payload.tickets_total,
        tickets_available=tickets_available,
        price=payload.price,
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


@router.post("/{band_id}/musicians/{user_id}", response_model=MessageResponse)
async def add_musician(
    user_id: uuid.UUID,
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
    await db.commit()
    return MessageResponse(detail="Музыкант добавлен в группу")


@router.delete("/{band_id}/musicians/{user_id}", response_model=MessageResponse)
async def remove_musician(
    user_id: uuid.UUID,
    band: Band = Depends(check_band_ownership),
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    musician = next((item for item in band.musicians if item.id == user_id), None)
    if musician is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Музыкант не найден в группе")
    band.musicians.remove(musician)
    await db.commit()
    return MessageResponse(detail="Музыкант удален из группы")
