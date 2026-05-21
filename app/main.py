from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)
app.include_router(api_router, prefix=settings.API_V1_STR)
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
async def frontend() -> FileResponse:
    return FileResponse("app/static/index.html")


@app.get("/concerts", include_in_schema=False)
async def concerts_page() -> FileResponse:
    return FileResponse("app/static/concerts.html")


@app.get("/cabinet", include_in_schema=False)
async def cabinet_page() -> FileResponse:
    return FileResponse("app/static/cabinet.html")
