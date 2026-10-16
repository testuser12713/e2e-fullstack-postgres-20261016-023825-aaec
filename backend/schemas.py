"""Pydantic v2 schemas for the API contract.

These mirror the shared interface field-for-field and are complete: feature
tickets implement behaviour against these models and must not add to them.
"""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import BaseModel, Field, field_serializer


def _iso_z(value: datetime) -> str:
    """Render a datetime as UTC ISO 8601 with a trailing ``Z``."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


class RoomCreate(BaseModel):
    name: str
    seats: int = Field(ge=1)
    equipment: list[str] = Field(default_factory=list)


class RoomUpdate(BaseModel):
    name: str | None = None
    seats: int | None = Field(default=None, ge=1)
    equipment: list[str] | None = None


class RoomOut(BaseModel):
    id: int
    name: str
    seats: int
    equipment: list[str]


class BookingCreate(BaseModel):
    room_id: int
    booked_by: str
    title: str
    start: datetime
    end: datetime


class BookingUpdate(BaseModel):
    room_id: int | None = None
    booked_by: str | None = None
    title: str | None = None
    start: datetime | None = None
    end: datetime | None = None


class BookingOut(BaseModel):
    id: int
    room_id: int
    booked_by: str
    title: str
    start: datetime
    end: datetime

    @field_serializer("start", "end")
    def _serialize_utc(self, value: datetime) -> str:
        return _iso_z(value)


class ErrorInfo(BaseModel):
    code: str
    message: str
    details: list[dict] = Field(default_factory=list)


class ErrorBody(BaseModel):
    error: ErrorInfo
