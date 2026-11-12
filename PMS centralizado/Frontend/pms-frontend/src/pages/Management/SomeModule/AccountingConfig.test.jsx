import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// La configuración contable de Management pide las cuentas del plan y las
// formas de cobro del restaurante para armar los selectores de conexión.
const get = vi.fn();
const put = vi.fn();
vi.mock("../../../lib/api", () => ({
  api: {
    get: (...args) => get(...args),
    put: (...args) => put(...args),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "prueba", role: "ADMIN", allowedModules: ["accounting"], permissions: ["accounting.read"] },
  }),
}));

import AccountingConfig from "./AccountingConfig";

const ACCOUNTS = [
  { id: "a1", code: "1.1.01.01", name: "Caja General", type: "ASSET", isActive: true },
  { id: "a2", code: "4.1.01.01", name: "Ventas de Alimentos", type: "INCOME", isActive: true },
];

function mockApi() {
  get.mockImplementation((url) => {
    if (url.startsWith("/accounting/settings")) {
      return Promise.resolve({
        data: { country: "CR", autoPost: false, fiscalPeriods: false, integrations: { restaurant: true }, accountMap: {} },
      });
    }
    if (url.startsWith("/accounting/accounts")) return Promise.resolve({ data: ACCOUNTS });
    if (url.startsWith("/restaurant/payments")) {
      return Promise.resolve({
        data: {
          bccrEmail: "",
          bccrTokenSet: false,
          bccrLastSync: null,
          paymentMethods: [
            { id: "efectivo", name: "Efectivo", enabled: true, account: "a1" },
            { id: "tarjeta", name: "Tarjeta", enabled: true, account: "" },
          ],
        },
      });
    }
    return Promise.resolve({ data: {} });
  });
}

const openTab = (name) => fireEvent.click(screen.getByRole("tab", { name }));

describe("Configuración contable: conexión de cuentas", () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("abre en General y sólo muestra esa sección", async () => {
    mockApi();
    render(<AccountingConfig />);
    expect(await screen.findByText("Registro de asientos")).toBeInTheDocument();
    expect(screen.getByText("Normativa contable")).toBeInTheDocument();
    // Las otras secciones no se montan hasta abrir su pestaña: la pantalla no se alarga.
    expect(screen.queryByText("Cuentas por concepto")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /General/ })).toHaveAttribute("aria-selected", "true");
  });

  it("cambia de sección con la barra de pestañas", async () => {
    mockApi();
    render(<AccountingConfig />);
    await screen.findByText("Registro de asientos");
    openTab(/Conexiones/);
    expect(screen.getByText("Conexiones con módulos")).toBeInTheDocument();
    expect(screen.queryByText("Registro de asientos")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Conexiones/ })).toHaveAttribute("aria-selected", "true");
  });

  it("lista los conceptos con su selector de cuenta", async () => {
    mockApi();
    render(<AccountingConfig />);
    await waitFor(() => expect(get).toHaveBeenCalledWith("/accounting/accounts?active=true"));
    openTab(/Cuentas y cobros/);
    expect(screen.getByText("Cuentas por concepto")).toBeInTheDocument();
    expect(screen.getByText("Efectivo / Caja")).toBeInTheDocument();
    expect(screen.getByText("IVA por pagar")).toBeInTheDocument();
  });

  it("muestra cada forma de cobro del restaurante con su cuenta", async () => {
    mockApi();
    render(<AccountingConfig />);
    await screen.findByText("Registro de asientos");
    openTab(/Cuentas y cobros/);
    expect(screen.getByText("Formas de cobro del restaurante")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Tarjeta").length).toBeGreaterThan(0));
    expect(screen.getByText("Guardar cuentas de cobro")).toBeInTheDocument();
  });
});
