"""Tests for the room CRUD endpoints.

They run through the FastAPI test client against the real PostgreSQL database
provided by conftest. Only this ticket's behaviour is asserted.
"""

from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

import db as db_module
import models

ERROR_KEYS = {"error"}
ERROR_FIELDS = {"code", "message", "details"}


def _create(client, name="Aquarium", seats=4, equipment=None):
    return client.post(
        "/api/rooms",
        json={"name": name, "seats": seats, "equipment": equipment or ["beamer"]},
    )


def test_create_room_returns_201_with_id(client):
    response = _create(client, name="Aquarium", seats=4, equipment=["beamer", "whiteboard"])
    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 1
    assert body["name"] == "Aquarium"
    assert body["seats"] == 4
    assert body["equipment"] == ["beamer", "whiteboard"]


def test_create_room_trims_name(client):
    response = _create(client, name="  Terrasse  ")
    assert response.status_code == 201
    assert response.json()["name"] == "Terrasse"


def test_duplicate_name_is_conflict_case_insensitive_and_trimmed(client):
    assert _create(client, name="Aquarium").status_code == 201
    response = _create(client, name="  aquarium  ")
    assert response.status_code == 409
    body = response.json()
    assert set(body) == ERROR_KEYS
    assert set(body["error"]) == ERROR_FIELDS
    assert body["error"]["code"] == "conflict"
    assert isinstance(body["error"]["message"], str) and body["error"]["message"]
    assert isinstance(body["error"]["details"], list)


@pytest.mark.parametrize("seats", [0, -3, 2.5, "many"])
def test_invalid_seats_is_422_validation_error(client, seats):
    response = client.post("/api/rooms", json={"name": "Bad", "seats": seats, "equipment": []})
    assert response.status_code == 422
    body = response.json()
    assert set(body) == ERROR_KEYS
    assert body["error"]["code"] == "validation_error"
    assert isinstance(body["error"]["message"], str) and body["error"]["message"]
    assert isinstance(body["error"]["details"], list)


def test_list_rooms_returns_every_room(client):
    _create(client, name="Alpha", equipment=["beamer"])
    _create(client, name="Beta", equipment=["whiteboard"])
    response = client.get("/api/rooms")
    assert response.status_code == 200
    names = [room["name"] for room in response.json()]
    assert names == ["Alpha", "Beta"]


def test_list_rooms_filters_by_all_equipment_tags_case_insensitive(client):
    _create(client, name="Alpha", equipment=["Beamer", "Whiteboard"])
    _create(client, name="Beta", equipment=["beamer"])
    _create(client, name="Gamma", equipment=["Whiteboard"])

    response = client.get(
        "/api/rooms", params=[("equipment", "BEAMER"), ("equipment", "whiteboard")]
    )
    assert response.status_code == 200
    assert [room["name"] for room in response.json()] == ["Alpha"]

    response = client.get("/api/rooms", params=[("equipment", "beamer")])
    assert {room["name"] for room in response.json()} == {"Alpha", "Beta"}

    response = client.get("/api/rooms", params=[("equipment", "projector")])
    assert response.json() == []


def test_get_room_returns_room_and_404_for_unknown(client):
    created = _create(client, name="Aquarium", seats=6).json()
    response = client.get(f"/api/rooms/{created['id']}")
    assert response.status_code == 200
    assert response.json() == created

    missing = client.get("/api/rooms/9999")
    assert missing.status_code == 404
    body = missing.json()
    assert set(body) == ERROR_KEYS
    assert body["error"]["code"] == "not_found"
    assert isinstance(body["error"]["message"], str) and body["error"]["message"]
    assert isinstance(body["error"]["details"], list)


def test_patch_updates_room_partially(client):
    created = _create(client, name="Aquarium", seats=4, equipment=["beamer"]).json()
    room_id = created["id"]

    response = client.patch(f"/api/rooms/{room_id}", json={"seats": 12})
    assert response.status_code == 200
    body = response.json()
    assert body["seats"] == 12
    assert body["name"] == "Aquarium"
    assert body["equipment"] == ["beamer"]

    response = client.patch(
        f"/api/rooms/{room_id}",
        json={"name": "  Riesen-Aquarium ", "equipment": ["beamer", "tv"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Riesen-Aquarium"
    assert body["equipment"] == ["beamer", "tv"]


def test_patch_unknown_room_is_404(client):
    response = client.patch("/api/rooms/4242", json={"seats": 3})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_patch_duplicate_name_is_conflict(client):
    _create(client, name="Aquarium")
    other = _create(client, name="Terrasse").json()
    response = client.patch(f"/api/rooms/{other['id']}", json={"name": "aquarium"})
    assert response.status_code == 409
    body = response.json()
    assert set(body) == ERROR_KEYS
    assert body["error"]["code"] == "conflict"
    assert isinstance(body["error"]["message"], str) and body["error"]["message"]


def test_patch_invalid_seats_is_422(client):
    room_id = _create(client).json()["id"]
    response = client.patch(f"/api/rooms/{room_id}", json={"seats": 0})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_delete_room_answers_204_then_404_and_unknown_is_404(client):
    room_id = _create(client).json()["id"]
    response = client.delete(f"/api/rooms/{room_id}")
    assert response.status_code == 204
    assert response.content == b""

    assert client.get(f"/api/rooms/{room_id}").status_code == 404
    assert client.delete(f"/api/rooms/{room_id}").status_code == 404


def test_room_created_via_api_survives_engine_reconnect(client):
    created = _create(client, name="Persistent", seats=7, equipment=["beamer"]).json()
    room_id = created["id"]

    db_module.engine.dispose()
    db_module.init_db()

    with Session(db_module.engine) as session:
        room = session.get(models.Room, room_id)
        assert room is not None
        assert room.name == "Persistent"
        assert room.seats == 7
        assert room.equipment == ["beamer"]

    response = client.get(f"/api/rooms/{room_id}")
    assert response.status_code == 200
    assert response.json() == created
