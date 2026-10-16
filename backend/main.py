"""FastAPI application entry point for the room-booking API."""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from db import engine, init_db
from errors import InternalErrorMiddleware, register_exception_handlers
from routers import availability, bookings, room_day, rooms

logger = logging.getLogger(__name__)

DEFAULT_CORS_ORIGINS = "http://localhost:5173"


def get_cors_origins() -> list[str]:
    """Allowed CORS origins from ``CORS_ORIGINS`` (comma-separated).

    Falls back to a working dev default so the service boots even when the
    sibling frontend service has not declared its origin yet.
    """
    raw = os.environ.get("CORS_ORIGINS") or DEFAULT_CORS_ORIGINS
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Touch the configuration once at startup so a missing required value refuses
    # to boot instead of failing on the first request that needs it.
    logger.info("starting API; CORS origins: %s", get_cors_origins())
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Raumbuchung API", version="0.1.0", lifespan=lifespan)

    # Added first so CORS ends up OUTSIDE it: the 500 body must keep its CORS
    # headers (the outer ServerErrorMiddleware would drop them).
    app.add_middleware(InternalErrorMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}

    # Registration order matters: availability must precede rooms, otherwise
    # /api/rooms/availability is swallowed by /api/rooms/{room_id}.
    app.include_router(availability.router)
    app.include_router(room_day.router)
    app.include_router(rooms.router)
    app.include_router(bookings.router)

    return app


app = create_app()
