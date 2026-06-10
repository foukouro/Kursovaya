import secrets
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_optional_active_user, get_session
from app.models.band import Band
from app.models.concert import Concert
from app.models.enums import ConcertStatus
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.ticket import TicketCheckoutRead, TicketConcertInfo, TicketPurchase, TicketRead, TicketWithConcert
from app.services.workflow import deliver_external_notification

router = APIRouter()


def card_brand(card_number: str) -> str:
    if card_number.startswith("4"):
        return "Visa"
    if re.match(r"^(5[1-5]|2[2-7])", card_number):
        return "Mastercard"
    if card_number.startswith(("2200", "2201", "2202", "2203", "2204")):
        return "MIR"
    return "Bank card"


def validate_payment_payload(payload: TicketPurchase) -> tuple[str, str]:
    normalized_card = re.sub(r"\D", "", payload.payment_card_number or "")
    if len(normalized_card) < 13 or len(normalized_card) > 19:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Номер карты указан некорректно")

    expiry = (payload.payment_expiry or "").strip()
    expiry_match = re.fullmatch(r"(0[1-9]|1[0-2])\/(\d{2})", expiry)
    if expiry_match is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Срок действия карты укажите в формате MM/YY")

    month = int(expiry_match.group(1))
    year = 2000 + int(expiry_match.group(2))
    now = datetime.now(timezone.utc)
    if (year, month) < (now.year, now.month):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Срок действия карты уже истек")

    cvc = (payload.payment_cvc or "").strip()
    if re.fullmatch(r"\d{3,4}", cvc) is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="CVC/CVV указан некорректно")

    return normalized_card[-4:], card_brand(normalized_card)


@router.post("/", response_model=TicketCheckoutRead, status_code=status.HTTP_201_CREATED)
async def purchase_ticket(
    payload: TicketPurchase,
    current_user: User | None = Depends(get_optional_active_user),
    db: AsyncSession = Depends(get_session),
) -> TicketCheckoutRead:
    payment_last4, payment_brand = validate_payment_payload(payload)
    fallback_email = current_user.email if current_user is not None else ""
    customer_email = (payload.customer_email or fallback_email).strip().lower()
    profile_name = ""
    if current_user is not None and current_user.profile is not None:
        profile_name = f"{current_user.profile.first_name} {current_user.profile.last_name}".strip()
    customer_name = (payload.customer_name or profile_name).strip()
    customer_phone = (payload.customer_phone or "").strip()
    cardholder = (payload.payment_cardholder or customer_name).strip()

    if not customer_email or not customer_name or not customer_phone or not cardholder:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Для покупки заполните контактные данные")

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
                user_id=current_user.id if current_user is not None else None,
                concert_id=concert.id,
                quantity=payload.quantity,
                customer_email=customer_email,
                customer_name=customer_name,
                customer_phone=customer_phone,
                payment_cardholder=cardholder,
                payment_last4=payment_last4,
                payment_brand=payment_brand,
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
    await deliver_external_notification(
        recipient=customer_email,
        subject="Покупка билета Waves",
        message=(
            f"Вы оформили {payload.quantity} билет(ов) на концерт «{concert.title}» в {concert.city}. "
            f"Площадка: {concert.venue}. Код билета: {ticket.qr_code_data}."
        ),
        metadata={
            "concert_id": str(concert.id),
            "ticket_id": str(ticket.id),
            "quantity": payload.quantity,
            "saved_to_account": current_user is not None,
        },
    )
    ticket_payload = TicketRead.model_validate(ticket, from_attributes=True)
    return TicketCheckoutRead(
        **ticket_payload.model_dump(),
        saved_to_account=current_user is not None,
    )


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
