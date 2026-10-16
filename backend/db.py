"""Database engine, session factory and declarative base.

The engine reads its URL from ``DATABASE_URL``. PostgreSQL is the only supported
backend; there is no SQLite fallback.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    """Declarative base shared by every ORM model."""


def get_database_url() -> str:
    """Return the configured database URL.

    Read lazily so a missing variable fails with a message that names it instead
    of a bare traceback at import time.
    """
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. The API needs a PostgreSQL connection string; "
            "see RUN.json or the README for how to provide it."
        )
    return url


engine = create_engine(get_database_url(), pool_pre_ping=True, future=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def init_db() -> None:
    """Create the schema if it does not exist yet."""
    import models  # noqa: F401  (registers the tables on Base.metadata)

    Base.metadata.create_all(bind=engine)


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a database session."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
