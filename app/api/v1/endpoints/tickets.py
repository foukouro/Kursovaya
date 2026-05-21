import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_session
from app.models.band import Band
from app.models.concert import Concert
from app.models.enums import ConcertStatus
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.ticket import TicketConcertInfo, TicketPurchase, TicketRead, TicketWithConcert

router = APIRouter()


@router.post("/", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
async def purchase_ticket(
    payload: TicketPurchase,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_session),
) -> Ticket:
    try:
        async with db.begin_nested():
            statement = select(Concert).where(Concert.id == payload.concert_id).with_for_update()
            concert = (await db.execute(statement)).scalar_one_or_none()
            if concert is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Концерт не найден")
            if concert.status != ConcertStatus.planned or concert.date_time <= datetime.now(timezone.utc):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Концерт недоступен для покупки")
            if concert.tickets_available < payload.quantity:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Недостаточно доступных билетов")

            concert.tickets_available -= payload.quantity
            ticket = Ticket(
                user_id=current_user.id,
                concert_id=concert.id,
                quantity=payload.quantity,
                qr_code_data=secrets.token_urlsafe(32),
            )
            db.add(ticket)
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        raise

    await db.refresh(ticket)
    return ticket


@router.get("/my", response_model=list[TicketWithConcert])
async def read_my_tickets(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_session),
) -> list[TicketWithConcert]:
    statement = (
        select(Ticket, Concert, Band.name.label("band_name"))
        .join(Concert, Ticket.concert_id == Concert.id)
        .join(Band, Concert.band_id == Band.id)
        .where(Ticket.user_id == current_user.id)
        .order_by(Ticket.purchase_date.desc())
    )
    rows = (await db.execute(statement)).all()
    result: list[TicketWithConcert] = []
    for ticket, concert, band_name in rows:
        ticket_read = TicketRead.model_validate(ticket, from_attributes=True)
        concert_info = TicketConcertInfo(
            concert_id=concert.id,
            title=concert.title,
            city=concert.city,
            venue=concert.venue,
            date_time=concert.date_time,
            band_name=band_name,
        )
        result.append(TicketWithConcert(**ticket_read.model_dump(), concert=concert_info))
    return result
