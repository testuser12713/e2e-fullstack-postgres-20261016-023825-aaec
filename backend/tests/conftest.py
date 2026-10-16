"""Shared test fixtures.

The suite runs against the real PostgreSQL database named by
``TEST_DATABASE_URL`` (falling back to ``DATABASE_URL``). There is no SQLite or
in-memory stand-in anywhere.
"""

from __future__ import annotations

import os

import pytest
from sqlalchemy import text

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
if not TEST_DATABASE_URL:
    raise RuntimeError(
        "TEST_DATABASE_URL (or DATABASE_URL) must be set to a PostgreSQL connection string; "
        "see RUN.json or the README."
    )

os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")


@pytest.fixture(scope="session")
def engine():
    import db as db_module

    return db_module.engine


@pytest.fixture(autouse=True)
def _reset_database(engine):
    import models

    models.Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE bookings, rooms RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as test_client:
        yield test_client
