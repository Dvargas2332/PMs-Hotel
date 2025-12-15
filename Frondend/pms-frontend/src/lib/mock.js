// src/lib/api.js (mock)

const sleep = (ms = 300) => new Promise((r) => setTimeout(r, ms));
let SETTINGS = {
  "core.currency": "CRC",
  "core.timezone": "America/Costa_Rica",
  "frontdesk.allowEarlyCheckIn": true,
  "frontdesk.defaultCheckInHour": "15:00",
  "accounting.eInvoice.enabled": true,
  "accounting.eInvoice.profile": "GENERAL",
  "discounts.maxPercentWithoutPin": 20,
  "restaurant.serviceCharge.rate": 0.1,
};

// Colecciones en memoria para CRUD de Management
let DB = {
  roles: [
    { id: "ADMIN", name: "ADMIN", description: "Superusuario" },
    { id: "MANAGER", name: "MANAGER", description: "Gerencia" },
    { id: "FRONTDESK_AGENT", name: "FRONTDESK_AGENT", description: "Recepcion" },
  ],
  permissions: [
    "frontdesk.read",
    "frontdesk.create_reservation",
    "frontdesk.checkin",
    "frontdesk.checkout",
    "frontdesk.apply_discount",
    "accounting.invoice.create",
    "accounting.invoice.cancel",
    "management.settings.write",
    "management.users.assign_roles",
    "restaurant.pos.open",
  ],
  rolePermissions: {
    ADMIN: ["*"],
    MANAGER: ["frontdesk.*", "accounting.*", "management.*", "restaurant.*", "audit.*"],
    FRONTDESK_AGENT: [
      "frontdesk.read",
      "frontdesk.create_reservation",
      "frontdesk.checkin",
      "frontdesk.checkout",
    ],
  },
  audit: [],
  roomTypes: [
    { id: "STD", name: "Standard", capacity: 2, baseRate: 45000, currency: "CRC", beds: "1Q", amenities: ["WIFI", "A/C"] },
  ],
  rooms: [{ id: "101", number: "101", typeId: "STD", floor: 1, capacity: 2, status: "AVAILABLE" }],
  ratePlans: [
    { id: "BAR", name: "BAR", currency: "CRC", derived: false, price: 45000, restrictions: { LOSMin: 1, LOSMax: 30 } },
  ],
  contracts: [{ id: "OTA-BOOKING", channel: "Booking.com", commission: 0.15, active: true, ratePlans: ["BAR"] }],
  paymentMethods: [
    { id: "CASH", name: "Efectivo", active: true },
    { id: "CARD", name: "Tarjeta", active: true },
  ],
  discounts: [{ id: "PROMO10", name: "Promo 10%", type: "percent", value: 10, requiresPin: false, active: true }],
  taxes: [
    { id: "VAT", name: "IVA", percent: 13, scope: "room" },
    { id: "POSSVC", name: "Servicio POS", percent: 10, scope: "pos" },
  ],
  printers: [
    { id: "INV_A4", name: "Factura A4", kind: "a4", module: "accounting" },
    { id: "POS_80", name: "Ticket 80mm", kind: "ticket80", module: "restaurant" },
  ],
  currency: { base: "CRC", secondaries: ["USD"], rounding: "line", fx: { USD: 530 } },
  hotelInfo: {
    name: "Hotel Demo",
    legalName: "Hotel Demo S.A.",
    phone: "+506 0000 0000",
    email: "info@demo.com",
    languages: ["es", "en"],
    nationalities: ["Costa Rica", "Estados Unidos", "Nicaragua", "Colombia"],
  },
  cashier: {
    requireOpenShift: true,
    reopenNeedsManager: true,
    cashDiffTolerance: 500,
  },
  mealPlans: [
    { id: "RO", name: "Room Only" },
    { id: "BB", name: "Bed & Breakfast" },
  ],
  usersFD: [
    {
      id: "u1",
      name: "Agente 1",
      username: "fd1",
      password: "1234",
      roles: ["FRONTDESK_AGENT"],
      pinPolicy: 4,
      active: true,
      // Relación usuario-hotel (se mantiene como hotelId en el modelo)
      hotelId: "HOTEL-DEMO-1",
    },
  ],
  invoicing: {
    einvoiceEnabled: true,
    profile: "GENERAL",
    sequencePrefix: "FD-",
    environment: "test",
  },
  restaurantSections: [
    {
      id: "sec-salon",
      name: "Salon Principal",
      tables: [
        { id: "S01", name: "Salon 1", seats: 4, x: 20, y: 40 },
        { id: "S02", name: "Salon 2", seats: 2, x: 50, y: 35 },
        { id: "S03", name: "Salon 3", seats: 4, x: 80, y: 45 },
      ],
    },
    {
      id: "sec-terraza",
      name: "Terraza",
      tables: [
        { id: "T01", name: "Terraza 1", seats: 4, x: 30, y: 50 },
        { id: "T02", name: "Terraza 2", seats: 6, x: 70, y: 55 },
      ],
    },
    {
      id: "sec-barra",
      name: "Barra",
      tables: [
        { id: "B01", name: "Barra 1", seats: 2, x: 40, y: 60 },
        { id: "B02", name: "Barra 2", seats: 2, x: 60, y: 65 },
      ],
    },
  ],
  restaurantMenu: {
    "sec-salon": [
      { id: "E01", name: "Nachos", price: 8, category: "Entradas" },
      { id: "P01", name: "Hamburguesa", price: 11, category: "Platos" },
      { id: "B01", name: "Refresco", price: 3, category: "Bebidas" },
      { id: "D01", name: "Brownie", price: 5, category: "Postres" },
    ],
    "sec-terraza": [
      { id: "E02", name: "Ceviche", price: 9, category: "Entradas" },
      { id: "P02", name: "Pasta Alfredo", price: 12, category: "Platos" },
      { id: "B02", name: "Cerveza", price: 4, category: "Bebidas" },
      { id: "D02", name: "Helado", price: 4, category: "Postres" },
    ],
    "sec-barra": [
      { id: "E03", name: "Alitas BBQ", price: 7.5, category: "Entradas" },
      { id: "P03", name: "Taco trio", price: 9, category: "Platos" },
      { id: "B03", name: "Limonada", price: 3.5, category: "Bebidas" },
      { id: "C02", name: "Alitas + Cerveza", price: 11, category: "Combos" },
    ],
  },
  restaurantConfig: {
    kitchenPrinter: "REST_KITCHEN",
    barPrinter: "REST_BAR",
  },
  restaurantPrinters: [
    { id: "REST_KITCHEN", name: "Cocina Restaurante" },
    { id: "REST_BAR", name: "Bar Restaurante" },
  ],
  restaurantGeneral: {
    nombreComercial: "Rest Demo",
    razonSocial: "Rest Demo S.A.",
    cedula: "3-101-123456",
    telefono: "+506 0000 0000",
    email: "rest@demo.com",
    direccion: "San Jose, CR",
    horario: "11:00 - 23:00",
    resolucion: "DGT-001",
    notas: "",
  },
  restaurantBilling: { comprobante: "factura", margen: "0", propina: "10", autoFactura: true },
  restaurantTaxes: {
    iva: "13",
    servicio: "10",
    descuentoMax: "15",
    permitirDescuentos: true,
    impuestoIncluido: true,
  },
  restaurantPayments: {
    monedaBase: "CRC",
    monedaSec: "USD",
    tipoCambio: "540",
    cobros: ["Efectivo", "Tarjeta"],
    cargoHabitacion: false,
  },
  restaurantFamilies: [],
  restaurantItems: [],
  restaurantRecipes: [],
  restaurantInventory: [],
  restaurantOrders: [],
  restaurantSales: [],
  restaurantCloses: [],
  restaurantLastCloseAt: null,
};

const UNIT_MAP = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  lb: { base: "g", factor: 453.59237 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
  oz: { base: "ml", factor: 29.5735 },
  un: { base: "un", factor: 1 },
};

const normalizeQty = (qty, unit) => {
  const val = Number(qty) || 0;
  const map = UNIT_MAP[unit];
  if (!map) return { value: val, baseUnit: unit || "un" };
  return { value: val * map.factor, baseUnit: map.base };
};

const makeResp = (data) => ({ data });

const normalize = (url = "") => {
  const u = url.replace(/^https?:\/\/[^/]+/i, "");
  const withoutApi = u.startsWith("/api") ? u.replace(/^\/api\/?/, "/") : u;
  return withoutApi.startsWith("/") ? withoutApi : `/${withoutApi}`;
};

const asNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const calcOrderTotals = (items = []) => {
  const subtotal = (items || []).reduce((acc, i) => acc + asNumber(i.price) * asNumber(i.qty || 1), 0);
  const serviceRate = asNumber(DB.restaurantTaxes?.servicio, 0) / 100;
  const taxRate = asNumber(DB.restaurantTaxes?.iva, 0) / 100;
  const service = subtotal * serviceRate;
  const tax = subtotal * taxRate;
  return { subtotal, service, tax, total: subtotal + service + tax };
};

const restaurantStats = () => {
  const lastClose = DB.restaurantLastCloseAt ? new Date(DB.restaurantLastCloseAt) : null;
  const salesSince = DB.restaurantSales.filter((s) => !lastClose || new Date(s.closedAt) > lastClose);
  const systemTotal = salesSince.reduce((acc, s) => acc + asNumber(s.totals?.total), 0);
  const byMethod = {};
  salesSince.forEach((s) => {
    Object.entries(s.payments || {}).forEach(([k, v]) => {
      byMethod[k] = asNumber(byMethod[k]) + asNumber(v);
    });
  });
  const openOrderValue = DB.restaurantOrders.reduce((acc, o) => acc + calcOrderTotals(o.items).total, 0);
  return {
    systemTotal,
    byMethod,
    salesCount: salesSince.length,
    openOrders: DB.restaurantOrders.length,
    openOrderValue,
    lastCloseAt: DB.restaurantLastCloseAt,
  };
};

export const mockApi = {
  get: async (url) => {
    await sleep();
    const raw = normalize(url);
    const [path, query] = raw.split("?");
    if (path === "/settings") return makeResp(SETTINGS);
    if (path === "/audit") return makeResp(DB.audit);
    if (path === "/hotel") return makeResp(DB.hotelInfo);
    if (path === "/restaurant/sections") return makeResp(DB.restaurantSections);
    if (path === "/restaurant/printers") return makeResp(DB.restaurantPrinters);
    if (path === "/restaurant/config") return makeResp(DB.restaurantConfig);
    if (path === "/restaurant/general") return makeResp(DB.restaurantGeneral);
    if (path === "/restaurant/billing") return makeResp(DB.restaurantBilling);
    if (path === "/restaurant/taxes") return makeResp(DB.restaurantTaxes);
    if (path === "/restaurant/payments") return makeResp(DB.restaurantPayments);
    if (path === "/restaurant/families") return makeResp(DB.restaurantFamilies);
    if (path === "/restaurant/items") return makeResp(DB.restaurantItems);
    if (path === "/restaurant/recipes") return makeResp(DB.restaurantRecipes);
    if (path === "/restaurant/inventory") return makeResp(DB.restaurantInventory);
    if (path === "/restaurant/orders") return makeResp(DB.restaurantOrders);
    if (path === "/restaurant/stats") return makeResp(restaurantStats());
    if (path === "/restaurant/close") return makeResp(DB.restaurantCloses);
    if (path === "/restaurant/menu") {
      let sectionId = null;
      if (query) {
        const params = new URLSearchParams(query);
        sectionId = params.get("section");
      }
      const bySection = sectionId ? DB.restaurantMenu[sectionId] : null;
      const flat = Object.values(DB.restaurantMenu || {}).flat();
      return makeResp(bySection && bySection.length ? bySection : flat);
    }
    const key = path.replace(/^\//, "");
    if (DB[key]) return makeResp(DB[key]);
    return makeResp(null);
  },
  put: async (url, payload) => {
    await sleep();
    const path = normalize(url);
    if (path === "/settings") {
      SETTINGS = { ...SETTINGS, ...payload };
      return makeResp(SETTINGS);
    }
    if (path.startsWith("/role-permissions/")) {
      const role = path.split("/").pop();
      DB.rolePermissions[role] = payload.permissions;
      return makeResp({ role, permissions: DB.rolePermissions[role] });
    }
    if (path === "/currency") {
      DB.currency = { ...DB.currency, ...payload };
      return makeResp(DB.currency);
    }
    if (path === "/invoicing") {
      DB.invoicing = { ...DB.invoicing, ...payload };
      return makeResp(DB.invoicing);
    }
    if (path === "/hotel") {
      DB.hotelInfo = { ...DB.hotelInfo, ...payload };
      return makeResp(DB.hotelInfo);
    }
    if (path === "/restaurant/config") {
      DB.restaurantConfig = { ...DB.restaurantConfig, ...payload };
      return makeResp(DB.restaurantConfig);
    }
    if (path === "/restaurant/general") {
      DB.restaurantGeneral = { ...DB.restaurantGeneral, ...payload };
      return makeResp(DB.restaurantGeneral);
    }
    if (path === "/restaurant/billing") {
      DB.restaurantBilling = { ...DB.restaurantBilling, ...payload };
      return makeResp(DB.restaurantBilling);
    }
    if (path === "/restaurant/taxes") {
      DB.restaurantTaxes = { ...DB.restaurantTaxes, ...payload };
      return makeResp(DB.restaurantTaxes);
    }
    if (path === "/restaurant/payments") {
      DB.restaurantPayments = { ...DB.restaurantPayments, ...payload };
      return makeResp(DB.restaurantPayments);
    }
    if (path.startsWith("/restaurant/sections/") && !path.endsWith("/tables")) {
      const id = path.split("/").pop();
      DB.restaurantSections = DB.restaurantSections.map((s) => (s.id === id ? { ...s, ...payload } : s));
      return makeResp(DB.restaurantSections.find((s) => s.id === id));
    }
    return makeResp(payload);
  },
  post: async (url, payload) => {
    await sleep();
    const path = normalize(url);
    if (path === "/auth/login") {
      // Login de HOTEL (demo): membresía PLATINUM con todos los módulos
      return makeResp({
        token: "mock-hotel-token",
        user: {
          id: "hotel-demo-1",
          name: payload?.email || "Hotel Demo",
          email: payload?.email || "hotel@demo.com",
          hotelId: "HOTEL-DEMO-1",
          membership: "PLATINUM",
          // Códigos de módulos habilitados para esta membresía
          allowedModules: ["frontdesk", "restaurant", "accounting", "management"],
        },
      });
    }
    if (path === "/auth/user-login") {
      // Login de USUARIO interno: valida contra DB.usersFD
      const username = (payload?.username || "").trim();
      const password = String(payload?.password || "").trim();
      const user = (DB.usersFD || []).find((u) => u.username === username);
      if (!user || !user.active) {
        return makeResp({ error: "INVALID_USER" }, 401);
      }
      // Si el usuario tiene password definido en DB, valídalo (simple, demo)
      if (typeof user.password === "string" && user.password !== password) {
        return makeResp({ error: "INVALID_CREDENTIALS" }, 401);
      }

      // Construir permisos efectivos a partir de roles
      const roles = Array.isArray(user.roles) ? user.roles : [];
      const permsSet = new Set();
      roles.forEach((r) => {
        const rp = DB.rolePermissions?.[r] || [];
        rp.forEach((p) => {
          if (p === "*") {
            (DB.permissions || []).forEach((all) => permsSet.add(all));
          } else if (p.endsWith(".*")) {
            const prefix = p.replace(/\.\*$/, "");
            (DB.permissions || []).forEach((all) => {
              if (all.startsWith(prefix + ".")) permsSet.add(all);
            });
          } else {
            permsSet.add(p);
          }
        });
      });

      const perms = Array.from(permsSet);
      const modulesSet = new Set();
      if (perms.some((p) => p.startsWith("frontdesk."))) modulesSet.add("frontdesk");
      if (perms.some((p) => p.startsWith("restaurant."))) modulesSet.add("restaurant");
      if (perms.some((p) => p.startsWith("accounting."))) modulesSet.add("accounting");
      if (perms.some((p) => p.startsWith("management."))) modulesSet.add("management");

      return makeResp({
        token: "mock-user-token",
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: Array.isArray(user.roles) ? user.roles[0] || "" : "",
          roles,
          // Campo de relación con hotel para usuarios (se expone como hotelId)
          hotelId: user.hotelId || "HOTEL-DEMO-1",
          permissions: perms,
          modules: Array.from(modulesSet),
        },
      });
    }
    if (path === "/auth/register") {
      return makeResp({
        token: "mock-token",
        user: { id: "mock-user", name: payload?.name || "Mock User", email: payload?.email || "mock@example.com" },
      });
    }
    const key = path.replace(/^\//, "");
    if (path === "/audit") {
      const item = {
        id: Math.random().toString(36).slice(2, 8),
        timestamp: new Date().toISOString(),
        userId: payload?.userId || "system",
        module: payload?.module || payload?.entity || "unknown",
        action: payload?.action || payload?.description || "change",
        ...payload,
      };
      DB.audit.unshift(item);
      return makeResp(item);
    }
    if (path === "/restaurant/order") {
      const now = new Date().toISOString();
      const order = {
        id: payload.id || payload.tableId || Math.random().toString(36).slice(2, 8),
        tableId: payload.tableId,
        sectionId: payload.sectionId,
        items: payload.items || [],
        note: payload.note || "",
        covers: payload.covers || 2,
        status: payload.status || "ENVIADO",
        serviceType: payload.serviceType || "DINE_IN",
        roomId: payload.roomId || "",
        updatedAt: now,
      };
      const idx = DB.restaurantOrders.findIndex((o) => o.tableId === order.tableId);
      if (idx >= 0) DB.restaurantOrders[idx] = { ...DB.restaurantOrders[idx], ...order };
      else DB.restaurantOrders.push(order);
      return makeResp(order);
    }
    if (path === "/restaurant/order/close") {
      const now = new Date().toISOString();
      const totals = payload?.totals && typeof payload.totals === "object" ? payload.totals : calcOrderTotals(payload.items || []);
      const sale = {
        id: payload.id || Math.random().toString(36).slice(2, 8),
        tableId: payload.tableId,
        sectionId: payload.sectionId,
        items: payload.items || [],
        totals,
        payments: payload.payments || {},
        note: payload.note || "",
        covers: payload.covers || 0,
        serviceType: payload.serviceType || "DINE_IN",
        roomId: payload.roomId || "",
        closedAt: now,
      };
      DB.restaurantSales.push(sale);
      DB.restaurantOrders = DB.restaurantOrders.filter((o) => o.tableId !== payload.tableId);
      return makeResp(sale);
    }
    if (path === "/restaurant/close") {
      const now = new Date().toISOString();
      const stats = restaurantStats();
      const reported = asNumber(payload?.totals?.reported ?? payload?.reported);
      const system = stats.systemTotal;
      const close = {
        id: payload.id || Math.random().toString(36).slice(2, 8),
        createdAt: now,
        turno: payload.turno || payload.note || `Turno ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        totals: {
          system,
          reported,
          diff: asNumber(payload?.totals?.diff ?? reported - system),
        },
        payments: payload.payments || {},
        breakdown: payload.breakdown || {},
        note: payload.note || "",
      };
      DB.restaurantCloses.unshift(close);
      DB.restaurantLastCloseAt = now;
      return makeResp(close);
    }
    if (DB[key]) {
      const id = payload.id || Math.random().toString(36).slice(2, 8);
      const item = { id, ...payload };
      DB[key].push(item);
      return makeResp(item);
    }
    if (path === "/restaurant/sections") {
      const item = { id: payload.id, name: payload.name, tables: [] };
      DB.restaurantSections.push(item);
      return makeResp(item);
    }
    if (path.startsWith("/restaurant/sections/") && path.endsWith("/tables")) {
      const secId = path.split("/")[3];
      const sec = DB.restaurantSections.find((s) => s.id === secId);
      if (sec) {
        const tbl = {
          id: payload.id,
          name: payload.name,
          seats: payload.seats || 2,
          x: typeof payload.x === "number" && !Number.isNaN(payload.x) ? payload.x : undefined,
          y: typeof payload.y === "number" && !Number.isNaN(payload.y) ? payload.y : undefined,
        };
        sec.tables = [...(sec.tables || []), tbl];
        return makeResp(sec.tables);
      }
    }
    if (path === "/restaurant/print") {
      const job = { id: Math.random().toString(36).slice(2, 7), ...payload, at: new Date().toISOString() };
      DB.audit.unshift({ timestamp: job.at, module: "restaurant", action: "print", detail: job });
      return makeResp({ ok: true, job });
    }
    if (path.startsWith("/restaurant/menu/")) {
      const secId = path.split("/").pop();
      DB.restaurantMenu[secId] = DB.restaurantMenu[secId] || [];
      const item = {
        id: payload.id || Math.random().toString(36).slice(2, 7),
        code: payload.code || `ART-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        name: payload.name,
        price: payload.price || 0,
        category: payload.category || "General",
      };
      DB.restaurantMenu[secId].push(item);
      return makeResp(item);
    }
    if (path === "/restaurant/items") {
      const list = Array.isArray(payload?.items) ? payload.items : [payload];
      const saved = list
        .filter(Boolean)
        .map((it) => ({
          id: it.id || Math.random().toString(36).slice(2, 7),
          code: it.code || `ART-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          ...it,
        }));
      DB.restaurantItems = [...DB.restaurantItems, ...saved];
      return makeResp(saved.length === 1 ? saved[0] : saved);
    }
    if (path === "/restaurant/families") {
      const item = { ...payload, id: payload.id || Math.random().toString(36).slice(2, 7) };
      DB.restaurantFamilies.push(item);
      return makeResp(item);
    }
    if (path === "/restaurant/recipes") {
      const { value, baseUnit } = normalizeQty(payload.cantidad, payload.unidad);
      const item = {
        ...payload,
        id: payload.id || Math.random().toString(36).slice(2, 7),
        baseCantidad: value,
        baseUnidad: baseUnit,
      };
      DB.restaurantRecipes.push(item);
      return makeResp(item);
    }
    if (path === "/restaurant/inventory") {
      const { value: baseStock, baseUnit } = normalizeQty(payload.stock, payload.unidad);
      const { value: baseMin, baseUnit: baseUnitMin } = normalizeQty(payload.minimo, payload.unidad);
      const item = {
        ...payload,
        id: payload.id || Math.random().toString(36).slice(2, 7),
        stockBase: baseStock,
        minimoBase: baseMin,
        unidadBase: baseUnit || baseUnitMin || payload.unidad,
      };
      DB.restaurantInventory.push(item);
      return makeResp(item);
    }
    return makeResp(payload);
  },
  delete: async (url) => {
    await sleep();
    const path = normalize(url).replace(/^\//, "");
    const [coll, id] = path.split("/");
    if (DB[coll]) {
      DB[coll] = DB[coll].filter((x) => x.id !== id);
      return makeResp({ ok: true });
    }
    if (path.startsWith("restaurant/sections/") && path.includes("/tables/")) {
      const [, , secId, , tableId] = path.split("/");
      const sec = DB.restaurantSections.find((s) => s.id === secId);
      if (sec) {
        sec.tables = (sec.tables || []).filter((t) => t.id !== tableId);
        return makeResp({ ok: true });
      }
    }
    if (path.startsWith("restaurant/sections/") && !path.includes("/tables/")) {
      const [, , secId] = path.split("/");
      DB.restaurantSections = DB.restaurantSections.filter((s) => s.id !== secId);
      delete DB.restaurantMenu?.[secId];
      return makeResp({ ok: true });
    }
    if (path.startsWith("restaurant/menu/")) {
      const [, , secId, itemId] = path.split("/");
      if (DB.restaurantMenu[secId]) {
        DB.restaurantMenu[secId] = DB.restaurantMenu[secId].filter((m) => m.id !== itemId);
        return makeResp({ ok: true });
      }
    }
    if (path.startsWith("restaurant/items/")) {
      const id = path.split("/").pop();
      DB.restaurantItems = DB.restaurantItems.filter((i) => i.id !== id);
      return makeResp({ ok: true });
    }
    if (path.startsWith("restaurant/families/")) {
      const id = path.split("/").pop();
      DB.restaurantFamilies = DB.restaurantFamilies.filter((i) => i.id !== id);
      return makeResp({ ok: true });
    }
    if (path.startsWith("restaurant/recipes/")) {
      const id = path.split("/").pop();
      DB.restaurantRecipes = DB.restaurantRecipes.filter((i) => i.id !== id);
      return makeResp({ ok: true });
    }
    if (path.startsWith("restaurant/inventory/")) {
      const id = path.split("/").pop();
      DB.restaurantInventory = DB.restaurantInventory.filter((i) => i.id !== id);
      return makeResp({ ok: true });
    }
    return makeResp({ ok: false });
  },
};
