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


class ModerationStatus(StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class InvitationStatus(StrEnum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class ScheduleEventType(StrEnum):
    concert = "concert"
    rehearsal = "rehearsal"
    meeting = "meeting"
    other = "other"


class ParticipationStatus(StrEnum):
    pending = "pending"
    confirmed = "confirmed"
    declined = "declined"


class NotificationKind(StrEnum):
    moderation = "moderation"
    invitation = "invitation"
    schedule = "schedule"
    system = "system"
