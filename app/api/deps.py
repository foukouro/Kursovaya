import uuid
from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, Path, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.band import Band
from app.models.enums import UserRole
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_db():
        yield session


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_exception
    try:
        parsed_user_id = uuid.UUID(user_id)
    except ValueError as exc:
        raise credentials_exception from exc

    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == parsed_user_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Пользователь заблокирован")
    return current_user


async def get_optional_active_user(
    token: str | None = Depends(optional_oauth2_scheme),
    db: AsyncSession = Depends(get_session),
) -> User | None:
    if not token:
        return None
    user_id = decode_access_token(token)
    if user_id is None:
        return None
    try:
        parsed_user_id = uuid.UUID(user_id)
    except ValueError:
        return None

    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == parsed_user_id)
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return None
    return user


def require_role(user: User, role: UserRole) -> User:
    if user.role != role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
    return user


def require_any_role(user: User, *roles: UserRole) -> User:
    if user.role not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
    return user


async def get_manager(current_user: User = Depends(get_current_active_user)) -> User:
    return require_any_role(current_user, UserRole.manager, UserRole.admin)


async def get_musician(current_user: User = Depends(get_current_active_user)) -> User:
    return require_any_role(current_user, UserRole.musician, UserRole.admin)


async def get_admin(current_user: User = Depends(get_current_active_user)) -> User:
    return require_role(current_user, UserRole.admin)


async def check_band_ownership(
    band_id: uuid.UUID = Path(...),
    current_user: User = Depends(get_manager),
    db: AsyncSession = Depends(get_session),
) -> Band:
    result = await db.execute(
        select(Band).options(selectinload(Band.musicians)).where(Band.id == band_id)
    )
    band = result.scalar_one_or_none()
    if band is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Группа не найдена")
    if band.manager_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Можно управлять только своими группами")
    return band
