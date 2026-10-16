"""Free-rooms availability search (implemented by the availability ticket)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Query

from errors import NotImplementedStubError
from schemas import RoomOut

router = APIRouter(prefix="/api/rooms")


@router.get("/availability", response_model=list[RoomOut])
def search_availability(
    start: datetime = Query(...),
    end: datetime = Query(...),
    min_seats: int = Query(...),
) -> list[RoomOut]:
    raise NotImplementedStubError("Availability search is implemented by the availability ticket.")
