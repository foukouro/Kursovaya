import asyncio

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.enums import UserRole
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


async def upsert_demo_users() -> None:
    async with AsyncSessionLocal() as session:
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
                continue

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

        await session.commit()


if __name__ == "__main__":
    asyncio.run(upsert_demo_users())
