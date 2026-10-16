"""Day-booking routes for a single room.

``GET /api/rooms/{room_id}/bookings?date=YYYY-MM-DD`` lists every booking of
that room whose period cuts the given UTC day, ascending by start. An unknown
room answers 404, a missing or malformed date is rejected by FastAPI with a 422
in the unified error body.
"""

from __future__ import annotations

from datetime import UTC, datetime, time, timedelta
from datetime import date as date_type

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from errors import NotFoundError
from models import Booking, Room
from schemas import BookingOut

router = APIRouter(prefix="/api/rooms")


@router.get("/{room_id}/bookings", response_model=list[BookingOut])
def room_bookings(
    room_id: int,
    date: date_type = Query(...),
    db: Session = Depends(get_db),
) -> list[BookingOut]:
    """Return the room's bookings that cut the UTC ``date``, ordered by start."""
    room = db.get(Room, room_id)
    if room is None:
        raise NotFoundError(f"Raum {room_id} wurde nicht gefunden.")

    day_start = datetime.combine(date, time.min, tzinfo=UTC)
    day_end = day_start + timedelta(days=1)

    statement = (
        select(Booking)
        .where(
            Booking.room_id == room_id,
            Booking.start < day_end,
            Booking.end > day_start,
        )
        .order_by(Booking.start)
    )
    bookings = db.scalars(statement).all()
    return [BookingOut.model_validate(booking, from_attributes=True) for booking in bookings]
