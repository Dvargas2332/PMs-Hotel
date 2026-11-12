import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";

// El módulo se quedaba vacío sin decir por qué. Esta prueba lo monta y comprueba
// que, si la configuración no carga, el motivo (con su código HTTP) se ve.
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", role: "ADMIN", hotelId: "h1" }, logout: vi.fn() }),
}));
vi.mock("../../lib/api", () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

import EInvoicingPage from "./EInvoicingPage";
import { LanguageProvider } from "../../context/LanguageContext";
import { api } from "../../lib/api";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/einvoicing"]}>
      <LanguageProvider>
        <EInvoicingPage />
      </LanguageProvider>
    </MemoryRouter>
  );

describe("Facturación electrónica", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("monta el módulo sin reventar", async () => {
    renderPage();
    expect(await screen.findByText("Costa Rica (CR-4.4)")).toBeInTheDocument();
  });

  it("si la configuración no carga, muestra el código HTTP y el motivo", async () => {
    api.get.mockImplementation((url) =>
      String(url).startsWith("/einvoicing/config")
        ? Promise.reject({ response: { status: 403, data: { message: "Permiso insuficiente" } } })
        : Promise.resolve({ data: {} })
    );
    renderPage();
    expect(await screen.findByText("HTTP 403 · Permiso insuficiente")).toBeInTheDocument();
  });
});
