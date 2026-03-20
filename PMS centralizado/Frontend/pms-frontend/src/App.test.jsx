import { render, screen } from "@testing-library/react";
import { test, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";

test("renders login screen", () => {
  render(
    <LanguageProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </LanguageProvider>
  );
  const title = screen.getByRole("heading", { name: /welcome back|bienvenido de vuelta/i });
  expect(title).toBeInTheDocument();
});
