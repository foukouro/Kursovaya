from datetime import datetime
from uuid import UUID

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Waves Recommendation Service", version="1.0.0")


class CatalogConcert(BaseModel):
    id: UUID
    band_name: str = Field(..., min_length=1, max_length=255)
    title: str = Field(..., min_length=1, max_length=255)
    city: str = Field(..., min_length=1, max_length=100)
    venue: str = Field(..., min_length=1, max_length=255)
    date_time: datetime
    price: int = Field(..., ge=0)
    tickets_available: int = Field(..., ge=0)
    genre: str = Field(default="unknown", min_length=1, max_length=100)


class RecommendationRequest(BaseModel):
    city: str | None = Field(default=None, max_length=100)
    favorite_genres: list[str] = Field(default_factory=list)
    favorite_artists: list[str] = Field(default_factory=list)
    max_price: int | None = Field(default=None, ge=0)
    concerts: list[CatalogConcert]
    limit: int = Field(default=6, ge=1, le=30)


class RecommendationItem(BaseModel):
    concert: CatalogConcert
    score: float
    reasons: list[str]


def score_concert(concert: CatalogConcert, payload: RecommendationRequest) -> RecommendationItem:
    score = 0.0
    reasons: list[str] = []

    if payload.city and concert.city.casefold() == payload.city.casefold():
        score += 4.0
        reasons.append("same_city")

    genre_matches = {item.casefold() for item in payload.favorite_genres}
    if concert.genre.casefold() in genre_matches:
        score += 3.5
        reasons.append("genre_match")

    artist_matches = {item.casefold() for item in payload.favorite_artists}
    if concert.band_name.casefold() in artist_matches:
        score += 5.0
        reasons.append("artist_match")

    if payload.max_price is not None and concert.price <= payload.max_price:
        score += 2.0
        reasons.append("within_budget")

    if concert.tickets_available > 100:
        score += 1.0
        reasons.append("good_ticket_stock")

    days_until = max((concert.date_time - datetime.now(concert.date_time.tzinfo)).days, 0)
    if days_until <= 14:
        score += 1.5
        reasons.append("soon")

    return RecommendationItem(concert=concert, score=score, reasons=reasons or ["catalog_match"])


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/recommendations/concerts", response_model=list[RecommendationItem])
async def recommend_concerts(payload: RecommendationRequest) -> list[RecommendationItem]:
    ranked = [score_concert(concert, payload) for concert in payload.concerts]
    ranked.sort(
        key=lambda item: (
            item.score,
            item.concert.tickets_available,
            -item.concert.price,
        ),
        reverse=True,
    )
    return ranked[: payload.limit]
