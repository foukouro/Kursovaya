import asyncio
import hashlib
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.band import Band, band_musicians
from app.models.concert import Concert
from app.models.enums import ConcertStatus, UserRole
from app.models.ticket import Ticket
from app.models.user import User, UserProfile


DEMO_USERS = [
    {
        "email": "user@example.com",
        "password": "user12345",
        "role": UserRole.registered_user,
        "first_name": "Demo",
        "last_name": "User",
    },
    {
        "email": "admin@example.com",
        "password": "admin12345",
        "role": UserRole.admin,
        "first_name": "Site",
        "last_name": "Admin",
    },
    {
        "email": "manager@example.com",
        "password": "manager12345",
        "role": UserRole.manager,
        "first_name": "Mila",
        "last_name": "Manager",
    },
    {
        "email": "musician@example.com",
        "password": "musician12345",
        "role": UserRole.musician,
        "first_name": "Leo",
        "last_name": "Tempo",
    },
]


DEMO_BANDS = [
    {
        "name": "Waves of Light",
        "genre": "indie",
        "manager_email": "manager@example.com",
        "musicians": ["musician@example.com"],
        "concerts": [
            {
                "title": "Northern Lights Tour",
                "venue": "Adrenal Hall",
                "city": "Москва",
                "days_from_now": 14,
                "tickets_total": 180,
                "tickets_available": 146,
                "price": 3900,
            },
            {
                "title": "Late Night Session",
                "venue": "Mira Club",
                "city": "Санкт-Петербург",
                "days_from_now": 28,
                "tickets_total": 140,
                "tickets_available": 121,
                "price": 3400,
            },
        ],
    },
    {
        "name": "Neon Drift",
        "genre": "rock",
        "manager_email": "manager@example.com",
        "musicians": ["musician@example.com"],
        "concerts": [
            {
                "title": "City Noise",
                "venue": "Izvestia Hall",
                "city": "Москва",
                "days_from_now": 21,
                "tickets_total": 220,
                "tickets_available": 188,
                "price": 4500,
            },
            {
                "title": "Afterglow Live",
                "venue": "A2 Green Concert",
                "city": "Санкт-Петербург",
                "days_from_now": 35,
                "tickets_total": 200,
                "tickets_available": 172,
                "price": 4200,
            },
        ],
    },
    {
        "name": "Velvet Pulse",
        "genre": "electronic",
        "manager_email": "manager@example.com",
        "musicians": ["musician@example.com"],
        "concerts": [
            {
                "title": "Pulse Frequency",
                "venue": "Mumiy Troll Music Bar",
                "city": "Сочи",
                "days_from_now": 18,
                "tickets_total": 160,
                "tickets_available": 132,
                "price": 3600,
            },
            {
                "title": "Waves at Night",
                "venue": "Big Twin Arena",
                "city": "Казань",
                "days_from_now": 42,
                "tickets_total": 240,
                "tickets_available": 201,
                "price": 4100,
            },
        ],
    },
]


def qr_code_for_ticket(email: str, concert_title: str, quantity: int) -> str:
    seed = f"{email}:{concert_title}:{quantity}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:24]


async def upsert_demo_users(session) -> dict[str, User]:
    users: dict[str, User] = {}
    for item in DEMO_USERS:
        result = await session.execute(
            select(User).options(selectinload(User.profile)).where(User.email == item["email"])
        )
        user = result.scalar_one_or_none()
        if user is None:
            user = User(
                email=item["email"],
                hashed_password=get_password_hash(item["password"]),
                role=item["role"],
                is_active=True,
            )
            user.profile = UserProfile(
                first_name=item["first_name"],
                last_name=item["last_name"],
            )
            session.add(user)
        else:
            user.hashed_password = get_password_hash(item["password"])
            user.role = item["role"]
            user.is_active = True
            if user.profile is None:
                user.profile = UserProfile(
                    first_name=item["first_name"],
                    last_name=item["last_name"],
                )
            else:
                user.profile.first_name = item["first_name"]
                user.profile.last_name = item["last_name"]
        users[item["email"]] = user
    await session.flush()
    return users


async def reset_demo_catalog(session, users: dict[str, User]) -> None:
    await session.execute(delete(Ticket))
    await session.execute(delete(Concert))
    await session.execute(delete(band_musicians))
    await session.execute(delete(Band))
    await session.flush()

    now = datetime.now(timezone.utc)
    created_concerts: list[tuple[Concert, str]] = []

    for band_data in DEMO_BANDS:
        band = Band(
            name=band_data["name"],
            genre=band_data["genre"],
            manager_id=users[band_data["manager_email"]].id,
        )
        band.musicians = [users[email] for email in band_data["musicians"]]
        session.add(band)
        await session.flush()

        for concert_data in band_data["concerts"]:
            concert = Concert(
                band_id=band.id,
                title=concert_data["title"],
                venue=concert_data["venue"],
                city=concert_data["city"],
                date_time=now + timedelta(days=concert_data["days_from_now"]),
                tickets_total=concert_data["tickets_total"],
                tickets_available=concert_data["tickets_available"],
                price=concert_data["price"],
                status=ConcertStatus.planned,
            )
            session.add(concert)
            created_concerts.append((concert, band.name))

    await session.flush()

    first_concert = created_concerts[0][0]
    ticket = Ticket(
        user_id=users["user@example.com"].id,
        concert_id=first_concert.id,
        purchase_date=now + timedelta(minutes=5),
        quantity=2,
        qr_code_data=qr_code_for_ticket("user@example.com", first_concert.title, 2),
    )
    session.add(ticket)
    first_concert.tickets_available -= 2


async def seed_demo_content() -> None:
    async with AsyncSessionLocal() as session:
        users = await upsert_demo_users(session)
        await reset_demo_catalog(session, users)
        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed_demo_content())
