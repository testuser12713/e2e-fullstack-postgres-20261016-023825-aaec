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

async function fillPeriodAndSearch(start: string, end: string) {
  const user = userEvent.setup();
  fireEvent.change(screen.getByLabelText(/Beginn/), {
    target: { value: start },
  });
  fireEvent.change(screen.getByLabelText(/Ende/), {
    target: { value: end },
  });
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
    await fillPeriodAndSearch("2026-10-20T09:00", "2026-10-20T11:00");

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
    await fillPeriodAndSearch("2026-10-20T09:00", "2026-10-20T11:00");

    expect(
      await screen.findByText(/Kein freier Raum für diesen Zeitraum/),
    ).toBeInTheDocument();
  });

  it("rejects an end before the start without calling the API", async () => {
    renderPage();
    await fillPeriodAndSearch("2026-10-20T11:00", "2026-10-20T09:00");

    expect(
      await screen.findByText("Das Ende muss nach dem Beginn liegen."),
    ).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
