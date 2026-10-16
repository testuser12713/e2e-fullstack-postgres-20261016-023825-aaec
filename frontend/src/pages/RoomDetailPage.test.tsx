import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RoomDetailPage from "./RoomDetailPage";
import type { Booking, Room } from "../types";

const ROOM: Room = {
  id: 3,
  name: "Konferenz Nord",
  seats: 12,
  equipment: ["Beamer", "Whiteboard"],
};

const LATER: Booking = {
  id: 2,
  room_id: 3,
  booked_by: "Berta",
  title: "Sitzung B",
  start: "2026-05-20T13:00:00Z",
  end: "2026-05-20T14:00:00Z",
};

const EARLIER: Booking = {
  id: 1,
  room_id: 3,
  booked_by: "Anna",
  title: "Sitzung A",
  start: "2026-05-20T09:00:00Z",
  end: "2026-05-20T10:30:00Z",
};

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

function installApi(
  bookingsByDate: Record<string, Booking[]>,
  room: Room = ROOM,
): void {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/bookings")) {
      const date = new URL(url).searchParams.get("date") ?? "";
      return Promise.resolve(jsonResponse(bookingsByDate[date] ?? []));
    }
    if (/\/api\/rooms\/\d+$/.test(url)) {
      return Promise.resolve(jsonResponse(room));
    }
    return Promise.resolve(jsonResponse({}, 404));
  });
}

function renderPage(roomId = "3") {
  return render(
    <MemoryRouter initialEntries={[`/rooms/${roomId}`]}>
      <Routes>
        <Route path="/rooms/:roomId" element={<RoomDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RoomDetailPage", () => {
  it("shows the selected room with its seats and equipment", async () => {
    installApi({});
    renderPage("3");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Konferenz Nord",
      }),
    ).toBeInTheDocument();
    const seats = screen.getByText("12 Plätze");
    expect(seats).toBeInTheDocument();
    expect(seats.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("Beamer")).toBeInTheDocument();
    expect(screen.getByText("Whiteboard")).toBeInTheDocument();
  });

  it("renders the seat line for a single seat room", async () => {
    installApi({}, { id: 3, name: "Mini", seats: 1, equipment: [] });
    renderPage("3");

    const seats = await screen.findByText("1 Platz");
    expect(seats.querySelector("svg")).not.toBeNull();
  });

  it("loads the chosen day's bookings in chronological order", async () => {
    installApi({ "2026-05-20": [LATER, EARLIER] });
    renderPage("3");

    await screen.findByRole("heading", {
      level: 1,
      name: "Konferenz Nord",
    });

    fireEvent.change(screen.getByLabelText("Datum"), {
      target: { value: "2026-05-20" },
    });

    expect(await screen.findByText("Sitzung A")).toBeInTheDocument();

    const titles = screen
      .getAllByText(/^Sitzung /)
      .map((element) => element.textContent);
    expect(titles).toEqual(["Sitzung A", "Sitzung B"]);
    expect(screen.getByText("09:00 – 10:30")).toBeInTheDocument();
    expect(screen.getByText("13:00 – 14:00")).toBeInTheDocument();
    expect(screen.getByText("gebucht von: Anna")).toBeInTheDocument();
    expect(screen.getByText("gebucht von: Berta")).toBeInTheDocument();
  });

  it("shows the German day row with prev, date, next and Heute controls", async () => {
    installApi({});
    renderPage("3");

    await screen.findByRole("heading", {
      level: 1,
      name: "Konferenz Nord",
    });

    const dayPicker = screen.getByRole("group", { name: "Tag auswählen" });
    expect(
      screen.getByRole("button", { name: "Vorheriger Tag" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nächster Tag" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heute" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Datum"), {
      target: { value: "2026-05-20" },
    });

    expect(within(dayPicker).getByText(/Mi, 20\.05\.2026/)).toBeInTheDocument();
    expect(within(dayPicker).getByText("UTC")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Vorheriger Tag" }));
    expect(within(dayPicker).getByText(/Di, 19\.05\.2026/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nächster Tag" }));
    expect(within(dayPicker).getByText(/Mi, 20\.05\.2026/)).toBeInTheDocument();
  });

  it("returns to today via the Heute control", async () => {
    installApi({});
    renderPage("3");

    await screen.findByRole("heading", {
      level: 1,
      name: "Konferenz Nord",
    });

    fireEvent.change(screen.getByLabelText("Datum"), {
      target: { value: "2026-05-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Heute" }));

    const today = new Date().toISOString().slice(0, 10);
    expect((screen.getByLabelText("Datum") as HTMLInputElement).value).toBe(
      today,
    );
  });

  it("shows a hint and a create-booking action for a day without bookings", async () => {
    installApi({});
    renderPage("3");

    await screen.findByRole("heading", {
      level: 1,
      name: "Konferenz Nord",
    });

    expect(
      await screen.findByText("An diesem Tag ist der Raum frei."),
    ).toBeInTheDocument();

    const link = await screen.findByRole("link", { name: "Buchung anlegen" });
    expect(link).toHaveAttribute("href", "/bookings/new");
  });
});
