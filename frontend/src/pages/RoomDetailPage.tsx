import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { Booking, Room } from "../types";
import "./RoomDetailPage.css";

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDayLabel(value: string): string {
  const date = parseIsoDate(value);
  if (!date) {
    return value;
  }
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${WEEKDAYS[date.getUTCDay()]}, ${day}.${month}.${date.getUTCFullYear()}`;
}

function shiftDate(value: string, days: number): string {
  const date = parseIsoDate(value);
  if (!date) {
    return value;
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatSeats(seats: number): string {
  return seats === 1 ? "1 Platz" : `${seats} Plätze`;
}

export default function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const numericRoomId = Number(roomId);
  const hasValidRoomId = Number.isInteger(numericRoomId);

  const [room, setRoom] = useState<Room | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);

  const [date, setDate] = useState<string>(todayIso);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasValidRoomId) {
      setRoom(null);
      setRoomLoading(false);
      setRoomError("Der Raum wurde nicht gefunden.");
      return;
    }

    let active = true;
    setRoomLoading(true);
    setRoomError(null);

    apiFetch<Room>(`/api/rooms/${numericRoomId}`)
      .then((data) => {
        if (active) {
          setRoom(data);
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setRoom(null);
        setRoomError(
          error instanceof ApiError && error.status === 404
            ? "Der Raum wurde nicht gefunden."
            : "Der Raum konnte nicht geladen werden.",
        );
      })
      .finally(() => {
        if (active) {
          setRoomLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [numericRoomId, hasValidRoomId]);

  useEffect(() => {
    if (!hasValidRoomId) {
      setBookings([]);
      setBookingsLoading(false);
      return;
    }

    let active = true;
    setBookingsLoading(true);
    setBookingsError(null);

    apiFetch<Booking[]>(
      `/api/rooms/${numericRoomId}/bookings?date=${date}`,
    )
      .then((data) => {
        if (!active) {
          return;
        }
        const sorted = [...data].sort(
          (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
        );
        setBookings(sorted);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setBookings([]);
        setBookingsError("Die Buchungen konnten nicht geladen werden.");
      })
      .finally(() => {
        if (active) {
          setBookingsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [numericRoomId, hasValidRoomId, date]);

  return (
    <section className="page room-detail">
      {roomError ? (
        <p className="notice notice--error" role="alert">
          {roomError}
        </p>
      ) : roomLoading || !room ? (
        <div
          className="room-detail__header room-detail__skeleton"
          aria-hidden="true"
        >
          <span className="room-detail__skeleton-line room-detail__skeleton-line--title" />
          <span className="room-detail__skeleton-line room-detail__skeleton-line--meta" />
        </div>
      ) : (
        <header className="card room-detail__header">
          <h1>{room.name}</h1>
          <p className="room-detail__seats numeric">{formatSeats(room.seats)}</p>
          {room.equipment.length > 0 && (
            <ul className="room-detail__equipment">
              {room.equipment.map((tag) => (
                <li key={tag} className="tag">
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </header>
      )}

      <div className="room-detail__day-picker">
        <button
          type="button"
          className="btn btn--secondary room-detail__day-nav"
          aria-label="Vorheriger Tag"
          onClick={() => setDate((current) => shiftDate(current, -1))}
        >
          «
        </button>
        <label className="room-detail__date-field">
          <span className="room-detail__date-label">
            {formatDayLabel(date)}{" "}
            <span className="room-detail__utc">UTC</span>
          </span>
          <input
            type="date"
            className="input room-detail__date-input numeric"
            value={date}
            aria-label="Datum"
            onChange={(event) => {
              if (event.target.value) {
                setDate(event.target.value);
              }
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn--secondary room-detail__day-nav"
          aria-label="Nächster Tag"
          onClick={() => setDate((current) => shiftDate(current, 1))}
        >
          »
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setDate(todayIso())}
        >
          Heute
        </button>
      </div>

      <div className="card room-detail__timeline">
        <h2 className="room-detail__timeline-title">
          Buchungen am {formatDayLabel(date)}
        </h2>

        {bookingsLoading ? (
          <ul
            className="room-detail__booking-list"
            aria-busy="true"
            role="status"
            aria-label="Buchungen werden geladen"
          >
            {[0, 1, 2].map((index) => (
              <li
                key={index}
                className="room-detail__booking room-detail__skeleton-row"
                aria-hidden="true"
              >
                <span className="room-detail__skeleton-line room-detail__skeleton-line--time" />
                <span className="room-detail__skeleton-line room-detail__skeleton-line--text" />
              </li>
            ))}
          </ul>
        ) : bookingsError ? (
          <p className="notice notice--error" role="alert">
            {bookingsError}
          </p>
        ) : bookings.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">
              An diesem Tag ist der Raum frei.
            </p>
            <p className="empty-state__hint">
              Wähle einen anderen Tag oder lege eine neue Buchung an.
            </p>
          </div>
        ) : (
          <ul className="room-detail__booking-list">
            {bookings.map((booking) => (
              <li key={booking.id} className="room-detail__booking">
                <span className="room-detail__booking-time numeric">
                  {formatTime(booking.start)} – {formatTime(booking.end)}
                </span>
                <span className="room-detail__booking-body">
                  <span className="room-detail__booking-title">
                    {booking.title}
                  </span>
                  <span className="room-detail__booking-by">
                    gebucht von: {booking.booked_by}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
