// src/store/configStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Estado inicial */
const defaultConfig = {
  hotel: { name: "Hotel Name", timezone: "America/Costa_Rica" },
  rooms: [], // [{id, number, type, status}]
  restaurant: { taxes: [], menus: [] },
  accounting: {
    currency: "CRC",
    taxRate: 0.13,
    fx: {
      provider: "manual",          // manual | bccr | ecb | custom
      base: "CRC",
      display: "CRC",
      secondary: "USD",
      supported: ["CRC", "USD"],
      rates: { USD: 0 },           // { USD: n, EUR: n } relativos a base
      rounding: 2,
      buy: 0,                      // compra moneda secundaria
      sell: 0,                     // venta moneda secundaria
      lastUpdated: null,
      custom: { endpoint: "", apiKey: "", headers: "" },
      bccr: { use: "venta" },      // compra | venta | promedio
    },
  },
  permissions: {}, // role -> [perms]
  users: [],       // [{id, name, email, role}]
};

const uuid = () =>
  (typeof crypto !== "undefined" && crypto?.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()));

// comparadores
const shallowEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
};

const deepEqualArray = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((ai, i) => JSON.stringify(ai) === JSON.stringify(b[i]));
};

const useConfigStore = create(
  persist(
    (set, get) => ({
      // ---- FLAG DE HIDRATACIÓN ----
      _hasHydrated: false,
      _setHasHydrated: (v) => set({ _hasHydrated: v }),

      // ---- ESTADO ----
      config: defaultConfig,

      /** HOTEL */
      setHotel: (patch) =>
        set((state) => {
          const next = { ...state.config.hotel, ...patch };
          if (shallowEqual(next, state.config.hotel)) return state;
          return { config: { ...state.config, hotel: next } };
        }),

      /** ROOMS */
      setRooms: (rooms) =>
        set((state) => {
          const current = state.config.rooms;
          if (current === rooms) return state;
          if (deepEqualArray(rooms, current)) return state;
          return { config: { ...state.config, rooms } };
        }),

      addRoom: ({ number, type = "standard", status = "available" }) =>
        set((state) => {
          const n = String(number).trim();
          // evita duplicados por número
          if (state.config.rooms.some((r) => String(r.number).trim() === n)) {
            return state; // no-op
          }
          return {
            config: {
              ...state.config,
              rooms: [...state.config.rooms, { id: uuid(), number: n, type, status }],
            },
          };
        }),

      updateRoom: (id, patch) =>
        set((state) => ({
          config: {
            ...state.config,
            rooms: state.config.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)),
          },
        })),

      removeRoom: (id) =>
        set((state) => ({
          config: { ...state.config, rooms: state.config.rooms.filter((r) => r.id !== id) },
        })),

      /** USERS */
      setUsers: (users) =>
        set((state) => {
          const current = state.config.users;
          if (current === users) return state;
          if (deepEqualArray(users, current)) return state;
          return { config: { ...state.config, users } };
        }),

      addUser: ({ name, email, role = "staff" }) =>
        set((state) => ({
          config: {
            ...state.config,
            users: [...state.config.users, { id: uuid(), name, email, role }],
          },
        })),

      updateUser: (id, patch) =>
        set((state) => ({
          config: {
            ...state.config,
            users: state.config.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
          },
        })),

      removeUser: (id) =>
        set((state) => ({
          config: { ...state.config, users: state.config.users.filter((u) => u.id !== id) },
        })),

      /** PERMISSIONS */
      setPermissions: (permMap) =>
        set((state) => {
          if (state.config.permissions === permMap) return state;
          return { config: { ...state.config, permissions: permMap } };
        }),

      /** RESTAURANT */
      setRestaurant: (patch) =>
        set((state) => {
          const next = { ...state.config.restaurant, ...patch };
          if (shallowEqual(next, state.config.restaurant)) return state;
          return { config: { ...state.config, restaurant: next } };
        }),

      addRestaurantTax: ({ name = "IVA", rate = 0.13 }) =>
        set((state) => ({
          config: {
            ...state.config,
            restaurant: {
              ...state.config.restaurant,
              taxes: [...(state.config.restaurant.taxes || []), { id: uuid(), name, rate }],
            },
          },
        })),

      removeRestaurantTax: (id) =>
        set((state) => ({
          config: {
            ...state.config,
            restaurant: {
              ...state.config.restaurant,
              taxes: (state.config.restaurant.taxes || []).filter((t) => t.id !== id),
            },
          },
        })),

      /** ACCOUNTING */
      setAccounting: (patch) =>
        set((state) => {
          const next = { ...state.config.accounting, ...patch };
          if (shallowEqual(next, state.config.accounting)) return state;
          return { config: { ...state.config, accounting: next } };
        }),

      // Helpers opcionales para FX (puedes usarlos o ignorarlos)
      setFx: (patch) =>
        set((state) => ({
          config: {
            ...state.config,
            accounting: {
              ...state.config.accounting,
              fx: { ...state.config.accounting.fx, ...patch },
            },
          },
        })),
      setFxRates: (rates) =>
        set((state) => ({
          config: {
            ...state.config,
            accounting: {
              ...state.config.accounting,
              fx: { ...state.config.accounting.fx, rates },
            },
          },
        })),

      /** UTIL */
      resetConfig: () => set({ config: defaultConfig }),
    }),
    {
      name: "pms-config",
      version: 3, // bump para buy/sell FX y dedupe rooms
      partialize: (state) => ({
        config: {
          hotel: state.config.hotel,
          rooms: state.config.rooms,
          users: state.config.users,
          permissions: state.config.permissions,
          restaurant: { taxes: state.config.restaurant.taxes, menus: state.config.restaurant.menus },
          accounting: state.config.accounting,
        },
      }),
      migrate: (state, fromVersion) => {
        const s = state || { config: defaultConfig };

        if (fromVersion < 2) {
          const prev = s.config || defaultConfig;
          const dedupMap = new Map();
          for (const r of prev.rooms || []) dedupMap.set(String(r.number).trim(), r);

          const withFx = {
            ...prev,
            accounting: {
              ...defaultConfig.accounting,
              ...prev.accounting,
              fx: { ...defaultConfig.accounting.fx, ...(prev.accounting?.fx || {}) },
            },
            rooms: Array.from(dedupMap.values()),
          };

          return { ...s, config: withFx };
        }

        if (fromVersion < 3) {
          const prev = s.config || defaultConfig;
          const fxPrev = prev.accounting?.fx || {};
          return {
            ...s,
            config: {
              ...prev,
              accounting: {
                ...prev.accounting,
                fx: {
                  ...defaultConfig.accounting.fx,
                  ...fxPrev,
                  buy: fxPrev.buy ?? 0,
                  sell: fxPrev.sell ?? 0,
                },
              },
            },
          };
        }

        return s;
      },
      onRehydrateStorage: () => (state) => {
        state?._setHasHydrated(true);
      },
    }
  )
);

export default useConfigStore;
