import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: react({
    include: "**/*.{js,jsx,ts,tsx}",
  }),
  test: {
    environment: "jsdom",
    setupFiles: "src/setupTests.js",
  },
  esbuild: {
    loader: "jsx",
    include: /src[\\/].*\.[jt]sx?$/,
  },
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
  build: {
    outDir: "build",
  },
});
