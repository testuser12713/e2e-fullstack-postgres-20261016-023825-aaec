import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Room } from "../types";
import { apiFetch } from "../api/client";
import RoomsPage from "./RoomsPage";

vi.mock("../api/client", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
  API_BASE_URL: "http://localhost:8000",
}));

const mockedApiFetch = vi.mocked(apiFetch);

const rooms: Room[] = [
  {
    id: 1,
    name: "Konferenzraum",
    seats: 12,
    equipment: ["Beamer", "Telefon"],
  },
  { id: 2, name: "Fokusraum", seats: 4, equipment: ["Whiteboard"] },
  { id: 3, name: "Besprechungsraum", seats: 8, equipment: ["Beamer"] },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <RoomsPage />
    </MemoryRouter>,
  );
}

describe("RoomsPage", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it("renders every room with name, seats and equipment tags", async () => {
    mockedApiFetch.mockResolvedValueOnce(rooms);
    renderPage();

    expect(await screen.findByText("Konferenzraum")).toBeInTheDocument();
    expect(screen.getByText("Fokusraum")).toBeInTheDocument();
    expect(screen.getByText("Besprechungsraum")).toBeInTheDocument();

    expect(screen.getByText("12 Plätze")).toBeInTheDocument();
    expect(screen.getByText("4 Plätze")).toBeInTheDocument();
    expect(screen.getByText("8 Plätze")).toBeInTheDocument();
  });

  it("shows the loading state while the request is pending", () => {
    mockedApiFetch.mockImplementation(() => new Promise<Room[]>(() => {}));
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Räume werden geladen",
    );
  });

  it("narrows the list immediately when an equipment chip is selected", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValueOnce(rooms);
    renderPage();

    await screen.findByText("Konferenzraum");

    await user.click(screen.getByRole("button", { name: /Beamer/ }));

    expect(screen.getByText("Konferenzraum")).toBeInTheDocument();
    expect(screen.getByText("Besprechungsraum")).toBeInTheDocument();
    expect(screen.queryByText("Fokusraum")).not.toBeInTheDocument();
  });

  it("shows a readable hint when no room matches the equipment filter", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValueOnce(rooms);
    renderPage();

    await screen.findByText("Konferenzraum");

    await user.click(screen.getByRole("button", { name: /Beamer/ }));
    await user.click(screen.getByRole("button", { name: /Whiteboard/ }));

    expect(
      screen.getByText(/Keine Räume mit dieser Ausstattung gefunden/),
    ).toBeInTheDocument();
  });

  it("shows an error notice when loading fails", async () => {
    mockedApiFetch.mockRejectedValueOnce(new Error("Netzwerkfehler"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Netzwerkfehler");
  });
});
