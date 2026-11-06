// src/lib/api.js
import axios from "axios";
import { mockApi } from "./mock";

// ===== Entorno (.env) =====
const USE_MOCK = ["1", "true", "yes"].includes(
  String(import.meta.env.VITE_MOCK || "").toLowerCase()
);

// When false (default), 404/501 from backend are treated as real errors (no silent mock fallback).
const ALLOW_MOCK_FALLBACK = ["1", "true", "yes"].includes(
  String(import.meta.env.VITE_ALLOW_MOCK_FALLBACK || "").toLowerCase()
);

const DEFAULT_BASE =
  typeof window !== "undefined" && window?.location?.origin
    ? window.location.port === "3000" &&
      ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? "http://localhost:4000/api"
      : `http://${window.location.hostname}:4000/api`
    : "http://localhost:4000/api";

const BASE = String(import.meta.env.VITE_API_URL || DEFAULT_BASE).replace(/\/+$/, "");

// Prefijos que existen en el backend real
const BACKEND_PREFIXES = [
  "/auth",
  "/launcher",
  "/gestor",
  "/settings",
  "/reservations",
  "/rooms",
  "/roomTypes",
  "/ratePlans",
  "/mealPlans",
  "/contracts",
  "/guests",
  "/hotel",
  "/health",
  "/version",
  "/roles",
  "/permissions",
  "/audit",
  "/taxes",
  "/restaurant",
  "/invoices",
  "/einvoicing",
  "/geo",
  "/cash-audits",
];

// ===== httpOnly cookie auth helpers =====
// Con cookies httpOnly, ya no almacenamos el token en localStorage.
// El backend setea access_token y refresh_token como cookies httpOnly.
// Para backward compat y para el login response, aún guardamos token en memoria.

export function getToken() {
  // Ya no usamos localStorage. El token lo envía el navegador vía cookies automáticamente.
  return null;
}
export function setToken(_t) {
  // No-op: el token se maneja vía cookies httpOnly
}
export function clearToken() {
  // No-op: el logout se hace llamando a /api/auth/logout
}

// ===== Sesión de personal de restaurante =====
// El login de cajero/mesero emite un token propio; el backend lo usa para
// validar cobros, anulaciones y descuentos contra el perfil del staff.
let staffToken = null;

export function getStaffToken() {
  return staffToken;
}

export function setStaffToken(token) {
  staffToken = token ? String(token) : null;
  if (!http) return;
  if (staffToken) http.defaults.headers.common["x-staff-token"] = staffToken;
  else delete http.defaults.headers.common["x-staff-token"];
}

// ===== Cliente HTTP (axios) =====
// Flag para evitar loops infinitos de refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

const http = !USE_MOCK
  ? (() => {
      const instance = axios.create({
        baseURL: BASE,
        timeout: 20000,
        withCredentials: true, // envía cookies httpOnly automáticamente
        headers: { "Accept-Encoding": "gzip, deflate, br" },
      });

      // Interceptor de respuesta: auto-refresh en 401
      instance.interceptors.response.use(
        (response) => response,
        async (error) => {
          const originalRequest = error.config;
          // Solo intentar refresh en 401 y si no es el endpoint de refresh/logout/login
          if (
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !originalRequest.url?.includes("/auth/refresh") &&
            !originalRequest.url?.includes("/auth/logout") &&
            !originalRequest.url?.includes("/auth/login") &&
            // Un 401 de credenciales de staff del restaurante NO debe refrescar sesión ni expulsar al usuario
            !originalRequest.url?.includes("/restaurant/staff/login")
          ) {
            if (isRefreshing) {
              // Ya hay un refresh en curso, encolar esta petición
              return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
              }).then(() => instance(originalRequest));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
              const { data } = await instance.post("/auth/refresh");
              processQueue(null, data.token);
              return instance(originalRequest);
            } catch (refreshError) {
              processQueue(refreshError, null);
              // Redirigir al login si el refresh falla
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("auth:logout"));
              }
              return Promise.reject(refreshError);
            } finally {
              isRefreshing = false;
            }
          }
          return Promise.reject(error);
        }
      );

      return instance;
    })()
  : null;

// Normaliza rutas
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
      if (!ALLOW_MOCK_FALLBACK || (status !== 404 && status !== 501)) throw err;
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
      if (!ALLOW_MOCK_FALLBACK || (status !== 404 && status !== 501)) throw err;
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
      if (!ALLOW_MOCK_FALLBACK || (status !== 404 && status !== 501)) throw err;
    }
  }
  return mockApi.put(path, data, config);
};

const patch = async (url, data, config) => {
  const path = normalizePath(url);
  if (!USE_MOCK && http && shouldUseBackend(path)) {
    try {
      return await http.patch(path, data, config);
    } catch (err) {
      const status = err?.response?.status;
      if (!ALLOW_MOCK_FALLBACK || (status !== 404 && status !== 501)) throw err;
    }
  }
  return mockApi.patch(path, data, config);
};

const del = async (url, config) => {
  const path = normalizePath(url);
  if (!USE_MOCK && http && shouldUseBackend(path)) {
    try {
      return await http.delete(path, config);
    } catch (err) {
      const status = err?.response?.status;
      if (!ALLOW_MOCK_FALLBACK || (status !== 404 && status !== 501)) throw err;
    }
  }
  return mockApi.delete(path, config);
};

// ===== API =====
export const api = {
  get,
  post,
  put,
  patch,
  delete: del,
  // --- auth ---
  async login(email, password) {
    const { data } = await post("/auth/login", { email, password });
    return data;
  },
  async loginUser(username, password, hotelId) {
    const endpoint = USE_MOCK ? "/auth/user-login" : "/launcher/login";
    const payload = { username, password, ...(hotelId ? { hotelId } : {}) };
    const { data } = await post(endpoint, payload);
    return data;
  },
  async refresh() {
    const { data } = await post("/auth/refresh");
    return data;
  },
  async logout() {
    await post("/auth/logout");
  },
  async register(name, email, password) {
    const { data } = await post("/auth/register", { name, email, password });
    return data;
  },
};

export { http, BASE, USE_MOCK };
