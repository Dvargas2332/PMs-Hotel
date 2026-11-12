import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";

// El TPV se quedaba en blanco: esta prueba lo monta con las respuestas mínimas
// del backend para que un error de render salga acá y no en el navegador.
vi.mock("../../lib/api", () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
  setStaffToken: vi.fn(),
}));
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "prueba", role: "ADMIN", hotelId: "h1", allowedModules: ["restaurant"], permissions: [] },
    logout: vi.fn(),
  }),
}));
vi.mock("../../lib/printAgent", () => ({
  ensurePrintAgentConfigInteractive: vi.fn(() => Promise.resolve(null)),
  printTextToAgent: vi.fn(() => Promise.resolve({ ok: true })),
}));

import RestaurantPage from "./RestaurantPage";

describe("TPV de restaurante", () => {
  afterEach(() => cleanup());

  it("monta la pantalla sin reventar", async () => {
    render(
      <MemoryRouter initialEntries={["/restaurant/pos"]}>
        <RestaurantPage />
      </MemoryRouter>
    );
    // La cabecera y el modal de turno son lo primero que se pinta; si algo del
    // render revienta (como el orden de las variables del cobro), no aparece nada.
    expect(await screen.findByText("Restaurant")).toBeInTheDocument();
    expect(screen.getByText("Apertura de turno")).toBeInTheDocument();
  });
});
