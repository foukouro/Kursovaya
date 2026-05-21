import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TicketPurchase(BaseModel):
    concert_id: uuid.UUID
    quantity: int = Field(..., gt=0, lt=11)


class TicketConcertInfo(BaseModel):
    concert_id: uuid.UUID
    title: str
    city: str
    venue: str
    date_time: datetime
    band_name: str


class TicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    concert_id: uuid.UUID
    purchase_date: datetime
    quantity: int
    qr_code_data: str
    created_at: datetime
    updated_at: datetime


class TicketWithConcert(TicketRead):
    concert: TicketConcertInfo
