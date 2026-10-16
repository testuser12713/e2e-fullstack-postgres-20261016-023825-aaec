"""ORM models for rooms and bookings.

All timestamps are UTC. ``Booking.start``/``Booking.end`` are stored as
timezone-aware timestamps; the API exchanges them as ISO 8601 with ``Z``.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    seats: Mapped[int] = mapped_column(Integer, nullable=False)
    equipment: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)


# Case-insensitive uniqueness of the room name (trimmed at the application layer).
Index("uq_rooms_name_lower", func.lower(Room.name), unique=True)


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    booked_by: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


Index("ix_bookings_room_id_start_end", Booking.room_id, Booking.start, Booking.end)
