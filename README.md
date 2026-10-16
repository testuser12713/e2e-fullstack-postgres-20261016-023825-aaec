# Raumbuchung

Eine zweiteilige Anwendung zur Buchung von Büroräumen: eine REST-API aus Python,
FastAPI, Pydantic v2 und SQLAlchemy 2.0 auf einer echten PostgreSQL-Datenbank,
dazu ein Vite/React/TypeScript-Frontend. Verwaltet werden Räume (eindeutiger Name,
Anzahl Plätze, Ausstattung als Schlagwörter) und Buchungen (Raum, gebucht von,
Titel, Beginn, Ende) mit Regeln gegen sich überschneidende oder ungültige
Buchungen und einem einheitlichen Fehlerkörper. Dieses Repository enthält den
Backend-Dienst `api` in `backend/`; der Frontend-Dienst `web` in `frontend/` ist
ein eigenständiger Dienst desselben Produkts.

## Tech-Stack

- **Sprache Backend:** Python 3.13
- **Framework Backend:** FastAPI mit Pydantic v2
- **ORM:** SQLAlchemy 2.0 mit psycopg; das Schema wird beim Start angelegt
- **Datenbank:** PostgreSQL 18 (kein SQLite, auch nicht in Tests)
- **Backend-Tests:** pytest mit dem FastAPI-TestClient (httpx) gegen eine echte PostgreSQL-Datenbank
- **Frontend:** Vite mit React und TypeScript (Dienst `web`)
- **Schnittstelle:** REST über JSON unter `/api`, einheitlicher Fehlerkörper

## Schnellstart

### 1. Datenbank starten

```bash
docker compose up -d
```

Das startet PostgreSQL 18 auf Port `5432` mit Benutzer/Datenbank `app`.
Die Daten liegen im Docker-Volume `db-data` und bleiben über Neustarts erhalten.

### 2. Backend installieren

```bash
cd backend
python -m pip install -r requirements.txt
```

### 3. Backend starten (Entwicklung)

```bash
cd backend
export DATABASE_URL="postgresql://app@localhost:5432/app"
export CORS_ORIGINS="http://localhost:5173"
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Danach prüft `GET http://localhost:8000/api/health` die Erreichbarkeit:
`{"status": "ok", "database": "ok"}`. Das Schema (Tabellen `rooms` und `bookings`)
wird beim Start automatisch angelegt — es ist keine Migration von Hand nötig.

### 4. Tests ausführen

```bash
cd backend
export DATABASE_URL="postgresql://app@localhost:5432/app"
PYTHONPATH=. python -m pytest
```

Die Tests laufen gegen die echte PostgreSQL-Datenbank aus `TEST_DATABASE_URL`
(Rückfall auf `DATABASE_URL`). Es gibt keinen SQLite- oder In-Memory-Ersatz.

## Produktions-Build

Das Backend wird nicht kompiliert; es wird als ASGI-Anwendung gestartet:

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Ein Produktionsstart bindet an alle Interfaces und setzt `DATABASE_URL` sowie
`CORS_ORIGINS` auf die echten Werte der Umgebung.

## Umgebungsvariablen

| Variable        | Dienst | Bedeutung                                                                 |
| --------------- | ------ | ------------------------------------------------------------------------- |
| `DATABASE_URL`  | api    | PostgreSQL-DSN, z. B. `postgresql://app@localhost:5432/app`           |
| `CORS_ORIGINS`  | api    | Komma-getrennte Liste erlaubter Frontend-Herkünfte (Standard: `http://localhost:5173`) |
| `TEST_DATABASE_URL` | api (Tests) | PostgreSQL-DSN für die Tests; fällt auf `DATABASE_URL` zurück |
| `VITE_API_BASE_URL` | web | Basis-URL der API (siehe `RUN.json` / Frontend-Dienst)              |

`RUN.json` im Repository-Stamm beschreibt, wie beide Dienste (`api`, `web`) und
die Datenbank (`db`) gestartet werden. Der Frontend-Dienst `web` wird dort
deklariert; für ihn ist `frontend/` (noch nicht in diesem Zweig vorhanden)
maßgeblich. Die API liest `CORS_ORIGINS` aus der Umgebung und behält einen
funktionierenden Standard, solange der Frontend-Dienst seinen Ursprung noch nicht
gemeldet hat.

## API

Basis-URL: `http://localhost:8000`. Alle Antworten mit Status >= 400 haben den
einheitlichen Fehlerkörper:

```json
{"error": {"code": "not_found", "message": "Raum 7 wurde nicht gefunden.", "details": []}}
```

`code` stammt aus der festen Menge `validation_error` (422), `not_found` (404),
`conflict` (409), `internal_error` (500 und jeder nicht abgebildete Status).

| Methode | Pfad                                     | Body / Query                                                              | Antwort                       | Status |
| ------- | ---------------------------------------- | ------------------------------------------------------------------------- | ----------------------------- | ------ |
| GET     | `/api/health`                            | –                                                                         | `{"status": "ok", "database": "ok"}` | 200 |
| POST    | `/api/rooms`                             | `{"name": str, "seats": int >= 1, "equipment": [str]}`                    | Raum                          | 201 |
| GET     | `/api/rooms`                             | `?equipment=<tag>` (wiederholbar)                                         | Liste von Räumen              | 200 |
| GET     | `/api/rooms/{room_id}`                   | –                                                                         | Raum                          | 200 / 404 |
| PATCH   | `/api/rooms/{room_id}`                   | `{"name"?, "seats"?, "equipment"?}`                                       | Raum                          | 200 / 404 / 409 |
| DELETE  | `/api/rooms/{room_id}`                   | –                                                                         | –                             | 204 / 404 |
| GET     | `/api/rooms/{room_id}/bookings`          | `?date=YYYY-MM-DD`                                                        | Liste der Tagesbuchungen      | 200 / 404 / 422 |
| GET     | `/api/rooms/availability`                | `?start=<iso8601>&end=<iso8601>&min_seats=<int>`                          | freie Räume                   | 200 / 422 |
| POST    | `/api/bookings`                          | `{"room_id": int, "booked_by": str, "title": str, "start": iso, "end": iso}` | Buchung                    | 201 / 404 / 409 |
| GET     | `/api/bookings`                          | `?room_id=<int>&date=YYYY-MM-DD` (beide optional)                         | Liste von Buchungen           | 200 |
| GET     | `/api/bookings/{booking_id}`             | –                                                                         | Buchung                       | 200 / 404 |
| PATCH   | `/api/bookings/{booking_id}`             | `{"room_id"?, "booked_by"?, "title"?, "start"?, "end"?}`                  | Buchung                       | 200 / 404 / 409 |
| DELETE  | `/api/bookings/{booking_id}`             | –                                                                         | –                             | 204 / 404 / 409 |

Alle Zeitstempel werden als UTC im ISO-8601-Format mit `Z` ausgetauscht. Dieser
Zweig liefert das Gerüst: `GET /api/health` ist implementiert, die übrigen Routen
sind registriert und antworten bis zu ihrer Umsetzung mit `501` im einheitlichen
Fehlerkörper. Die Fachfunktionen liefern die jeweiligen Tickets nach.

## Funktionen (Feature-Liste)

- Einheitlicher Fehlerkörper für jede Antwort mit Status >= 400
- `GET /api/health` mit Datenbankprüfung
- Raum-CRUD mit eindeutigem Namen (ohne Beachtung von Groß-/Kleinschreibung) und Ausstattungsfilter
- Buchungs-CRUD mit den vier Regeln: Ende nach Beginn, Höchstdauer 8 Stunden,
  keine Überschneidung im selben Raum, keine Änderung oder Löschung begonnener Buchungen
- Tagesansicht der Buchungen eines Raums
- Suche nach freien Räumen in einem Zeitraum mit Mindest-Platzzahl
- Frontend (Dienst `web`): Raumliste mit Filter, Tagesansicht, Buchungsformular mit
  Validierung und Überschneidungsmeldung sowie die Suche nach freien Räumen
