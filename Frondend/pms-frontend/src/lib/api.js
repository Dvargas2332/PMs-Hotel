// src/lib/api.js
import axios from "axios";
import { mockApi } from "./mock";

// ===== Entorno CRA (.env) =====
// REACT_APP_API_URL, REACT_APP_MOCK (1/true para activar mock)
const USE_MOCK = ["1", "true", "yes"].includes(
  String(process.env.REACT_APP_MOCK || "").toLowerCase()
);

const BASE = String(process.env.REACT_APP_API_URL || "http://localhost:4000/api").replace(
  /\/+$/,
  ""
);

// Prefijos que existen en el backend real (si alguno no esta, caera al mock)
const BACKEND_PREFIXES = [
  "/auth",
  "/launcher",
  "/reservations",
  "/rooms",
  "/roomTypes",
  "/guests",
  "/hotel",
  "/health",
  "/roles",
  "/permissions",
  "/restaurant",
  "/reports",
  "/invoices",
  "/geo",
  "/cash-audits",
];

// ===== Token helpers =====
export function getToken() {
  return localStorage.getItem("token");
}
export function setToken(t) {
  if (t) localStorage.setItem("token", t);
}
export function clearToken() {
  localStorage.removeItem("token");
}

// ===== Cliente HTTP (axios) =====
const http = !USE_MOCK
  ? (() => {
      const instance = axios.create({
        baseURL: BASE,
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      });

      // Authorization: Bearer <token>
      instance.interceptors.request.use((cfg) => {
        const token = getToken();
        if (token) cfg.headers.Authorization = `Bearer ${token}`;
        return cfg;
      });
      return instance;
    })()
  : null;

// Normaliza rutas: quita prefijos /api extra y fuerza slash inicial
const normalizePath = (url = "") => {
  const withoutOrigin = url.replace(/^https?:\/\/[^/]+/i, "");
  let clean = withoutOrigin.startsWith("/api")
    ? withoutOrigin.replace(/^\/api\/?/, "/")
    : withoutOrigin;
  clean = clean.replace(/^\/+/, "/");
  if (!clean.startsWith("/")) clean = `/${clean}`;
  return clean;
};

const shouldUseBackend = (path) => BACKEND_PREFIXES.some((p) => path.startsWith(p));

const get = async (url, config) => {
  const path = normalizePath(url);
  if (!USE_MOCK && http && shouldUseBackend(path)) {
    try {
      return await http.get(path, config);
    } catch (err) {
      const status = err?.response?.status;
      if (status !== 404 && status !== 501) throw err;
    }
  }
  return mockApi.get(path, config);
};

const post = async (url, data, config) => {
  const path = normalizePath(url);
  if (!USE_MOCK && http && shouldUseBackend(path)) {
    try {
      return await http.post(path, data, config);
    } catch (err) {
      const status = err?.response?.status;
      if (status !== 404 && status !== 501) throw err;
    }
  }
  return mockApi.post(path, data, config);
};

const put = async (url, data, config) => {
  const path = normalizePath(url);
  if (!USE_MOCK && http && shouldUseBackend(path)) {
    try {
      return await http.put(path, data, config);
    } catch (err) {
      const status = err?.response?.status;
      if (status !== 404 && status !== 501) throw err;
    }
  }
  return mockApi.put(path, data, config);
};

const del = async (url, config) => {
  const path = normalizePath(url);
  if (!USE_MOCK && http && shouldUseBackend(path)) {
    try {
      return await http.delete(path, config);
    } catch (err) {
      const status = err?.response?.status;
      if (status !== 404 && status !== 501) throw err;
    }
  }
  return mockApi.delete(path, config);
};

// ===== API =====
// Hybrid: usa backend para los prefijos conocidos y mock para el resto o si 404.
export const api = {
  get,
  post,
  put,
  delete: del,
  // --- auth ---
  async login(email, password) {
    const { data } = await post("/auth/login", { email, password });
    return data;
  },
  async loginUser(username, password) {
    // Login de usuario del launcher (tabla UserLauncher)
    const { data } = await post("/launcher/login", { username, password });
    return data;
  },
  async register(name, email, password) {
    const { data } = await post("/auth/register", { name, email, password });
    return data;
  },
};

// (Opcional) exporta http por si quieres usarlo en servicios especificos
export { http, BASE, USE_MOCK };
