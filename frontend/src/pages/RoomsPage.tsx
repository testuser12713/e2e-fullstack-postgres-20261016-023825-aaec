import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { Room } from "../types";
import "./RoomsPage.css";

function formatSeats(seats: number): string {
  return seats === 1 ? "1 Platz" : `${seats} Plätze`;
}

function ChairIcon() {
  return (
    <svg
      className="room-card__icon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 2.5h8M5 2.5v5.5h6V2.5M4.5 8h7l1 5.5M5 13.5h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Room[]>("/api/rooms");
      setRooms(data);
    } catch (err) {
      setRooms(null);
      setError(
        err instanceof Error
          ? err.message
          : "Die Räume konnten nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const equipmentTags = useMemo<string[]>(() => {
    if (!rooms) {
      return [];
    }
    const seen = new Map<string, string>();
    for (const room of rooms) {
      for (const tag of room.equipment) {
        const key = normalize(tag);
        if (key.length > 0 && !seen.has(key)) {
          seen.set(key, tag);
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "de"));
  }, [rooms]);

  const normalizedSearch = normalize(search);
  const normalizedSelected = useMemo(
    () => selectedTags.map(normalize),
    [selectedTags],
  );

  const filteredRooms = useMemo<Room[]>(() => {
    if (!rooms) {
      return [];
    }
    return rooms.filter((room) => {
      if (
        normalizedSearch.length > 0 &&
        !normalize(room.name).includes(normalizedSearch)
      ) {
        return false;
      }
      const roomTags = room.equipment.map(normalize);
      return normalizedSelected.every((tag) => roomTags.includes(tag));
    });
  }, [rooms, normalizedSearch, normalizedSelected]);

  const hasActiveFilter = normalizedSearch.length > 0 || selectedTags.length > 0;

  const toggleTag = (tag: string) => {
    const key = normalize(tag);
    setSelectedTags((current) =>
      current.some((existing) => normalize(existing) === key)
        ? current.filter((existing) => normalize(existing) !== key)
        : [...current, tag],
    );
  };

  const resetFilters = () => {
    setSearch("");
    setSelectedTags([]);
  };

  return (
    <section className="page rooms-page">
      <h1>Räume</h1>

      {loading && (
        <div
          className="rooms-loading"
          role="status"
          aria-busy="true"
          aria-label="Räume werden geladen"
        >
          <p className="rooms-loading__label">Räume werden geladen …</p>
          <div className="rooms-grid" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <div className="room-card room-card--skeleton" key={index}>
                <div className="room-card__skeleton-line room-card__skeleton-line--title" />
                <div className="room-card__skeleton-line room-card__skeleton-line--meta" />
                <div className="room-card__skeleton-line room-card__skeleton-line--tags" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && error !== null && (
        <div className="notice notice--error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="btn btn--secondary rooms-retry"
            onClick={() => void loadRooms()}
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {!loading && error === null && rooms !== null && (
        <>
          {(equipmentTags.length > 0 || rooms.length > 0) && (
            <div className="rooms-filter">
              <div className="rooms-filter__field">
                <label className="rooms-filter__label" htmlFor="rooms-search">
                  Raumname
                </label>
                <input
                  id="rooms-search"
                  className="input"
                  type="search"
                  value={search}
                  placeholder="Nach Raumname suchen …"
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              {equipmentTags.length > 0 && (
                <fieldset className="rooms-filter__equipment">
                  <legend className="rooms-filter__label">Ausstattung</legend>
                  <div className="rooms-filter__chips">
                    {equipmentTags.map((tag) => {
                      const active = normalizedSelected.includes(normalize(tag));
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={
                            active
                              ? "tag rooms-chip rooms-chip--active"
                              : "tag rooms-chip"
                          }
                          aria-pressed={active}
                          onClick={() => toggleTag(tag)}
                        >
                          {active && (
                            <span className="rooms-chip__check" aria-hidden="true">
                              ✓
                            </span>
                          )}
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {hasActiveFilter && (
                <button
                  type="button"
                  className="btn btn--ghost rooms-filter__reset"
                  onClick={resetFilters}
                >
                  Filter zurücksetzen
                </button>
              )}
            </div>
          )}

          {rooms.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">
                Es sind noch keine Räume angelegt.
              </p>
              <p className="empty-state__hint">
                Sobald Räume erfasst sind, erscheinen sie hier.
              </p>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">
                {selectedTags.length > 0
                  ? "Keine Räume mit dieser Ausstattung gefunden — Filter anpassen oder zurücksetzen."
                  : "Keine Räume zu deiner Suche gefunden — Suchbegriff anpassen."}
              </p>
              <p className="empty-state__hint">
                {selectedTags.length > 0
                  ? "Wähle weniger Schlagwörter oder setze den Filter zurück."
                  : "Prüfe den eingegebenen Raumnamen."}
              </p>
            </div>
          ) : (
            <ul className="rooms-grid rooms-list">
              {filteredRooms.map((room) => (
                <li key={room.id} className="rooms-list__item">
                  <Link
                    className="room-card"
                    to={`/rooms/${room.id}`}
                    aria-label={`${room.name}, ${formatSeats(room.seats)}`}
                  >
                    <span className="room-card__name">{room.name}</span>
                    <span className="room-card__meta numeric">
                      <ChairIcon />
                      {formatSeats(room.seats)}
                    </span>
                    {room.equipment.length > 0 && (
                      <span className="room-card__tags">
                        {room.equipment.map((tag) => (
                          <span className="tag" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
