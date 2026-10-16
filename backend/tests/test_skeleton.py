"""Tests for the backend skeleton itself.

These assert only what this ticket delivers: the health route, the mounted
routers (read from the route table, never from a response), the unified error
body for validation and internal errors, CORS from configuration and that data
written through the ORM survives an engine reconnect.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

import db as db_module
import models
from main import app


def _routes_by_path() -> dict[str, set[str]]:
    schema = app.openapi()
    return {
        path: {method.upper() for method in operations}
        for path, operations in schema["paths"].items()
    }


def test_health_answers_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_entry_point_mounts_all_four_routers():
    routes = _routes_by_path()
    assert {"GET", "POST"} <= routes["/api/rooms"]
    assert {"GET", "PATCH", "DELETE"} <= routes["/api/rooms/{room_id}"]
    assert routes["/api/rooms/availability"] == {"GET"}
    assert routes["/api/rooms/{room_id}/bookings"] == {"GET"}
    assert {"GET", "POST"} <= routes["/api/bookings"]
    assert {"GET", "PATCH", "DELETE"} <= routes["/api/bookings/{booking_id}"]

    order = list(app.openapi()["paths"])
    assert order.index("/api/rooms/availability") < order.index("/api/rooms/{room_id}")


def test_invalid_body_answers_422_in_contract_body(client):
    response = client.post("/api/rooms", json={"name": "small", "seats": 0, "equipment": []})
    assert response.status_code == 422
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == "validation_error"
    assert isinstance(body["error"]["message"], str)
    assert body["error"]["message"]
    assert isinstance(body["error"]["details"], list)


def test_internal_error_handler_produces_contract_body():
    @app.get("/__test_internal_error__")
    def _boom() -> None:
        raise RuntimeError("boom")

    with TestClient(app, raise_server_exceptions=False) as test_client:
        response = test_client.get(
            "/__test_internal_error__", headers={"Origin": "http://localhost:5173"}
        )

    assert response.status_code == 500
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == "internal_error"
    assert isinstance(body["error"]["message"], str)
    assert body["error"]["message"]
    # A 5xx must keep its CORS headers, otherwise the browser sees a network error.
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_allows_configured_origin(client):
    origin = "http://localhost:5173"
    response = client.get("/api/health", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin


def test_room_survives_engine_reconnect():
    with Session(db_module.engine) as session:
        session.add(models.Room(name="Persistence Room", seats=6, equipment=["beamer"]))
        session.commit()

    db_module.engine.dispose()

    db_module.init_db()
    with Session(db_module.engine) as session:
        rooms = session.query(models.Room).all()

    assert len(rooms) == 1
    assert rooms[0].name == "Persistence Room"
    assert rooms[0].seats == 6
    assert rooms[0].equipment == ["beamer"]
