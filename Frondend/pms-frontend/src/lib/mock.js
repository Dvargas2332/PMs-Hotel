//src/lib/api.js

const sleep = (ms=300) => new Promise(r => setTimeout(r, ms));
let SETTINGS = {
  "core.currency": "CRC",
  "core.timezone": "America/Costa_Rica",
  "frontdesk.allowEarlyCheckIn": true,
  "frontdesk.defaultCheckInHour": "15:00",
  "accounting.eInvoice.enabled": true,
  "accounting.eInvoice.profile": "GENERAL",
  "discounts.maxPercentWithoutPin": 20,
  "restaurant.serviceCharge.rate": 0.10,
};

// Colecciones en memoria para CRUD de Management
let DB = {
  roles: [
    { id: "ADMIN", name: "ADMIN", description: "Superusuario" },
    { id: "MANAGER", name: "MANAGER", description: "Gerencia" },
    { id: "FRONTDESK_AGENT", name: "FRONTDESK_AGENT", description: "Recepción" },
  ],
  permissions: [
    "frontdesk.read","frontdesk.create_reservation","frontdesk.checkin","frontdesk.checkout",
    "frontdesk.apply_discount","accounting.invoice.create","accounting.invoice.cancel",
    "management.settings.write","management.users.assign_roles","restaurant.pos.open"
  ],
  rolePermissions: {
    ADMIN: ["*"],
    MANAGER: ["frontdesk.*","accounting.*","management.*","restaurant.*","audit.*"],
    FRONTDESK_AGENT: ["frontdesk.read","frontdesk.create_reservation","frontdesk.checkin","frontdesk.checkout"]
  },
  audit: [],
  roomTypes: [
    { id:"STD", name:"Standard", capacity:2, baseRate:45000, currency:"CRC", beds:"1Q", amenities:["WIFI","A/C"] },
  ],
  rooms: [
    { id:"101", number:"101", typeId:"STD", floor:1, capacity:2, status:"AVAILABLE" },
  ],
  ratePlans: [
    { id:"BAR", name:"BAR", currency:"CRC", derived:false, price:45000, restrictions:{ LOSMin:1, LOSMax:30 } },
  ],
  contracts: [
    { id:"OTA-BOOKING", channel:"Booking.com", commission:0.15, active:true, ratePlans:["BAR"] }
  ],
  paymentMethods: [
    { id:"CASH", name:"Efectivo", active:true },
    { id:"CARD", name:"Tarjeta", active:true }
  ],
  discounts: [
    { id:"PROMO10", name:"Promo 10%", type:"percent", value:10, requiresPin:false, active:true }
  ],
  taxes: [
    { id:"VAT", name:"IVA", percent:13, scope:"room" },
    { id:"POSSVC", name:"Servicio POS", percent:10, scope:"pos" },
  ],
  printers: [
    { id:"INV_A4", name:"Factura A4", kind:"a4", module:"accounting" },
    { id:"POS_80", name:"Ticket 80mm", kind:"ticket80", module:"restaurant" },
  ],
  currency: {
    base:"CRC",
    secondaries:["USD"],
    rounding:"line",
    fx:{ USD:530 }
  },
  hotelInfo: {
    name:"Hotel Demo",
    legalName:"Hotel Demo S.A.",
    phone:"+506 0000 0000",
    email:"info@demo.com",
    languages:["es","en"],
    nationalities:["Costa Rica","Estados Unidos","Nicaragua","Colombia"]
  },
  cashier: {
    requireOpenShift:true,
    reopenNeedsManager:true,
    cashDiffTolerance:500
  },
  mealPlans: [
    { id:"RO", name:"Room Only" },
    { id:"BB", name:"Bed & Breakfast" },
  ],
  usersFD: [
    { id:"u1", name:"Agente 1", username:"fd1", roles:["FRONTDESK_AGENT"], pinPolicy:4, active:true }
  ],
  invoicing: {
    einvoiceEnabled:true,
    profile:"GENERAL",
    sequencePrefix:"FD-",
    environment:"test"
  }
};

const makeResp = (data) => ({ data });

export const mockApi = {
  get: async (url) => {
    await sleep();
    if (url==="/api/settings") return makeResp(SETTINGS);
    if (url==="/api/audit") return makeResp(DB.audit);
    // colecciones básicas
    const key = url.replace("/api/","");
    if (DB[key]) return makeResp(DB[key]);
    return makeResp(null);
  },
  put: async (url, payload) => {
    await sleep();
    if (url==="/api/settings") {
      SETTINGS = { ...SETTINGS, ...payload };
      return makeResp(SETTINGS);
    }
    if (url.startsWith("/api/role-permissions/")) {
      const role = url.split("/").pop();
      DB.rolePermissions[role] = payload.permissions;
      return makeResp({ role, permissions: DB.rolePermissions[role] });
    }
    if (url==="/api/currency") {
      DB.currency = { ...DB.currency, ...payload };
      return makeResp(DB.currency);
    }
    if (url==="/api/invoicing") {
      DB.invoicing = { ...DB.invoicing, ...payload };
      return makeResp(DB.invoicing);
    }
    return makeResp(payload);
  },
  post: async (url, payload) => {
    await sleep();
    const key = url.replace("/api/","");
    if (DB[key]) {
      const id = payload.id || Math.random().toString(36).slice(2,8);
      const item = { id, ...payload };
      DB[key].push(item);
      return makeResp(item);
    }
    return makeResp(payload);
  },
  delete: async (url) => {
    await sleep();
    const [_, coll, id] = url.split("/api/")[1].split("/");
    if (DB[coll]) {
      DB[coll] = DB[coll].filter(x => x.id !== id);
      return makeResp({ ok:true });
    }
    return makeResp({ ok:false });
  }
};
