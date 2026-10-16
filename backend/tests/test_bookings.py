"""Tests for booking CRUD and the four booking rules.

They run against the real PostgreSQL database configured by the shared
``conftest`` fixtures (``TEST_DATABASE_URL`` falling back to ``DATABASE_URL``).
Rooms are created directly through the ORM because the room-CRUD endpoint is
another ticket's slice.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from sqlalchemy.orm import Session

import db as db_module
import models

BASE = datetime(2030, 1, 1, 10, 0, tzinfo=UTC)


def _iso(year: int, month: int, day: int, hour: int, minute: int = 0) -> str:
    return datetime(year, month, day, hour, minute, tzinfo=UTC).isoformat().replace("+00:00", "Z")


@pytest.fixture()
def rooms() -> Iterator[dict[str, int]]:
    with Session(db_module.engine) as session:
        first = models.Room(name="Alpha", seats=4, equipment=["beamer"])
        second = models.Room(name="Beta", seats=8, equipment=["whiteboard"])
        session.add_all([first, second])
        session.commit()
        ids = {"alpha": first.id, "beta": second.id}
    yield ids


def _create(client, room_id: int, start: str, end: str, **overrides):
    payload = {
        "room_id": room_id,
        "booked_by": "Alice",
        "title": "Standup",
        "start": start,
        "end": end,
    }
    payload.update(overrides)
    return client.post("/api/bookings", json=payload)


def _assert_error_body(response, code: str) -> None:
    body = response.json()
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message", "details"}
    assert body["error"]["code"] == code
    assert isinstance(body["error"]["message"], str)
    assert body["error"]["message"]
    assert isinstance(body["error"]["details"], list)


# --- AC-06: CRUD -----------------------------------------------------------


def test_create_booking_returns_201_with_id(client, rooms):
    response = _create(client, rooms["alpha"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 11))
    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 1
    assert body["room_id"] == rooms["alpha"]
    assert body["booked_by"] == "Alice"
    assert body["title"] == "Standup"
    assert body["start"] == "2030-01-01T10:00:00Z"
    assert body["end"] == "2030-01-01T11:00:00Z"


def test_get_booking_by_id_and_unknown_answers_404(client, rooms):
    created = _create(client, rooms["alpha"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 11))
    booking_id = created.json()["id"]

    found = client.get(f"/api/bookings/{booking_id}")
    assert found.status_code == 200
    assert found.json()["id"] == booking_id

    missing = client.get("/api/bookings/999999")
    assert missing.status_code == 404
    _assert_error_body(missing, "not_found")


def test_list_bookings_filters_by_room_and_date(client, rooms):
    _create(client, rooms["alpha"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 11))
    _create(client, rooms["beta"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 11))
    _create(client, rooms["alpha"], _iso(2030, 1, 3, 10), _iso(2030, 1, 3, 11))

    everything = client.get("/api/bookings")
    assert everything.status_code == 200
    assert len(everything.json()) == 3

    by_room = client.get("/api/bookings", params={"room_id": rooms["alpha"]})
    assert [b["room_id"] for b in by_room.json()] == [rooms["alpha"], rooms["alpha"]]

    by_day = client.get("/api/bookings", params={"date": "2030-01-01"})
    assert len(by_day.json()) == 2

    empty_day = client.get("/api/bookings", params={"date": "2030-01-02"})
    assert empty_day.json() == []


def test_list_bookings_date_cuts_utc_day(client, rooms):
    _create(client, rooms["alpha"], _iso(2030, 1, 1, 23), _iso(2030, 1, 2, 2))

    first_day = client.get("/api/bookings", params={"date": "2030-01-01"}).json()
    second_day = client.get("/api/bookings", params={"date": "2030-01-02"}).json()
    before = client.get("/api/bookings", params={"date": "2029-12-31"}).json()

    assert len(first_day) == 1
    assert len(second_day) == 1
    assert before == []


# --- AC-07: end after start ------------------------------------------------


def test_end_before_or_equal_start_answers_422(client, rooms):
    before = _create(client, rooms["alpha"], _iso(2030, 1, 1, 11), _iso(2030, 1, 1, 10))
    assert before.status_code == 422
    _assert_error_body(before, "validation_error")

    equal = _create(client, rooms["alpha"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 10))
    assert equal.status_code == 422
    _assert_error_body(equal, "validation_error")


# --- AC-08: maximum duration ------------------------------------------------


def test_duration_above_eight_hours_answers_422_and_exactly_eight_is_allowed(client, rooms):
    too_long = _create(client, rooms["alpha"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 18, 1))
    assert too_long.status_code == 422
    _assert_error_body(too_long, "validation_error")

    exactly_eight = _create(client, rooms["alpha"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 18))
    assert exactly_eight.status_code == 201


# --- AC-09: overlap ---------------------------------------------------------


def test_overlapping_same_room_answers_409_with_clashing_period(client, rooms):
    _create(client, rooms["alpha"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 11))

    response = _create(client, rooms["alpha"], _iso(2030, 1, 1, 10, 30), _iso(2030, 1, 1, 11, 30))
    assert response.status_code == 409
    _assert_error_body(response, "conflict")

    details = response.json()["error"]["details"]
    assert details
    clash = details[0]
    assert clash["start"] == "2030-01-01T10:00:00Z"
    assert clash["end"] == "2030-01-01T11:00:00Z"


def test_touching_boundaries_are_not_an_overlap(client, rooms):
    before = _create(client, rooms["alpha"], _iso(2030, 1, 1, 9), _iso(2030, 1, 1, 10))
    after = _create(client, rooms["alpha"], _iso(2030, 1, 1, 11), _iso(2030, 1, 1, 12))
    middle = _create(client, rooms["alpha"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 11))

    assert before.status_code == 201
    assert middle.status_code == 201
    assert after.status_code == 201


def test_overlap_across_different_rooms_is_allowed(client, rooms):
    first = _create(client, rooms["alpha"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 11))
    second = _create(client, rooms["beta"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 11))
    assert first.status_code == 201
    assert second.status_code == 201


# --- unknown room / past start ---------------------------------------------


def test_unknown_room_answers_404(client):
    response = _create(client, 999999, _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 11))
    assert response.status_code == 404
    _assert_error_body(response, "not_found")


def test_past_start_is_allowed_when_other_rules_hold(client, rooms):
    response = _create(client, rooms["alpha"], _iso(2020, 1, 1, 10), _iso(2020, 1, 1, 11))
    assert response.status_code == 201


# --- AC-06 / AC-10: PATCH ---------------------------------------------------


def test_patch_updates_a_not_started_booking(client, rooms):
    created = _create(client, rooms["alpha"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 11))
    booking_id = created.json()["id"]

    response = client.patch(f"/api/bookings/{booking_id}", json={"title": "Retro"})
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Retro"
    assert body["start"] == "2030-01-01T10:00:00Z"


def test_patch_rejects_invalid_period_with_422(client, rooms):
    created = _create(client, rooms["alpha"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 11))
    booking_id = created.json()["id"]

    response = client.patch(f"/api/bookings/{booking_id}", json={"end": _iso(2030, 1, 1, 9)})
    assert response.status_code == 422
    _assert_error_body(response, "validation_error")


def test_patch_rejects_overlap_with_409(client, rooms):
    created = _create(client, rooms["alpha"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 11))
    _create(client, rooms["alpha"], _iso(2030, 1, 1, 12), _iso(2030, 1, 1, 13))
    booking_id = created.json()["id"]

    response = client.patch(f"/api/bookings/{booking_id}", json={"end": _iso(2030, 1, 1, 12, 30)})
    assert response.status_code == 409
    _assert_error_body(response, "conflict")


def test_patch_unknown_booking_answers_404(client):
    response = client.patch("/api/bookings/999999", json={"title": "X"})
    assert response.status_code == 404
    _assert_error_body(response, "not_found")


def test_patch_started_booking_answers_409(client, rooms):
    created = _create(client, rooms["alpha"], _iso(2020, 1, 1, 10), _iso(2020, 1, 1, 11))
    booking_id = created.json()["id"]

    response = client.patch(f"/api/bookings/{booking_id}", json={"title": "Too late"})
    assert response.status_code == 409
    _assert_error_body(response, "conflict")


# --- AC-06 / AC-10: DELETE --------------------------------------------------


def test_delete_not_started_booking_returns_204(client, rooms):
    created = _create(client, rooms["alpha"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 11))
    booking_id = created.json()["id"]

    response = client.delete(f"/api/bookings/{booking_id}")
    assert response.status_code == 204
    assert client.get(f"/api/bookings/{booking_id}").status_code == 404


def test_delete_started_booking_answers_409(client, rooms):
    created = _create(client, rooms["alpha"], _iso(2020, 1, 1, 10), _iso(2020, 1, 1, 11))
    booking_id = created.json()["id"]

    response = client.delete(f"/api/bookings/{booking_id}")
    assert response.status_code == 409
    _assert_error_body(response, "conflict")
    assert client.get(f"/api/bookings/{booking_id}").status_code == 200


def test_delete_unknown_booking_answers_404(client):
    response = client.delete("/api/bookings/999999")
    assert response.status_code == 404
    _assert_error_body(response, "not_found")


# --- AC-23: persistence across an engine reconnect --------------------------


def test_booking_is_retrievable_after_engine_reconnect(client, rooms):
    created = _create(client, rooms["alpha"], _iso(2030, 1, 1, 10), _iso(2030, 1, 1, 11))
    booking_id = created.json()["id"]

    db_module.engine.dispose()
    db_module.init_db()

    response = client.get(f"/api/bookings/{booking_id}")
    assert response.status_code == 200
    assert response.json()["title"] == "Standup"
