import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import ProtectedRoute from "./ProtectedRoutes";

// La cookie httpOnly es la que mantiene la sesión; aquí se simula que el
// refresco contesta con sesión válida, como al recargar con F5 o Ctrl+F5.
const refresh = vi.fn();
vi.mock("../lib/api", () => ({
  api: {
    refresh: (...args) => refresh(...args),
    login: vi.fn(),
    loginUser: vi.fn(),
    logout: vi.fn(),
  },
}));

function renderAt(path) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/management"
            element={
              <ProtectedRoute>
                <div>PANEL PROTEGIDO</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>PANTALLA DE LOGIN</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("recargar una pantalla con sesión válida", () => {
  beforeEach(() => {
    refresh.mockReset();
    sessionStorage.clear();
  });

  it("no manda al login cuando el refresco devuelve la sesión", async () => {
    refresh.mockResolvedValue({
      token: "token-de-prueba",
      hotel: { id: "hotel-1", name: "Hotel de prueba" },
      user: { id: "u1", name: "admin", allowedModules: ["management"] },
    });

    renderAt("/management");

    expect(await screen.findByText("PANEL PROTEGIDO")).toBeInTheDocument();
    expect(screen.queryByText("PANTALLA DE LOGIN")).toBeNull();
  });

  it("mantiene la sesión guardada si el refresco falla por red", async () => {
    sessionStorage.setItem("hotel", JSON.stringify({ id: "hotel-1", name: "Hotel de prueba" }));
    sessionStorage.setItem("user", JSON.stringify({ id: "u1", name: "admin", allowedModules: ["management"] }));
    refresh.mockRejectedValue(new Error("Network Error"));

    renderAt("/management");

    expect(await screen.findByText("PANEL PROTEGIDO")).toBeInTheDocument();
  });

  it("manda al login cuando el servidor rechaza la sesión", async () => {
    refresh.mockRejectedValue({ response: { status: 401 } });

    renderAt("/management");

    expect(await screen.findByText("PANTALLA DE LOGIN")).toBeInTheDocument();
  });
});
