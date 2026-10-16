import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import DateTimeField from "../components/DateTimeField";
import type { Room } from "../types";
import "./AvailabilityPage.css";

type FieldErrors = {
  date?: string;
  start?: string;
  end?: string;
  seats?: string;
};

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; rooms: Room[] }
  | { status: "error"; message: string };

function buildUtcIso(date: string, time: string): string {
  if (date.length === 0 || time.length === 0) {
    return "";
  }
  return `${date}T${time}:00Z`;
}

function seatLabel(seats: number): string {
  return seats === 1 ? "1 Platz" : `${seats} Plätze`;
}

export default function AvailabilityPage() {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [seats, setSeats] = useState("1");
  const [touched, setTouched] = useState<{
    date: boolean;
    start: boolean;
    end: boolean;
    seats: boolean;
  }>({ date: false, start: false, end: false, seats: false });
  const [submitted, setSubmitted] = useState(false);
  const [state, setState] = useState<SearchState>({ status: "idle" });

  const validation = useMemo<FieldErrors>(() => {
    const errors: FieldErrors = {};
    if (date.length === 0) {
      errors.date = "Bitte ein Datum angeben.";
    }
    if (startTime.length === 0) {
      errors.start = "Bitte einen Beginn angeben.";
    }
    if (endTime.length === 0) {
      errors.end = "Bitte ein Ende angeben.";
    } else if (date.length > 0 && startTime.length > 0) {
      const startMs = Date.parse(buildUtcIso(date, startTime));
      const endMs = Date.parse(buildUtcIso(date, endTime));
      if (endMs <= startMs) {
        errors.end = "Das Ende muss nach dem Beginn liegen.";
      }
    }

    const trimmedSeats = seats.trim();
    const seatsNumber = Number(trimmedSeats);
    if (trimmedSeats.length === 0) {
      errors.seats = "Bitte die Mindestzahl an Plätzen angeben.";
    } else if (!Number.isInteger(seatsNumber) || seatsNumber < 1) {
      errors.seats = "Die Mindestzahl an Plätzen muss eine ganze Zahl ab 1 sein.";
    }

    return errors;
  }, [date, startTime, endTime, seats]);

  function errorFor(field: keyof FieldErrors): string | undefined {
    if (!submitted && !touched[field]) {
      return undefined;
    }
    return validation[field];
  }

  async function runSearch(): Promise<void> {
    const params = new URLSearchParams({
      start: buildUtcIso(date, startTime),
      end: buildUtcIso(date, endTime),
      min_seats: String(Number(seats.trim())),
    });

    setState({ status: "loading" });

    try {
      const rooms = await apiFetch<Room[]>(
        `/api/rooms/availability?${params.toString()}`,
      );
      setState({ status: "success", rooms });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Die Suche ist fehlgeschlagen. Bitte erneut versuchen.";
      setState({ status: "error", message });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(validation).length > 0) {
      return;
    }
    void runSearch();
  }

  const dateError = errorFor("date");
  const startError = errorFor("start");
  const endError = errorFor("end");
  const seatsError = errorFor("seats");
  const isLoading = state.status === "loading";

  return (
    <section className="page">
      <h1>Freie Räume</h1>
      <p className="availability-intro">
        Zeitraum und Mindestzahl an Plätzen angeben, um freie Räume zu finden.
        Alle Zeiten in UTC.
      </p>

      <form
        className="availability-form card"
        onSubmit={handleSubmit}
        noValidate
        aria-label="Suche nach freien Räumen"
      >
        <p className="availability-form__note">
          Mit <span aria-hidden="true">*</span> markierte Felder sind
          Pflichtfelder.
        </p>

        <div className="availability-form__row">
          <div className="availability-form__field availability-form__field--period">
            <DateTimeField
              id="availability-period"
              date={date}
              startTime={startTime}
              endTime={endTime}
              onDateChange={setDate}
              onStartTimeChange={setStartTime}
              onEndTimeChange={setEndTime}
              onBlur={(field) =>
                setTouched((prev) => ({ ...prev, [field]: true }))
              }
              dateError={dateError}
              startError={startError}
              endError={endError}
            />
          </div>

          <div className="availability-form__field availability-form__field--seats">
            <label className="availability-form__label" htmlFor="availability-seats">
              Mindestplätze <span aria-hidden="true">*</span>
            </label>
            <input
              id="availability-seats"
              className="input numeric"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={seats}
              onChange={(event) => setSeats(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, seats: true }))}
              aria-invalid={seatsError ? true : undefined}
              aria-describedby={
                seatsError ? "availability-seats-error" : undefined
              }
            />
            {seatsError ? (
              <p
                id="availability-seats-error"
                className="availability-form__error"
                role="alert"
              >
                {seatsError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="availability-form__actions">
          <button
            type="submit"
            className="btn btn--primary availability-form__submit"
            disabled={isLoading}
          >
            {isLoading ? "Suche läuft …" : "Freie Räume suchen"}
          </button>
        </div>
      </form>

      <div className="availability-results-region" aria-busy={isLoading}>
        {state.status === "idle" ? (
          <p className="availability-hint">
            Sobald Sie suchen, erscheint hier die Liste der freien Räume.
          </p>
        ) : null}

        {state.status === "loading" ? (
          <div className="availability-loading" role="status">
            <span className="availability-loading__text">Suche läuft …</span>
            <div className="availability-skeletons" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <div key={index} className="availability-skeleton" />
              ))}
            </div>
          </div>
        ) : null}

        {state.status === "error" ? (
          <p className="notice notice--error" role="alert">
            {state.message}
          </p>
        ) : null}

        {state.status === "success" && state.rooms.length > 0 ? (
          <ul className="availability-results" aria-label="Freie Räume">
            {state.rooms.map((room) => (
              <li key={room.id}>
                <Link className="availability-card" to={`/rooms/${room.id}`}>
                  <span className="availability-card__name">{room.name}</span>
                  <span className="availability-card__seats numeric">
                    {seatLabel(room.seats)}
                  </span>
                  {room.equipment.length > 0 ? (
                    <span className="availability-card__equipment">
                      {room.equipment.map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {state.status === "success" && state.rooms.length === 0 ? (
          <div className="empty-state" role="status">
            <p className="empty-state__title">
              Kein freier Raum für diesen Zeitraum — Zeitraum ändern oder
              Mindestzahl an Plätzen senken.
            </p>
            <p className="empty-state__hint">
              Passen Sie den Zeitraum oder die Mindestzahl an und suchen Sie
              erneut.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
