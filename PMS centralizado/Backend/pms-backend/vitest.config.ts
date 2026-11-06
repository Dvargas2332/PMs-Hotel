import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Solo las pruebas fuente: dist/ es salida de compilación y duplicaría la corrida.
    include: ["src/**/*.test.ts"],
  },
});
