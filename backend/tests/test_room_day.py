"""Tests for the room day-booking endpoint.

``GET /api/rooms/{room_id}/bookings?date=YYYY-MM-DD`` returns exactly the
bookings of that room whose period cuts the given UTC day, ascending by start;
an unknown room answers 404, a missing or malformed date 422 — both in the
contract's unified error body. Runs against the real PostgreSQL test database.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

import db as db_module
import models


def _add_room(name: str = "Room A", seats: int = 4) -> int:
    with Session(db_module.engine) as session:
        room = models.Room(name=name, seats=seats, equipment=[])
        session.add(room)
        session.commit()
        return room.id


def _add_booking(
    room_id: int,
    start: datetime,
    end: datetime,
    title: str = "Meeting",
    booked_by: str = "Alice",
) -> int:
    with Session(db_module.engine) as session:
        booking = models.Booking(
            room_id=room_id,
            booked_by=booked_by,
            title=title,
            start=start,
            end=end,
        )
        session.add(booking)
        session.commit()
        return booking.id


def _assert_error_body(response, code: str) -> None:
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    assert isinstance(body["error"]["message"], str)
    assert body["error"]["message"]
    assert isinstance(body["error"]["details"], list)


def test_day_lists_bookings_sorted_by_start(client):
    room_id = _add_room()
    later = _add_booking(
        room_id,
        datetime(2026, 3, 10, 15, 0, tzinfo=UTC),
        datetime(2026, 3, 10, 16, 0, tzinfo=UTC),
        title="Later",
    )
    earlier = _add_booking(
        room_id,
        datetime(2026, 3, 10, 9, 0, tzinfo=UTC),
        datetime(2026, 3, 10, 10, 30, tzinfo=UTC),
        title="Earlier",
    )

    response = client.get(f"/api/rooms/{room_id}/bookings", params={"date": "2026-03-10"})

    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload] == [earlier, later]
    assert payload[0]["start"] == "2026-03-10T09:00:00Z"
    assert payload[0]["title"] == "Earlier"


def test_booking_running_over_midnight_is_included(client):
    room_id = _add_room()
    booking_id = _add_booking(
        room_id,
        datetime(2026, 3, 10, 22, 0, tzinfo=UTC),
        datetime(2026, 3, 11, 2, 0, tzinfo=UTC),
    )

    for day in ("2026-03-10", "2026-03-11"):
        response = client.get(f"/api/rooms/{room_id}/bookings", params={"date": day})
        assert response.status_code == 200
        assert [item["id"] for item in response.json()] == [booking_id]


def test_booking_outside_the_day_is_left_out(client):
    room_id = _add_room()
    _add_booking(
        room_id,
        datetime(2026, 3, 15, 9, 0, tzinfo=UTC),
        datetime(2026, 3, 15, 10, 0, tzinfo=UTC),
    )

    response = client.get(f"/api/rooms/{room_id}/bookings", params={"date": "2026-03-10"})

    assert response.status_code == 200
    assert response.json() == []


def test_booking_touching_the_boundary_does_not_cut_the_day(client):
    room_id = _add_room()
    _add_booking(
        room_id,
        datetime(2026, 3, 10, 22, 0, tzinfo=UTC),
        datetime(2026, 3, 11, 0, 0, tzinfo=UTC),
    )

    response = client.get(f"/api/rooms/{room_id}/bookings", params={"date": "2026-03-11"})

    assert response.status_code == 200
    assert response.json() == []


def test_other_rooms_bookings_are_not_returned(client):
    room_id = _add_room("Room A")
    other_room_id = _add_room("Room B")
    _add_booking(
        other_room_id,
        datetime(2026, 3, 10, 9, 0, tzinfo=UTC),
        datetime(2026, 3, 10, 10, 0, tzinfo=UTC),
    )

    response = client.get(f"/api/rooms/{room_id}/bookings", params={"date": "2026-03-10"})

    assert response.status_code == 200
    assert response.json() == []


def test_unknown_room_answers_404(client):
    response = client.get("/api/rooms/9999/bookings", params={"date": "2026-03-10"})

    assert response.status_code == 404
    _assert_error_body(response, "not_found")


def test_missing_date_answers_422(client):
    room_id = _add_room()

    response = client.get(f"/api/rooms/{room_id}/bookings")

    assert response.status_code == 422
    _assert_error_body(response, "validation_error")


def test_malformed_date_answers_422(client):
    room_id = _add_room()

    response = client.get(f"/api/rooms/{room_id}/bookings", params={"date": "not-a-date"})

    assert response.status_code == 422
    _assert_error_body(response, "validation_error")
