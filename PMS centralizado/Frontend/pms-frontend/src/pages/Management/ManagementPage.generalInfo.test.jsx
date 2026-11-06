import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { LanguageProvider } from "../../context/LanguageContext";
import { ThemeProvider } from "../../context/ThemeContext";
import ManagementPage from "./ManagementPage";

afterEach(() => cleanup());

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      role: "ADMIN",
      permissions: ["management.settings.write"],
      allowedModules: ["management", "frontdesk", "restaurant"],
    },
    hotel: { id: "h1", name: "Hotel", allowedModules: ["management", "frontdesk", "restaurant"] },
  }),
}));

vi.mock("../../lib/api", () => ({
  api: {
    get: vi.fn(async (url) => {
      if (String(url).includes("/hotel/company")) {
        return { data: { name: "Empresa de prueba", companyId: "123", email: "e@x.com" } };
      }
      return { data: {} };
    }),
    put: vi.fn(async () => ({ data: {} })),
    post: vi.fn(async () => ({ data: {} })),
    patch: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async () => ({ data: {} })),
  },
}));

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

describe("ManagementPage · Información general", () => {
  it("muestra la empresa al abrir la sección", async () => {
    render(
      <ThemeProvider>
        <LanguageProvider>
          <MemoryRouter initialEntries={["/management"]}>
            <ManagementPage />
          </MemoryRouter>
        </LanguageProvider>
      </ThemeProvider>
    );

    expect(await screen.findByText(/Información general de la empresa/i)).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Empresa de prueba")).toBeInTheDocument();
  });

  it("el botón Información general vuelve a la sección de empresa", async () => {
    render(
      <ThemeProvider>
        <LanguageProvider>
          <MemoryRouter initialEntries={["/management"]}>
            <ManagementPage />
          </MemoryRouter>
        </LanguageProvider>
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /general information/i }));
    expect(await screen.findByText(/Información general de la empresa/i)).toBeInTheDocument();
  });
});
