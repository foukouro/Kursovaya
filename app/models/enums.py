from enum import StrEnum


class UserRole(StrEnum):
    guest = "guest"
    registered_user = "registered_user"
    musician = "musician"
    manager = "manager"
    admin = "admin"


class ConcertStatus(StrEnum):
    planned = "planned"
    completed = "completed"
    cancelled = "cancelled"
