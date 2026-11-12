import { describe, it, expect } from "vitest";
import { shouldUseBackend } from "./backendPrefixes";

// Un módulo que no está en BACKEND_PREFIXES no falla: se responde con el mock y
// la pantalla queda vacía sin error visible. Contabilidad se quedó así y sus
// tres pantallas nunca pidieron datos al servidor, por eso se comprueba aquí.
describe("rutas de módulos que deben ir al backend", () => {
  const rutas = [
    "/accounting/settings",
    "/accounting/accounts?active=true",
    "/accounting/accounts",
    "/accounting/entries",
    "/accounting/entries?limit=20&status=POSTED",
    "/accounting/periods",
    "/accounting/initialize",
  ];

  it.each(rutas)("%s se pide al servidor y no al mock", (ruta) => {
    expect(shouldUseBackend(ruta)).toBe(true);
  });

  it("una ruta de demo que sólo existe en el mock sigue yendo al mock", () => {
    expect(shouldUseBackend("/currency")).toBe(false);
  });
});
