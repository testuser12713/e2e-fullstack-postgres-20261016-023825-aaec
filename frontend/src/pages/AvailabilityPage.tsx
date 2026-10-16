import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import type { Room } from "../types";
import "./AvailabilityPage.css";

type FieldErrors = {
  start?: string;
  end?: string;
  seats?: string;
};

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; rooms: Room[] }
  | { status: "error"; message: string };

function toUtcIso(value: string): string {
  if (value.length === 0) {
    return "";
  }
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return `${withSeconds}Z`;
}

function seatLabel(seats: number): string {
  return seats === 1 ? "1 Platz" : `${seats} Plätze`;
}

export default function AvailabilityPage() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [seats, setSeats] = useState("1");
  const [touched, setTouched] = useState<{
    start: boolean;
    end: boolean;
    seats: boolean;
  }>({ start: false, end: false, seats: false });
  const [submitted, setSubmitted] = useState(false);
  const [state, setState] = useState<SearchState>({ status: "idle" });

  const validation = useMemo<FieldErrors>(() => {
    const errors: FieldErrors = {};
    if (start.length === 0) {
      errors.start = "Bitte einen Beginn angeben.";
    }
    if (end.length === 0) {
      errors.end = "Bitte ein Ende angeben.";
    } else if (start.length > 0) {
      const startTime = new Date(toUtcIso(start)).getTime();
      const endTime = new Date(toUtcIso(end)).getTime();
      if (endTime <= startTime) {
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
  }, [start, end, seats]);

  function errorFor(field: keyof FieldErrors): string | undefined {
    if (!submitted && !touched[field]) {
      return undefined;
    }
    return validation[field];
  }

  async function runSearch(): Promise<void> {
    const params = new URLSearchParams({
      start: toUtcIso(start),
      end: toUtcIso(end),
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
          <div className="availability-form__field">
            <label className="availability-form__label" htmlFor="availability-start">
              Beginn <span aria-hidden="true">*</span>
            </label>
            <input
              id="availability-start"
              className="input numeric"
              type="datetime-local"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              onBlur={() =>
                setTouched((prev) => ({ ...prev, start: true }))
              }
              aria-invalid={startError ? true : undefined}
              aria-describedby={
                startError ? "availability-start-error" : undefined
              }
            />
            {startError ? (
              <p
                id="availability-start-error"
                className="availability-form__error"
                role="alert"
              >
                {startError}
              </p>
            ) : null}
          </div>

          <div className="availability-form__field">
            <label className="availability-form__label" htmlFor="availability-end">
              Ende <span aria-hidden="true">*</span>
            </label>
            <input
              id="availability-end"
              className="input numeric"
              type="datetime-local"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, end: true }))}
              aria-invalid={endError ? true : undefined}
              aria-describedby={
                endError ? "availability-end-error" : undefined
              }
            />
            {endError ? (
              <p
                id="availability-end-error"
                className="availability-form__error"
                role="alert"
              >
                {endError}
              </p>
            ) : null}
          </div>

          <div className="availability-form__field">
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

          <div className="availability-form__action">
            <button
              type="submit"
              className="btn btn--primary availability-form__submit"
              disabled={isLoading}
            >
              {isLoading ? "Suche läuft …" : "Freie Räume suchen"}
            </button>
          </div>
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
