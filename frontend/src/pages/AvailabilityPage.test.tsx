import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AvailabilityPage from "./AvailabilityPage";
import { apiFetch } from "../api/client";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

function renderPage() {
  return render(
    <MemoryRouter>
      <AvailabilityPage />
    </MemoryRouter>,
  );
}

function fillPeriod(date: string, start: string, end: string) {
  fireEvent.change(screen.getByLabelText("Datum"), {
    target: { value: date },
  });
  fireEvent.change(screen.getByLabelText("Beginn"), {
    target: { value: start },
  });
  fireEvent.change(screen.getByLabelText("Ende"), {
    target: { value: end },
  });
}

async function fillPeriodAndSearch(date: string, start: string, end: string) {
  const user = userEvent.setup();
  fillPeriod(date, start, end);
  await user.click(screen.getByRole("button", { name: "Freie Räume suchen" }));
}

describe("AvailabilityPage", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("renders the free rooms for the searched period", async () => {
    apiFetchMock.mockResolvedValue([
      {
        id: 1,
        name: "Besprechungsraum Nord",
        seats: 12,
        equipment: ["Beamer", "Whiteboard"],
      },
    ]);

    renderPage();
    await fillPeriodAndSearch("2026-10-20", "09:00", "11:00");

    expect(
      await screen.findByText("Besprechungsraum Nord"),
    ).toBeInTheDocument();
    expect(screen.getByText("12 Plätze")).toBeInTheDocument();
    expect(screen.getByText("Beamer")).toBeInTheDocument();
    expect(screen.getByText("Whiteboard")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/rooms/availability?"),
    );
  });

  it("shows a readable hint when no free room matches", async () => {
    apiFetchMock.mockResolvedValue([]);

    renderPage();
    await fillPeriodAndSearch("2026-10-20", "09:00", "11:00");

    expect(
      await screen.findByText(/Kein freier Raum für diesen Zeitraum/),
    ).toBeInTheDocument();
  });

  it("rejects an end before the start without calling the API", async () => {
    renderPage();
    await fillPeriodAndSearch("2026-10-20", "11:00", "09:00");

    expect(
      await screen.findByText("Das Ende muss nach dem Beginn liegen."),
    ).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("renders one date and two time controls instead of a datetime-local", () => {
    const { container } = renderPage();

    expect(
      container.querySelector('input[type="datetime-local"]'),
    ).toBeNull();

    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(1);
    expect(container.querySelectorAll('input[type="time"]')).toHaveLength(2);
  });

  it("shows the computed duration for the chosen period", () => {
    renderPage();
    fillPeriod("2026-10-20", "09:00", "11:30");

    expect(screen.getByText("Dauer: 2 Std. 30 Min.")).toBeInTheDocument();
  });

  it("marks an invalid field with the error state after submit", async () => {
    const { container } = renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Freie Räume suchen" }));

    expect(
      await screen.findByText("Bitte ein Datum angeben."),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".datetime-field__input--error"),
    ).not.toBeNull();
  });

  it("keeps untouched fields neutral", () => {
    const { container } = renderPage();

    expect(
      container.querySelector(".datetime-field__input--error"),
    ).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
