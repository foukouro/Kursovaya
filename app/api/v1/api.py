from fastapi import APIRouter

from app.api.v1.endpoints import admin, auth, bands, concerts, tickets, users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(concerts.router, prefix="/concerts", tags=["concerts"])
api_router.include_router(tickets.router, prefix="/tickets", tags=["tickets"])
api_router.include_router(bands.router, prefix="/bands", tags=["bands"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
