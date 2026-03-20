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
    inventoryEnabled: true,
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
  restaurantSubFamilies: [],
  restaurantSubSubFamilies: [],
  restaurantItems: [],
  restaurantRecipes: [],
  restaurantInventory: [],
  restaurantInventoryInvoices: [],
  restaurantOrders: [],
  restaurantSales: [],
  restaurantCloses: [],
  restaurantLastCloseAt: null,
  restaurantKdsStatus: {},
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

const safeText = (node) => (node && typeof node.textContent === "string" ? node.textContent.trim() : "");
const localNameEquals = (node, name) => node && node.localName === name;
const getFirstByLocalName = (root, name) =>
  root ? root.getElementsByTagNameNS("*", name)[0] || null : null;
const getTextByLocalName = (root, name) => safeText(getFirstByLocalName(root, name));
const getChildText = (root, name) => {
  if (!root || !root.childNodes) return "";
  for (const n of root.childNodes) {
    if (localNameEquals(n, name)) return safeText(n);
  }
  return "";
};
const normalizeUnit = (raw) => {
  const unit = String(raw || "").trim();
  if (!unit) return "";
  const lower = unit.toLowerCase();
  if (["unid", "unidad", "und", "u"].includes(lower)) return "un";
  return lower;
};

const parseXmlInvoice = (xml) => {
  if (typeof DOMParser === "undefined") throw new Error("XML parser unavailable");
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const hasError = doc.getElementsByTagName("parsererror").length > 0;
  if (hasError) throw new Error("XML invalido");
  const emisorNode = getFirstByLocalName(doc, "Emisor");
  const commercialName = getChildText(emisorNode, "NombreComercial") || "";
  const legalName = getChildText(emisorNode, "Nombre") || "";
  const emisor =
    commercialName ||
    legalName ||
    "";
  const idNode = getFirstByLocalName(emisorNode, "Identificacion");
  const legalId = getChildText(idNode, "Numero") || "";
  const phoneNode = getFirstByLocalName(emisorNode, "Telefono");
  const phoneCode = getChildText(phoneNode, "CodigoPais") || "";
  const phoneNum = getChildText(phoneNode, "NumTelefono") || "";
  const phone = [phoneCode ? `+${phoneCode}` : "", phoneNum].filter(Boolean).join(" ").trim();
  const email = getChildText(emisorNode, "CorreoElectronico") || "";
  const addressNode = getFirstByLocalName(emisorNode, "Ubicacion");
  const address = [
    getChildText(addressNode, "Provincia"),
    getChildText(addressNode, "Canton"),
    getChildText(addressNode, "Distrito"),
    getChildText(addressNode, "Barrio"),
    getChildText(addressNode, "OtrasSenas"),
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(", ");
  const docNumber =
    getTextByLocalName(doc, "NumeroConsecutivo") ||
    getTextByLocalName(doc, "NumeroConsecutivoComprobante") ||
    "";
  const issueDate =
    getTextByLocalName(doc, "FechaEmision") ||
    getTextByLocalName(doc, "FechaEmisionComprobante") ||
    "";
  const detalleServicio = getFirstByLocalName(doc, "DetalleServicio");
  const lineNodes = detalleServicio
    ? Array.from(detalleServicio.getElementsByTagNameNS("*", "LineaDetalle"))
    : Array.from(doc.getElementsByTagNameNS("*", "LineaDetalle"));
  const lines = lineNodes.map((line) => {
    const sku =
      getChildText(line, "Codigo") ||
      getChildText(getFirstByLocalName(line, "CodigoComercial"), "Codigo") ||
      "";
    const name = getChildText(line, "Detalle") || getChildText(line, "Descripcion") || "";
    const qty = getChildText(line, "Cantidad") || "0";
    const unit = normalizeUnit(getChildText(line, "UnidadMedida") || getChildText(line, "Unidad"));
    const cost = getChildText(line, "PrecioUnitario") || getChildText(line, "Precio") || "";
    const impuestoNode = getFirstByLocalName(line, "Impuesto");
    const taxRate = getChildText(impuestoNode, "Tarifa") || getChildText(line, "Tarifa") || "";
    return { sku, name, qty, unit, cost, taxRate };
  });
  return {
    supplierName: emisor,
    supplierLegalName: legalName || "",
    supplierCommercialName: commercialName || "",
    supplierLegalId: legalId || "",
    supplierPhone: phone || "",
    supplierEmail: email || "",
    supplierAddress: address || "",
    docNumber,
    issueDate,
    lines: lines.filter((l) => l.name || l.sku),
  };
};

const findInventoryItem = (line) => {
  const sku = String(line.sku || "").trim().toLowerCase();
  const name = String(line.name || "").trim().toLowerCase();
  if (sku) {
    const bySku = (DB.restaurantInventory || []).find((i) => String(i.sku || "").trim().toLowerCase() === sku);
    if (bySku) return bySku;
  }
  if (name) {
    const byName = (DB.restaurantInventory || []).find((i) => String(i.desc || "").trim().toLowerCase() === name);
    if (byName) return byName;
  }
  return null;
};

const applyInventoryLine = (line, supplierName) => {
  const qty = Number(line.qty || 0);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const unit = String(line.unit || "").trim() || "un";
  const { value: baseQty, baseUnit } = normalizeQty(qty, unit);
  const existing = findInventoryItem(line);
  if (existing) {
    const sameBase = !existing.unidadBase || existing.unidadBase === baseUnit;
    const nextBase = sameBase ? asNumber(existing.stockBase) + baseQty : asNumber(existing.stockBase);
    existing.stockBase = nextBase;
    existing.unidadBase = existing.unidadBase || baseUnit;
    existing.unit = existing.unit || existing.unidad || baseUnit;
    existing.stock = nextBase;
    existing.cost = line.cost || existing.cost || existing.costo || 0;
    existing.taxRate = line.taxRate || existing.taxRate || existing.iva || "13";
    existing.supplierName = supplierName || existing.supplierName || existing.proveedor || "";
    return existing;
  }
  const item = {
    id: Math.random().toString(36).slice(2, 7),
    sku: line.sku || "",
    desc: line.name || line.sku || "",
    stock: baseQty,
    unit: baseUnit,
    stockBase: baseQty,
    unidadBase: baseUnit,
    minimo: 0,
    cost: line.cost || 0,
    taxRate: line.taxRate || "13",
    supplierName: supplierName || "",
    inventoryControlled: true,
  };
  DB.restaurantInventory.push(item);
  return item;
};

const consumeInventoryForOrder = (orderItems = []) => {
  const invEnabled = DB.restaurantGeneral?.inventoryEnabled !== false;
  if (!invEnabled) return;
  const recipes = Array.isArray(DB.restaurantRecipes) ? DB.restaurantRecipes : [];
  orderItems.forEach((item) => {
    const itemId = String(item?.id || item?.code || item?.codigo || "").trim();
    if (!itemId) return;
    const qty = asNumber(item?.qty ?? 1, 1);
    const lines = recipes.filter((r) => {
      const rId = String(r.restaurantItemId || r.codigo || r.restaurantItemCode || "").trim();
      return rId && rId === itemId;
    });
    lines.forEach((line) => {
      const invId = String(line.ingrediente || line.inventoryItemId || "").trim();
      if (!invId) return;
      const inv = (DB.restaurantInventory || []).find((i) => String(i.id) === invId);
      if (!inv) return;
      const baseQty = Number.isFinite(Number(line.baseCantidad))
        ? asNumber(line.baseCantidad)
        : normalizeQty(line.cantidad, line.unidad).value;
      const baseUnit = line.baseUnidad || normalizeQty(line.cantidad, line.unidad).baseUnit;
      const invBaseUnit = inv.unidadBase || inv.unit || inv.unidad;
      if (invBaseUnit && baseUnit && invBaseUnit !== baseUnit) return;
      const delta = baseQty * qty;
      const currentBase = asNumber(inv.stockBase, asNumber(inv.stock, 0));
      const nextBase = Math.max(0, currentBase - delta);
      inv.stockBase = nextBase;
      inv.stock = nextBase;
      inv.unidadBase = inv.unidadBase || baseUnit || invBaseUnit;
      inv.unit = inv.unit || inv.unidad || inv.unidadBase;
    });
  });
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
    if (path.startsWith("/permissions/role/")) {
      const role = decodeURIComponent(path.split("/").pop() || "");
      const permissions = DB.rolePermissions?.[role] || [];
      return makeResp({ role, permissions });
    }
    if (path === "/settings") return makeResp(SETTINGS);
    if (path === "/audit") return makeResp(DB.audit);
    if (path === "/hotel") return makeResp(DB.hotelInfo);
    if (path === "/restaurant/sections") return makeResp(DB.restaurantSections);
    if (path.startsWith("/restaurant/sections/") && path.endsWith("/layout")) {
      const parts = path.split("/");
      const secId = parts[3];
      const sec = DB.restaurantSections.find((s) => s.id === secId);
      return makeResp({ tables: Array.isArray(sec?.tables) ? sec.tables.map((t) => ({ ...t })) : [] });
    }
    if (path.startsWith("/restaurant/sections/") && path.endsWith("/objects")) {
      const parts = path.split("/");
      const secId = parts[3];
      if (!DB.restaurantSectionObjects) DB.restaurantSectionObjects = {};
      const list = DB.restaurantSectionObjects[secId] || [];
      return makeResp(list);
    }
    if (path === "/restaurant/printers") return makeResp(DB.restaurantPrinters);
    if (path === "/restaurant/config") return makeResp(DB.restaurantConfig);
    if (path === "/restaurant/general") return makeResp(DB.restaurantGeneral);
    if (path === "/restaurant/billing") return makeResp(DB.restaurantBilling);
    if (path === "/restaurant/taxes") return makeResp(DB.restaurantTaxes);
    if (path === "/restaurant/payments") return makeResp(DB.restaurantPayments);
    if (path === "/restaurant/families") return makeResp(DB.restaurantFamilies);
    if (path === "/restaurant/subfamilies") {
      const params = new URLSearchParams(query || "");
      const familyId = params.get("familyId");
      const list = Array.isArray(DB.restaurantSubFamilies) ? DB.restaurantSubFamilies : [];
      return makeResp(familyId ? list.filter((i) => i.familyId === familyId) : list);
    }
    if (path === "/restaurant/subsubfamilies") {
      const params = new URLSearchParams(query || "");
      const subFamilyId = params.get("subFamilyId");
      const list = Array.isArray(DB.restaurantSubSubFamilies) ? DB.restaurantSubSubFamilies : [];
      return makeResp(subFamilyId ? list.filter((i) => i.subFamilyId === subFamilyId) : list);
    }
    if (path === "/restaurant/items") return makeResp(DB.restaurantItems);
    if (path === "/restaurant/recipes") return makeResp(DB.restaurantRecipes);
    if (path === "/restaurant/inventory") return makeResp(DB.restaurantInventory);
    if (path === "/restaurant/inventory/invoices") return makeResp(DB.restaurantInventoryInvoices || []);
    if (path === "/restaurant/orders") {
      const params = new URLSearchParams(query || "");
      const status = String(params.get("status") || "OPEN").toUpperCase();
      if (status === "PAID") {
        const list = (DB.restaurantSales || []).map((s) => ({
          id: s.id,
          tableId: s.tableId,
          sectionId: s.sectionId,
          items: s.items || [],
          total: asNumber(s?.totals?.total ?? s?.totals?.system ?? 0),
          note: s.note || "",
          covers: s.covers || 0,
          status: "PAID",
          serviceType: s.serviceType || "DINE_IN",
          roomId: s.roomId || "",
          updatedAt: s.closedAt || new Date().toISOString(),
        }));
        return makeResp(list);
      }
      return makeResp(DB.restaurantOrders);
    }
    if (path === "/restaurant/stats") return makeResp(restaurantStats());
    if (path === "/restaurant/close") return makeResp(DB.restaurantCloses);
    if (path === "/restaurant/kds") {
      const params = new URLSearchParams(query || "");
      const area = String(params.get("area") || "KITCHEN").toUpperCase();
      const list = [];
      for (const o of DB.restaurantOrders || []) {
        for (const it of o.items || []) {
          const cat = String(it.category || "").toLowerCase();
          const isBar = cat.includes("bebida") || cat.includes("bar");
          const itemArea = isBar ? "BAR" : "KITCHEN";
          if (itemArea !== area) continue;
          const key = `${o.id || o.tableId}-${it.id}`;
          const status = String(DB.restaurantKdsStatus[key] || "NEW").toUpperCase();
          if (status === "SERVED") continue;
          list.push({
            id: key,
            status,
            area: itemArea,
            itemId: it.id,
            name: it.name,
            category: it.category,
            price: it.price,
            qty: it.qty,
            order: {
              id: o.id || o.tableId,
              tableId: o.tableId,
              sectionId: o.sectionId || null,
              note: o.note || "",
              covers: o.covers || 0,
              updatedAt: o.updatedAt || new Date().toISOString(),
            },
          });
        }
      }
      return makeResp(list);
    }
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
    if (path.startsWith("/permissions/role/")) {
      const role = decodeURIComponent(path.split("/").pop() || "");
      const next = Array.isArray(payload?.permissions) ? payload.permissions : [];
      DB.rolePermissions[role] = next;
      return makeResp({ role, permissions: DB.rolePermissions[role] });
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
    if (path.startsWith("/restaurant/sections/") && path.endsWith("/layout")) {
      const parts = path.split("/");
      const secId = parts[3];
      const sec = DB.restaurantSections.find((s) => s.id === secId);
      if (sec) {
        const tables = Array.isArray(payload?.tables) ? payload.tables : [];
        sec.tables = (sec.tables || []).map((t) => {
          const p = tables.find((x) => String(x?.id) === String(t.id));
          if (!p) return t;
          const x = Number(p.x);
          const y = Number(p.y);
          const rotation = Number(p.rotation);
          const size = Number(p.size);
          const color = typeof p.color === "string" ? p.color : undefined;
          const kind = p.kind ? String(p.kind) : undefined;
          return {
            ...t,
            kind: kind || t.kind,
            x: Number.isFinite(x) ? x : t.x,
            y: Number.isFinite(y) ? y : t.y,
            rotation: Number.isFinite(rotation) ? rotation : t.rotation,
            size: Number.isFinite(size) ? size : t.size,
            color: color !== undefined ? color : t.color,
          };
        });
      }
      if (!DB.restaurantSectionObjects) DB.restaurantSectionObjects = {};
      if (Array.isArray(payload?.objects)) {
        // overwrite objects for section
        DB.restaurantSectionObjects[secId] = payload.objects.map((o) => ({ ...o }));
      }
      return makeResp({ ok: true });
    }
    if (path.startsWith("/restaurant/sections/") && !path.endsWith("/tables")) {
      const id = path.split("/").pop();
      DB.restaurantSections = DB.restaurantSections.map((s) => (s.id === id ? { ...s, ...payload } : s));
      return makeResp(DB.restaurantSections.find((s) => s.id === id));
    }
    return makeResp(payload);
  },
  patch: async (url, payload) => {
    await sleep();
    const path = normalize(url);
    if (path.startsWith("/restaurant/inventory/")) {
      const id = path.split("/").pop();
      const next = DB.restaurantInventory.map((i) =>
        i.id === id
          ? { ...i, inventoryControlled: payload?.inventoryControlled !== false }
          : i
      );
      DB.restaurantInventory = next;
      const updated = DB.restaurantInventory.find((i) => i.id === id);
      return makeResp(updated || { id, ...payload });
    }
    if (path.startsWith("/restaurant/sections/") && path.includes("/tables/") && path.endsWith("/position")) {
      const parts = path.split("/");
      const secId = parts[3];
      const tableId = parts[5];
      const sec = DB.restaurantSections.find((s) => s.id === secId);
      if (sec) {
        const x = Number(payload?.x);
        const y = Number(payload?.y);
        const rotation = Number(payload?.rotation);
        const size = Number(payload?.size);
        const color = typeof payload?.color === "string" ? payload.color : undefined;
        const kind = payload?.kind ? String(payload.kind) : undefined;
        sec.tables = (sec.tables || []).map((t) =>
          t.id === tableId
            ? {
                ...t,
                kind: kind || t.kind,
                x: Number.isFinite(x) ? x : t.x,
                y: Number.isFinite(y) ? y : t.y,
                rotation: Number.isFinite(rotation) ? rotation : t.rotation,
                size: Number.isFinite(size) ? size : t.size,
                color: color !== undefined ? color : t.color,
              }
            : t
        );
      }
      const updated = sec?.tables?.find((t) => t.id === tableId);
      return makeResp({ ok: true, table: updated || { id: tableId, ...payload } });
    }
    if (path.startsWith("/restaurant/sections/") && path.includes("/objects/")) {
      const parts = path.split("/");
      const secId = parts[3];
      const objectId = parts[5];
      if (!DB.restaurantSectionObjects) DB.restaurantSectionObjects = {};
      const list = DB.restaurantSectionObjects[secId] || [];
      DB.restaurantSectionObjects[secId] = list.map((o) => (o.id === objectId ? { ...o, ...payload } : o));
      const updated = DB.restaurantSectionObjects[secId].find((o) => o.id === objectId);
      return makeResp(updated || { id: objectId, ...payload });
    }
    if (path.startsWith("/restaurant/kds/")) {
      const id = path.split("/").pop();
      const status = String(payload?.status || "").toUpperCase();
      if (id) DB.restaurantKdsStatus[id] = status || "NEW";
      return makeResp({ ok: true });
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
          allowedModules: ["frontdesk", "restaurant", "accounting", "einvoicing", "management"],
        },
      });
    }
    if (path === "/auth/user-login" || path === "/launcher/login") {
      // Login de USUARIO interno: valida contra DB.usersFD
      const username = (payload?.username || "").trim();
      const password = String(payload?.password || "").trim();
      const hotelId = String(payload?.hotelId || "").trim();
      const user = (DB.usersFD || []).find((u) => u.username === username && (!hotelId || u.hotelId === hotelId));
      if (!user || !user.active) {
        return makeResp({ error: "INVALID_CREDENTIALS" }, 401);
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

      const baseUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: Array.isArray(user.roles) ? user.roles[0] || "" : "",
        roles,
        // Campo de relación con hotel para usuarios (se expone como hotelId)
        hotelId: user.hotelId || "HOTEL-DEMO-1",
        permissions: perms,
      };
      const modules = Array.from(modulesSet);

      if (path === "/launcher/login") {
        return makeResp({
          token: "mock-user-token",
          launcher: {
            ...baseUser,
            roleId: baseUser.role,
            hotelName: DB.hotelInfo?.name || "Hotel Demo",
            allowedModules: modules,
          },
        });
      }

      return makeResp({
        token: "mock-user-token",
        user: {
          ...baseUser,
          modules,
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
      consumeInventoryForOrder(payload.items || []);
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
      const reported = asNumber(payload?.totals?.reported ?? payload?.reported ?? 0);
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
          kind: payload.kind || "mesa",
          size: Number.isFinite(Number(payload.size)) ? Number(payload.size) : 56,
          rotation: Number.isFinite(Number(payload.rotation)) ? Number(payload.rotation) : 0,
          color: typeof payload.color === "string" ? payload.color : "",
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
      const item = {
        id: payload.id || Math.random().toString(36).slice(2, 7),
        name: payload?.name || payload?.familia || payload?.grupo || "",
      };
      DB.restaurantFamilies.push(item);
      return makeResp(item);
    }
    if (path === "/restaurant/subfamilies") {
      const item = {
        id: payload.id || Math.random().toString(36).slice(2, 7),
        familyId: payload.familyId,
        name: payload.name || "",
      };
      DB.restaurantSubFamilies.push(item);
      return makeResp(item);
    }
    if (path === "/restaurant/subsubfamilies") {
      const item = {
        id: payload.id || Math.random().toString(36).slice(2, 7),
        subFamilyId: payload.subFamilyId,
        name: payload.name || "",
      };
      DB.restaurantSubSubFamilies.push(item);
      return makeResp(item);
    }
    if (path === "/restaurant/recipes") {
      const { value, baseUnit } = normalizeQty(payload.cantidad, payload.unidad);
      const inv = (DB.restaurantInventory || []).find((i) => String(i.id) === String(payload.ingrediente));
      const itemMeta = (DB.restaurantItems || []).find((i) => String(i.id) === String(payload.codigo));
      const item = {
        ...payload,
        id: payload.id || Math.random().toString(36).slice(2, 7),
        restaurantItemId: payload.codigo,
        restaurantItemName: itemMeta?.name || itemMeta?.nombre || "",
        restaurantItemCode: itemMeta?.code || itemMeta?.codigo || payload.codigo,
        inventorySku: inv?.sku || "",
        inventoryDesc: inv?.desc || inv?.descripcion || "",
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
        inventoryControlled: payload?.inventoryControlled !== false,
      };
      DB.restaurantInventory.push(item);
      return makeResp(item);
    }
    if (path === "/restaurant/inventory/invoices") {
      const lines = Array.isArray(payload?.lines) ? payload.lines : [];
      const supplierName = String(payload?.supplierName || payload?.proveedor || "").trim();
      const invoice = {
        id: payload?.id || Math.random().toString(36).slice(2, 8),
        supplierName,
        proveedor: supplierName,
        supplierLegalName: payload?.supplierLegalName || payload?.legalName || payload?.razonSocial || "",
        supplierCommercialName: payload?.supplierCommercialName || payload?.commercialName || payload?.nombreComercial || "",
        supplierLegalId: payload?.supplierLegalId || payload?.legalId || payload?.taxId || payload?.cedulaJuridica || "",
        supplierPhone: payload?.supplierPhone || payload?.phone || payload?.telefono || "",
        supplierEmail: payload?.supplierEmail || payload?.email || payload?.correo || payload?.correoElectronico || "",
        supplierAddress: payload?.supplierAddress || payload?.address || payload?.direccion || "",
        docNumber: payload?.docNumber || payload?.numero || "",
        issueDate: payload?.issueDate || payload?.fecha || "",
        source: payload?.source || "MANUAL",
        currency: payload?.currency || "",
        exchangeRate: payload?.exchangeRate || "",
        lines: lines
          .filter((l) => l)
          .map((l) => ({
            id: Math.random().toString(36).slice(2, 9),
            sku: l.sku || "",
            name: l.name || "",
            qty: l.qty || 0,
            unit: l.unit || "",
            cost: l.cost || 0,
            taxRate: l.taxRate || "13",
          })),
      };
      invoice.total = invoice.lines.reduce(
        (acc, l) => acc + asNumber(l.cost) * asNumber(l.qty || 0),
        0
      );
      invoice.taxTotal = invoice.lines.reduce((acc, l) => {
        const rate = asNumber(l.taxRate, 0) / 100;
        return acc + asNumber(l.cost) * asNumber(l.qty || 0) * rate;
      }, 0);
      if (payload?.totals && typeof payload.totals === "object") {
        invoice.totalFromXml = payload.totals.totalComprobante || payload.totals.total || "";
        invoice.taxTotalFromXml = payload.totals.totalImpuesto || "";
        invoice.totalSaleFromXml = payload.totals.totalVenta || "";
      }
      (DB.restaurantInventoryInvoices || (DB.restaurantInventoryInvoices = [])).unshift(invoice);
      invoice.lines.forEach((l) => applyInventoryLine(l, supplierName));
      return makeResp(invoice);
    }
    if (path === "/restaurant/inventory/invoices/import-xml") {
      const xml = String(payload?.xml || "");
      const parsed = parseXmlInvoice(xml);
      const invoice = {
        supplierName: parsed.supplierName || "XML",
        docNumber: parsed.docNumber || "",
        issueDate: parsed.issueDate || "",
        source: "XML",
        lines: parsed.lines,
        totals: payload?.totals || parsed?.totals || undefined,
        currency: payload?.currency || parsed?.currency || "",
        exchangeRate: payload?.exchangeRate || parsed?.exchangeRate || "",
      };
      return await mockApi.post("/restaurant/inventory/invoices", invoice);
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
    if (path.startsWith("restaurant/subfamilies/")) {
      const id = path.split("/").pop();
      DB.restaurantSubFamilies = DB.restaurantSubFamilies.filter((i) => i.id !== id);
      DB.restaurantSubSubFamilies = DB.restaurantSubSubFamilies.filter((i) => i.subFamilyId !== id);
      return makeResp({ ok: true });
    }
    if (path.startsWith("restaurant/subsubfamilies/")) {
      const id = path.split("/").pop();
      DB.restaurantSubSubFamilies = DB.restaurantSubSubFamilies.filter((i) => i.id !== id);
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
