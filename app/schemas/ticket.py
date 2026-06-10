import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TicketPurchase(BaseModel):
    concert_id: uuid.UUID
    quantity: int = Field(..., gt=0, lt=11)
    customer_email: str | None = Field(default=None, min_length=5, max_length=255)
    customer_name: str | None = Field(default=None, min_length=2, max_length=255)
    customer_phone: str | None = Field(default=None, min_length=7, max_length=40)
    payment_cardholder: str | None = Field(default=None, min_length=2, max_length=255)
    payment_card_number: str | None = Field(default=None, min_length=13, max_length=32)
    payment_expiry: str | None = Field(default=None, min_length=4, max_length=5)
    payment_cvc: str | None = Field(default=None, min_length=3, max_length=4)

    @model_validator(mode="after")
    def validate_checkout_fields(self) -> "TicketPurchase":
        required_fields = {
            "customer_email": self.customer_email,
            "customer_name": self.customer_name,
            "customer_phone": self.customer_phone,
            "payment_cardholder": self.payment_cardholder,
            "payment_card_number": self.payment_card_number,
            "payment_expiry": self.payment_expiry,
            "payment_cvc": self.payment_cvc,
        }
        missing = [name for name, value in required_fields.items() if not value]
        if missing:
            raise ValueError("Для покупки заполните контактные и платежные данные")
        return self


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
    user_id: uuid.UUID | None = None
    concert_id: uuid.UUID
    purchase_date: datetime
    quantity: int
    customer_email: str
    customer_name: str
    customer_phone: str
    payment_cardholder: str
    payment_last4: str
    payment_brand: str
    qr_code_data: str
    created_at: datetime
    updated_at: datetime


class TicketCheckoutRead(TicketRead):
    saved_to_account: bool


class TicketWithConcert(TicketRead):
    concert: TicketConcertInfo
