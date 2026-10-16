"""Room CRUD routes (implemented by the room-CRUD ticket)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from errors import NotImplementedStubError
from schemas import RoomCreate, RoomOut, RoomUpdate

router = APIRouter(prefix="/api/rooms")


@router.post("", response_model=RoomOut, status_code=201)
def create_room(payload: RoomCreate) -> RoomOut:
    raise NotImplementedStubError("Creating rooms is implemented by the room-CRUD ticket.")


@router.get("", response_model=list[RoomOut])
def list_rooms(equipment: list[str] = Query(default=[])) -> list[RoomOut]:
    raise NotImplementedStubError("Listing rooms is implemented by the room-CRUD ticket.")


@router.get("/{room_id}", response_model=RoomOut)
def get_room(room_id: int) -> RoomOut:
    raise NotImplementedStubError("Reading a room is implemented by the room-CRUD ticket.")


@router.patch("/{room_id}", response_model=RoomOut)
def update_room(room_id: int, payload: RoomUpdate) -> RoomOut:
    raise NotImplementedStubError("Updating a room is implemented by the room-CRUD ticket.")


@router.delete("/{room_id}", status_code=204)
def delete_room(room_id: int) -> None:
    raise NotImplementedStubError("Deleting a room is implemented by the room-CRUD ticket.")
