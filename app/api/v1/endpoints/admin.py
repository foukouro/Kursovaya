import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_admin, get_session
from app.models.band import Band
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.band import BandCreate, BandRead
from app.schemas.user import UserRead, UserRoleUpdate

router = APIRouter(dependencies=[Depends(get_admin)])


@router.get("/users", response_model=list[UserRead])
async def read_users(
    role: UserRole | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_session),
) -> list[User]:
    statement = (
        select(User)
        .options(selectinload(User.profile))
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if role is not None:
        statement = statement.where(User.role == role)
    return list((await db.execute(statement)).scalars().all())


@router.put("/users/{user_id}/role", response_model=UserRead)
async def update_user_role(
    user_id: uuid.UUID,
    payload: UserRoleUpdate,
    db: AsyncSession = Depends(get_session),
) -> User:
    user = (
        await db.execute(select(User).options(selectinload(User.profile)).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/bands", response_model=BandRead, status_code=status.HTTP_201_CREATED)
async def create_band(payload: BandCreate, db: AsyncSession = Depends(get_session)) -> Band:
    manager = (await db.execute(select(User).where(User.id == payload.manager_id))).scalar_one_or_none()
    if manager is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Менеджер не найден")
    if manager.role != UserRole.manager:
        manager.role = UserRole.manager

    existing_band = (await db.execute(select(Band).where(Band.name == payload.name))).scalar_one_or_none()
    if existing_band is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Группа с таким именем уже существует")

    band = Band(name=payload.name, genre=payload.genre, manager_id=manager.id)
    db.add(band)
    await db.commit()
    await db.refresh(band)
    return band
