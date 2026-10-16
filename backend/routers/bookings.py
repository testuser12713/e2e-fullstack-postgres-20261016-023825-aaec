"""Booking CRUD routes (implemented by the booking-CRUD ticket)."""

from __future__ import annotations

from datetime import date as date_type

from fastapi import APIRouter

from errors import NotImplementedStubError
from schemas import BookingCreate, BookingOut, BookingUpdate

router = APIRouter(prefix="/api/bookings")


@router.post("", response_model=BookingOut, status_code=201)
def create_booking(payload: BookingCreate) -> BookingOut:
    raise NotImplementedStubError("Creating bookings is implemented by the booking-CRUD ticket.")


@router.get("", response_model=list[BookingOut])
def list_bookings(
    room_id: int | None = None,
    date: date_type | None = None,
) -> list[BookingOut]:
    raise NotImplementedStubError("Listing bookings is implemented by the booking-CRUD ticket.")


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int) -> BookingOut:
    raise NotImplementedStubError("Reading a booking is implemented by the booking-CRUD ticket.")


@router.patch("/{booking_id}", response_model=BookingOut)
def update_booking(booking_id: int, payload: BookingUpdate) -> BookingOut:
    raise NotImplementedStubError("Updating a booking is implemented by the booking-CRUD ticket.")


@router.delete("/{booking_id}", status_code=204)
def delete_booking(booking_id: int) -> None:
    raise NotImplementedStubError("Deleting a booking is implemented by the booking-CRUD ticket.")
