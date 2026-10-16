import { useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "../api/client";
import type { Booking, Room } from "../types";
import "./BookingForm.css";

const MAX_DURATION_MINUTES = 8 * 60;
const SECONDS_PER_MINUTE = 60 * 1000;

type FieldName =
  | "room"
  | "bookedBy"
  | "title"
  | "startDate"
  | "startTime"
  | "endDate"
  | "endTime";

interface TouchedState {
  [field: string]: boolean;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function parseIso(value: string): Date | null {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function formatTime(date: Date): string {
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function formatDate(date: Date): string {
  return `${pad(date.getUTCDate())}.${pad(
    date.getUTCMonth() + 1,
  )}.${date.getUTCFullYear()}`;
}

function formatDuration(minutes: number): string {
  const total = Math.abs(Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} Std.`);
  }
  if (mins > 0 || hours === 0) {
    parts.push(`${mins} Min.`);
  }
  return parts.join(" ");
}

function combineUtc(date: string, time: string): string | null {
  if (!date || !time) {
    return null;
  }
  return `${date}T${time}:00Z`;
}

function toMinutes(iso: string): number | null {
  const parsed = parseIso(iso);
  if (parsed === null) {
    return null;
  }
  return Math.round(parsed.getTime() / SECONDS_PER_MINUTE);
}

interface DetectedPeriod {
  start: string;
  end: string;
}

function findPeriod(details: unknown): DetectedPeriod | null {
  if (Array.isArray(details)) {
    for (const item of details) {
      const found = findPeriod(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (details && typeof details === "object") {
    const record = details as Record<string, unknown>;
    const start = record.start ?? record.from;
    const end = record.end ?? record.to;
    if (typeof start === "string" && typeof end === "string") {
      return { start, end };
    }
    for (const key of Object.keys(record)) {
      const found = findPeriod(record[key]);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function buildConflictMessage(error: ApiError): string {
  const period = findPeriod(error.details);
  if (period) {
    const start = parseIso(period.start);
    const end = parseIso(period.end);
    if (start && end) {
      const sameDay =
        start.toISOString().slice(0, 10) === end.toISOString().slice(0, 10);
      const range = sameDay
        ? `${formatTime(start)} bis ${formatTime(end)}`
        : `${formatDate(start)} ${formatTime(start)} bis ${formatDate(
            end,
          )} ${formatTime(end)}`;
      return `Der Raum ist von ${range} bereits gebucht. Bitte wählen Sie einen anderen Zeitraum.`;
    }
  }
  return "Der Raum ist im gewählten Zeitraum bereits gebucht. Bitte wählen Sie einen anderen Zeitraum.";
}

export default function BookingForm() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const [room, setRoom] = useState("");
  const [bookedBy, setBookedBy] = useState("");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");

  const [touched, setTouched] = useState<TouchedState>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRoomsLoading(true);
    apiFetch<Room[]>("/api/rooms")
      .then((data) => {
        if (active) {
          setRooms(data);
          setRoomsError(null);
        }
      })
      .catch(() => {
        if (active) {
          setRoomsError(
            "Die Raumliste konnte nicht geladen werden. Bitte laden Sie die Seite neu.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setRoomsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const startIso = combineUtc(startDate, startTime);
  const endIso = combineUtc(endDate, endTime);

  const durationMinutes = useMemo(() => {
    if (!startIso || !endIso) {
      return null;
    }
    const start = toMinutes(startIso);
    const end = toMinutes(endIso);
    if (start === null || end === null) {
      return null;
    }
    return end - start;
  }, [startIso, endIso]);

  const errors = useMemo(() => {
    const next: Partial<Record<FieldName, string>> = {};
    if (!room) {
      next.room = "Bitte einen Raum auswählen.";
    }
    if (!bookedBy.trim()) {
      next.bookedBy = "Bitte angeben, wer die Buchung vornimmt.";
    }
    if (!title.trim()) {
      next.title = "Bitte einen Titel angeben.";
    }
    if (!startDate) {
      next.startDate = "Bitte ein Startdatum wählen.";
    }
    if (!startTime) {
      next.startTime = "Bitte eine Startzeit wählen.";
    }
    if (!endDate) {
      next.endDate = "Bitte ein Enddatum wählen.";
    }
    if (!endTime) {
      next.endTime = "Bitte eine Endzeit wählen.";
    }
    if (startIso && endIso) {
      const start = toMinutes(startIso);
      const end = toMinutes(endIso);
      if (start !== null && end !== null) {
        if (end <= start) {
          next.endTime = "Das Ende muss nach dem Beginn liegen.";
        } else if (end - start > MAX_DURATION_MINUTES) {
          next.endTime =
            "Die Höchstdauer von 8 Stunden wurde überschritten.";
        }
      }
    }
    return next;
  }, [room, bookedBy, title, startDate, startTime, endDate, endTime, startIso, endIso]);

  const isValid = Object.keys(errors).length === 0;

  function markTouched(field: FieldName): void {
    setTouched((current) =>
      current[field] ? current : { ...current, [field]: true },
    );
  }

  function visibleError(field: FieldName): string | undefined {
    if (!submitted && !touched[field]) {
      return undefined;
    }
    return errors[field];
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setSubmitted(true);
    setConfirmation(null);
    setFormError(null);

    if (!isValid || !startIso || !endIso) {
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch<Booking>("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: Number(room),
          booked_by: bookedBy.trim(),
          title: title.trim(),
          start: startIso,
          end: endIso,
        }),
      });
      setConfirmation(
        `Die Buchung „${title.trim()}“ wurde angelegt. Sie erscheint in der Tagesansicht des Raums.`,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFormError(buildConflictMessage(error));
      } else if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError(
          "Die Buchung konnte nicht angelegt werden. Bitte versuchen Sie es erneut.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const controlsDisabled = roomsLoading || rooms.length === 0;

  function controlClass(field: FieldName): string {
    return visibleError(field) ? "input field__control--error" : "input";
  }

  return (
    <section className="booking-form card" aria-label="Buchungsformular">
      <p className="booking-form__required-note">
        Mit * gekennzeichnete Felder sind Pflichtfelder.
      </p>

      {formError && (
        <div className="notice notice--error" role="alert">
          {formError}
        </div>
      )}

      {confirmation && (
        <div className="notice notice--success" role="status">
          {confirmation}
        </div>
      )}

      {roomsError && (
        <div className="notice notice--error" role="alert">
          {roomsError}
        </div>
      )}

      {!roomsLoading && !roomsError && rooms.length === 0 && (
        <div className="notice notice--info" role="status">
          Es sind noch keine Räume vorhanden. Bitte legen Sie zuerst einen Raum
          an.
        </div>
      )}

      <form className="booking-form__form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="booking-room">
            Raum <span className="field__required">*</span>
          </label>
          <select
            id="booking-room"
            className={
              visibleError("room") ? "select field__control--error" : "select"
            }
            value={room}
            disabled={controlsDisabled}
            onChange={(event) => {
              setRoom(event.target.value);
              markTouched("room");
            }}
            onBlur={() => markTouched("room")}
            aria-invalid={visibleError("room") ? true : undefined}
            aria-describedby={
              visibleError("room") ? "booking-room-error" : undefined
            }
          >
            <option value="">
              {roomsLoading ? "Räume werden geladen …" : "Bitte wählen"}
            </option>
            {rooms.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name} · {item.seats} Plätze
              </option>
            ))}
          </select>
          {visibleError("room") && (
            <p className="field__error" id="booking-room-error">
              {visibleError("room")}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="booking-booked-by">
            Gebucht von <span className="field__required">*</span>
          </label>
          <input
            id="booking-booked-by"
            type="text"
            className={controlClass("bookedBy")}
            value={bookedBy}
            placeholder="Name"
            onChange={(event) => {
              setBookedBy(event.target.value);
              markTouched("bookedBy");
            }}
            onBlur={() => markTouched("bookedBy")}
            aria-invalid={visibleError("bookedBy") ? true : undefined}
            aria-describedby={
              visibleError("bookedBy") ? "booking-booked-by-error" : undefined
            }
          />
          {visibleError("bookedBy") && (
            <p className="field__error" id="booking-booked-by-error">
              {visibleError("bookedBy")}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="booking-title">
            Titel <span className="field__required">*</span>
          </label>
          <input
            id="booking-title"
            type="text"
            className={controlClass("title")}
            value={title}
            placeholder="z. B. Planungsrunde"
            onChange={(event) => {
              setTitle(event.target.value);
              markTouched("title");
            }}
            onBlur={() => markTouched("title")}
            aria-invalid={visibleError("title") ? true : undefined}
            aria-describedby={
              visibleError("title") ? "booking-title-error" : undefined
            }
          />
          {visibleError("title") && (
            <p className="field__error" id="booking-title-error">
              {visibleError("title")}
            </p>
          )}
        </div>

        <div className="booking-form__datetime">
          <div className="field field--datetime">
            <label className="field__label" htmlFor="booking-start-date">
              Beginn (Datum) <span className="field__required">*</span>
            </label>
            <input
              id="booking-start-date"
              type="date"
              className={controlClass("startDate")}
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                markTouched("startDate");
              }}
              onBlur={() => markTouched("startDate")}
              aria-invalid={visibleError("startDate") ? true : undefined}
              aria-describedby={
                visibleError("startDate") ? "booking-start-date-error" : undefined
              }
            />
            {visibleError("startDate") && (
              <p className="field__error" id="booking-start-date-error">
                {visibleError("startDate")}
              </p>
            )}
          </div>

          <div className="field field--datetime">
            <label className="field__label" htmlFor="booking-start-time">
              Beginn (Uhrzeit) <span className="field__required">*</span>
            </label>
            <input
              id="booking-start-time"
              type="time"
              step={900}
              className={controlClass("startTime")}
              value={startTime}
              onChange={(event) => {
                setStartTime(event.target.value);
                markTouched("startTime");
              }}
              onBlur={() => markTouched("startTime")}
              aria-invalid={visibleError("startTime") ? true : undefined}
              aria-describedby={
                visibleError("startTime") ? "booking-start-time-error" : undefined
              }
            />
            {visibleError("startTime") && (
              <p className="field__error" id="booking-start-time-error">
                {visibleError("startTime")}
              </p>
            )}
          </div>

          <div className="field field--datetime">
            <label className="field__label" htmlFor="booking-end-date">
              Ende (Datum) <span className="field__required">*</span>
            </label>
            <input
              id="booking-end-date"
              type="date"
              className={controlClass("endDate")}
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                markTouched("endDate");
              }}
              onBlur={() => markTouched("endDate")}
              aria-invalid={visibleError("endDate") ? true : undefined}
              aria-describedby={
                visibleError("endDate") ? "booking-end-date-error" : undefined
              }
            />
            {visibleError("endDate") && (
              <p className="field__error" id="booking-end-date-error">
                {visibleError("endDate")}
              </p>
            )}
          </div>

          <div className="field field--datetime">
            <label className="field__label" htmlFor="booking-end-time">
              Ende (Uhrzeit) <span className="field__required">*</span>
            </label>
            <input
              id="booking-end-time"
              type="time"
              step={900}
              className={controlClass("endTime")}
              value={endTime}
              onChange={(event) => {
                setEndTime(event.target.value);
                markTouched("endTime");
              }}
              onBlur={() => markTouched("endTime")}
              aria-invalid={visibleError("endTime") ? true : undefined}
              aria-describedby={
                visibleError("endTime") ? "booking-end-time-error" : undefined
              }
            />
            {visibleError("endTime") && (
              <p className="field__error" id="booking-end-time-error">
                {visibleError("endTime")}
              </p>
            )}
          </div>
        </div>

        <div className="booking-form__meta">
          {durationMinutes !== null && durationMinutes > 0 && (
            <p
              className={
                durationMinutes > MAX_DURATION_MINUTES
                  ? "booking-form__duration booking-form__duration--over"
                  : "booking-form__duration"
              }
            >
              Dauer: {formatDuration(durationMinutes)}
            </p>
          )}
          <p className="field__helper">Alle Zeiten in UTC.</p>
        </div>

        <div className="booking-form__actions">
          <button
            type="submit"
            className="btn btn--primary booking-form__submit"
            disabled={submitting || controlsDisabled}
          >
            {submitting ? "Wird gespeichert …" : "Buchung anlegen"}
          </button>
        </div>
      </form>
    </section>
  );
}
