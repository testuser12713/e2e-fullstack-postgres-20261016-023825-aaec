export interface Room {
  id: number;
  name: string;
  seats: number;
  equipment: string[];
}

export interface RoomCreate {
  name: string;
  seats: number;
  equipment: string[];
}

export interface RoomUpdate {
  name?: string;
  seats?: number;
  equipment?: string[];
}

export interface Booking {
  id: number;
  room_id: number;
  booked_by: string;
  title: string;
  start: string;
  end: string;
}

export interface BookingCreate {
  room_id: number;
  booked_by: string;
  title: string;
  start: string;
  end: string;
}

export interface BookingUpdate {
  room_id?: number;
  booked_by?: string;
  title?: string;
  start?: string;
  end?: string;
}

export type ErrorCode =
  | "validation_error"
  | "not_found"
  | "conflict"
  | "internal_error";

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details: unknown[];
  };
}
