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


BAND_BLUEPRINTS = [
    ("Waves of Light", "indie"),
    ("Neon Drift", "rock"),
    ("Velvet Pulse", "electronic"),
    ("Silver Avenue", "pop"),
    ("Echo Harbour", "indie"),
    ("Polar Sunset", "rock"),
    ("Static Bloom", "alternative"),
    ("Golden District", "pop"),
    ("Midnight Metro", "electronic"),
    ("Crimson Avenue", "metal"),
    ("North Signal", "jazz"),
    ("Blue Carousel", "indie"),
    ("Paper Satellites", "electronic"),
    ("Radio Garden", "pop"),
    ("Voltage Hearts", "rock"),
    ("Luna Harbor", "indie"),
    ("Stereo Veil", "electronic"),
    ("Amber Skyline", "pop"),
]


CITY_VENUES: dict[str, list[str]] = {
    "Москва": ["Adrenal Hall", "VK Stadium", "MTC Live Hall", "1930 Moscow", "Pravda Club"],
    "Санкт-Петербург": ["A2 Green Concert", "Aurora Hall", "Sound Club", "MTC Hall SPB", "Factory 3"],
    "Казань": ["Big Twin Arena", "Werk", "Reborn Hall", "Volga Stage", "Uram Space"],
    "Сочи": ["Mumiy Troll Music Bar", "Skypark Arena", "Sea Breeze Hall", "Port Stage"],
    "Екатеринбург": ["Tele Club", "Dom Pechati", "Center Club", "Manege Hall"],
    "Нижний Новгород": ["Milo Concert Hall", "Nebo Stage", "Factory NN", "Volna Hall"],
    "Самара": ["Zvezda Hall", "Volga Music Hall", "Signal Club", "Raketa Space"],
    "Краснодар": ["Arena Hall", "Sgt. Pepper's Bar", "Dom Event Hall", "South Stage"],
    "Уфа": ["Tinkoff Hall", "Art Square Hall", "Bashkir Arena", "Cloud Room"],
    "Красноярск": ["Era Hall", "Yenisey Stage", "Bridge Club", "North Dome"],
    "Новосибирск": ["Podzemka", "Opera Sky Hall", "Sibir Arena", "Loft Park"],
}


SHOW_TITLES = [
    "Northern Lights Tour",
    "City Noise",
    "Afterglow Live",
    "Pulse Frequency",
    "Waves at Night",
    "Midnight Broadcast",
    "Open Season",
    "Gravity Session",
    "Electric Stories",
    "Live in Motion",
    "Satellite Hearts",
    "Ocean of Signals",
    "Night Transit",
    "Velvet City",
    "Parallel Lines",
    "Aerial Dreams",
]


PRICE_STEPS = [2800, 3200, 3500, 3900, 4200, 4500, 4800, 5200]
TICKET_TOTALS = [120, 140, 160, 180, 200, 220, 240, 260, 300]


def qr_code_for_ticket(email: str, concert_title: str, quantity: int) -> str:
    seed = f"{email}:{concert_title}:{quantity}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:24]


def generated_band_catalog() -> list[dict]:
    catalog: list[dict] = []
    cities = list(CITY_VENUES.keys())

    for band_index, (band_name, genre) in enumerate(BAND_BLUEPRINTS):
        concerts: list[dict] = []
        for concert_index in range(8):
            city = cities[(band_index + concert_index) % len(cities)]
            venue_list = CITY_VENUES[city]
            venue = venue_list[(band_index * 2 + concert_index) % len(venue_list)]
            title = SHOW_TITLES[(band_index + concert_index) % len(SHOW_TITLES)]
            days_from_now = 7 + concert_index * 8 + band_index
            tickets_total = TICKET_TOTALS[(band_index + concert_index) % len(TICKET_TOTALS)]
            sold_tickets = 12 + ((band_index * 11 + concert_index * 9) % max(tickets_total // 2, 20))
            concerts.append(
                {
                    "title": f"{title} {band_name}",
                    "venue": venue,
                    "city": city,
                    "days_from_now": days_from_now,
                    "tickets_total": tickets_total,
                    "tickets_available": tickets_total - sold_tickets,
                    "price": PRICE_STEPS[(band_index + concert_index) % len(PRICE_STEPS)],
                    "status": ConcertStatus.planned,
                }
            )

        # Add two historical entries per band so the database contains richer data.
        for archive_index in range(2):
            city = cities[(band_index + archive_index + 3) % len(cities)]
            venue_list = CITY_VENUES[city]
            venue = venue_list[(band_index + archive_index) % len(venue_list)]
            title = SHOW_TITLES[(band_index + archive_index + 5) % len(SHOW_TITLES)]
            tickets_total = TICKET_TOTALS[(band_index + archive_index + 2) % len(TICKET_TOTALS)]
            concerts.append(
                {
                    "title": f"{title} Archive {band_name}",
                    "venue": venue,
                    "city": city,
                    "days_from_now": -(35 + band_index * 2 + archive_index * 14),
                    "tickets_total": tickets_total,
                    "tickets_available": 0,
                    "price": PRICE_STEPS[(band_index + archive_index + 2) % len(PRICE_STEPS)],
                    "status": ConcertStatus.completed if archive_index == 0 else ConcertStatus.cancelled,
                }
            )

        catalog.append(
            {
                "name": band_name,
                "genre": genre,
                "manager_email": "manager@example.com",
                "musicians": ["musician@example.com"],
                "concerts": concerts,
            }
        )

    return catalog


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
    created_concerts: list[Concert] = []

    for band_data in generated_band_catalog():
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
                status=concert_data["status"],
            )
            session.add(concert)
            created_concerts.append(concert)

    await session.flush()

    for offset, quantity in ((0, 2), (5, 1), (12, 3), (20, 2)):
        concert = created_concerts[offset]
        if concert.status != ConcertStatus.planned or concert.tickets_available < quantity:
            continue
        ticket = Ticket(
            user_id=users["user@example.com"].id,
            concert_id=concert.id,
            purchase_date=now + timedelta(minutes=5 + offset),
            quantity=quantity,
            qr_code_data=qr_code_for_ticket("user@example.com", concert.title, quantity),
        )
        session.add(ticket)
        concert.tickets_available -= quantity


async def seed_demo_content() -> None:
    async with AsyncSessionLocal() as session:
        users = await upsert_demo_users(session)
        await reset_demo_catalog(session, users)
        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed_demo_content())
