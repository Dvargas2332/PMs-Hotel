import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";

// El módulo se quedaba vacío sin decir por qué, y el catálogo CABYS guardado no
// se veía porque la pantalla lo vaciaba con el buscador vacío.
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

const CATALOG = [
  { id: "0123400010100", description: "Tomate cherry orgánico, fresco o refrigerado" },
  { id: "3814001010200", description: "Mesas de trabajo para cocinas y barras" },
];

describe("Facturación electrónica", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockImplementation(() => Promise.resolve({ data: {} }));
  });

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

  it("muestra los códigos CABYS ya guardados al abrir Catálogos", async () => {
    api.get.mockImplementation((url) =>
      String(url).startsWith("/einvoicing/cabys")
        ? Promise.resolve({ data: CATALOG })
        : Promise.resolve({ data: {} })
    );
    renderPage();
    await screen.findByText("Costa Rica (CR-4.4)");
    fireEvent.click(screen.getByRole("button", { name: /Catalogs/i }));
    expect(await screen.findByText("0123400010100")).toBeInTheDocument();
    expect(screen.getByText("Tomate cherry orgánico, fresco o refrigerado")).toBeInTheDocument();
  });

  it("el buscador del catálogo no borra la lista y pide el filtro al servidor", async () => {
    api.get.mockImplementation((url) =>
      String(url).startsWith("/einvoicing/cabys")
        ? Promise.resolve({ data: CATALOG })
        : Promise.resolve({ data: {} })
    );
    renderPage();
    await screen.findByText("Costa Rica (CR-4.4)");
    fireEvent.click(screen.getByRole("button", { name: /Catalogs/i }));
    await screen.findByText("0123400010100");
    fireEvent.change(screen.getByPlaceholderText("Buscar en catálogo..."), { target: { value: "tomate" } });
    await screen.findByText("0123400010100");
    // El filtro va al servidor con su propio retardo: se espera la llamada.
    await waitFor(
      () => {
        const llamadas = api.get.mock.calls.map(([url]) => String(url));
        expect(llamadas.some((u) => u.includes("/einvoicing/cabys?q=tomate"))).toBe(true);
      },
      { timeout: 3000 }
    );
  });
});
