"""Booking CRUD routes implementing the four booking rules.

Rules enforced on create and update:

1. ``end`` must be strictly after ``start`` (else 422).
2. Duration at most 8 hours; exactly 8 hours is allowed (else 422).
3. No overlap with another booking of the SAME room; a mere touching
   (one ends exactly when the other starts) is not an overlap, and bookings
   of different rooms may overlap freely (else 409, clashing period in details).
4. An unknown ``room_id`` answers 404.

A booking that has already started (``start <= now``) may not be changed or
deleted (409); creating a booking with a past start is allowed as long as the
other rules hold. All timestamps are UTC.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from datetime import date as date_type

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from errors import VALIDATION_ERROR, AppError, ConflictError, NotFoundError
from models import Booking, Room
from schemas import BookingCreate, BookingOut, BookingUpdate

router = APIRouter(prefix="/api/bookings")

MAX_DURATION = timedelta(hours=8)


class ValidationError(AppError):
    """A business-rule violation mapped to the contract's 422 body."""

    status_code = 422
    code = VALIDATION_ERROR


def _as_utc(value: datetime) -> datetime:
    """Normalise a datetime to timezone-aware UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _iso_z(value: datetime) -> str:
    """Render a datetime as UTC ISO 8601 with a trailing ``Z``."""
    return _as_utc(value).isoformat().replace("+00:00", "Z")


def _to_out(booking: Booking) -> BookingOut:
    return BookingOut(
        id=booking.id,
        room_id=booking.room_id,
        booked_by=booking.booked_by,
        title=booking.title,
        start=booking.start,
        end=booking.end,
    )


def _validate_period(start: datetime, end: datetime) -> None:
    """Rule 1 and 2: end after start, duration at most 8 hours."""
    if end <= start:
        raise ValidationError("Das Ende muss nach dem Beginn liegen.")
    if end - start > MAX_DURATION:
        raise ValidationError("Eine Buchung darf höchstens 8 Stunden dauern.")


def _find_overlap(
    session: Session,
    room_id: int,
    start: datetime,
    end: datetime,
    exclude_id: int | None = None,
) -> Booking | None:
    """Return a clashing booking of the same room, or ``None``.

    Two periods overlap when the existing start is strictly before the new end
    AND the existing end is strictly after the new start. A mere touching
    boundary therefore does not count.
    """
    stmt = select(Booking).where(
        Booking.room_id == room_id,
        Booking.start < end,
        Booking.end > start,
    )
    if exclude_id is not None:
        stmt = stmt.where(Booking.id != exclude_id)
    return session.scalars(stmt.order_by(Booking.start).limit(1)).first()


def _raise_conflict(clash: Booking) -> None:
    raise ConflictError(
        f"Der Raum ist von {_iso_z(clash.start)} bis {_iso_z(clash.end)} bereits belegt.",
        details=[
            {
                "id": clash.id,
                "room_id": clash.room_id,
                "start": _iso_z(clash.start),
                "end": _iso_z(clash.end),
            }
        ],
    )


def _get_or_404(session: Session, booking_id: int) -> Booking:
    booking = session.get(Booking, booking_id)
    if booking is None:
        raise NotFoundError(f"Buchung {booking_id} wurde nicht gefunden.")
    return booking


def _room_or_404(session: Session, room_id: int) -> Room:
    room = session.get(Room, room_id)
    if room is None:
        raise NotFoundError(f"Raum {room_id} wurde nicht gefunden.")
    return room


@router.post("", response_model=BookingOut, status_code=201)
def create_booking(payload: BookingCreate, session: Session = Depends(get_db)) -> BookingOut:
    start = _as_utc(payload.start)
    end = _as_utc(payload.end)
    _validate_period(start, end)
    _room_or_404(session, payload.room_id)

    clash = _find_overlap(session, payload.room_id, start, end)
    if clash is not None:
        _raise_conflict(clash)

    booking = Booking(
        room_id=payload.room_id,
        booked_by=payload.booked_by,
        title=payload.title,
        start=start,
        end=end,
    )
    session.add(booking)
    session.commit()
    session.refresh(booking)
    return _to_out(booking)


@router.get("", response_model=list[BookingOut])
def list_bookings(
    room_id: int | None = None,
    date: date_type | None = None,
    session: Session = Depends(get_db),
) -> list[BookingOut]:
    stmt = select(Booking)
    if room_id is not None:
        stmt = stmt.where(Booking.room_id == room_id)
    if date is not None:
        day_start = datetime(date.year, date.month, date.day, tzinfo=UTC)
        day_end = day_start + timedelta(days=1)
        stmt = stmt.where(Booking.start < day_end, Booking.end > day_start)
    stmt = stmt.order_by(Booking.start)
    return [_to_out(booking) for booking in session.scalars(stmt)]


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int, session: Session = Depends(get_db)) -> BookingOut:
    return _to_out(_get_or_404(session, booking_id))


@router.patch("/{booking_id}", response_model=BookingOut)
def update_booking(
    booking_id: int,
    payload: BookingUpdate,
    session: Session = Depends(get_db),
) -> BookingOut:
    booking = _get_or_404(session, booking_id)

    if _as_utc(booking.start) <= datetime.now(UTC):
        raise ConflictError("Die Buchung hat bereits begonnen und kann nicht mehr geändert werden.")

    data = payload.model_dump(exclude_unset=True, exclude_none=True)
    room_id = data.get("room_id", booking.room_id)
    booked_by = data.get("booked_by", booking.booked_by)
    title = data.get("title", booking.title)
    start = _as_utc(data["start"]) if "start" in data else _as_utc(booking.start)
    end = _as_utc(data["end"]) if "end" in data else _as_utc(booking.end)

    _validate_period(start, end)
    if "room_id" in data:
        _room_or_404(session, room_id)

    clash = _find_overlap(session, room_id, start, end, exclude_id=booking.id)
    if clash is not None:
        _raise_conflict(clash)

    booking.room_id = room_id
    booking.booked_by = booked_by
    booking.title = title
    booking.start = start
    booking.end = end
    session.commit()
    session.refresh(booking)
    return _to_out(booking)


@router.delete("/{booking_id}", status_code=204)
def delete_booking(booking_id: int, session: Session = Depends(get_db)) -> None:
    booking = _get_or_404(session, booking_id)

    if _as_utc(booking.start) <= datetime.now(UTC):
        raise ConflictError("Die Buchung hat bereits begonnen und kann nicht mehr gelöscht werden.")

    session.delete(booking)
    session.commit()
