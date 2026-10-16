"""Free-rooms availability search (implemented by the availability ticket).

A room is available for an interval when it has at least ``min_seats`` seats and
no booking overlaps that interval. Two periods overlap when they share more than
a boundary, so a booking that only touches the interval at its start or end does
NOT block the room.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from fastapi.exceptions import RequestValidationError
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from db import get_db
from models import Booking, Room
from schemas import RoomOut

router = APIRouter(prefix="/api/rooms")


def _as_utc(value: datetime) -> datetime:
    """Normalise a query timestamp to UTC, treating a naive value as UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


@router.get("/availability", response_model=list[RoomOut])
def search_availability(
    start: datetime = Query(...),
    end: datetime = Query(...),
    min_seats: int = Query(...),
    session: Session = Depends(get_db),
) -> list[RoomOut]:
    start_utc = _as_utc(start)
    end_utc = _as_utc(end)

    if end_utc <= start_utc:
        raise RequestValidationError(
            [
                {
                    "loc": ["query", "end"],
                    "msg": "Das Ende muss nach dem Start liegen.",
                    "type": "value_error",
                }
            ]
        )

    overlapping = select(Booking.id).where(
        Booking.room_id == Room.id,
        Booking.start < end_utc,
        Booking.end > start_utc,
    )

    statement = (
        select(Room).where(Room.seats >= min_seats).where(~exists(overlapping)).order_by(Room.id)
    )

    return list(session.execute(statement).scalars().all())
