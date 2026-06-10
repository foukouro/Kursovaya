import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ActionLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    actor_id: uuid.UUID | None = None
    actor_email: str | None = None
    action: str
    target_type: str
    target_id: uuid.UUID | None = None
    summary: str
    created_at: datetime
    updated_at: datetime
