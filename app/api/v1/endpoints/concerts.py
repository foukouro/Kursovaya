import uuid
import json
import re
from html import unescape
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_manager, get_musician, get_session
from app.core.config import settings
from app.models.band import Band, band_musicians
from app.models.concert import Concert
from app.models.enums import ConcertStatus
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.concert import ConcertRead, ConcertSearch, ConcertUpdate, ExternalConcert, MyConcert

router = APIRouter()

POSTER_POOL = (
    "/static/assets/poster-lowve.svg",
    "/static/assets/poster-mynhon.svg",
    "/static/assets/poster-queen.svg",
    "/static/assets/poster-pyro.svg",
)

KUDAGO_CITY_SLUGS = {
    "москва": "msk",
    "санкт-петербург": "spb",
    "петербург": "spb",
    "spb": "spb",
    "мск": "msk",
    "екатеринбург": "ekb",
    "казань": "kzn",
    "нижний новгород": "nnv",
    "samara": "sam",
    "самара": "sam",
    "краснодар": "kda",
    "сочи": "sochi",
    "уфа": "ufa",
    "красноярск": "kya",
}

GENRE_ALIASES = {
    "rock": "рок",
    "pop": "поп",
    "indie": "инди",
    "metal": "метал",
    "jazz": "джаз",
    "electronic": "электрон",
    "hip-hop": "хип-хоп",
    "hip hop": "хип-хоп",
    "rap": "рэп",
}

TM_SEARCH_URL = "https://www.ticketmaster.com/search"
KUDAGO_EVENTS_URL = "https://kudago.com/public-api/v1.4/events/"


def poster_for_band(name: str) -> str:
    return POSTER_POOL[sum(ord(char) for char in name.lower()) % len(POSTER_POOL)]


def normalize_query_value(value: str) -> str:
    return value.strip().lower().replace("ё", "е")


def to_utc_timestamp(value: datetime | None, default: int) -> int:
    if value is None:
        return default
    normalized = value
    if normalized.tzinfo is None:
        normalized = normalized.replace(tzinfo=timezone.utc)
    return int(normalized.timestamp())


def first_future_kudago_date(dates: list[dict], since_ts: int, until_ts: int | None) -> datetime | None:
    future_starts: list[int] = []
    for item in dates:
        start_ts = item.get("start")
        if not isinstance(start_ts, int):
            continue
        end_ts = item.get("end") if isinstance(item.get("end"), int) else start_ts
        if start_ts >= since_ts and (until_ts is None or start_ts <= until_ts or end_ts >= since_ts):
            future_starts.append(start_ts)
    if not future_starts:
        return None
    return datetime.fromtimestamp(min(future_starts), tz=timezone.utc)


def resolve_kudago_city_slug(city: str) -> str | None:
    return KUDAGO_CITY_SLUGS.get(normalize_query_value(city))


async def search_kudago_events(
    city: str,
    limit: int,
    date_from: datetime | None,
    date_to: datetime | None,
) -> list[ExternalConcert]:
    city_slug = resolve_kudago_city_slug(city)
    if city_slug is None:
        return []

    since_ts = to_utc_timestamp(date_from, int(datetime.now(timezone.utc).timestamp()))
    until_ts = to_utc_timestamp(date_to, since_ts + 60 * 60 * 24 * 365)
    params = {
        "lang": "ru",
        "location": city_slug,
        "categories": "concert",
        "page_size": str(min(max(limit * 3, 10), 50)),
        "actual_since": str(since_ts),
        "actual_until": str(until_ts),
        "expand": "place",
        "fields": "id,title,dates,place,site_url,images,price",
    }

    async with httpx.AsyncClient(timeout=12, headers={"User-Agent": "Mozilla/5.0 Waves/1.0"}) as client:
        response = await client.get(KUDAGO_EVENTS_URL, params=params)
    if response.status_code >= 400:
        return []

    payload = response.json()
    results: list[ExternalConcert] = []
    for event in payload.get("results", []):
        title = event.get("title", "Concert")
        venue = event.get("place", {}) or {}
        venue_name = venue.get("title") or venue.get("name") or venue.get("address") or "Venue TBA"
        city_name = city
        images = event.get("images") or []
        poster_url = images[0].get("image") if images else None
        date_time = first_future_kudago_date(event.get("dates", []), since_ts, until_ts)
        results.append(
            ExternalConcert(
                source="KudaGo",
                source_url=event.get("site_url", ""),
                artist_name=title,
                title=title,
                city=city_name,
                venue=venue_name,
                date_time=date_time,
                poster_url=poster_url,
            )
        )
        if len(results) >= limit:
            break
    return results


async def search_ticketmaster_web(
    city: str,
    genre: str | None,
    artist: str | None,
    limit: int,
) -> list[ExternalConcert]:
    keyword = " ".join(value for value in (artist, genre, city, "concert") if value).strip()
    if not keyword:
        return []

    async with httpx.AsyncClient(timeout=15, headers={"User-Agent": "Mozilla/5.0 Waves/1.0"}) as client:
        response = await client.get(TM_SEARCH_URL, params={"q": keyword}, follow_redirects=True)
    if response.status_code >= 400:
        return []

    match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', response.text)
    if not match:
        return []

    payload = json.loads(unescape(match.group(1)))
    queries = payload.get("props", {}).get("pageProps", {}).get("initialReduxState", {}).get("api", {}).get("queries", {})
    events: list[dict] = []
    for key, value in queries.items():
        if key.startswith("searchEvents"):
            events = value.get("data", {}).get("events", [])
            break

    results: list[ExternalConcert] = []
    for event in events:
        venue = event.get("venue", {}) or {}
        venue_city = venue.get("city", "")
        title = event.get("title") or "Concert"
        source_text = " ".join(
            str(part)
            for part in (
                title,
                venue.get("name", ""),
                venue_city,
                artist or "",
                genre or "",
            )
            if part
        )
        if city and normalize_query_value(city) not in normalize_query_value(source_text):
            continue

        start_value = event.get("dates", {}).get("startDate")
        date_time = datetime.fromisoformat(start_value.replace("Z", "+00:00")) if start_value else None
        results.append(
            ExternalConcert(
                source="Ticketmaster",
                source_url=event.get("url", ""),
                artist_name=artist or title,
                title=title,
                city=venue_city or city,
                venue=venue.get("name", "Venue TBA"),
                date_time=date_time,
                poster_url=venue.get("imageUrl"),
            )
        )
        if len(results) >= limit:
            break
    return results


@router.get("/", response_model=list[ConcertSearch])
async def search_concerts(
    city: str = Query(..., min_length=1),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    genre: str | None = None,
    artist: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_session),
) -> list[ConcertSearch]:
    now = datetime.now(timezone.utc)
    conditions = [
        Concert.city.ilike(f"%{city}%"),
        Concert.date_time > now,
        Concert.status == ConcertStatus.planned,
        Concert.tickets_available > 0,
    ]
    if date_from is not None:
        conditions.append(Concert.date_time >= date_from)
    if date_to is not None:
        conditions.append(Concert.date_time <= date_to)
    if genre is not None:
        conditions.append(Band.genre.ilike(f"%{genre}%"))
    if artist is not None:
        conditions.append(Band.name.ilike(f"%{artist}%"))

    statement = (
        select(Concert, Band.name.label("band_name"))
        .join(Band, Concert.band_id == Band.id)
        .where(and_(*conditions))
        .order_by(Concert.date_time.asc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(statement)).all()
    return [
        ConcertSearch(
            id=concert.id,
            band_name=band_name,
            title=concert.title,
            city=concert.city,
            venue=concert.venue,
            date_time=concert.date_time,
            price=concert.price,
            tickets_available=concert.tickets_available,
            poster_url=poster_for_band(band_name),
        )
        for concert, band_name in rows
    ]


@router.get("/external", response_model=list[ExternalConcert])
async def search_external_concerts(
    city: str = Query(..., min_length=1),
    genre: str | None = None,
    artist: str | None = None,
    limit: int = Query(8, ge=1, le=20),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[ExternalConcert]:
    concerts: list[ExternalConcert] = []
    city_slug = resolve_kudago_city_slug(city)
    preferred_tm = bool(artist or genre)

    if preferred_tm:
        concerts.extend(await search_ticketmaster_web(city, genre, artist, limit))
        if not concerts:
            concerts.extend(await search_ticketmaster_web(city, None, None, limit))
    if len(concerts) < limit and city_slug is not None:
        concerts.extend(await search_kudago_events(city, limit - len(concerts), date_from, date_to))

    if len(concerts) < limit and settings.TICKETMASTER_API_KEY:
        keyword = " ".join(value for value in (artist, genre, city) if value)
        params = {
            "apikey": settings.TICKETMASTER_API_KEY,
            "classificationName": "music",
            "city": city,
            "size": str(limit - len(concerts)),
            "sort": "date,asc",
        }
        if keyword:
            params["keyword"] = keyword

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get("https://app.ticketmaster.com/discovery/v2/events.json", params=params)
        if response.status_code < 400:
            payload = response.json()
            events = payload.get("_embedded", {}).get("events", [])
            for event in events:
                venue = event.get("_embedded", {}).get("venues", [{}])[0]
                dates = event.get("dates", {}).get("start", {})
                date_value = dates.get("dateTime") or dates.get("localDate")
                parsed_date = datetime.fromisoformat(date_value.replace("Z", "+00:00")) if date_value else None
                images = sorted(event.get("images", []), key=lambda image: image.get("width", 0), reverse=True)
                attractions = event.get("_embedded", {}).get("attractions", [])
                artist_name = attractions[0].get("name") if attractions else event.get("name", "Concert")
                concerts.append(
                    ExternalConcert(
                        source="Ticketmaster",
                        source_url=event.get("url", ""),
                        artist_name=artist_name,
                        title=event.get("name", artist_name),
                        city=venue.get("city", {}).get("name", city),
                        venue=venue.get("name", "Venue TBA"),
                        date_time=parsed_date,
                        poster_url=images[0].get("url") if images else None,
                    )
                )
                if len(concerts) >= limit:
                    break

    if len(concerts) < limit and (not settings.TICKETMASTER_API_KEY or not preferred_tm):
        concerts.extend(await search_ticketmaster_web(city, genre, artist, limit - len(concerts)))

    deduped: list[ExternalConcert] = []
    seen: set[tuple[str, str, str]] = set()
    for concert in concerts:
        signature = (concert.source, concert.title, concert.source_url)
        if signature in seen:
            continue
        seen.add(signature)
        deduped.append(concert)
        if len(deduped) >= limit:
            break
    return deduped


@router.get("/my", response_model=list[MyConcert])
async def read_my_concerts(
    current_user: User = Depends(get_musician),
    db: AsyncSession = Depends(get_session),
) -> list[MyConcert]:
    statement = (
        select(Concert, Band.name.label("band_name"))
        .join(Band, Concert.band_id == Band.id)
        .join(band_musicians, band_musicians.c.band_id == Band.id)
        .where(band_musicians.c.user_id == current_user.id)
        .order_by(Concert.date_time.asc())
    )
    rows = (await db.execute(statement)).all()
    return [
        MyConcert(**ConcertRead.model_validate(concert, from_attributes=True).model_dump(), band_name=band_name)
        for concert, band_name in rows
    ]


async def get_manager_concert(
    concert_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> Concert:
    statement = (
        select(Concert)
        .options(selectinload(Concert.band))
        .join(Band, Concert.band_id == Band.id)
        .where(Concert.id == concert_id)
    )
    concert = (await db.execute(statement)).scalar_one_or_none()
    if concert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Концерт не найден")
    if concert.band.manager_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Можно управлять только своими концертами")
    return concert


@router.put("/{concert_id}", response_model=ConcertRead)
async def update_concert(
    concert_id: uuid.UUID,
    payload: ConcertUpdate,
    current_user: User = Depends(get_manager),
    db: AsyncSession = Depends(get_session),
) -> Concert:
    concert = await get_manager_concert(concert_id, current_user, db)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(concert, field, value)
    if concert.tickets_available > concert.tickets_total:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="tickets_available не может быть больше tickets_total",
        )
    await db.commit()
    await db.refresh(concert)
    return concert


@router.delete("/{concert_id}", response_model=MessageResponse)
async def cancel_concert(
    concert_id: uuid.UUID,
    current_user: User = Depends(get_manager),
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    concert = await get_manager_concert(concert_id, current_user, db)
    concert.status = ConcertStatus.cancelled
    await db.commit()
    return MessageResponse(detail="Концерт отменен")
