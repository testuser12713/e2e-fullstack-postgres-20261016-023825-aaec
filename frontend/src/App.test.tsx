import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

function renderApp(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App shell", () => {
  it("renders the shell with its navigation", () => {
    renderApp();

    expect(
      screen.getByRole("navigation", { name: "Hauptnavigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Räume" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Freie Räume" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Alle Zeiten in UTC")).toBeInTheDocument();
  });

  it("opens the rooms page on the root route", () => {
    renderApp("/");

    expect(
      screen.getByRole("heading", { level: 1, name: "Räume" }),
    ).toBeInTheDocument();
  });

  it("reaches the free-rooms page through the navigation", async () => {
    const user = userEvent.setup();
    renderApp("/");

    await user.click(screen.getByRole("link", { name: "Freie Räume" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Freie Räume" }),
    ).toBeInTheDocument();
  });

  it("reaches the rooms page through the navigation", async () => {
    const user = userEvent.setup();
    renderApp("/availability");

    await user.click(screen.getByRole("link", { name: "Räume" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Räume" }),
    ).toBeInTheDocument();
  });

  it("renders the room detail route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.includes("/bookings")
          ? []
          : { id: 5, name: "Besprechungsraum", seats: 4, equipment: [] };
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => body,
        } as unknown as Response);
      }),
    );

    renderApp("/rooms/5");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Besprechungsraum",
      }),
    ).toBeInTheDocument();
  });

  it("renders the new booking route with the booking form", () => {
    renderApp("/bookings/new");

    expect(
      screen.getByRole("heading", { level: 1, name: "Neue Buchung" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Buchungsformular" }),
    ).toBeInTheDocument();
  });
});
