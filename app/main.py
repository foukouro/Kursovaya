from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)
app.include_router(api_router, prefix=settings.API_V1_STR)
app.mount("/static", StaticFiles(directory="app/static"), name="static")


NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}


@app.middleware("http")
async def disable_cache_for_frontend(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path in {"/", "/concerts", "/cabinet"} or (
        path.startswith("/static/") and path.endswith((".js", ".css", ".html"))
    ):
        response.headers.update(NO_CACHE_HEADERS)
    return response


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
async def frontend() -> FileResponse:
    return FileResponse("app/static/index.html", headers=NO_CACHE_HEADERS)


@app.get("/concerts", include_in_schema=False)
async def concerts_page() -> FileResponse:
    return FileResponse("app/static/concerts.html", headers=NO_CACHE_HEADERS)


@app.get("/cabinet", include_in_schema=False)
async def cabinet_page() -> FileResponse:
    return FileResponse("app/static/cabinet.html", headers=NO_CACHE_HEADERS)
