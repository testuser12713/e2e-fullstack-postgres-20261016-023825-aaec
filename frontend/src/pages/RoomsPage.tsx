import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Link } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { Room } from "../types";
import "./RoomsPage.css";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function formatSeats(seats: number): string {
  return seats === 1 ? "1 Platz" : `${seats} Plätze`;
}

function ChairIcon() {
  return (
    <svg
      className="room-card__icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
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

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [roomName, setRoomName] = useState<string>("");
  const [roomSeats, setRoomSeats] = useState<string>("");
  const [roomEquipment, setRoomEquipment] = useState<string[]>([]);
  const [equipmentDraft, setEquipmentDraft] = useState<string>("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

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

  const resetForm = useCallback(() => {
    setRoomName("");
    setRoomSeats("");
    setRoomEquipment([]);
    setEquipmentDraft("");
    setTouched({});
    setSubmitted(false);
    setSubmitting(false);
    setModalError(null);
  }, []);

  const openModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const closeModal = useCallback(() => {
    setModalOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (modalOpen) {
      nameInputRef.current?.focus();
    }
  }, [modalOpen]);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab" || dialogRef.current === null) {
      return;
    }
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

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

  const validationErrors = useMemo(() => {
    const next: { name?: string; seats?: string } = {};
    if (roomName.trim().length === 0) {
      next.name = "Bitte einen Raumnamen angeben.";
    }
    const seats = Number(roomSeats);
    if (roomSeats.trim().length === 0 || !Number.isInteger(seats) || seats < 1) {
      next.seats = "Bitte eine Platzanzahl von mindestens 1 angeben.";
    }
    return next;
  }, [roomName, roomSeats]);

  const visibleError = (field: "name" | "seats"): string | undefined => {
    if (!submitted && !touched[field]) {
      return undefined;
    }
    return validationErrors[field];
  };

  const addEquipmentTag = () => {
    const value = equipmentDraft.trim();
    if (value.length === 0) {
      return;
    }
    setRoomEquipment((current) =>
      current.some((tag) => normalize(tag) === normalize(value))
        ? current
        : [...current, value],
    );
    setEquipmentDraft("");
  };

  const removeEquipmentTag = (tag: string) => {
    setRoomEquipment((current) => current.filter((item) => item !== tag));
  };

  const handleEquipmentKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addEquipmentTag();
    }
  };

  const handleCreateRoom = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setSubmitted(true);
    setModalError(null);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch<Room>("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName.trim(),
          seats: Number(roomSeats),
          equipment: roomEquipment,
        }),
      });
      setModalOpen(false);
      await loadRooms();
      triggerRef.current?.focus();
    } catch (err) {
      if (err instanceof ApiError) {
        setModalError(err.message);
      } else {
        setModalError(
          "Der Raum konnte nicht angelegt werden. Bitte versuchen Sie es erneut.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page rooms-page">
      <div className="rooms-page__head">
        <h1>Räume</h1>
        <button
          type="button"
          className="btn btn--primary"
          onClick={openModal}
          ref={triggerRef}
        >
          Raum anlegen
        </button>
      </div>

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

      {modalOpen && (
        <div
          className="room-modal__overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            className="room-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-modal-title"
            ref={dialogRef}
            onKeyDown={handleDialogKeyDown}
          >
            <div className="room-modal__header">
              <h2 className="room-modal__title" id="room-modal-title">
                Raum anlegen
              </h2>
              <button
                type="button"
                className="room-modal__close"
                onClick={closeModal}
                aria-label="Schließen"
              >
                ×
              </button>
            </div>

            <form className="room-modal__form" onSubmit={handleCreateRoom} noValidate>
              <p className="room-modal__required-note">
                Mit * gekennzeichnete Felder sind Pflichtfelder.
              </p>

              {modalError !== null && (
                <div className="notice notice--error" role="alert">
                  {modalError}
                </div>
              )}

              <div className="room-modal__body">
                <div className="room-modal__field">
                  <label className="room-modal__label" htmlFor="room-modal-name">
                    Name <span className="room-modal__required">*</span>
                  </label>
                  <input
                    id="room-modal-name"
                    ref={nameInputRef}
                    type="text"
                    className={
                      visibleError("name")
                        ? "input room-modal__control--error"
                        : "input"
                    }
                    value={roomName}
                    placeholder="z. B. Konferenzraum"
                    onChange={(event) => {
                      setRoomName(event.target.value);
                      setTouched((current) => ({ ...current, name: true }));
                    }}
                    onBlur={() =>
                      setTouched((current) => ({ ...current, name: true }))
                    }
                    aria-invalid={visibleError("name") ? true : undefined}
                    aria-describedby={
                      visibleError("name") ? "room-modal-name-error" : undefined
                    }
                  />
                  {visibleError("name") && (
                    <p className="room-modal__error" id="room-modal-name-error">
                      {visibleError("name")}
                    </p>
                  )}
                </div>

                <div className="room-modal__field">
                  <label
                    className="room-modal__label"
                    htmlFor="room-modal-seats"
                  >
                    Plätze <span className="room-modal__required">*</span>
                  </label>
                  <input
                    id="room-modal-seats"
                    type="number"
                    min={1}
                    className={
                      visibleError("seats")
                        ? "input room-modal__control--error"
                        : "input"
                    }
                    value={roomSeats}
                    placeholder="z. B. 6"
                    onChange={(event) => {
                      setRoomSeats(event.target.value);
                      setTouched((current) => ({ ...current, seats: true }));
                    }}
                    onBlur={() =>
                      setTouched((current) => ({ ...current, seats: true }))
                    }
                    aria-invalid={visibleError("seats") ? true : undefined}
                    aria-describedby={
                      visibleError("seats") ? "room-modal-seats-error" : undefined
                    }
                  />
                  {visibleError("seats") && (
                    <p className="room-modal__error" id="room-modal-seats-error">
                      {visibleError("seats")}
                    </p>
                  )}
                </div>

                <div className="room-modal__field">
                  <label
                    className="room-modal__label"
                    htmlFor="room-modal-equipment"
                  >
                    Ausstattung
                  </label>
                  <input
                    id="room-modal-equipment"
                    type="text"
                    className="input"
                    value={equipmentDraft}
                    placeholder="z. B. Beamer"
                    onChange={(event) => setEquipmentDraft(event.target.value)}
                    onKeyDown={handleEquipmentKeyDown}
                    onBlur={addEquipmentTag}
                    aria-describedby="room-modal-equipment-helper"
                  />
                  <p
                    className="room-modal__helper"
                    id="room-modal-equipment-helper"
                  >
                    Mit Enter oder Komma bestätigen.
                  </p>
                  {roomEquipment.length > 0 && (
                    <div className="room-modal__tags">
                      {roomEquipment.map((tag) => (
                        <span className="room-modal__tag" key={tag}>
                          {tag}
                          <button
                            type="button"
                            className="room-modal__tag-remove"
                            onClick={() => removeEquipmentTag(tag)}
                            aria-label={`${tag} entfernen`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="room-modal__footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={closeModal}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={submitting}
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
