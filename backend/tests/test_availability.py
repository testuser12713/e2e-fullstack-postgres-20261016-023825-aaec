"""Tests for the free-rooms availability search.

Run against the real PostgreSQL test database through the FastAPI TestClient.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

import db as db_module
import models


def _add_room(name: str, seats: int, equipment: list[str] | None = None) -> int:
    with Session(db_module.engine) as session:
        room = models.Room(name=name, seats=seats, equipment=equipment or [])
        session.add(room)
        session.commit()
        return room.id


def _add_booking(room_id: int, start: datetime, end: datetime) -> None:
    with Session(db_module.engine) as session:
        session.add(
            models.Booking(
                room_id=room_id,
                booked_by="test",
                title="Test booking",
                start=start,
                end=end,
            )
        )
        session.commit()


def test_availability_filters_by_seat_count(client):
    small = _add_room("Small", seats=2)
    large = _add_room("Large", seats=10)

    start = datetime(2030, 1, 1, 9, tzinfo=UTC)
    end = datetime(2030, 1, 1, 10, tzinfo=UTC)
    response = client.get(
        "/api/rooms/availability",
        params={"start": start.isoformat(), "end": end.isoformat(), "min_seats": 5},
    )

    assert response.status_code == 200
    ids = [room["id"] for room in response.json()]
    assert large in ids
    assert small not in ids
    assert all(room["seats"] >= 5 for room in response.json())


def test_booked_room_is_excluded(client):
    free = _add_room("Free", seats=8)
    booked = _add_room("Booked", seats=8)

    _add_booking(
        booked,
        datetime(2030, 1, 1, 9, 30, tzinfo=UTC),
        datetime(2030, 1, 1, 10, 30, tzinfo=UTC),
    )

    response = client.get(
        "/api/rooms/availability",
        params={
            "start": datetime(2030, 1, 1, 9, tzinfo=UTC).isoformat(),
            "end": datetime(2030, 1, 1, 11, tzinfo=UTC).isoformat(),
            "min_seats": 1,
        },
    )

    assert response.status_code == 200
    ids = {room["id"] for room in response.json()}
    assert free in ids
    assert booked not in ids


def test_touching_boundary_does_not_block(client):
    room = _add_room("Touching", seats=4)
    # Booking ends exactly when the searched interval starts.
    _add_booking(
        room,
        datetime(2030, 1, 1, 8, tzinfo=UTC),
        datetime(2030, 1, 1, 9, tzinfo=UTC),
    )
    # Booking starts exactly when the searched interval ends.
    _add_booking(
        room,
        datetime(2030, 1, 1, 10, tzinfo=UTC),
        datetime(2030, 1, 1, 11, tzinfo=UTC),
    )

    response = client.get(
        "/api/rooms/availability",
        params={
            "start": datetime(2030, 1, 1, 9, tzinfo=UTC).isoformat(),
            "end": datetime(2030, 1, 1, 10, tzinfo=UTC).isoformat(),
            "min_seats": 1,
        },
    )

    assert response.status_code == 200
    ids = {room["id"] for room in response.json()}
    assert room in ids


def test_missing_parameters_answer_422_in_contract_body(client):
    response = client.get("/api/rooms/availability")
    assert response.status_code == 422
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["message"]
    assert isinstance(body["error"]["details"], list)


def test_malformed_timestamp_answers_422(client):
    response = client.get(
        "/api/rooms/availability",
        params={"start": "not-a-date", "end": "2030-01-01T10:00:00Z", "min_seats": 1},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_end_not_after_start_answers_422(client):
    start = datetime(2030, 1, 1, 10, tzinfo=UTC)
    end = start - timedelta(hours=1)
    response = client.get(
        "/api/rooms/availability",
        params={"start": start.isoformat(), "end": end.isoformat(), "min_seats": 1},
    )
    assert response.status_code == 422
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["message"]
