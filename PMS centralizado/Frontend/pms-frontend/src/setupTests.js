import { vi } from "vitest";

// Mock API to avoid network calls in tests.
vi.mock("./lib/api", () => {
  const makeResp = (data = {}) => Promise.resolve({ data });
  const api = {
    get: () => makeResp({}),
    post: () => makeResp({}),
    put: () => makeResp({}),
    patch: () => makeResp({}),
    delete: () => makeResp({}),
    login: () =>
      makeResp({
        token: "test.token.value",
        user: { email: "test@local", isGestor: false },
        hotel: { id: "hotel-test", name: "Hotel Test", membership: "HBASIC" },
      }),
    loginUser: () => makeResp({}),
    register: () => makeResp({}),
  };
  return { api, BASE: "http://localhost:4000/api", USE_MOCK: true };
});

if (typeof window !== "undefined") {
  window.alert = () => {};
}

if (typeof process !== "undefined" && process?.emitWarning) {
  const originalEmit = process.emitWarning.bind(process);
  process.emitWarning = (warning, ...args) => {
    const msg = typeof warning === "string" ? warning : warning?.message || "";
    if (warning?.name === "DeprecationWarning" && msg.includes("punycode")) return;
    return originalEmit(warning, ...args);
  };
}
