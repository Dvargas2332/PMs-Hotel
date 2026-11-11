import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";

// La pantalla de Contabilidad pide cuentas, asientos y períodos al abrir; aquí
// se simulan las respuestas del backend para comprobar que ambos listados se
// pintan y que un error del servidor se ve en pantalla.
const get = vi.fn();
vi.mock("../../lib/api", () => ({
  api: {
    get: (...args) => get(...args),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ t: (key) => key }),
}));
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "prueba", role: "ADMIN", allowedModules: ["accounting"], permissions: ["accounting.read"] },
  }),
}));

import AccountingPage from "./AccountingPage";

const ACCOUNTS = [
  { id: "a1", code: "1.1.01.01", name: "Caja General", type: "ASSET", isActive: true, parentId: null },
  { id: "a2", code: "4.1.01.01", name: "Ventas de Alimentos", type: "INCOME", isActive: true, parentId: null },
];

const ENTRIES = [
  {
    id: "e1",
    number: "AC-2026-00001",
    date: "2026-11-09T10:00:00.000Z",
    description: "Venta restaurante v-0001",
    status: "DRAFT",
    source: "RESTAURANT",
    currency: "CRC",
    lines: [{ id: "l1", debit: 1000, credit: 0, account: ACCOUNTS[0] }],
  },
];

function mockApi({ entries = ENTRIES, accounts = ACCOUNTS, failAccounts = false, settings = null } = {}) {
  get.mockImplementation((url) => {
    if (url.startsWith("/accounting/entries")) return Promise.resolve({ data: { total: entries.length, entries } });
    if (url.startsWith("/accounting/accounts")) {
      if (failAccounts) return Promise.reject({ response: { data: { message: "Permiso insuficiente" } } });
      return Promise.resolve({ data: accounts });
    }
    if (url.startsWith("/accounting/periods")) return Promise.resolve({ data: [] });
    if (url.startsWith("/accounting/settings")) {
      return Promise.resolve({
        data: settings ?? { autoPost: false, fiscalPeriods: false, integrations: {} },
      });
    }
    if (url.startsWith("/accounting/ledger")) return Promise.resolve({ data: { rows: [] } });
    return Promise.resolve({ data: {} });
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountingPage />
    </MemoryRouter>
  );
}

describe("Contabilidad: carga de cuentas y asientos", () => {
  beforeEach(() => {
    get.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("muestra los asientos del libro diario", async () => {
    mockApi();
    renderPage();
    expect(await screen.findByText("AC-2026-00001")).toBeInTheDocument();
  });

  it("muestra el plan de cuentas al abrir esa pestaña", async () => {
    mockApi();
    renderPage();
    const navButtons = await screen.findAllByRole("button", { name: /Plan de Cuentas/i });
    await userEvent.click(navButtons[0]);
    expect(await screen.findByText("1.1.01.01")).toBeInTheDocument();
    expect(screen.getByText("Caja General")).toBeInTheDocument();
  });

  it("avisa en pantalla cuando el plan de cuentas no se puede cargar", async () => {
    mockApi({ failAccounts: true });
    renderPage();
    const navButtons = await screen.findAllByRole("button", { name: /Plan de Cuentas/i });
    await userEvent.click(navButtons[0]);
    await waitFor(() => expect(screen.getByText(/Permiso insuficiente/i)).toBeInTheDocument());
  });

  it("explica por qué el libro diario está vacío cuando no hay conexiones activas", async () => {
    mockApi({ entries: [], settings: { autoPost: true, integrations: {} } });
    renderPage();
    expect(await screen.findByText(/conexiones con módulos están apagadas/i)).toBeInTheDocument();
  });

  it("avisa cuando las conexiones están activas pero el registro automático está apagado", async () => {
    mockApi({ entries: [], settings: { autoPost: false, integrations: { restaurant: true } } });
    renderPage();
    expect(await screen.findByText(/registro automático\s+está desactivado/i)).toBeInTheDocument();
  });
});
