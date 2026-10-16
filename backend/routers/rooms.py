"""Room CRUD routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db import get_db
from errors import ConflictError, NotFoundError
from models import Room
from schemas import RoomCreate, RoomOut, RoomUpdate

router = APIRouter(prefix="/api/rooms")


def _room_out(room: Room) -> RoomOut:
    return RoomOut(id=room.id, name=room.name, seats=room.seats, equipment=list(room.equipment))


def _clean_name(name: str) -> str:
    return name.strip()


def _name_taken(session: Session, name: str, exclude_id: int | None = None) -> bool:
    stmt = select(Room.id).where(func.lower(Room.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(Room.id != exclude_id)
    return session.execute(stmt).first() is not None


def _get_room_or_404(session: Session, room_id: int) -> Room:
    room = session.get(Room, room_id)
    if room is None:
        raise NotFoundError(f"Raum {room_id} wurde nicht gefunden.")
    return room


@router.post("", response_model=RoomOut, status_code=201)
def create_room(payload: RoomCreate, session: Session = Depends(get_db)) -> RoomOut:
    name = _clean_name(payload.name)
    if _name_taken(session, name):
        raise ConflictError(f"Ein Raum mit dem Namen '{name}' existiert bereits.")

    room = Room(name=name, seats=payload.seats, equipment=list(payload.equipment))
    session.add(room)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise ConflictError(f"Ein Raum mit dem Namen '{name}' existiert bereits.") from exc
    session.refresh(room)
    return _room_out(room)


@router.get("", response_model=list[RoomOut])
def list_rooms(
    equipment: list[str] = Query(default=[]), session: Session = Depends(get_db)
) -> list[RoomOut]:
    rooms = session.scalars(select(Room).order_by(Room.id)).all()
    wanted = {tag.strip().lower() for tag in equipment if tag.strip()}
    if wanted:
        rooms = [room for room in rooms if wanted <= {tag.lower() for tag in room.equipment}]
    return [_room_out(room) for room in rooms]


@router.get("/{room_id}", response_model=RoomOut)
def get_room(room_id: int, session: Session = Depends(get_db)) -> RoomOut:
    return _room_out(_get_room_or_404(session, room_id))


@router.patch("/{room_id}", response_model=RoomOut)
def update_room(room_id: int, payload: RoomUpdate, session: Session = Depends(get_db)) -> RoomOut:
    room = _get_room_or_404(session, room_id)

    if payload.name is not None:
        name = _clean_name(payload.name)
        if _name_taken(session, name, exclude_id=room_id):
            raise ConflictError(f"Ein Raum mit dem Namen '{name}' existiert bereits.")
        room.name = name

    if payload.seats is not None:
        room.seats = payload.seats

    if payload.equipment is not None:
        room.equipment = list(payload.equipment)

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise ConflictError("Der Raumname ist bereits vergeben.") from exc
    session.refresh(room)
    return _room_out(room)


@router.delete("/{room_id}", status_code=204)
def delete_room(room_id: int, session: Session = Depends(get_db)) -> None:
    room = _get_room_or_404(session, room_id)
    session.delete(room)
    session.commit()
