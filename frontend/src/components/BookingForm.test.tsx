import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BookingForm from "./BookingForm";
import { ApiError, apiFetch } from "../api/client";
import type { Booking, Room } from "../types";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = apiFetch as unknown as Mock;

const room: Room = { id: 1, name: "Alpha", seats: 4, equipment: ["Beamer"] };

const createdBooking: Booking = {
  id: 10,
  room_id: 1,
  booked_by: "Anna",
  title: "Planung",
  start: "2030-01-02T09:00:00Z",
  end: "2030-01-02T10:00:00Z",
};

function rejectConflict(): Promise<never> {
  return Promise.reject(
    new ApiError(409, "conflict", "Der Raum ist belegt.", [
      { start: "2030-01-02T09:00:00Z", end: "2030-01-02T11:30:00Z" },
    ]),
  );
}

beforeEach(() => {
  mockedApiFetch.mockReset();
  mockedApiFetch.mockImplementation((path: string) => {
    if (path === "/api/rooms") {
      return Promise.resolve([room]);
    }
    if (path === "/api/bookings") {
      return Promise.resolve(createdBooking);
    }
    return Promise.reject(new Error(`Unerwarteter Pfad: ${path}`));
  });
});

async function waitForRooms(): Promise<void> {
  await screen.findByRole("option", { name: /Alpha/ });
}

function fillDateTime(
  prefix: "Beginn" | "Ende",
  date: string,
  time: string,
): void {
  fireEvent.change(screen.getByLabelText(new RegExp(`${prefix} \\(Datum\\)`)), {
    target: { value: date },
  });
  fireEvent.change(
    screen.getByLabelText(new RegExp(`${prefix} \\(Uhrzeit\\)`)),
    {
      target: { value: time },
    },
  );
}

async function fillValidForm(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await waitForRooms();
  await user.selectOptions(screen.getByLabelText(/^Raum/), "1");
  await user.type(screen.getByLabelText(/Gebucht von/), "Anna");
  await user.type(screen.getByLabelText(/Titel/), "Planung");
  fillDateTime("Beginn", "2030-01-02", "09:00");
  fillDateTime("Ende", "2030-01-02", "10:00");
}

describe("BookingForm", () => {
  it("renders all fields and offers the rooms from the API", async () => {
    render(<BookingForm />);

    await waitForRooms();
    expect(screen.getByLabelText(/Gebucht von/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Titel/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Beginn \(Datum\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Beginn \(Uhrzeit\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ende \(Datum\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ende \(Uhrzeit\)/)).toBeInTheDocument();
  });

  it("shows field errors only after a field was touched or the form was submitted", async () => {
    const user = userEvent.setup();
    render(<BookingForm />);
    await waitForRooms();

    expect(
      screen.queryByText(/Ende muss nach dem Beginn/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Bitte einen Titel angeben/),
    ).not.toBeInTheDocument();

    fillDateTime("Beginn", "2030-01-02", "10:00");
    fillDateTime("Ende", "2030-01-02", "09:00");

    expect(
      await screen.findByText(/Ende muss nach dem Beginn/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Bitte einen Titel angeben/),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buchung anlegen" }));

    expect(
      await screen.findByText(/Bitte einen Titel angeben/),
    ).toBeInTheDocument();
  });

  it("enforces the maximum duration of 8 hours", async () => {
    const user = userEvent.setup();
    render(<BookingForm />);
    await waitForRooms();

    await user.selectOptions(screen.getByLabelText(/^Raum/), "1");
    await user.type(screen.getByLabelText(/Gebucht von/), "Anna");
    await user.type(screen.getByLabelText(/Titel/), "Planung");
    fillDateTime("Beginn", "2030-01-02", "08:00");
    fillDateTime("Ende", "2030-01-02", "17:00");

    await user.click(screen.getByRole("button", { name: "Buchung anlegen" }));

    expect(
      await screen.findByText(/Höchstdauer von 8 Stunden/),
    ).toBeInTheDocument();

    const bookingCalls = mockedApiFetch.mock.calls.filter(
      ([path]) => path === "/api/bookings",
    );
    expect(bookingCalls).toHaveLength(0);
  });

  it("shows the occupied period on a 409 conflict and keeps the entered values", async () => {
    mockedApiFetch.mockImplementation((path: string) => {
      if (path === "/api/rooms") {
        return Promise.resolve([room]);
      }
      if (path === "/api/bookings") {
        return rejectConflict();
      }
      return Promise.reject(new Error(`Unerwarteter Pfad: ${path}`));
    });

    const user = userEvent.setup();
    render(<BookingForm />);
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Buchung anlegen" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/09:00 bis 11:30/);

    expect(screen.getByLabelText(/Titel/)).toHaveValue("Planung");
    expect(screen.getByLabelText(/Gebucht von/)).toHaveValue("Anna");
    expect(screen.getByLabelText(/Beginn \(Uhrzeit\)/)).toHaveValue("09:00");
    expect(screen.getByLabelText(/Ende \(Uhrzeit\)/)).toHaveValue("10:00");
  });

  it("shows a confirmation and posts the booking on success", async () => {
    const user = userEvent.setup();
    render(<BookingForm />);
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Buchung anlegen" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/angelegt/);
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/api/bookings",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          room_id: 1,
          booked_by: "Anna",
          title: "Planung",
          start: "2030-01-02T09:00:00Z",
          end: "2030-01-02T10:00:00Z",
        }),
      }),
    );
  });
});
