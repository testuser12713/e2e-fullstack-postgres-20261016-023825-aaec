import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Room } from "../types";
import { ApiError, apiFetch } from "../api/client";
import RoomsPage from "./RoomsPage";

vi.mock("../api/client", () => ({
  apiFetch: vi.fn(),
  API_BASE_URL: "http://localhost:8000",
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    details: unknown[];

    constructor(
      status: number,
      code: string,
      message: string,
      details: unknown[] = [],
    ) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
      this.details = details;
    }
  },
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

async function openModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Raum anlegen" }));
  return screen.getByRole("dialog");
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

  it("formats a single seat as '1 Platz'", async () => {
    mockedApiFetch.mockResolvedValueOnce([
      { id: 9, name: "Telefonzelle", seats: 1, equipment: [] },
    ]);
    renderPage();

    expect(await screen.findByText("1 Platz")).toBeInTheDocument();
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

  it("opens the create-room modal from the page head and closes it with Escape", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValueOnce(rooms);
    renderPage();

    await screen.findByText("Konferenzraum");
    const trigger = screen.getByRole("button", { name: "Raum anlegen" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Raum anlegen")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Abbrechen" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Speichern" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("creates a room and shows it in the list afterwards", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValueOnce(rooms);
    renderPage();

    await screen.findByText("Konferenzraum");
    await openModal(user);

    await user.type(screen.getByPlaceholderText("z. B. Konferenzraum"), "Werkstatt");
    await user.type(screen.getByPlaceholderText("z. B. 6"), "5");
    await user.type(screen.getByPlaceholderText("z. B. Beamer"), "Werkbank{Enter}");

    expect(screen.getByText("Werkbank")).toBeInTheDocument();

    mockedApiFetch.mockResolvedValueOnce({
      id: 4,
      name: "Werkstatt",
      seats: 5,
      equipment: ["Werkbank"],
    });
    mockedApiFetch.mockResolvedValueOnce([
      ...rooms,
      { id: 4, name: "Werkstatt", seats: 5, equipment: ["Werkbank"] },
    ]);

    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText("Werkstatt")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/api/rooms",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Werkstatt",
          seats: 5,
          equipment: ["Werkbank"],
        }),
      }),
    );
  });

  it("shows the API message on a 409 conflict and keeps the entered values", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValueOnce(rooms);
    renderPage();

    await screen.findByText("Konferenzraum");
    await openModal(user);

    await user.type(screen.getByPlaceholderText("z. B. Konferenzraum"), "Konferenzraum");
    await user.type(screen.getByPlaceholderText("z. B. 6"), "10");

    mockedApiFetch.mockRejectedValueOnce(
      new ApiError(
        409,
        "conflict",
        "Ein Raum mit diesem Namen existiert bereits.",
        [],
      ),
    );

    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ein Raum mit diesem Namen existiert bereits.",
    );
    expect(screen.getByPlaceholderText("z. B. Konferenzraum")).toHaveValue("Konferenzraum");
    expect(screen.getByPlaceholderText("z. B. 6")).toHaveValue(10);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the API message on a 422 validation error and keeps the modal open", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValueOnce(rooms);
    renderPage();

    await screen.findByText("Konferenzraum");
    await openModal(user);

    await user.type(screen.getByPlaceholderText("z. B. Konferenzraum"), "Neuer Raum");
    await user.type(screen.getByPlaceholderText("z. B. 6"), "3");

    mockedApiFetch.mockRejectedValueOnce(
      new ApiError(
        422,
        "validation_error",
        "Die eingegebenen Werte sind ungültig.",
        [],
      ),
    );

    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Die eingegebenen Werte sind ungültig.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not call the API when the form is empty", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValueOnce(rooms);
    renderPage();

    await screen.findByText("Konferenzraum");
    await openModal(user);

    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Bitte einen Raumnamen angeben.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
