"""Day-booking routes for a single room (implemented by the room-day ticket)."""

from __future__ import annotations

from datetime import date as date_type

from fastapi import APIRouter, Query

from errors import NotImplementedStubError
from schemas import BookingOut

router = APIRouter(prefix="/api/rooms")


@router.get("/{room_id}/bookings", response_model=list[BookingOut])
def room_bookings(room_id: int, date: date_type = Query(...)) -> list[BookingOut]:
    raise NotImplementedStubError("The room day view is implemented by the room-day ticket.")
