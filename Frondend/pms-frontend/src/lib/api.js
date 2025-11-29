// src/lib/api.js
import axios from "axios";
import { mockApi } from "./mock";

// ===== Entorno CRA (.env) =====
// REACT_APP_API_URL, REACT_APP_MOCK (1/true para activar mock)
const USE_MOCK =
  process.env.REACT_APP_MOCK === "0" ||
  String(process.env.REACT_APP_MOCK || "").toLowerCase() === "true";

const BASE = String(process.env.REACT_APP_API_URL || "http://localhost:4000/api")
  .replace(/\/+$/, "");

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
let http = null;

if (!USE_MOCK) {
  http = axios.create({
    baseURL: BASE,
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });

  // Authorization: Bearer <token>
  http.interceptors.request.use((cfg) => {
    const token = getToken();
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  });
}

// ===== API =====
// Si USE_MOCK es true, delega en mockApi (debe exponer firmas equivalentes).
// Si no, usa axios (http) para llamar al backend real.
export const api = USE_MOCK
  ? mockApi
  : {
      // --- auth ---
      async login(email, password) {
        const { data } = await http.post("/auth/login", { email, password });
        return data;
      },
      async register(name, email, password) {
        const { data } = await http.post("/auth/register", { name, email, password });
        return data;
      },

      // --- rooms ---
      async listRooms() {
        const { data } = await http.get("/rooms");
        return data;
      },
      async createRoom(room) {
        const { data } = await http.post("/rooms", room);
        return data;
      },

      async listRoomTypes() {
        const { data } = await http.get("/room-types");
        return data;
      },

      async createRoomType(payload) {
        const { data } = await http.post("/room-types", payload);
         return data;
      },

      async listRooms() {
        const { data } = await http.get("/rooms"); 
        return data; 
      },


      // --- guests ---
      async listGuests(q) {
        const path = q ? `/guests?q=${encodeURIComponent(q)}` : "/guests";
        const { data } = await http.get(path);
        return data;
      },
      async createGuest(g) {
        const { data } = await http.post("/guests", g);
        return data;
      },

      // --- reservations ---
      async listReservations() {
        const { data } = await http.get("/reservations");
        return data;
      },
      async createReservation(r) {
        const { data } = await http.post("/reservations", r);
        return data;
      },
      async checkIn(id) {
        const { data } = await http.post(`/reservations/${id}/checkin`);
        return data;
      },
      async checkOut(id) {
        const { data } = await http.post(`/reservations/${id}/checkout`);
        return data;
      },

      // --- settings (Management) ---
      async getSettings() {
        const { data } = await http.get("/settings");
        return data;
      },
      async updateSettings(patch) {
        const { data } = await http.put("/settings", patch);
        return data;
      },
    };

// (Opcional) exporta http por si quieres usarlo en servicios específicos
export { http, BASE, USE_MOCK };
