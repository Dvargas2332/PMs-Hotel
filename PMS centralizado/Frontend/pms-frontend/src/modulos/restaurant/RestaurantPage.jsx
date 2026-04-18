import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Columns2, DoorOpen, Droplets, Leaf, RectangleHorizontal, Tag, Toilet, UtensilsCrossed, Waves } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { sanitizeImageUrl } from "../../lib/security";
import { api } from "../../lib/api";
import { ensurePrintAgentConfigInteractive, printTextToAgent } from "../../lib/printAgent";
import { normalizeMoneyInput, parseMoneyInput } from "../../lib/money";
import RestaurantUserMenu from "./RestaurantUserMenu";
import RestaurantCloseXButton from "./RestaurantCloseXButton";

const BASE_URL = import.meta.env.BASE_URL || "/";
const ICON_ASSET_VERSION = "20260320-occupied";
const FREE_TABLE_ICON_URL = `${BASE_URL}assets/restaurant/table-free.png`;
const OCCUPIED_TABLE_ICON_URL = `${BASE_URL}assets/restaurant/table-occupied.png?v=${ICON_ASSET_VERSION}`;
const CAMASTRO_FREE_ICON_URL = `${BASE_URL}assets/restaurant/camastro-free.png`;
const CAMASTRO_OCCUPIED_ICON_URL = `${BASE_URL}assets/restaurant/camastro-occupied.png`;
const TABURETE_FREE_ICON_URL = `${BASE_URL}assets/restaurant/taburete-free.png`;
const TABURETE_OCCUPIED_ICON_URL = `${BASE_URL}assets/restaurant/taburete-occupied.png`;
const BAR_DECOR_ICON_URL = `${BASE_URL}assets/restaurant/bar.svg`;

let currencySymbol = "$";
const resolveCurrencySymbol = (code) => {
  const c = String(code || "").toUpperCase();
  if (c === "CRC" || c === "₡") return "₡";
  if (c === "USD" || c === "$") return "$";
  if (c === "EUR" || c === "€") return "€";
  if (c === "GBP" || c === "£") return "£";
  if (c === "MXN") return "$";
  return c ? `${c} ` : "$";
};

function formatMoney(n) {
  return `${currencySymbol}${(Number(n) || 0).toFixed(2)}`;
}
function asNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asInt(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : fallback;
}

function composePrintText({ header, body, footer }) {
  const parts = [];
  const h = String(header || "").trim();
  if (h) {
    parts.push(h);
    parts.push("");
  }
  parts.push(body);
  const f = String(footer || "").trim();
  if (f) {
    parts.push("");
    parts.push(f);
  }
  return parts.join("\n");
}

function buildVoidTicketText({ tableId, sectionId, items, reason, authorizedBy }) {
  const W = 32;
  const center = (s) => {
    const str = String(s || "");
    const pad = Math.max(0, Math.floor((W - str.length) / 2));
    return " ".repeat(pad) + str;
  };
  const sep = "-".repeat(W);
  const lines = [];
  lines.push(center("*** CANCELADO ***"));
  lines.push(center("*** VOID / NO PREPARAR ***"));
  lines.push(sep);
  lines.push(`Fecha: ${new Date().toLocaleString()}`);
  if (sectionId) lines.push(`Seccion: ${sectionId}`);
  if (tableId) lines.push(`Mesa: ${tableId}`);
  if (authorizedBy) lines.push(`Autorizado por: ${authorizedBy}`);
  if (reason) lines.push(`Motivo: ${reason}`);
  lines.push(sep);
  const itemList = Array.isArray(items) ? items : [];
  if (itemList.length > 0) {
    lines.push("Items a CANCELAR:");
    for (const it of itemList) {
      const qty = Number(it?.qty || 1);
      const name = String(it?.name || it?.label || "");
      lines.push(`  [X] ${qty} x ${name}`);
      const note = String(it?.detailNote || it?.note || "").trim();
      if (note) lines.push(`      ${note}`);
    }
  }
  lines.push(sep);
  lines.push(center("*** CANCELADO ***"));
  return lines.join("\n");
}

function buildCloseReportText({ stage, shiftNumber, hotelName, openedAt, closedAt, openingAmount, systemTotal, byMethod, declared, diff, salesCount, note, staffName }) {
  const W = 40;
  const center = (s) => { const str = String(s || ""); const pad = Math.max(0, Math.floor((W - str.length) / 2)); return " ".repeat(pad) + str; };
  const sep  = "=".repeat(W);
  const sep2 = "-".repeat(W);
  const rjust = (label, value) => { const l = String(label); const v = String(value); return l + " ".repeat(Math.max(1, W - l.length - v.length)) + v; };
  const lines = [];
  lines.push(sep);
  if (hotelName) lines.push(center(hotelName));
  lines.push(center(`CIERRE ${String(stage || "Z").toUpperCase()} DE CAJA`));
  lines.push(sep);
  if (shiftNumber) lines.push(`Turno:    #${shiftNumber}`);
  lines.push(`Apertura: ${openedAt ? new Date(openedAt).toLocaleString() : "-"}`);
  lines.push(`Cierre:   ${closedAt ? new Date(closedAt).toLocaleString() : new Date().toLocaleString()}`);
  if (staffName) lines.push(`Cajero:   ${staffName}`);
  lines.push(sep2);
  lines.push(center("VENTAS POR METODO (SISTEMA)"));
  lines.push(sep2);
  const methods = byMethod && typeof byMethod === "object" ? Object.entries(byMethod).filter(([, v]) => Number(v) > 0) : [];
  for (const [key, amt] of methods) lines.push(rjust(`  ${key}:`, Number(amt || 0).toFixed(2)));
  lines.push(sep2);
  lines.push(rjust("TOTAL SISTEMA:", Number(systemTotal || 0).toFixed(2)));
  lines.push(`Transacciones: ${salesCount || 0}`);
  if (declared && typeof declared === "object") {
    const entries = Object.entries(declared).filter(([k, v]) => k && k !== "notes" && Number(v) > 0);
    if (entries.length > 0) {
      lines.push(sep2);
      lines.push(center("CONTEO FISICO DECLARADO"));
      lines.push(sep2);
      let declTotal = 0;
      for (const [key, val] of entries) { const a = Number(val) || 0; declTotal += a; lines.push(rjust(`  ${key}:`, a.toFixed(2))); }
      lines.push(sep2);
      lines.push(rjust("TOTAL DECLARADO:", declTotal.toFixed(2)));
      lines.push(rjust("DIFERENCIA:", Number(diff || 0).toFixed(2)));
    }
  }
  if (Number(openingAmount) > 0) { lines.push(sep2); lines.push(rjust("Fondo apertura:", Number(openingAmount).toFixed(2))); }
  if (note) { lines.push(sep2); lines.push("Notas:"); lines.push(String(note)); }
  lines.push(sep);
  lines.push("");
  lines.push("Firma: ________________________");
  lines.push(sep);
  return lines.join("\n");
}

function buildPrintPreviewText({ title, payload, totals }) {
  const W = 40;
  const now = new Date();
  const lines = [];
  const header = String(payload?.__printHeader || "").trim();
  const footer = String(payload?.__printFooter || "").trim();
  const sep = "-".repeat(W);
  const rjust = (label, value) => { const l = String(label); const v = String(value); return l + " ".repeat(Math.max(1, W - l.length - v.length)) + v; };

  if (header) { lines.push(header); lines.push(""); }

  lines.push(String(title || "IMPRIMIR").toUpperCase());
  lines.push(`Fecha:    ${now.toLocaleString()}`);
  if (payload?.saleNumber) lines.push(`Venta #:  ${String(payload.saleNumber)}`);
  if (payload?.type) lines.push(`Tipo:     ${String(payload.type)}`);
  if (payload?.cashierName) lines.push(`Cajero:   ${String(payload.cashierName)}`);
  if (payload?.sectionId) lines.push(`Sección:  ${String(payload.sectionId)}`);
  if (payload?.tableId) lines.push(`Mesa:     ${String(payload.tableId)}`);
  if (payload?.covers != null) lines.push(`Personas: ${asInt(payload.covers, 0)}`);
  if (payload?.serviceType) lines.push(`Servicio: ${String(payload.serviceType)}`);
  if (payload?.roomId) lines.push(`Habitac.: ${String(payload.roomId)}`);
  lines.push(sep);

  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length > 0) {
    for (const it of items) {
      const qty = asInt(it?.qty ?? it?.quantity ?? 1, 1);
      const name = String(it?.name || it?.label || it?.title || it?.id || "Item");
      const price = it?.price ?? it?.unitPrice ?? it?.amount;
      const hasPrice = price != null && String(price).trim() !== "";
      if (hasPrice) lines.push(rjust(`  ${qty} x ${name}`, formatMoney(qty * (Number(price) || 0))));
      else lines.push(`  ${qty} x ${name}`);
      const note = String(it?.note || "").trim();
      if (note) lines.push(`    * ${note}`);
    }
    lines.push(sep);
  }

  const note = String(payload?.note || "").trim();
  if (note) { lines.push(`Nota: ${note}`); lines.push(""); }

  const t = totals && typeof totals === "object" ? totals : null;
  if (t) {
    const total = t.total ?? t.system ?? t.grandTotal ?? t.totalAmount;
    const tax = t.tax ?? t.iva ?? t.impuesto;
    const service = t.service ?? t.servicio ?? t.tip10;
    const subtotal = t.subtotal ?? t.base;
    if (subtotal != null) lines.push(rjust("Subtotal:", formatMoney(subtotal)));
    if (t?.discountTotal) lines.push(rjust("Descuento:", `- ${formatMoney(t.discountTotal)}`));
    if (service != null) lines.push(rjust("Servicio (10%):", formatMoney(service)));
    if (tax != null) lines.push(rjust("Impuesto (IVA):", formatMoney(tax)));
    if (total != null) lines.push(rjust("TOTAL:", formatMoney(total)));
  }

  const payMethods = Array.isArray(payload?.paymentMethods) ? payload.paymentMethods : [];
  if (payMethods.length > 0) {
    lines.push(sep);
    for (const pm of payMethods) {
      if (pm?.name && Number(pm?.amount) > 0) lines.push(rjust(`  ${pm.name}:`, formatMoney(pm.amount)));
    }
    if (payload?.paid != null) lines.push(rjust("  Recibido:", formatMoney(payload.paid)));
    if (payload?.change != null && Number(payload.change) > 0) lines.push(rjust("  Cambio:", formatMoney(payload.change)));
  }

  if (footer) { lines.push(""); lines.push(footer); }

  return lines.join("\n");
}

function applyTableStylesToSections(sectionsList, tableStyles) {
  const styles = tableStyles && typeof tableStyles === "object" ? tableStyles : null;
  if (!styles) return sectionsList;
  return (sectionsList || []).map((sec) => {
    const secId = String(sec?.id || "");
    const byTable = secId && styles[secId] && typeof styles[secId] === "object" ? styles[secId] : null;
    if (!byTable) return sec;
    return {
      ...sec,
      tables: (sec.tables || []).map((t) => {
        const tableId = String(t?.id || "");
        const st = tableId && byTable[tableId] && typeof byTable[tableId] === "object" ? byTable[tableId] : null;
        if (!st) return t;
        const next = { ...t };
        const size = Number(st.size ?? st.iconSize);
        const rotation = Number(st.rotation ?? st.angle);
        const color = String(st.color || st.colorHex || st.iconColor || "").trim();
        const kind = st.kind;
        if (Number.isFinite(size)) next.size = size;
        if (Number.isFinite(rotation)) next.rotation = rotation;
        if (color) next.color = color;
        if (kind) next.kind = kind;
        return next;
      }),
    };
  });
}

function getFloorObjectMeta(kind) {
  const k = String(kind || "OTHER").toUpperCase();
  const map = {
    LABEL: { label: "Label", Icon: Tag, bg: "#334155" },
    BAR: { label: "Bar", Icon: UtensilsCrossed, bg: "#f59e0b" },
    POOL: { label: "Pool", Icon: Waves, bg: "#0ea5e9" },
    PLANT: { label: "Plant", Icon: Leaf, bg: "#10b981" },
    WALL: { label: "Wall", Icon: RectangleHorizontal, bg: "#64748b" },
    COUNTER: { label: "Counter", Icon: Columns2, bg: "#f97316" },
    DOOR: { label: "Door", Icon: DoorOpen, bg: "#6366f1" },
    WC: { label: "WC", Icon: Toilet, bg: "#d946ef" },
    OTHER: { label: "Object", Icon: Droplets, bg: "#94a3b8" },
  };
  return map[k] || map.OTHER;
}

function MesaFreeIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true" focusable="false">
      <rect x="150" y="148" width="212" height="212" rx="22" fill="currentColor" />
      <rect x="164" y="162" width="184" height="184" rx="18" fill="currentColor" opacity="0.22" />

      <rect x="210" y="70" width="92" height="70" rx="30" fill="#374151" opacity="0.95" />
      <path d="M202 92c18-16 90-16 108 0" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      {Array.from({ length: 9 }).map((_, i) => {
        const x = 210 + i * 10;
        return <line key={`t-${i}`} x1={x} y1="88" x2={x + 6} y2="128" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />;
      })}

      <rect x="210" y="372" width="92" height="70" rx="30" fill="#374151" opacity="0.95" />
      <path d="M202 420c18 16 90 16 108 0" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      {Array.from({ length: 9 }).map((_, i) => {
        const x = 210 + i * 10;
        return <line key={`b-${i}`} x1={x} y1="384" x2={x + 6} y2="424" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />;
      })}

      <rect x="70" y="210" width="70" height="92" rx="30" fill="#374151" opacity="0.95" />
      <path d="M92 202c-16 18-16 90 0 108" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      {Array.from({ length: 9 }).map((_, i) => {
        const y = 210 + i * 10;
        return <line key={`l-${i}`} x1="88" y1={y} x2="128" y2={y + 6} stroke="currentColor" strokeWidth="6" strokeLinecap="round" />;
      })}

      <rect x="372" y="210" width="70" height="92" rx="30" fill="#374151" opacity="0.95" />
      <path d="M420 202c16 18 16 90 0 108" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      {Array.from({ length: 9 }).map((_, i) => {
        const y = 210 + i * 10;
        return <line key={`r-${i}`} x1="384" y1={y} x2="424" y2={y + 6} stroke="currentColor" strokeWidth="6" strokeLinecap="round" />;
      })}
    </svg>
  );
}

function MesaOccupiedIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true" focusable="false">
      <circle cx="108" cy="150" r="44" fill="#6B7280" />
      <path d="M68 214c0-28 18-50 40-50h0c22 0 40 22 40 50v124H68V214z" fill="#6B7280" />
      <path d="M58 254c0-12 10-22 22-22h56c12 0 22 10 22 22v42H58v-42z" fill="#4B5563" opacity="0.9" />
      <path d="M84 338h12l-18 142c-2 14-20 14-18 0l24-142z" fill="#4B5563" />
      <path d="M132 338h12l24 142c2 14-16 14-18 0l-18-142z" fill="#4B5563" />

      <circle cx="404" cy="150" r="44" fill="#6B7280" />
      <path d="M364 214c0-28 18-50 40-50h0c22 0 40 22 40 50v124h-80V214z" fill="#6B7280" />
      <path d="M354 254c0-12 10-22 22-22h56c12 0 22 10 22 22v42h-100v-42z" fill="#4B5563" opacity="0.9" />
      <path d="M380 338h12l-18 142c-2 14-20 14-18 0l24-142z" fill="#4B5563" />
      <path d="M428 338h12l24 142c2 14-16 14-18 0l-18-142z" fill="#4B5563" />

      <path d="M150 252c0-26 20-46 46-46h120c26 0 46 20 46 46v30H150v-30z" fill="currentColor" />
      <rect x="238" y="282" width="36" height="132" rx="10" fill="currentColor" opacity="0.85" />
      <path d="M178 414h156c0 32-26 58-58 58H236c-32 0-58-26-58-58z" fill="currentColor" opacity="0.95" />

      <path d="M206 234c18 0 32 10 32 22s-14 22-32 22-32-10-32-22 14-22 32-22z" fill="#60A5FA" />
      <path d="M306 234c18 0 32 10 32 22s-14 22-32 22-32-10-32-22 14-22 32-22z" fill="#60A5FA" />
      <path d="M192 250c0-8 6-14 14-14h0c8 0 14 6 14 14v4h-28v-4z" fill="#2563EB" opacity="0.6" />
      <path d="M292 250c0-8 6-14 14-14h0c8 0 14 6 14 14v4h-28v-4z" fill="#2563EB" opacity="0.6" />

      <path d="M246 210h20c4 0 8 4 8 8v20c0 4-4 8-8 8h-20c-4 0-8-4-8-8v-20c0-4 4-8 8-8z" fill="currentColor" opacity="0.95" />
      <path d="M286 210h20c4 0 8 4 8 8v20c0 4-4 8-8 8h-20c-4 0-8-4-8-8v-20c0-4 4-8 8-8z" fill="currentColor" opacity="0.95" />
      <rect x="250" y="214" width="12" height="5" rx="2.5" fill="currentColor" opacity="0.35" />
      <rect x="290" y="214" width="12" height="5" rx="2.5" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

function getTableIcons(kind) {
  const k = String(kind || "mesa").toLowerCase();
  if (k === "mesa") return { Free: MesaFreeIcon, Occupied: MesaOccupiedIcon };
  return { Free: MesaFreeIcon, Occupied: MesaOccupiedIcon };
}

const sumNumbers = (obj = {}) => Object.values(obj).reduce((acc, v) => acc + (Number(v) || 0), 0);

const normalizePaymentName = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  try {
    return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return raw;
  }
};

const slugifyPaymentKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);

const resolvePaymentKey = (name, id) => {
  const base = normalizePaymentName(name || id);
  if (!base) return "";
  const normalized = base.replace(/\s+/g, " ").trim();
  const directMap = {
    efectivo: "cash",
    cash: "cash",
    tarjeta: "card",
    card: "card",
    sinpe: "sinpe",
    transferencia: "transfer",
    transfer: "transfer",
    "bank transfer": "transfer",
    habitacion: "room",
    room: "room",
    "cargo habitacion": "room",
  };
  if (directMap[normalized]) return directMap[normalized];
  return slugifyPaymentKey(name || id);
};

const normalizeOrderList = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const getOrderKey = (order) => String(order?.id || order?.orderId || order?.localId || "");

const buildLocalOrder = (overrides = {}) => ({
  localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  items: [],
  covers: 2,
  note: "",
  status: "NEW",
  serviceType: "DINE_IN",
  roomId: "",
  guestId: "",
  discountId: "",
  discountPercent: 0,
  ...overrides,
});

const getOrderSaveKey = (payload) => String(payload?.orderId || payload?.localId || payload?.tableId || "");

export default function RestaurantPage() {
  const { user, hotel } = useAuth();
  const navigate = useNavigate();

  const orderSaveTimerRef = useRef(null);
  const pendingOrderSaveRef = useRef(null);
  const creatingOrderRef = useRef({});
  const pendingCreateUpdateRef = useRef({});
  const addItemRef = useRef(null);

  const pendingPrintRef = useRef(null);
  const autoComandaRef = useRef(false);
  const [printConfirmOpen, setPrintConfirmOpen] = useState(false);
  const [printConfirmTitle, setPrintConfirmTitle] = useState("");
  const [printConfirmText, setPrintConfirmText] = useState("");
  const [printConfirmBusy, setPrintConfirmBusy] = useState(false);
  const [freeIconOk, setFreeIconOk] = useState(true);
  const [occupiedIconOk, setOccupiedIconOk] = useState(true);
  const [camastroFreeIconOk, setCamastroFreeIconOk] = useState(true);
  const [camastroOccupiedIconOk, setCamastroOccupiedIconOk] = useState(true);
  const [tabureteFreeIconOk, setTabureteFreeIconOk] = useState(true);
  const [tabureteOccupiedIconOk, setTabureteOccupiedIconOk] = useState(true);

  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [tablePickerMode, setTablePickerMode] = useState("NEW"); // NEW | MOVE
  const [moveTargetTable, setMoveTargetTable] = useState(null);
  const [tablePickerSectionId, setTablePickerSectionId] = useState("");
  const [sectionLauncher, setSectionLauncher] = useState(true);

  const [covers, setCovers] = useState(2);
  const [orderNote, setOrderNote] = useState("");
  const [search, setSearch] = useState("");
const [subCategory, setSubCategory] = useState("");
  const [subSubCategory, setSubSubCategory] = useState("");
  const [category, setCategory] = useState("");
  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionsError, setSectionsError] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [ordersByTable, setOrdersByTable] = useState({});
  const ordersByTableRef = useRef({});
  const [activeOrderByTable, setActiveOrderByTable] = useState({});
  const activeOrderByTableRef = useRef({});
  const selectedTableRef = useRef(null);
  const [now, setNow] = useState(new Date());
  const [printerCfg, setPrinterCfg] = useState({ kitchenPrinter: "", barPrinter: "", cashierPrinter: "" });
  const [printSettings, setPrintSettings] = useState({
    paperType: "80mm",
    defaultDocType: "TE",
    showPreview: true,
    previewByType: { comanda: true, subtotal: true, invoice: true },
    types: {
      comanda: { enabled: true, printerId: "", copies: 1 },
      ticket: { enabled: true, printerId: "", copies: 1 },
      electronicInvoice: { enabled: true, printerId: "", copies: 1 },
      closes: { enabled: true, printerId: "", copies: 1 },
      document: { enabled: true, printerId: "", copies: 1 },
    },
  });

  const [closeOpen, setCloseOpen] = useState(false);
  const [closeForm, setCloseForm] = useState({ cash: "", card: "", sinpe: "", transfer: "", room: "", notes: "" });
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeStage, setCloseStage] = useState("X");
  const [closeAuditOk, setCloseAuditOk] = useState(false);
  const [closeSnapshot, setCloseSnapshot] = useState(null);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [shiftOpenForm, setShiftOpenForm] = useState({ amount: "", note: "", staffId: "" });
  const [shiftKeypadTarget, setShiftKeypadTarget] = useState("password");
  const [shiftOpenBusy, setShiftOpenBusy] = useState(false);
  const [shiftOpenError, setShiftOpenError] = useState("");
  const [shiftLoading, setShiftLoading] = useState(true);
  const [voidInvoiceModalOpen, setVoidInvoiceModalOpen] = useState(false);
  const [voidInvoiceForm, setVoidInvoiceForm] = useState({ username: "", password: "", reason: "" });
  const [voidInvoiceBusy, setVoidInvoiceBusy] = useState(false);
  const [voidInvoiceError, setVoidInvoiceError] = useState("");
  const [voidInvoiceList, setVoidInvoiceList] = useState([]);
  const [voidInvoiceLoading, setVoidInvoiceLoading] = useState(false);
  const [voidInvoiceTarget, setVoidInvoiceTarget] = useState(null);
  const [voidInvoiceAuthOpen, setVoidInvoiceAuthOpen] = useState(false);
  const [voidInvoiceSuccessOpen, setVoidInvoiceSuccessOpen] = useState(false);
  const voidInvoiceSuccessTimerRef = useRef(null);
  const [cancelOrderModalOpen, setCancelOrderModalOpen] = useState(false);
  const [cancelOrderForm, setCancelOrderForm] = useState({ username: "", password: "", reason: "" });
  const [cancelOrderBusy, setCancelOrderBusy] = useState(false);
  const [cancelOrderError, setCancelOrderError] = useState("");
  const [cancelOrderTarget, setCancelOrderTarget] = useState(null);

  const [openInfo, setOpenInfo] = useState(() => ({ openedAt: new Date().toISOString(), user: "Cashier" }));
  const [taxesCfg, setTaxesCfg] = useState({
    iva: 13,
    servicio: 10,
    descuentoMax: 15,
    permitirDescuentos: true,
    impuestoIncluido: true,
  });
  const [discountsList, setDiscountsList] = useState([]);
  const [guestsList, setGuestsList] = useState([]);
  const [billingCfg, setBillingCfg] = useState({
    ticketHeader: "",
    ticketFooter: "",
    invoiceHeader: "",
    invoiceFooter: "",
  });

  const [paymentsCfg, setPaymentsCfg] = useState({
    monedaBase: "CRC",
    monedaSec: "USD",
    tipoCambio: 530,
    cobros: [],
    cargoHabitacion: false,
    paymentMethods: [],
  });
  const [stats, setStats] = useState({ systemTotal: 0, openOrders: 0, salesCount: 0, openOrderValue: 0, lastCloseAt: null, byMethod: {} });

  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({});
  const [splitPayments, setSplitPayments] = useState(false);
  const [selectedPaymentKeys, setSelectedPaymentKeys] = useState([]);
  const [paymentResult, setPaymentResult] = useState(null);
  const [paymentPrintBusy, setPaymentPrintBusy] = useState(false);
  const [splitOrderModalOpen, setSplitOrderModalOpen] = useState(false);
  const [splitOrderMap, setSplitOrderMap] = useState({});
  const [splitOrderCount, setSplitOrderCount] = useState(2);
  const [itemOptionsOpen, setItemOptionsOpen] = useState(false);
  const [itemOptionsItem, setItemOptionsItem] = useState(null);
  const [itemOptionsSize, setItemOptionsSize] = useState("");
  const [itemOptionsDetails, setItemOptionsDetails] = useState([]);
  const [itemOptionsNote, setItemOptionsNote] = useState("");
  const [floorZoom, setFloorZoom] = useState(1);
  const [floorPan, setFloorPan] = useState({ x: 0, y: 0 });
  const [floorDragging, setFloorDragging] = useState(false);
  const [serviceType, setServiceType] = useState("DINE_IN"); // DINE_IN, TAKEOUT, DELIVERY, ROOM
  const [roomCharge, setRoomCharge] = useState("");
  const [selectedGuestId, setSelectedGuestId] = useState("");
  const [guestSearch, setGuestSearch] = useState("");
  const [showCustomerPanel, setShowCustomerPanel] = useState(false);
  const [activeStaff, setActiveStaff] = useState(null);
  const activeStaffRef = useRef(null);
  const [staffLoginOpen, setStaffLoginOpen] = useState(true);
  const [staffLoginForm, setStaffLoginForm] = useState({ username: "", password: "" });
  const [staffOptions, setStaffOptions] = useState([]);
  const [staffOptionsLoading, setStaffOptionsLoading] = useState(false);
  const [staffLoginBusy, setStaffLoginBusy] = useState(false);
  const [staffLoginError, setStaffLoginError] = useState("");

  const role = useMemo(() => (user?.role || "").toUpperCase(), [user?.role]);
  const canViewTotals = useMemo(() => role === "ADMIN" || role === "MANAGER", [role]);
  const discountOptions = useMemo(
    () =>
      (discountsList || []).filter(
        (d) => d && d.active !== false && String(d.type || "percent").toLowerCase() === "percent"
      ),
    [discountsList]
  );
  const discountById = useMemo(() => new Map(discountOptions.map((d) => [String(d.id), d])), [discountOptions]);
  const quickCashSections = useMemo(
    () => (sections || []).filter((s) => s?.quickCashEnabled),
    [sections]
  );
  const canCloseX = useMemo(() => {
    const perms = Array.isArray(user?.permissions) ? user.permissions : [];
    return role === "ADMIN" || perms.includes("restaurant.shift.closeX") || perms.includes("restaurant.shift.close");
  }, [role, user?.permissions]);
  const canCloseZ = useMemo(() => {
    const perms = Array.isArray(user?.permissions) ? user.permissions : [];
    return role === "ADMIN" || perms.includes("restaurant.shift.closeZ") || perms.includes("restaurant.shift.close");
  }, [role, user?.permissions]);
  const canEditItemPrice = useMemo(() => {
    const perms = Array.isArray(user?.permissions) ? user.permissions : [];
    return role === "ADMIN" || perms.includes("restaurant.orders.edit_price");
  }, [role, user?.permissions]);
  const canMoveOrders = useMemo(() => {
    if (role === "ADMIN") return true;
    const perms = Array.isArray(user?.permissions) ? user.permissions : [];
    return perms.includes("restaurant.orders.move");
  }, [role, user?.permissions]);
  const floorPanRef = useRef({ x: 0, y: 0 });
  const floorDragRef = useRef(null);

  useEffect(() => {
    floorPanRef.current = floorPan;
  }, [floorPan]);

  useEffect(() => {
    activeStaffRef.current = activeStaff;
  }, [activeStaff]);

  useEffect(() => {
    if (!activeStaff) setStaffLoginOpen(true);
  }, [activeStaff]);

  useEffect(() => {
    if (activeStaff) setStaffLoginOpen(false);
  }, [activeStaff]);

  useEffect(() => {
    currencySymbol = resolveCurrencySymbol(paymentsCfg.monedaBase);
  }, [paymentsCfg.monedaBase]);

  const loadStaffOptions = useCallback(async () => {
    setStaffOptionsLoading(true);
    try {
      const { data } = await api.get("/restaurant/staff");
      const list = Array.isArray(data) ? data : [];
      setStaffOptions(list.filter((s) => s?.active !== false));
    } catch {
      setStaffOptions([]);
    } finally {
      setStaffOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (staffLoginOpen) {
      loadStaffOptions();
    }
  }, [staffLoginOpen, loadStaffOptions]);
  useEffect(() => {
    if (shiftModalOpen) {
      loadStaffOptions();
    }
  }, [shiftModalOpen, loadStaffOptions]);

  const handleStaffDigit = useCallback((digit) => {
    if (shiftModalOpen) {
      if (shiftKeypadTarget === "amount") {
        setShiftOpenForm((prev) => ({ ...prev, amount: `${prev.amount || ""}${digit}`.slice(0, 12) }));
        return;
      }
      setStaffLoginForm((prev) => ({ ...prev, password: `${prev.password || ""}${digit}`.slice(0, 12) }));
      return;
    }
    setStaffLoginForm((prev) => ({ ...prev, password: `${prev.password || ""}${digit}`.slice(0, 12) }));
  }, [shiftKeypadTarget, shiftModalOpen]);

  const handleStaffBackspace = useCallback(() => {
    if (shiftModalOpen) {
      if (shiftKeypadTarget === "amount") {
        setShiftOpenForm((prev) => ({ ...prev, amount: (prev.amount || "").slice(0, -1) }));
        return;
      }
      setStaffLoginForm((prev) => ({ ...prev, password: (prev.password || "").slice(0, -1) }));
      return;
    }
    setStaffLoginForm((prev) => ({ ...prev, password: (prev.password || "").slice(0, -1) }));
  }, [shiftKeypadTarget, shiftModalOpen]);

  const handleStaffClear = useCallback(() => {
    if (shiftModalOpen) {
      if (shiftKeypadTarget === "amount") {
        setShiftOpenForm((prev) => ({ ...prev, amount: "" }));
        return;
      }
      setStaffLoginForm((prev) => ({ ...prev, password: "" }));
      return;
    }
    setStaffLoginForm((prev) => ({ ...prev, password: "" }));
  }, [shiftKeypadTarget, shiftModalOpen]);

  const formatElapsed = useCallback(
    (iso) => {
      if (!iso) return "";
      const start = new Date(iso);
      if (Number.isNaN(start.getTime())) return "";
      const ms = Math.max(0, now - start);
      const totalMin = Math.floor(ms / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    },
    [now]
  );

  const clampZoom = useCallback((value) => Math.min(2.4, Math.max(0.6, value)), []);

  const resetFloorView = useCallback(() => {
    setFloorZoom(1);
    setFloorPan({ x: 0, y: 0 });
  }, []);

  const handleFloorPointerDown = useCallback(
    (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target;
      if (target?.closest && target.closest("[data-floor-table=\"true\"]")) return;
      e.preventDefault();
      if (typeof e.currentTarget.setPointerCapture === "function") {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      const start = floorPanRef.current;
      floorDragRef.current = { x: e.clientX, y: e.clientY, panX: start.x, panY: start.y };
      setFloorDragging(true);
    },
    []
  );

  const handleFloorPointerMove = useCallback((e) => {
    if (!floorDragRef.current) return;
    const dx = e.clientX - floorDragRef.current.x;
    const dy = e.clientY - floorDragRef.current.y;
    setFloorPan({ x: floorDragRef.current.panX + dx, y: floorDragRef.current.panY + dy });
  }, []);

  const handleFloorPointerUp = useCallback(() => {
    if (!floorDragRef.current) return;
    floorDragRef.current = null;
    setFloorDragging(false);
  }, []);

  const handleFloorWheel = useCallback(
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setFloorZoom((z) => clampZoom(z + delta));
    },
    [clampZoom]
  );

  const persistOrderNow = useCallback(async (payload) => {
    if (!payload?.tableId) return;
    const localKey = payload?.localId ? String(payload.localId) : "";
    if (payload?.createNew && localKey) {
      if (creatingOrderRef.current[localKey]) {
        pendingCreateUpdateRef.current[localKey] = payload;
        return;
      }
      creatingOrderRef.current[localKey] = true;
    }

    let data = null;
    try {
      const response = await api.post("/restaurant/order", payload);
      data = response?.data;
    } catch (err) {
      if (payload?.createNew && localKey) {
        creatingOrderRef.current[localKey] = false;
      }
      throw err;
    }

    if (data && typeof data === "object") {
      const pendingCreateSnapshot = payload?.createNew && localKey ? pendingCreateUpdateRef.current[localKey] : null;
      setOrdersByTable((prev) => {
        const list = normalizeOrderList(prev[payload.tableId]);
        const incoming = {
          ...data,
          items: Array.isArray(data.items) ? data.items : [],
          covers: data.covers || payload.covers || 0,
          note: data.note || payload.note || "",
          status: data.status || "OPEN",
          serviceType: data.serviceType || payload.serviceType || "DINE_IN",
          roomId: data.roomId || payload.roomId || "",
          guestId: data.guestId || payload.guestId || "",
        };
        const incomingKey = getOrderKey(incoming);
        const matchKey = payload.orderId || payload.localId || incomingKey;
        const idx = list.findIndex((o) => getOrderKey(o) === String(matchKey));
        const nextList = [...list];
        if (idx >= 0) {
          const prevOrder = nextList[idx];
          if (pendingCreateSnapshot) {
            // Keep latest optimistic snapshot while the initial create request is still catching up.
            nextList[idx] = {
              ...prevOrder,
              ...incoming,
              items: Array.isArray(pendingCreateSnapshot.items)
                ? pendingCreateSnapshot.items
                : Array.isArray(prevOrder.items)
                  ? prevOrder.items
                  : incoming.items,
              covers: pendingCreateSnapshot.covers ?? prevOrder.covers ?? incoming.covers,
              note:
                typeof pendingCreateSnapshot.note === "string"
                  ? pendingCreateSnapshot.note
                  : typeof prevOrder.note === "string"
                    ? prevOrder.note
                    : incoming.note,
              serviceType: pendingCreateSnapshot.serviceType || prevOrder.serviceType || incoming.serviceType || "DINE_IN",
              roomId: pendingCreateSnapshot.roomId ?? prevOrder.roomId ?? incoming.roomId ?? "",
              discountId: pendingCreateSnapshot.discountId ?? prevOrder.discountId ?? incoming.discountId ?? "",
              discountPercent: Number(
                pendingCreateSnapshot.discountPercent ?? prevOrder.discountPercent ?? incoming.discountPercent ?? 0
              ) || 0,
              waiterId: pendingCreateSnapshot.waiterId ?? prevOrder.waiterId ?? incoming.waiterId,
              localId: prevOrder.localId || payload.localId || incoming.localId || undefined,
            };
          } else {
            nextList[idx] = { ...prevOrder, ...incoming, localId: prevOrder.localId || payload.localId };
          }
        } else {
          nextList.push({ ...incoming, localId: payload.localId || incoming.localId || undefined });
        }
        return { ...prev, [payload.tableId]: nextList };
      });

      const orderKey = getOrderKey(data);
      if (orderKey) {
        setActiveOrderByTable((prev) => {
          const currentKey = prev[payload.tableId];
          const matchesPayload = currentKey === String(payload.orderId || payload.localId || "");
          if (!currentKey || matchesPayload) {
            return { ...prev, [payload.tableId]: orderKey };
          }
          return prev;
        });
      }

      if (payload?.createNew && localKey) {
        creatingOrderRef.current[localKey] = false;
        const pending = pendingCreateUpdateRef.current[localKey];
        if (pending) {
          delete pendingCreateUpdateRef.current[localKey];
          // Persist latest snapshot now that we have the real order id.
          await persistOrderNow({
            ...pending,
            orderId: data.id || data.orderId,
            createNew: false,
          });
        }
      }
    } else if (payload?.createNew && localKey) {
      creatingOrderRef.current[localKey] = false;
    }
  }, []);

  const queueOrderSave = useCallback(
    (payload) => {
      const key = getOrderSaveKey(payload);
      const pending = pendingOrderSaveRef.current && typeof pendingOrderSaveRef.current === "object" ? pendingOrderSaveRef.current : {};
      pendingOrderSaveRef.current = { ...pending, [key]: payload };
      if (orderSaveTimerRef.current) clearTimeout(orderSaveTimerRef.current);
      orderSaveTimerRef.current = setTimeout(async () => {
        const batch = pendingOrderSaveRef.current && typeof pendingOrderSaveRef.current === "object" ? pendingOrderSaveRef.current : {};
        pendingOrderSaveRef.current = null;
        orderSaveTimerRef.current = null;
        try {
          for (const p of Object.values(batch)) {
            if (!p?.tableId) continue;
            // eslint-disable-next-line no-await-in-loop
            await persistOrderNow(p);
          }
        } catch (err) {
          const msg = err?.response?.data?.message || err?.message || "Could not save order.";
          window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: msg } }));
        }
      }, 650);
    },
    [persistOrderNow]
  );

  const flushOrderSave = useCallback(async () => {
    if (orderSaveTimerRef.current) {
      clearTimeout(orderSaveTimerRef.current);
      orderSaveTimerRef.current = null;
    }
    const batch = pendingOrderSaveRef.current && typeof pendingOrderSaveRef.current === "object" ? pendingOrderSaveRef.current : {};
    pendingOrderSaveRef.current = null;
    try {
      for (const p of Object.values(batch)) {
        if (!p?.tableId) continue;
        // eslint-disable-next-line no-await-in-loop
        await persistOrderNow(p);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Could not save order.";
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: msg } }));
    }
  }, [persistOrderNow]);

  useEffect(() => {
    return () => {
      if (orderSaveTimerRef.current) clearTimeout(orderSaveTimerRef.current);
    };
  }, []);

  const allTables = useMemo(() => {
    const list = [];
    (sections || []).forEach((sec) => {
      (sec.tables || []).forEach((t) => list.push({ ...t, section: sec }));
    });
    return list;
  }, [sections]);

  const tablePickerTables = useMemo(() => {
    if (!tablePickerSectionId || tablePickerSectionId === "ALL") return allTables;
    return allTables.filter((t) => String(t.section?.id || "") === String(tablePickerSectionId));
  }, [allTables, tablePickerSectionId]);

  const tableOrderSummary = useMemo(() => {
    const summary = {};
    Object.entries(ordersByTable || {}).forEach(([tableId, entry]) => {
      const list = normalizeOrderList(entry);
      const sentTimes = list
        .map((o) => (o?.sentAt ? new Date(o.sentAt) : null))
        .filter((d) => d && !Number.isNaN(d.getTime()))
        .sort((a, b) => a - b);
      summary[tableId] = {
        count: list.length,
        hasItems: list.some((o) => (o.items || []).length > 0),
        sentAt: sentTimes.length > 0 ? sentTimes[0].toISOString() : "",
      };
    });
    return summary;
  }, [ordersByTable]);

  const pickMenuHierarchyValue = useCallback((item, keys = [], fallback = "") => {
    for (const key of keys) {
      const val = String(item?.[key] || "").trim();
      if (val) return val;
    }
    return String(fallback || "").trim();
  }, []);

  const getMenuFamily = useCallback(
    (item) =>
      pickMenuHierarchyValue(
        item,
        ["familyName", "family", "familia", "familyLabel", "familyCategory", "categoryName", "category"],
        "General"
      ),
    [pickMenuHierarchyValue]
  );

  const getMenuSubFamily = useCallback(
    (item) =>
      pickMenuHierarchyValue(item, [
        "subFamilyName",
        "subfamily",
        "subFamily",
        "subCategoria",
        "subcategoria",
        "subCategory",
        "subFamilyLabel",
      ]),
    [pickMenuHierarchyValue]
  );

  const getMenuSubSubFamily = useCallback(
    (item) =>
      pickMenuHierarchyValue(item, [
        "subSubFamilyName",
        "subSubFamily",
        "subsubfamily",
        "subSubFamilia",
        "subsubFamilia",
        "subSubCategory",
        "subsubCategory",
      ]),
    [pickMenuHierarchyValue]
  );

  const categories = useMemo(() => {
    const set = new Set();
    (menuItems || []).forEach((m) => {
      const family = getMenuFamily(m);
      if (family) set.add(family);
    });
    return Array.from(set);
  }, [menuItems, getMenuFamily]);

  const subCategories = useMemo(() => {
    if (!category) return [];
    const set = new Set();
    (menuItems || []).forEach((m) => {
      if (getMenuFamily(m) !== category) return;
      const sub = getMenuSubFamily(m);
      if (sub) set.add(sub);
    });
    return Array.from(set);
  }, [menuItems, category, getMenuFamily, getMenuSubFamily]);

  const subSubCategories = useMemo(() => {
    if (!category || !subCategory) return [];
    const set = new Set();
    (menuItems || []).forEach((m) => {
      if (getMenuFamily(m) !== category) return;
      if (getMenuSubFamily(m) !== subCategory) return;
      const subSub = getMenuSubSubFamily(m);
      if (subSub) set.add(subSub);
    });
    return Array.from(set);
  }, [menuItems, category, subCategory, getMenuFamily, getMenuSubFamily, getMenuSubSubFamily]);

  const filteredMenu = useMemo(() => {
    return (menuItems || []).filter((m) => {
      const family = getMenuFamily(m);
      const subFamily = getMenuSubFamily(m);
      const subSubFamily = getMenuSubSubFamily(m);
      const inCat = !category || family === category;
      const inSub = !subCategory || subFamily === subCategory;
      const inSubSub = !subSubCategory || subSubFamily === subSubCategory;
      const term = String(search || "").toLowerCase();
      const matches =
        !term ||
        [m.name, m.code, m.barcode]
          .map((v) => String(v || "").toLowerCase())
          .some((v) => v.includes(term));
      return inCat && inSub && inSubSub && matches;
    });
  }, [menuItems, category, subCategory, subSubCategory, search, getMenuFamily, getMenuSubFamily, getMenuSubSubFamily]);

  useEffect(() => {
    if (!category) return;
    if (categories.includes(category)) return;
    setCategory("");
    setSubCategory("");
    setSubSubCategory("");
  }, [category, categories]);

  useEffect(() => {
    if (!category) {
      if (subCategory) setSubCategory("");
      if (subSubCategory) setSubSubCategory("");
      return;
    }
    if (!subCategory) return;
    if (subCategories.includes(subCategory)) return;
    setSubCategory("");
    setSubSubCategory("");
  }, [category, subCategory, subSubCategory, subCategories]);

  useEffect(() => {
    if (!subCategory) {
      if (subSubCategory) setSubSubCategory("");
      return;
    }
    if (!subSubCategory) return;
    if (subSubCategories.includes(subSubCategory)) return;
    setSubSubCategory("");
  }, [subCategory, subSubCategory, subSubCategories]);

  const shift = useMemo(() => {
    const h = now.getHours();
    if (h < 15) return "Morning shift";
    if (h < 22) return "Afternoon shift";
    return "Night shift";
  }, [now]);

  const selectedTableOrders = useMemo(() => {
    if (!selectedTable?.id) return [];
    return normalizeOrderList(ordersByTable[selectedTable.id]);
  }, [ordersByTable, selectedTable?.id]);

  const activeOrderKey = useMemo(
    () => (selectedTable?.id ? activeOrderByTable[selectedTable.id] || "" : ""),
    [activeOrderByTable, selectedTable?.id]
  );

  const orderTabs = useMemo(
    () =>
      selectedTableOrders.map((o, idx) => ({
        key: getOrderKey(o) || `order-${idx + 1}`,
        label: `Order ${idx + 1}`,
      })),
    [selectedTableOrders]
  );

  const currentOrder = useMemo(() => {
    if (!selectedTable?.id) return { items: [], covers, note: orderNote, status: "New", serviceType, roomId: roomCharge, guestId: selectedGuestId, discountId: "", discountPercent: 0 };
    const list = selectedTableOrders;
    const byKey = list.find((o) => getOrderKey(o) && getOrderKey(o) === activeOrderKey);
    const stored = byKey || list[0];
    if (!stored) {
      return { items: [], covers, note: orderNote, status: "New", serviceType, roomId: roomCharge, guestId: selectedGuestId, discountId: "", discountPercent: 0 };
    }
    return {
      ...stored,
      items: Array.isArray(stored?.items) ? stored.items : [],
      covers: stored?.covers || covers,
      note: typeof stored?.note === "string" ? stored.note : orderNote || "",
      status: stored?.status || "New",
      updatedAt: stored?.updatedAt,
      serviceType: stored?.serviceType || serviceType,
      roomId: stored?.roomId || roomCharge,
      guestId: stored?.guestId || selectedGuestId,
      discountId: stored?.discountId || "",
      discountPercent: Number(stored?.discountPercent || 0) || 0,
    };
  }, [selectedTable?.id, selectedTableOrders, activeOrderKey, covers, orderNote, serviceType, roomCharge, selectedGuestId]);

  useEffect(() => {
    if (!selectedTable?.id) return;
    if (!currentOrder) return;
    const nextCovers = currentOrder.covers || selectedTable?.seats || 2;
    const nextNote = currentOrder.note || "";
    const nextService = currentOrder.serviceType || "DINE_IN";
    const nextRoom = currentOrder.roomId || "";
    const nextGuest = currentOrder.guestId || "";
    if (covers !== nextCovers) setCovers(nextCovers);
    if (orderNote !== nextNote) setOrderNote(nextNote);
    if (serviceType !== nextService) setServiceType(nextService);
    if (roomCharge !== nextRoom) setRoomCharge(nextRoom);
    if (selectedGuestId !== nextGuest) setSelectedGuestId(nextGuest);
  }, [selectedTable?.id, selectedTable?.seats, currentOrder, covers, orderNote, serviceType, roomCharge, selectedGuestId]);

  useEffect(() => {
    if (!selectedSection?.id || selectedTable) return;
    resetFloorView();
  }, [selectedSection?.id, selectedTable, resetFloorView]);

  useEffect(() => {
    if (!selectedTable?.id) return;
    if (selectedTableOrders.length === 0) return;
    const hasActive = selectedTableOrders.some((o) => getOrderKey(o) === activeOrderKey);
    if (!hasActive) {
      setActiveOrderByTable((prev) => ({ ...prev, [selectedTable.id]: getOrderKey(selectedTableOrders[0]) }));
    }
  }, [selectedTable?.id, selectedTableOrders, activeOrderKey]);

  useEffect(() => {
    activeOrderByTableRef.current = activeOrderByTable;
  }, [activeOrderByTable]);

  useEffect(() => {
    ordersByTableRef.current = ordersByTable;
  }, [ordersByTable]);

  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  useEffect(() => {
    return () => {
      if (voidInvoiceSuccessTimerRef.current) clearTimeout(voidInvoiceSuccessTimerRef.current);
    };
  }, []);

  const totals = useMemo(() => {
    const serviceRate = Number(taxesCfg.servicio || 0) / 100;
    const taxRate = Number(taxesCfg.iva || 0) / 100;
    const sums = (currentOrder.items || []).reduce(
      (acc, i) => {
        const qty = Number(i.qty || 0);
        const price = Number(i.price || 0);
        const gross = price * qty;
        const itemDiscountRate = Math.min(100, Math.max(0, Number(i.discountPercent || 0))) / 100;
        const discountedGross = gross * (1 - itemDiscountRate);
        acc.discountItems += gross - discountedGross;
        const includes = i?.priceIncludesTaxesAndService !== false;
        if (includes) {
          const denom = 1 + serviceRate + taxRate;
          const net = denom > 0 ? discountedGross / denom : discountedGross;
          acc.subtotal += net;
          acc.service += net * serviceRate;
          acc.tax += net * taxRate;
          acc.total += discountedGross;
        } else {
          const net = discountedGross;
          acc.subtotal += net;
          acc.service += net * serviceRate;
          acc.tax += net * taxRate;
          acc.total += net + net * serviceRate + net * taxRate;
        }
        return acc;
      },
      { subtotal: 0, service: 0, tax: 0, total: 0, discountItems: 0 }
    );
    const orderDiscountRate = Math.min(100, Math.max(0, Number(currentOrder.discountPercent || 0))) / 100;
    const orderDiscount = sums.total * orderDiscountRate;
    const factor = sums.total > 0 ? (sums.total - orderDiscount) / sums.total : 1;
    return {
      subtotal: sums.subtotal * factor,
      service: sums.service * factor,
      tax: sums.tax * factor,
      total: sums.total * factor,
      discountItems: sums.discountItems,
      discountOrder: orderDiscount,
      discountTotal: sums.discountItems + orderDiscount,
    };
  }, [currentOrder.items, currentOrder.discountPercent, taxesCfg.iva, taxesCfg.servicio]);

  const systemTotal = useMemo(() => {
    if (typeof stats.systemTotal === "number") return stats.systemTotal || 0;
    const serviceRate = Number(taxesCfg.servicio || 0) / 100;
    const taxRate = Number(taxesCfg.iva || 0) / 100;
    const computeOrderTotal = (order) => {
      const sums = (order?.items || []).reduce(
        (acc, i) => {
          const qty = Number(i.qty || 0);
          const price = Number(i.price || 0);
          const gross = price * qty;
          const itemDiscountRate = Math.min(100, Math.max(0, Number(i.discountPercent || 0))) / 100;
          const discountedGross = gross * (1 - itemDiscountRate);
          const includes = i?.priceIncludesTaxesAndService !== false;
          if (includes) {
            const denom = 1 + serviceRate + taxRate;
            const net = denom > 0 ? discountedGross / denom : discountedGross;
            acc.total += discountedGross;
            acc.subtotal += net;
            acc.service += net * serviceRate;
            acc.tax += net * taxRate;
          } else {
            const net = discountedGross;
            acc.subtotal += net;
            acc.service += net * serviceRate;
            acc.tax += net * taxRate;
            acc.total += net + net * serviceRate + net * taxRate;
          }
          return acc;
        },
        { subtotal: 0, service: 0, tax: 0, total: 0 }
      );
      const orderDiscountRate = Math.min(100, Math.max(0, Number(order?.discountPercent || 0))) / 100;
      const orderDiscount = sums.total * orderDiscountRate;
      return sums.total - orderDiscount;
    };
    return Object.values(ordersByTable).reduce((acc, entry) => {
      const list = normalizeOrderList(entry);
      const tableSum = list.reduce((sum, o) => sum + computeOrderTotal(o), 0);
      return acc + tableSum;
    }, 0);
  }, [stats.systemTotal, ordersByTable, taxesCfg.iva, taxesCfg.servicio]);

  const reportedTotal = useMemo(
    () => sumNumbers({ cash: closeForm.cash, card: closeForm.card, sinpe: closeForm.sinpe, transfer: closeForm.transfer, room: closeForm.room }),
    [closeForm]
  );

  const closeSummary = useMemo(() => {
    const sys = systemTotal || 0;
    const diff = reportedTotal - sys;
    return { system: sys, reported: reportedTotal, diff };
  }, [systemTotal, reportedTotal]);
  const auditTotals = closeSnapshot?.totals || closeSummary;

  const paymentTotal = useMemo(() => sumNumbers(paymentForm), [paymentForm]);
  const paymentDiff = useMemo(() => paymentTotal - totals.total, [paymentTotal, totals.total]);

  const availablePaymentMethods = useMemo(() => {
    const usedKeys = new Set();
    const toUniqueKey = (base, idx) => {
      let key = base || `pm-${idx + 1}`;
      let i = 1;
      while (usedKeys.has(key)) {
        key = `${base || "pm"}-${i}`;
        i += 1;
      }
      usedKeys.add(key);
      return key;
    };

    const fromPaymentMethods = Array.isArray(paymentsCfg?.paymentMethods) ? paymentsCfg.paymentMethods : [];
    const enabledFromMethods = fromPaymentMethods
      .filter((m) => m && m.enabled !== false)
      .map((m, idx) => {
        const name = String(m?.name || m?.id || "").trim();
        if (!name) return null;
        const baseKey = resolvePaymentKey(name, m?.id);
        return { id: String(m?.id || name || `pm-${idx + 1}`), name, key: toUniqueKey(baseKey, idx) };
      })
      .filter(Boolean);

    const cobros = Array.isArray(paymentsCfg?.cobros) ? paymentsCfg.cobros : [];
    const normalizedCobros = cobros.map((c) => String(c || "").trim()).filter(Boolean);
    const fallbackCobros = normalizedCobros.length > 0 ? normalizedCobros : ["Efectivo", "Tarjeta", "SINPE", "Transferencia"];

    const fromCobros = fallbackCobros.map((name, idx) => {
      const baseKey = resolvePaymentKey(name, name);
      return { id: slugifyPaymentKey(name) || `pm-${idx + 1}`, name, key: toUniqueKey(baseKey, idx) };
    });

    const hasPaymentMethods = fromPaymentMethods.length > 0;
    const baseList = hasPaymentMethods ? enabledFromMethods : fromCobros;
    const methods = [...baseList];

    if (paymentsCfg?.cargoHabitacion && !methods.some((m) => m.key === "room")) {
      const roomKey = toUniqueKey("room", methods.length);
      methods.push({ id: "room", name: "Habitacion", key: roomKey });
    }

    return methods;
  }, [paymentsCfg?.paymentMethods, paymentsCfg?.cobros, paymentsCfg?.cargoHabitacion]);

  const closeMethodRows = useMemo(() => {
    const byMethod = stats?.byMethod && typeof stats.byMethod === "object" ? stats.byMethod : {};
    const labelMap = new Map((availablePaymentMethods || []).map((m) => [String(m.key), String(m.name || m.key)]));
    return Object.entries(byMethod).map(([key, amount]) => ({
      key,
      label: labelMap.get(String(key)) || String(key),
      amount: asNumber(amount),
    }));
  }, [stats?.byMethod, availablePaymentMethods]);
  const closeInputDefs = useMemo(() => {
    const labelMap = new Map((availablePaymentMethods || []).map((m) => [String(m.key), String(m.name || m.key)]));
    const base = [
      { key: "cash", label: labelMap.get("cash") || "Cash" },
      { key: "card", label: labelMap.get("card") || "Card" },
      { key: "sinpe", label: labelMap.get("sinpe") || "SINPE" },
      { key: "transfer", label: labelMap.get("transfer") || "Bank transfer" },
      { key: "room", label: labelMap.get("room") || "Room charge" },
    ];
    const enabledKeys = new Set((availablePaymentMethods || []).map((m) => String(m.key)));
    if (paymentsCfg?.cargoHabitacion) enabledKeys.add("room");
    return base.filter((item) => enabledKeys.has(item.key));
  }, [availablePaymentMethods, paymentsCfg?.cargoHabitacion]);
  const closeCompareRows = useMemo(() => {
    const byMethod = stats?.byMethod && typeof stats.byMethod === "object" ? stats.byMethod : {};
    return (closeInputDefs || []).map((item) => ({
      key: item.key,
      label: item.label,
      amount: asNumber(byMethod[item.key] ?? 0),
    }));
  }, [closeInputDefs, stats?.byMethod]);

  const auditRows = useMemo(() => {
    const byMethod =
      closeSnapshot?.byMethod && typeof closeSnapshot.byMethod === "object"
        ? closeSnapshot.byMethod
        : stats?.byMethod && typeof stats.byMethod === "object"
          ? stats.byMethod
          : {};
    const labelMap = new Map((availablePaymentMethods || []).map((m) => [String(m.key), String(m.name || m.key)]));
    return Object.entries(byMethod).map(([key, amount]) => ({
      key,
      label: labelMap.get(String(key)) || String(key),
      amount: asNumber(amount),
    }));
  }, [closeSnapshot?.byMethod, stats?.byMethod, availablePaymentMethods]);

  const selectedPaymentMethods = useMemo(() => {
    if (!selectedPaymentKeys.length) return [];
    const byKey = new Map(availablePaymentMethods.map((m) => [m.key, m]));
    return selectedPaymentKeys.map((k) => byKey.get(k)).filter(Boolean);
  }, [availablePaymentMethods, selectedPaymentKeys]);

  const displayTotals = paymentResult?.totals || totals;
  const paymentChange = paymentResult?.change || 0;

  const hasItems = useMemo(() => (currentOrder.items || []).length > 0, [currentOrder.items]);
  const isQuickCashContext = useMemo(
    () =>
      Boolean(selectedSection?.quickCashEnabled) ||
      Boolean(selectedTable?.quickCash) ||
      String(selectedTable?.id || "").startsWith("QC-"),
    [selectedSection?.quickCashEnabled, selectedTable?.quickCash, selectedTable?.id]
  );
  const isOrderComandada = useCallback((order) => {
    if (!order) return false;
    const status = String(order?.status || "").toUpperCase();
    if (status === "ENVIADO") return true;
    if (order?.sentAt) return true;
    const sentItems = order?.sentItems && typeof order.sentItems === "object" ? Object.values(order.sentItems) : [];
    return sentItems.some((v) => Number(v || 0) > 0);
  }, []);
  const isComandada = useMemo(() => isOrderComandada(currentOrder), [currentOrder, isOrderComandada]);
  const isRBasic = useMemo(() => String(hotel?.membership || "").toUpperCase() === "RBASIC", [hotel?.membership]);
  const serviceOptions = useMemo(
    () => [
      { id: "DINE_IN", label: "Dine In" },
      { id: "TAKEOUT", label: "Takeout" },
      { id: "DELIVERY", label: "Delivery" },
      { id: "ROOM", label: "Room charge" },
    ],
    []
  );
  const filteredServiceOptions = useMemo(
    () => (isRBasic ? serviceOptions.filter((opt) => !["DELIVERY", "ROOM"].includes(opt.id)) : serviceOptions),
    [isRBasic, serviceOptions]
  );
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setOpenInfo((prev) => ({
      ...prev,
      user: user?.name || user?.email || prev.user,
    }));
  }, [user?.name, user?.email]);

  const refreshShiftStatus = useCallback(async () => {
    setShiftLoading(true);
    setShiftOpenError("");
    try {
      const { data } = await api.get("/restaurant/shift");
      if (data?.open) {
        setShiftModalOpen(false);
        if (data?.shift?.openedAt) {
          setOpenInfo((prev) => ({ ...prev, openedAt: data.shift.openedAt }));
        }
      } else {
        setShiftModalOpen(true);
      }
    } catch (err) {
      setShiftModalOpen(true);
      const msg = err?.response?.data?.message || "No se pudo validar el turno.";
      setShiftOpenError(msg);
    } finally {
      setShiftLoading(false);
    }
  }, []);

  const openShift = useCallback(async (staffIdOverride = "") => {
    if (shiftOpenBusy) return;
    const amountValue = parseMoneyInput(shiftOpenForm.amount || 0);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setShiftOpenError("Debes ingresar un monto de apertura mayor a 0.");
      return;
    }
    const staffId = String(staffIdOverride || shiftOpenForm.staffId || "").trim();
    if (!staffId) {
      setShiftOpenError("Selecciona un usuario para la apertura.");
      return;
    }
    const staff = (staffOptions || []).find((s) => String(s?.id) === staffId);
    setShiftOpenBusy(true);
    setShiftOpenError("");
    try {
      const noteParts = [];
      if (staff) {
        const roleLabel = staffRoleLabel(staff.role || "");
        noteParts.push(`Apertura por ${staff.name || staff.username || "usuario"} (${roleLabel})`);
      }
      if (shiftOpenForm.note) noteParts.push(String(shiftOpenForm.note || "").trim());
      const note = noteParts.filter(Boolean).join(" | ") || undefined;
      const { data } = await api.post("/restaurant/shift/open", {
        openingAmount: amountValue,
        note,
      });
      setShiftModalOpen(false);
      setShiftOpenForm({ amount: "", note: "", staffId: "" });
      if (data?.shift?.openedAt) {
        setOpenInfo((prev) => ({ ...prev, openedAt: data.shift.openedAt }));
      }
      setShiftLoading(false);
    } catch (err) {
      const msg = err?.response?.data?.message || "No se pudo abrir el turno.";
      setShiftOpenError(msg);
    } finally {
      setShiftOpenBusy(false);
    }
  }, [shiftOpenBusy, shiftOpenForm.amount, shiftOpenForm.note, shiftOpenForm.staffId, staffOptions]);

  const openShiftWithLogin = useCallback(async () => {
    if (staffLoginBusy || shiftOpenBusy) return;
    setStaffLoginError("");
    setShiftOpenError("");
    const username = String(staffLoginForm.username || "").trim();
    const password = String(staffLoginForm.password || "").trim();
    if (!username || !password) {
      setStaffLoginError("Usuario y password requeridos.");
      return;
    }
    setStaffLoginBusy(true);
    try {
      const { data } = await api.post("/restaurant/staff/login", { username, password });
      setActiveStaff(data || null);
      setStaffLoginForm({ username: "", password: "" });
      const staff = (staffOptions || []).find((s) => String(s?.username || "") === username);
      const staffId = staff?.id ? String(staff.id) : "";
      if (staffId) {
        setShiftOpenForm((f) => ({ ...f, staffId }));
      }
      await openShift(staffId);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "No se pudo iniciar.";
      setStaffLoginError(msg);
    } finally {
      setStaffLoginBusy(false);
    }
  }, [staffLoginBusy, shiftOpenBusy, staffLoginForm.username, staffLoginForm.password, staffOptions, openShift]);

  useEffect(() => {
    refreshShiftStatus();
  }, [refreshShiftStatus]);

  const loadSections = useCallback(async () => {
    let loadingCleared = false;
    const clearLoading = () => {
      if (loadingCleared) return;
      loadingCleared = true;
      setSectionsLoading(false);
    };
    setSectionsLoading(true);
    setSectionsError("");
    try {
      const { data } = await api.get("/restaurant/sections");
      let baseSections = Array.isArray(data) ? data : [];

      // Table style persistence is stored in /restaurant/general.tableStyles (backend doesn't persist size/rotation/color on tables).
      try {
        const { data: gen } = await api.get("/restaurant/general");
        const tableStyles = gen?.tableStyles;
        if (tableStyles) baseSections = applyTableStylesToSections(baseSections, tableStyles);
      } catch {
        // ignore
      }

      setSections(baseSections);
      if (baseSections.length === 0) {
        setSectionsError("No sections/tables configured. Create them from Management.");
        clearLoading();
        return;
      }
      clearLoading();

      // Some backends store floorplan/layout separately per section.
      // Merge `/layout` into section tables when available (load in background).
      try {
        const layoutResults = await Promise.allSettled(
          baseSections.map(async (s) => {
            const id = String(s?.id || "");
            if (!id) return null;
            const res = await api.get(`/restaurant/sections/${encodeURIComponent(id)}/layout`);
            const tables = Array.isArray(res?.data?.tables) ? res.data.tables : Array.isArray(res?.data) ? res.data : [];
            return { id, tables };
          })
        );
        const layouts = new Map();
        for (const r of layoutResults) {
          if (r.status !== "fulfilled" || !r.value?.id) continue;
          layouts.set(String(r.value.id), Array.isArray(r.value.tables) ? r.value.tables : []);
        }
        if (layouts.size > 0) {
          setSections((prev) =>
            (prev || []).map((sec) => {
              const layoutTables = layouts.get(String(sec?.id || ""));
              if (!Array.isArray(layoutTables) || layoutTables.length === 0) return sec;
              const byId = new Map(layoutTables.map((t) => [String(t?.id), t]));
              return {
                ...sec,
                tables: (sec.tables || []).map((t) => {
                  const p = byId.get(String(t?.id));
                  if (!p) return t;
                  const next = { ...t };
                  if (Number.isFinite(Number(p?.x))) next.x = Number(p.x);
                  if (Number.isFinite(Number(p?.y))) next.y = Number(p.y);

                  // Style fields: prefer layout values when present.
                  if (Number.isFinite(Number(p?.size))) next.size = Number(p.size);
                  if (Number.isFinite(Number(p?.rotation))) next.rotation = Number(p.rotation);
                  if (typeof p?.color === "string" && String(p.color).trim()) next.color = String(p.color);
                  if (p?.kind) next.kind = String(p.kind);
                  return next;
                }),
              };
            })
          );
        }
      } catch {
        // ignore: layout endpoint may not exist
      }
    } catch {
      setSections([]);
      setSectionsError("Could not load sections. Check configuration in Management.");
    } finally {
      clearLoading();
    }
  }, []);

  const loadPrinters = useCallback(async () => {
    try {
      const { data } = await api.get("/restaurant/config");
      setPrinterCfg({
        kitchenPrinter: data?.kitchenPrinter || "",
        barPrinter: data?.barPrinter || "",
        cashierPrinter: data?.cashierPrinter || "",
      });
      const p = data?.printing && typeof data.printing === "object" ? data.printing : null;
      if (p) setPrintSettings((prev) => ({ ...prev, ...p, types: { ...prev.types, ...(p.types || {}) } }));
    } catch {
      setPrinterCfg({ kitchenPrinter: "", barPrinter: "", cashierPrinter: "" });
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get("/restaurant/taxes");
      if (data && typeof data === "object") {
        setTaxesCfg({
          iva: data.iva ?? 13,
          servicio: data.servicio ?? 10,
          descuentoMax: data.descuentoMax ?? 15,
          permitirDescuentos: data.permitirDescuentos ?? true,
          impuestoIncluido: data.impuestoIncluido ?? true,
        });
      }
    } catch {
      setTaxesCfg({ iva: 13, servicio: 10, descuentoMax: 15, permitirDescuentos: true, impuestoIncluido: true });
    }
    try {
      const { data } = await api.get("/restaurant/payments");
      if (data && typeof data === "object") {
        const cobrosList = Array.isArray(data.cobros)
          ? data.cobros
          : typeof data.cobros === "string"
            ? data.cobros.split(",").map((c) => c.trim()).filter(Boolean)
            : [];
        setPaymentsCfg({
          monedaBase: data.monedaBase || "CRC",
          monedaSec: data.monedaSec || "USD",
          tipoCambio: Number(data.tipoCambio || 0) || 530,
          cobros: cobrosList,
          cargoHabitacion: Boolean(data.cargoHabitacion),
          paymentMethods: Array.isArray(data.paymentMethods) ? data.paymentMethods : [],
        });
      }
    } catch {
      setPaymentsCfg({ monedaBase: "CRC", monedaSec: "USD", tipoCambio: 530, cobros: [], cargoHabitacion: false, paymentMethods: [] });
    }
    try {
      const { data } = await api.get("/restaurant/billing");
      if (data && typeof data === "object") {
        setBillingCfg({
          ticketHeader: data.ticketHeader || "",
          ticketFooter: data.ticketFooter || "",
          invoiceHeader: data.invoiceHeader || "",
          invoiceFooter: data.invoiceFooter || "",
        });
      }
    } catch {
      setBillingCfg({ ticketHeader: "", ticketFooter: "", invoiceHeader: "", invoiceFooter: "" });
    }

    try {
      const { data } = await api.get("/discounts");
      setDiscountsList(Array.isArray(data) ? data : []);
    } catch {
      setDiscountsList([]);
    }

    try {
      const { data } = await api.get("/guests");
      setGuestsList(Array.isArray(data) ? data : []);
    } catch {
      setGuestsList([]);
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    try {
      const { data } = await api.get("/restaurant/orders");
      if (Array.isArray(data)) {
        const map = {};
        data.forEach((o, idx) => {
          if (!o?.tableId) return;
          const previousList = normalizeOrderList(ordersByTableRef.current[o.tableId]);
          const order = {
            ...o,
            items: Array.isArray(o.items) ? o.items : [],
            covers: o.covers || 2,
            note: o.note || "",
            status: o.status || "ENVIADO",
            serviceType: o.serviceType || "DINE_IN",
            roomId: o.roomId || "",
            sentItems: o.sentItemsMap && typeof o.sentItemsMap === "object" ? o.sentItemsMap : {},
            sentAt: o.sentItemsMap ? new Date(o.updatedAt || Date.now()).toISOString() : "",
          };
          const incomingKey = getOrderKey(order);
          if (incomingKey) {
            const prevMatch = previousList.find((p) => getOrderKey(p) === incomingKey);
            const prevStatus = String(prevMatch?.status || "").toUpperCase();
            const incomingStatus = String(order.status || "").toUpperCase();
            if (prevStatus === "ENVIADO" && (incomingStatus === "OPEN" || !incomingStatus)) {
              order.status = "ENVIADO";
            }
            // Prefer server sentItemsMap; fall back to local state if server doesn't have it yet
            if (!o.sentItemsMap && prevMatch?.sentItems) order.sentItems = prevMatch.sentItems;
            if (!o.sentItemsMap && prevMatch?.sentAt) order.sentAt = prevMatch.sentAt;
          }
          if (!getOrderKey(order)) {
            order.localId = `local-${o.tableId}-${idx}-${Date.now()}`;
          }
          if (!map[o.tableId]) map[o.tableId] = [];
          map[o.tableId].push(order);
        });
        setOrdersByTable(map);
        const currentTableId = selectedTableRef.current?.id;
        setActiveOrderByTable((prev) => {
          const next = { ...prev };
          if (currentTableId) {
            const list = normalizeOrderList(map[currentTableId]);
            if (list.length === 0) {
              delete next[currentTableId];
            } else {
              const currentKey = prev[currentTableId];
              const has = list.some((o) => getOrderKey(o) === currentKey);
              next[currentTableId] = has ? currentKey : getOrderKey(list[0]);
            }
          }
          return next;
        });
        if (currentTableId) {
          const list = normalizeOrderList(map[currentTableId]);
          const preferredKey = activeOrderByTableRef.current[currentTableId];
          const order = list.find((o) => getOrderKey(o) === preferredKey) || list[0];
          if (order) {
            setCovers(order.covers || 2);
            setOrderNote(order.note || "");
            setServiceType(order.serviceType || "DINE_IN");
            setRoomCharge(order.roomId || "");
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const { data } = await api.get("/restaurant/stats");
      if (data && typeof data === "object") {
        setStats({
          systemTotal: Number(data.systemTotal || 0),
          openOrders: Number(data.openOrders || 0),
          salesCount: Number(data.salesCount || 0),
          openOrderValue: Number(data.openOrderValue || 0),
          lastCloseAt: data.lastCloseAt || null,
          byMethod: data.byMethod || {},
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadSections();
    loadPrinters();
    loadSettings();
    refreshStats();
  }, [loadSections, loadPrinters, loadSettings, refreshStats]);

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  const loadMenu = useCallback(
    async (sectionId) => {
      try {
        const { data } = await api.get(`/restaurant/menu?section=${encodeURIComponent(sectionId || "")}&serviceType=${serviceType}`);
        if (Array.isArray(data) && data.length > 0) {
          setMenuItems(data);
          setCategory("");
          setSubCategory("");
          setSubSubCategory("");
          return;
        }
      } catch {
        /* ignore */
      }
      setMenuItems([]);
      setCategory("");
      setSubCategory("");
      setSubSubCategory("");
    },
    [serviceType]
  );

  useEffect(() => {
    if (selectedSection?.id) {
      loadMenu(selectedSection.id);
    }
  }, [selectedSection?.id, loadMenu]);

  const handleSelectTable = (table, section) => {
    if (!activeStaffRef.current) {
      setStaffLoginOpen(true);
      return;
    }
    setSelectedSection(section);
    setSelectedTable(table);
    const list = normalizeOrderList(ordersByTable[table.id]);
    if (list.length === 0) {
      const newOrder = buildLocalOrder({
        covers: table?.seats || 2,
        serviceType: "DINE_IN",
        sectionId: section?.id,
        waiterId: activeStaffRef.current?.role === "WAITER" ? activeStaffRef.current?.id : undefined,
      });
      setOrdersByTable((prev) => ({ ...prev, [table.id]: [newOrder] }));
      setActiveOrderByTable((prev) => ({ ...prev, [table.id]: getOrderKey(newOrder) }));
      setCovers(newOrder.covers || table?.seats || 2);
      setOrderNote(newOrder.note || "");
      setServiceType(newOrder.serviceType || "DINE_IN");
      setRoomCharge(newOrder.roomId || "");
    } else {
      const desiredKey = activeOrderByTable[table.id] || getOrderKey(list[0]);
      const order = list.find((o) => getOrderKey(o) === desiredKey) || list[0];
      setActiveOrderByTable((prev) => ({ ...prev, [table.id]: getOrderKey(order) }));
      setCovers(order?.covers || table?.seats || 2);
      setOrderNote(order?.note || "");
      setServiceType(order?.serviceType || "DINE_IN");
      setRoomCharge(order?.roomId || "");
    }
    loadMenu(section?.id);
    setSectionLauncher(false);
    setTablePickerOpen(false);
  };

  const startQuickCash = (section) => {
    if (!section) return;
    if (shiftLoading) return;
    if (shiftModalOpen) {
      setShiftModalOpen(true);
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: "Restaurant", desc: "Open shift before using Quick Cash." },
        })
      );
      return;
    }
    const sectionId = String(section?.id || "");
    if (!sectionId) return;
    const quickTableId = `QC-${sectionId}`;
    const quickTableName = section?.name ? `${section.name} - Quick` : `Quick ${sectionId}`;
    handleSelectTable(
      {
        id: quickTableId,
        name: quickTableName,
        seats: 1,
        quickCash: true,
        sectionId,
      },
      section
    );
  };

  const moveToTable = async (toTable) => {
    if (!selectedTable?.id || !toTable?.id) return;
    if (!canMoveOrders) {
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "No tienes permiso para mover ordenes." } }));
      return;
    }
    try {
      await api.post("/restaurant/order/move", {
        fromTableId: selectedTable.id,
        toTableId: toTable.id,
        restaurantOrderId: currentOrder?.id || currentOrder?.orderId || undefined,
        orderId: currentOrder?.id || currentOrder?.orderId || undefined,
      });
      await refreshOrders();
      setSelectedSection(toTable.section || selectedSection);
      setSelectedTable(toTable);
      setTablePickerOpen(false);
      setMoveTargetTable(null);
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Table changed." } }));
    } catch (err) {
      const msg = err?.response?.data?.message || "Could not change table.";
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: msg } }));
    }
  };

  const printToAgent = useCallback(async ({ printerNames, text, copies = 1 }) => {
    const cfg = ensurePrintAgentConfigInteractive();
    if (!cfg) throw new Error("Print Agent API key not set.");

    const list = Array.from(new Set((printerNames || []).map((p) => String(p || "").trim()).filter(Boolean)));
    if (list.length === 0) throw new Error("No printer configured for this action.");

    for (const printerName of list) {
      // eslint-disable-next-line no-await-in-loop
      await printTextToAgent({ agentUrl: cfg.url, apiKey: cfg.key, printerName, text, copies });
    }
  }, []);

  const getInvoicePrintConfig = () => {
    const docType = String(printSettings?.defaultDocType || "TE").toUpperCase();
    const typeKey = docType === "FE" ? "electronicInvoice" : "ticket";
    const cfg = printSettings?.types?.[typeKey] || {};
    const docCfg = printSettings?.types?.document || {};
    const printerId = String(cfg.printerId || docCfg.printerId || printerCfg.cashierPrinter || "").trim();
    const copies = Number(cfg.copies || docCfg.copies || 1) || 1;
    return { printerId, copies, docType, typeKey };
  };
  const closeVoidInvoiceModal = () => {
    if (voidInvoiceBusy) return;
    setVoidInvoiceModalOpen(false);
    setVoidInvoiceAuthOpen(false);
    setVoidInvoiceError("");
    setVoidInvoiceForm({ username: "", password: "", reason: "" });
    setVoidInvoiceTarget(null);
  };

  const showVoidInvoiceSuccess = () => {
    setVoidInvoiceSuccessOpen(true);
    if (voidInvoiceSuccessTimerRef.current) clearTimeout(voidInvoiceSuccessTimerRef.current);
    voidInvoiceSuccessTimerRef.current = setTimeout(() => {
      setVoidInvoiceSuccessOpen(false);
      voidInvoiceSuccessTimerRef.current = null;
    }, 1600);
  };

  const loadVoidInvoices = async () => {
    setVoidInvoiceLoading(true);
    try {
      const { data } = await api.get("/restaurant/shift/invoices");
      setVoidInvoiceList(Array.isArray(data) ? data : []);
    } catch {
      setVoidInvoiceList([]);
    } finally {
      setVoidInvoiceLoading(false);
    }
  };

  const openVoidInvoiceModal = () => {
    setVoidInvoiceModalOpen(true);
    setVoidInvoiceAuthOpen(false);
    setVoidInvoiceError("");
    setVoidInvoiceForm({ username: "", password: "", reason: "" });
    setVoidInvoiceBusy(false);
    setVoidInvoiceTarget(null);
    loadVoidInvoices();
  };

  const openVoidInvoiceAuth = () => {
    if (!voidInvoiceTarget?.id) {
      setVoidInvoiceError("Selecciona una factura primero.");
      return;
    }
    const targetStatus = String(voidInvoiceTarget.status || "").toUpperCase();
    if (targetStatus === "CANCELED") {
      setVoidInvoiceError("La factura ya esta anulada.");
      return;
    }
    if (targetStatus === "NO_DOC") {
      setVoidInvoiceError("Esta factura no tiene documento electronico.");
      return;
    }
    setVoidInvoiceAuthOpen(true);
    setVoidInvoiceError("");
    setVoidInvoiceForm({ username: "", password: "", reason: "" });
  };

  const closeVoidInvoiceAuth = () => {
    if (voidInvoiceBusy) return;
    setVoidInvoiceAuthOpen(false);
    setVoidInvoiceError("");
    setVoidInvoiceForm({ username: "", password: "", reason: "" });
  };

  const confirmVoidInvoice = async () => {
    if (voidInvoiceBusy) return;
    const username = String(voidInvoiceForm.username || "").trim();
    const password = String(voidInvoiceForm.password || "").trim();
    const reason = String(voidInvoiceForm.reason || "").trim();
    if (!username || !password || !reason) {
      setVoidInvoiceError("Usuario, contrasena y motivo son requeridos.");
      return;
    }

    if (!voidInvoiceTarget?.restaurantOrderId) {
      setVoidInvoiceError("Selecciona una factura.");
      return;
    }
    if (String(voidInvoiceTarget.status || "").toUpperCase() === "CANCELED") {
      setVoidInvoiceError("La factura ya esta anulada.");
      return;
    }

    setVoidInvoiceBusy(true);
    setVoidInvoiceError("");
    try {
      await api.post("/restaurant/order/void-invoice", {
        restaurantOrderId: voidInvoiceTarget.restaurantOrderId,
        tableId: voidInvoiceTarget?.order?.tableId || undefined,
        docType: voidInvoiceTarget.docType,
        reason,
        adminCode: password,
        adminUser: username,
      });

      closeVoidInvoiceModal();
      showVoidInvoiceSuccess();
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Factura anulada." } }));
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "No se pudo anular la factura.";
      setVoidInvoiceError(msg);
    } finally {
      setVoidInvoiceBusy(false);
    }
  };

  const cancelEmptyOrder = async () => {
    if (!selectedTable?.id) return;
    const tableId = selectedTable.id;
    const list = normalizeOrderList(ordersByTable[tableId]);
    if (list.length === 0) return;
    const targetOrder = list.find((o) => getOrderKey(o) === activeOrderKey) || list[0];
    if (!targetOrder) return;
    const itemsCount = Array.isArray(targetOrder.items) ? targetOrder.items.length : 0;
    const orderId = targetOrder?.id || targetOrder?.orderId || "";
    if (!orderId) {
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: "Restaurant", desc: "La orden aun no existe en el sistema." },
        })
      );
      return;
    }
    setCancelOrderTarget({ orderId, tableId, itemsCount });
    setCancelOrderForm({ username: "", password: "", reason: "" });
    setCancelOrderError("");
    setCancelOrderModalOpen(true);
  };

  const closeCancelOrderModal = () => {
    if (cancelOrderBusy) return;
    setCancelOrderModalOpen(false);
    setCancelOrderError("");
    setCancelOrderForm({ username: "", password: "", reason: "" });
    setCancelOrderTarget(null);
  };

  const confirmCancelOrder = async () => {
    if (cancelOrderBusy) return;
    const username = String(cancelOrderForm.username || "").trim();
    const password = String(cancelOrderForm.password || "").trim();
    const reason = String(cancelOrderForm.reason || "").trim();
    if (!username || !password || !reason) {
      setCancelOrderError("Usuario, contrasena y motivo son requeridos.");
      return;
    }
    if (!cancelOrderTarget?.orderId || !cancelOrderTarget?.tableId) {
      setCancelOrderError("Orden no seleccionada.");
      return;
    }

    // Capture snapshots before state is cleared
    const orderSnapshot = currentOrder;
    const tableSnapshot = selectedTable;
    const sectionSnapshot = selectedSection;
    const wasComandada = isComandada;

    setCancelOrderBusy(true);
    setCancelOrderError("");
    try {
      await api.post("/restaurant/order/cancel", {
        orderId: cancelOrderTarget.orderId,
        tableId: cancelOrderTarget.tableId,
        reason,
        adminCode: password,
        adminUser: username,
      });
      const tableId = cancelOrderTarget.tableId;
      setOrdersByTable((prev) => {
        const current = normalizeOrderList(prev[tableId]);
        const nextList = current.filter((o) => {
          const id = String(o?.id || o?.orderId || "");
          return id !== String(cancelOrderTarget.orderId);
        });
        const next = { ...prev };
        if (nextList.length === 0) {
          delete next[tableId];
        } else {
          next[tableId] = nextList;
        }
        return next;
      });
      setActiveOrderByTable((prev) => {
        const next = { ...prev };
        delete next[tableId];
        return next;
      });
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Orden anulada." } }));
      closeCancelOrderModal();
      resetToLobby();

      // Print void ticket to kitchen if items were already sent
      if (wasComandada) {
        const sentMap = getSentMap(orderSnapshot);
        const hasSentMap = Object.values(sentMap).some((v) => Number(v) > 0);
        const itemsToVoid = (orderSnapshot?.items || []).filter((i) => {
          if (hasSentMap) return Number(sentMap[getOrderItemKey(i)] || 0) > 0;
          return true;
        });
        if (itemsToVoid.length > 0) {
          const voidText = buildVoidTicketText({
            tableId: tableSnapshot?.name || tableSnapshot?.id,
            sectionId: sectionSnapshot?.name || sectionSnapshot?.id,
            items: itemsToVoid,
            reason,
            authorizedBy: username,
          });
          const kitchenPrinters = [printerCfg.kitchenPrinter, printerCfg.barPrinter].filter(Boolean);
          if (kitchenPrinters.length > 0) {
            printToAgent({ printerNames: kitchenPrinters, text: voidText, copies: 1 }).catch(() => {});
          }
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "No se pudo anular la orden.";
      setCancelOrderError(msg);
    } finally {
      setCancelOrderBusy(false);
    }
  };

  const openPayments = () => {
    if (!selectedTable?.id || !hasItems) return;
    const activeService = currentOrder.serviceType || serviceType;
    const roomTarget = currentOrder.roomId || roomCharge;
    if (activeService === "ROOM" && !roomTarget) {
      window.alert("Agrega el numero de habitacion para el cargo.");
      return;
    }
    const methods = availablePaymentMethods;
    const totalDue = Number(totals.total || 0);
    const totalValue = Number.isFinite(totalDue) ? totalDue.toFixed(2) : "";
    const roomKey = methods.find((m) => m.key === "room")?.key;
    const defaultKey = activeService === "ROOM" && roomKey ? roomKey : methods[0]?.key;
    const baseForm = {};
    methods.forEach((m) => {
      baseForm[m.key] = "";
    });
    if (defaultKey) baseForm[defaultKey] = totalValue;
    setPaymentForm(baseForm);
    setSelectedPaymentKeys(defaultKey ? [defaultKey] : []);
    setSplitPayments(false);
    setPaymentResult(null);
    setPaymentPrintBusy(false);
    setPaymentsModalOpen(true);
  };

  const closePaymentsModal = (options = {}) => {
    const force = options?.force === true;
    if (paymentPrintBusy && !force) return;
    setPaymentsModalOpen(false);
    setPaymentForm({});
    setSelectedPaymentKeys([]);
    setSplitPayments(false);
    setPaymentResult(null);
    setPaymentPrintBusy(false);
  };

  const finalizePaymentAndExit = () => {
    const keepQuickCashContext = isQuickCashContext;
    closePaymentsModal({ force: true });
    setOrderNote("");
    setCovers(2);
    setServiceType("DINE_IN");
    setRoomCharge("");
    if (!keepQuickCashContext) {
      setSelectedTable(null);
    }
    setSectionLauncher(false);
  };

  const getSplitItemKey = (item, idx) =>
    getOrderItemKey(item) || String(item?.id ?? item?.code ?? item?.name ?? idx ?? "");
  const getItemQty = (item) => Math.max(0, Math.floor(Number(item?.qty || 0)));

  const openSplitOrderModal = () => {
    if (!selectedTable?.id || !hasItems) return;
    const map = {};
    (currentOrder.items || []).forEach((item, idx) => {
      const key = getSplitItemKey(item, idx);
      const qty = getItemQty(item);
      map[key] = { A: qty, B: 0, C: 0 };
    });
    setSplitOrderMap(map);
    setSplitOrderCount(2);
    setSplitOrderModalOpen(true);
  };

  const closeSplitOrderModal = () => {
    setSplitOrderModalOpen(false);
  };

  const confirmSplitOrder = () => {
    if (!selectedTable?.id) return;
    const items = Array.isArray(currentOrder.items) ? currentOrder.items : [];
    const itemsA = [];
    const itemsB = [];
    const itemsC = [];
    let qtyA = 0;
    let qtyB = 0;
    let qtyC = 0;
    items.forEach((it, idx) => {
      const key = getSplitItemKey(it, idx);
      const split = splitOrderMap[key] || { A: getItemQty(it), B: 0, C: 0 };
      if (split.A > 0) {
        itemsA.push({ ...it, qty: split.A });
        qtyA += split.A;
      }
      if (split.B > 0) {
        itemsB.push({ ...it, qty: split.B });
        qtyB += split.B;
      }
      if (splitOrderCount === 3 && split.C > 0) {
        itemsC.push({ ...it, qty: split.C });
        qtyC += split.C;
      }
    });
    if (qtyA === 0 || qtyB === 0 || (splitOrderCount === 3 && qtyC === 0)) {
      window.alert(splitOrderCount === 3 ? "Debes asignar articulos a las tres cuentas." : "Debes asignar articulos a las dos cuentas.");
      return;
    }

    const newOrder = buildLocalOrder({
      covers: currentOrder.covers || covers || 2,
      note: "",
      serviceType: currentOrder.serviceType || serviceType || "DINE_IN",
      roomId: currentOrder.roomId || roomCharge || "",
      sectionId: currentOrder.sectionId || selectedSection?.id || null,
    });

    setOrdersByTable((prev) => {
      const list = normalizeOrderList(prev[selectedTable.id]);
      const currentKey = getOrderKey(currentOrder);
      const idx = list.findIndex((o) => getOrderKey(o) === currentKey);
      if (idx < 0) return prev;
      const nextList = [...list];
      nextList[idx] = { ...nextList[idx], items: itemsA };
      nextList.push({ ...newOrder, items: itemsB });
      return { ...prev, [selectedTable.id]: nextList };
    });

    queueOrderSave({
      orderId: currentOrder.id || currentOrder.orderId || undefined,
      localId: currentOrder.localId || undefined,
      createNew: !currentOrder.id && !currentOrder.orderId,
      sectionId: currentOrder.sectionId || selectedSection?.id || null,
      tableId: selectedTable.id,
      items: itemsA,
      note: currentOrder.note || "",
      covers: currentOrder.covers || covers || 0,
      serviceType: currentOrder.serviceType || serviceType || "DINE_IN",
      roomId: currentOrder.roomId || roomCharge || "",
      guestId: currentOrder.guestId || selectedGuestId || "",
      discountId: currentOrder.discountId || "",
      discountPercent: Number(currentOrder.discountPercent || 0) || 0,
    });
    queueOrderSave({
      orderId: newOrder.id || newOrder.orderId || undefined,
      localId: newOrder.localId || undefined,
      createNew: true,
      sectionId: newOrder.sectionId || selectedSection?.id || null,
      tableId: selectedTable.id,
      items: itemsB,
      note: "",
      covers: newOrder.covers || 0,
      serviceType: newOrder.serviceType || serviceType || "DINE_IN",
      roomId: newOrder.roomId || roomCharge || "",
      guestId: currentOrder.guestId || selectedGuestId || "",
      discountId: "",
      discountPercent: 0,
    });

    if (splitOrderCount === 3) {
      const newOrderC = buildLocalOrder({
        covers: currentOrder.covers || covers || 2,
        note: "",
        serviceType: currentOrder.serviceType || serviceType || "DINE_IN",
        roomId: currentOrder.roomId || roomCharge || "",
        sectionId: currentOrder.sectionId || selectedSection?.id || null,
      });
      setOrdersByTable((prev) => {
        const list = normalizeOrderList(prev[selectedTable.id]);
        return { ...prev, [selectedTable.id]: [...list, { ...newOrderC, items: itemsC }] };
      });
      queueOrderSave({
        orderId: newOrderC.id || newOrderC.orderId || undefined,
        localId: newOrderC.localId || undefined,
        createNew: true,
        sectionId: newOrderC.sectionId || selectedSection?.id || null,
        tableId: selectedTable.id,
        items: itemsC,
        note: "",
        covers: newOrderC.covers || 0,
        serviceType: newOrderC.serviceType || serviceType || "DINE_IN",
        roomId: newOrderC.roomId || roomCharge || "",
        discountId: "",
        discountPercent: 0,
      });
    }

    setActiveOrderByTable((prev) => ({ ...prev, [selectedTable.id]: getOrderKey(currentOrder) }));
    setSplitOrderModalOpen(false);
  };

  const handleSplitToggle = () => {
    const nextSplit = !splitPayments;
    setSplitPayments(nextSplit);
    if (!nextSplit) {
      const totalDue = Number(totals.total || 0);
      const totalValue = Number.isFinite(totalDue) ? totalDue.toFixed(2) : "";
      const fallbackKey = selectedPaymentKeys[selectedPaymentKeys.length - 1] || availablePaymentMethods[0]?.key;
      setSelectedPaymentKeys(fallbackKey ? [fallbackKey] : []);
      setPaymentForm((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          next[k] = "";
        });
        if (fallbackKey) next[fallbackKey] = totalValue;
        return next;
      });
    }
  };

  const handlePaymentMethodToggle = (key) => {
    if (!key) return;
    const totalDue = Number(totals.total || 0);
    const totalValue = Number.isFinite(totalDue) ? totalDue.toFixed(2) : "";
    const isSelected = selectedPaymentKeys.includes(key);

    if (!splitPayments) {
      setSelectedPaymentKeys([key]);
      setPaymentForm((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          next[k] = "";
        });
        next[key] = totalValue;
        return next;
      });
      return;
    }

    if (isSelected && selectedPaymentKeys.length === 1) return;
    setSelectedPaymentKeys((prev) => (isSelected ? prev.filter((k) => k !== key) : [...prev, key]));
    setPaymentForm((prev) => {
      const next = { ...prev };
      if (isSelected) {
        next[key] = "";
        } else if (!String(next[key] ?? "").trim()) {
        const remaining = Math.max(0, totalDue - sumNumbers(prev));
        next[key] = remaining ? remaining.toFixed(2) : "";
      }
      return next;
    });
  };

  const updatePaymentAmount = (key, value) => {
    setPaymentForm((prev) => ({ ...prev, [key]: value }));
  };

  const printPaidInvoice = async () => {
    if (paymentPrintBusy) return;
    const payload = paymentResult?.payload;
    const previewTotals = paymentResult?.totals;
    if (!payload || !previewTotals) {
      closePaymentsModal();
      return;
    }

    setPaymentPrintBusy(true);
    try {
      // Close payment flow immediately when user chooses to print.
      finalizePaymentAndExit();
      const invoiceCfg = getInvoicePrintConfig();
      const isFE = String(invoiceCfg.docType || "TE").toUpperCase() === "FE";
      const header = isFE ? billingCfg.invoiceHeader : billingCfg.ticketHeader;
      const footer = isFE ? billingCfg.invoiceFooter : billingCfg.ticketFooter;
      const run = async () => {
        const baseText = buildPrintPreviewText({ title: "Factura", payload, totals: previewTotals });
        const text = composePrintText({ header, body: baseText, footer });
        await printToAgent({
          printerNames: [invoiceCfg.printerId],
          text,
          copies: invoiceCfg.copies,
        });
        window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Factura impresa." } }));
      };
      await runPrintWithPreview({
        title: "Factura",
        payload: { ...payload, __printHeader: header, __printFooter: footer },
        totals: previewTotals,
        onConfirm: run,
        previewKey: "invoice",
      });
    } catch (err) {
      const msg = err?.message || err?.response?.data?.message || "No se pudo imprimir.";
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: "Restaurant billing", desc: msg, kind: "einvoice.error" },
        })
      );
    } finally {
      setPaymentPrintBusy(false);
    }
  };

  const resetToLobby = () => {
    setSelectedSection(null);
    setSelectedTable(null);
    setCategory("");
    setSectionLauncher(true);
    setSearch("");
    setOrderNote("");
    setCovers(2);
    setServiceType("DINE_IN");
    setRoomCharge("");
  };

  const staffRoleLabel = (roleValue) => {
    const roleKey = String(roleValue || "").toUpperCase();
    if (roleKey === "CASHIER") return "Cajero";
    if (roleKey === "WAITER") return "Mesero";
    return "Personal";
  };

  const clearStaffSession = () => {
    setActiveStaff(null);
    setStaffLoginForm({ username: "", password: "" });
    setStaffLoginError("");
    setStaffLoginOpen(true);
  };

  const submitStaffLogin = async () => {
    if (staffLoginBusy) return;
    setStaffLoginBusy(true);
    setStaffLoginError("");
    try {
      const payload = {
        username: String(staffLoginForm.username || "").trim(),
        password: String(staffLoginForm.password || "").trim(),
      };
      if (!payload.username || !payload.password) {
        setStaffLoginError("Usuario y password requeridos.");
        setStaffLoginBusy(false);
        return;
      }
      const { data } = await api.post("/restaurant/staff/login", payload);
      setActiveStaff(data || null);
      setStaffLoginForm({ username: "", password: "" });
      setStaffLoginError("");
      setStaffLoginOpen(false);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "No se pudo iniciar.";
      setStaffLoginError(msg);
    } finally {
      setStaffLoginBusy(false);
    }
  };

  const updateOrderForTable = useCallback(
    (tableId, updater, orderKeyOverride = "") => {
      let nextActiveKey = "";
      setOrdersByTable((prev) => {
        const list = normalizeOrderList(prev[tableId]);
        const desiredKey = orderKeyOverride || activeOrderByTable[tableId] || "";
        let idx = desiredKey ? list.findIndex((o) => getOrderKey(o) === desiredKey) : -1;
        let nextList = [...list];

        if (idx < 0 && list.length > 0) {
          idx = 0;
        }

        if (idx < 0) {
            const created = buildLocalOrder({
              covers: covers || 2,
              note: orderNote || "",
              serviceType: serviceType || "DINE_IN",
              roomId: roomCharge || "",
              sectionId: selectedSection?.id || null,
              waiterId: activeStaffRef.current?.role === "WAITER" ? activeStaffRef.current?.id : undefined,
            });
          nextList = [...list, created];
          idx = nextList.length - 1;
        }

        const cur = nextList[idx] || buildLocalOrder();
        const next = updater(cur);
        const staffWaiterId = activeStaffRef.current?.role === "WAITER" ? activeStaffRef.current?.id : undefined;
        const merged = {
          ...cur,
          ...next,
          items: Array.isArray(next?.items) ? next.items : Array.isArray(cur.items) ? cur.items : [],
          covers: next?.covers ?? cur?.covers ?? covers,
          note: typeof next?.note === "string" ? next.note : typeof cur?.note === "string" ? cur.note : orderNote || "",
          serviceType: next?.serviceType || cur?.serviceType || serviceType || "DINE_IN",
          roomId: next?.roomId || cur?.roomId || roomCharge || "",
          guestId: next?.guestId || cur?.guestId || selectedGuestId || "",
          status: typeof next?.status === "string" ? next.status : cur?.status || "",
          sentItems: next?.sentItems || cur?.sentItems || {},
          sentAt: next?.sentAt || cur?.sentAt || "",
          waiterId: next?.waiterId || cur?.waiterId || staffWaiterId,
        };

        nextList[idx] = merged;
        nextActiveKey = getOrderKey(merged);

        // Persist open order so it stays on the table until paid or canceled.
        queueOrderSave({
          orderId: merged.id || merged.orderId || undefined,
          localId: merged.localId || undefined,
          createNew: !merged.id && !merged.orderId,
          sectionId: merged.sectionId || selectedSection?.id || null,
          tableId,
          items: Array.isArray(merged.items) ? merged.items : [],
          note: merged.note || "",
          covers: merged.covers || 0,
          serviceType: merged.serviceType || "DINE_IN",
          roomId: merged.roomId || "",
          guestId: merged.guestId || "",
          discountId: merged.discountId || "",
          discountPercent: Number(merged.discountPercent || 0) || 0,
          waiterId: merged.waiterId || undefined,
        });

        return { ...prev, [tableId]: nextList };
      });

      if (nextActiveKey) {
        setActiveOrderByTable((prev) => ({ ...prev, [tableId]: nextActiveKey }));
      }
    },
    [activeOrderByTable, covers, orderNote, serviceType, roomCharge, selectedGuestId, selectedSection?.id, queueOrderSave]
  );

  const createNewOrderForTable = (tableId, { select = true } = {}) => {
    if (!tableId) return null;
    let newOrder = null;
    setOrdersByTable((prev) => {
      const list = normalizeOrderList(prev[tableId]);
      const draft = list.find((o) => !o?.id && !o?.orderId && (o.items || []).length === 0);
      if (draft) {
        newOrder = draft;
        return prev;
      }
        newOrder = buildLocalOrder({
          covers: selectedTable?.seats || covers || 2,
          note: "",
          serviceType: serviceType || "DINE_IN",
          roomId: roomCharge || "",
          sectionId: selectedSection?.id || null,
          waiterId: activeStaffRef.current?.role === "WAITER" ? activeStaffRef.current?.id : undefined,
        });
      return { ...prev, [tableId]: [...list, newOrder] };
    });
    if (select && newOrder) {
      setActiveOrderByTable((prev) => ({ ...prev, [tableId]: getOrderKey(newOrder) }));
      setCovers(newOrder.covers || 2);
      setOrderNote(newOrder.note || "");
      setServiceType(newOrder.serviceType || "DINE_IN");
      setRoomCharge(newOrder.roomId || "");
    }
    return newOrder;
  };

  const selectOrderForTable = (tableId, orderKey) => {
    if (!tableId || !orderKey) return;
    const list = normalizeOrderList(ordersByTable[tableId]);
    const order = list.find((o) => getOrderKey(o) === orderKey);
    if (!order) return;
    setActiveOrderByTable((prev) => ({ ...prev, [tableId]: orderKey }));
    setCovers(order.covers || selectedTable?.seats || 2);
    setOrderNote(order.note || "");
    setServiceType(order.serviceType || "DINE_IN");
    setRoomCharge(order.roomId || "");
  };

  const moveItemToOrder = (item, targetKey) => {
    if (!selectedTable?.id || !item) return;
    const tableId = selectedTable.id;
    const fromKey = getOrderKey(currentOrder);
    if (!fromKey) return;

    let fromSnapshot = null;
    let toSnapshot = null;
    let newOrderKey = "";

    setOrdersByTable((prev) => {
      const list = normalizeOrderList(prev[tableId]);
      const fromIdx = list.findIndex((o) => getOrderKey(o) === fromKey);
      if (fromIdx < 0) return prev;

      const nextList = [...list];
      const fromOrder = { ...nextList[fromIdx], items: [...(nextList[fromIdx].items || [])] };
      const movingKey = getOrderItemKey(item);
      const itemIdx = fromOrder.items.findIndex((i) => getOrderItemKey(i) === movingKey);
      if (itemIdx < 0) return prev;

      const movingItem = fromOrder.items[itemIdx];
      fromOrder.items.splice(itemIdx, 1);
      nextList[fromIdx] = fromOrder;

      let targetOrder = null;
      let targetIdx = -1;
      if (targetKey === "__new__") {
        const created = buildLocalOrder({
          covers: fromOrder.covers || covers || 2,
          note: "",
          serviceType: fromOrder.serviceType || serviceType || "DINE_IN",
          roomId: fromOrder.roomId || "",
          sectionId: fromOrder.sectionId || selectedSection?.id || null,
        });
        newOrderKey = getOrderKey(created);
        targetOrder = created;
        nextList.push(created);
        targetIdx = nextList.length - 1;
      } else {
        targetIdx = nextList.findIndex((o) => getOrderKey(o) === targetKey);
        if (targetIdx >= 0) {
          targetOrder = { ...nextList[targetIdx], items: [...(nextList[targetIdx].items || [])] };
        }
      }

      if (!targetOrder) return prev;

      const existingIdx = targetOrder.items.findIndex((i) => getOrderItemKey(i) === movingKey);
      if (existingIdx >= 0) {
        const existing = targetOrder.items[existingIdx];
        targetOrder.items[existingIdx] = { ...existing, qty: (Number(existing.qty) || 0) + (Number(movingItem.qty) || 0) };
      } else {
        targetOrder.items.push({ ...movingItem });
      }

      nextList[targetIdx] = targetOrder;
      fromSnapshot = fromOrder;
      toSnapshot = targetOrder;

      return { ...prev, [tableId]: nextList };
    });

    if (fromSnapshot) {
      queueOrderSave({
        orderId: fromSnapshot.id || fromSnapshot.orderId || undefined,
        localId: fromSnapshot.localId || undefined,
        createNew: !fromSnapshot.id && !fromSnapshot.orderId,
        sectionId: fromSnapshot.sectionId || selectedSection?.id || null,
        tableId,
        items: Array.isArray(fromSnapshot.items) ? fromSnapshot.items : [],
        note: fromSnapshot.note || "",
        covers: fromSnapshot.covers || 0,
        serviceType: fromSnapshot.serviceType || "DINE_IN",
        roomId: fromSnapshot.roomId || "",
        discountId: fromSnapshot.discountId || "",
        discountPercent: Number(fromSnapshot.discountPercent || 0) || 0,
      });
    }
    if (toSnapshot) {
      queueOrderSave({
        orderId: toSnapshot.id || toSnapshot.orderId || undefined,
        localId: toSnapshot.localId || undefined,
        createNew: !toSnapshot.id && !toSnapshot.orderId,
        sectionId: toSnapshot.sectionId || selectedSection?.id || null,
        tableId,
        items: Array.isArray(toSnapshot.items) ? toSnapshot.items : [],
        note: toSnapshot.note || "",
        covers: toSnapshot.covers || 0,
        serviceType: toSnapshot.serviceType || "DINE_IN",
        roomId: toSnapshot.roomId || "",
        discountId: toSnapshot.discountId || "",
        discountPercent: Number(toSnapshot.discountPercent || 0) || 0,
      });
    }
    if (newOrderKey) {
      setActiveOrderByTable((prev) => ({ ...prev, [tableId]: newOrderKey }));
    }
  };

  const addItem = (item, overrides = {}) => {
    if (!selectedTable?.id || !item) return;
    const baseId = item?.itemId || item?.id;
    const variantKey = overrides.variantKey || item?.variantKey || "";
    const nextItem = {
      ...item,
      ...overrides,
      id: baseId,
      itemId: baseId,
      variantKey,
    };
    const nextKey = getOrderItemKey(nextItem);
    updateOrderForTable(selectedTable.id, (cur) => {
      const idx = cur.items.findIndex((i) => getOrderItemKey(i) === nextKey);
      const items = idx >= 0
        ? cur.items.map((i, k) => (k === idx ? { ...i, qty: i.qty + 1 } : i))
        : [...cur.items, { ...nextItem, qty: 1 }];
      return { ...cur, items, covers: cur.covers || covers, note: cur.note || orderNote };
    });
  };
  addItemRef.current = addItem;


  const updateQty = (itemKey, delta) => {
    if (!selectedTable?.id) return;
    if (isComandada && delta < 0) return;
    updateOrderForTable(selectedTable.id, (cur) => {
      const items = cur.items
        .map((i) => (getOrderItemKey(i) === itemKey ? { ...i, qty: Math.max(1, i.qty + delta) } : i))
        .filter((i) => i.qty > 0);
      return { ...cur, items };
    });
  };

  const removeItem = (itemKey) => {
    if (!selectedTable?.id) return;
    if (isComandada) return;
    updateOrderForTable(selectedTable.id, (cur) => ({ ...cur, items: cur.items.filter((i) => getOrderItemKey(i) !== itemKey) }));
  };

  const handleCoversChange = (value) => {
    if (!selectedTable?.id) return;
    const next = Math.max(1, Number(value) || 1);
    setCovers(next);
    updateOrderForTable(selectedTable.id, (cur) => ({ ...cur, covers: next }));
  };

  const handleNoteChange = (value) => {
    setOrderNote(value);
    if (selectedTable?.id) updateOrderForTable(selectedTable.id, (cur) => ({ ...cur, note: value }));
  };

  const handleServiceTypeChange = (value) => {
    const next = value || "DINE_IN";
    setServiceType(next);
    if (next !== "ROOM") setRoomCharge("");
    if (selectedTable?.id) {
      updateOrderForTable(selectedTable.id, (cur) => ({ ...cur, serviceType: next, roomId: next === "ROOM" ? roomCharge : "" }));
    }
  };

  const handleRoomChargeChange = (value) => {
    setRoomCharge(value);
    if (selectedTable?.id) updateOrderForTable(selectedTable.id, (cur) => ({ ...cur, roomId: value }));
  };

  const handleOrderDiscountChange = (value) => {
    if (!selectedTable?.id) return;
    const id = String(value || "");
    const selected = discountById.get(id);
    const percent = selected ? Number(selected.value || 0) : 0;
    updateOrderForTable(selectedTable.id, (cur) => ({ ...cur, discountId: id, discountPercent: percent }));
  };

  const handleItemDiscountChange = (itemKey, value) => {
    if (!selectedTable?.id) return;
    const id = String(value || "");
    const selected = discountById.get(id);
    const percent = selected ? Number(selected.value || 0) : 0;
    updateOrderForTable(selectedTable.id, (cur) => {
      const items = (cur.items || []).map((i) =>
        getOrderItemKey(i) === itemKey ? { ...i, discountId: id, discountPercent: percent } : i
      );
      return { ...cur, items };
    });
  };
  const handleItemPriceChange = (itemKey, value) => {
    if (!selectedTable?.id) return;
    if (!canEditItemPrice) return;
    const nextPrice = parseMoneyInput(value);
    if (!Number.isFinite(nextPrice)) return;
    updateOrderForTable(selectedTable.id, (cur) => {
      const items = (cur.items || []).map((i) =>
        getOrderItemKey(i) === itemKey ? { ...i, price: nextPrice } : i
      );
      return { ...cur, items };
    });
  };
  const resolveOptionId = useCallback(
    (opt, idx) => String(opt?.id ?? opt?.key ?? opt?.label ?? opt?.name ?? idx ?? ""),
    []
  );
  const getOrderItemKey = useCallback(
    (item) => `${String(item?.id ?? item?.itemId ?? "")}::${String(item?.variantKey ?? "")}`,
    []
  );
  const getItemSizes = useCallback((item) => (Array.isArray(item?.sizes) ? item.sizes : []), []);
  const getItemDetails = useCallback((item) => (Array.isArray(item?.details) ? item.details : []), []);
  const itemHasOptions = useCallback(
    (item) => getItemSizes(item).length > 0 || getItemDetails(item).length > 0,
    [getItemSizes, getItemDetails]
  );

  const openItemOptions = useCallback(
    (item) => {
      const sizes = getItemSizes(item);
      const defaultSize = sizes.find((s) => s?.isDefault) || sizes[0] || null;
      const defaultSizeId = defaultSize ? resolveOptionId(defaultSize, sizes.indexOf(defaultSize)) : "";
      setItemOptionsItem(item);
      setItemOptionsSize(defaultSizeId);
      setItemOptionsDetails([]);
      setItemOptionsNote("");
      setItemOptionsOpen(true);
    },
    [getItemSizes, resolveOptionId]
  );

  const closeItemOptions = useCallback(() => {
    setItemOptionsOpen(false);
    setItemOptionsItem(null);
    setItemOptionsSize("");
    setItemOptionsDetails([]);
    setItemOptionsNote("");
  }, []);

  const itemOptionMeta = useMemo(() => {
    if (!itemOptionsItem) {
      return { sizeOptions: [], detailOptions: [], selectedSize: null, selectedDetails: [], basePrice: 0, extras: 0, total: 0 };
    }
    const sizeOptions = getItemSizes(itemOptionsItem);
    const detailOptions = getItemDetails(itemOptionsItem);
    const selectedSize =
      sizeOptions.find((s, idx) => resolveOptionId(s, idx) === itemOptionsSize) || sizeOptions[0] || null;
    const selectedDetails = detailOptions.filter((d, idx) =>
      itemOptionsDetails.includes(resolveOptionId(d, idx))
    );
    const basePrice = selectedSize
      ? Number(selectedSize.price ?? itemOptionsItem.price ?? 0) || 0
      : Number(itemOptionsItem.price ?? 0) || 0;
    const extras = selectedDetails.reduce(
      (sum, d) => sum + (Number(d.priceDelta ?? d.price ?? 0) || 0),
      0
    );
    return { sizeOptions, detailOptions, selectedSize, selectedDetails, basePrice, extras, total: basePrice + extras };
  }, [itemOptionsItem, itemOptionsSize, itemOptionsDetails, getItemSizes, getItemDetails, resolveOptionId]);

  const confirmItemOptions = () => {
    if (!itemOptionsItem) return;
    const sizeOpt = itemOptionMeta.selectedSize;
    const sizeLabel = sizeOpt ? String(sizeOpt.label || sizeOpt.name || "").trim() : "";
    const detailOptions = itemOptionMeta.detailOptions || [];
    const selectedDetails = detailOptions
      .map((d, idx) => ({ d, key: resolveOptionId(d, idx) }))
      .filter(({ key }) => itemOptionsDetails.includes(key));
    const detailLabels = selectedDetails.map(({ d }) => String(d.label || d.name || "").trim()).filter(Boolean);
    const note = String(itemOptionsNote || "").trim();
    const detailText = [...detailLabels, ...(note ? [note] : [])].filter(Boolean).join(", ");
    const nameSuffix = sizeLabel ? ` - ${sizeLabel}` : "";
    const detailSuffix = detailText ? ` (${detailText})` : "";
    const finalName = `${itemOptionsItem.name}${nameSuffix}${detailSuffix}`;

    const sizeKey = sizeOpt ? `size:${resolveOptionId(sizeOpt, itemOptionMeta.sizeOptions.indexOf(sizeOpt))}` : "";
    const detailKeys = selectedDetails.map(({ key }) => `detail:${key}`);
    const noteKey = note ? `note:${encodeURIComponent(note)}` : "";
    const variantKey = [sizeKey, ...detailKeys, noteKey].filter(Boolean).join("|");

    addItem(itemOptionsItem, {
      name: finalName,
      price: itemOptionMeta.total,
      variantKey,
      detailNote: note || null,
    });
    closeItemOptions();
  };

  const menuGrid = useMemo(
    () => (
      <div className="flex-1 min-h-0 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
        <div className="grid [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(185px,1fr))] gap-3">
          {filteredMenu.map((item, idx) => (
            <button
              key={String(item.id || item.code || `${item.name}-${idx}`)}
              onClick={() => (itemHasOptions(item) ? openItemOptions(item) : addItemRef.current && addItemRef.current(item))}
              className="relative rounded-2xl bg-white/95 border border-lime-200 shadow-[0_8px_20px_rgba(16,185,129,0.18)] hover:shadow-[0_12px_28px_rgba(16,185,129,0.28)] hover:-translate-y-0.5 transition text-left p-3 flex flex-col gap-2 h-36 sm:h-40 md:h-44 lg:h-48"
              style={{
                borderColor: item?.color ? String(item.color) : undefined,
              }}
            >
              <div className="min-w-0 text-[16px] font-semibold text-lime-900 leading-tight line-clamp-2">
                {item.name}
              </div>

              {item.imageUrl ? (
                <div className="flex-1 min-h-0 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                  <img
                    alt=""
                    src={sanitizeImageUrl(item.imageUrl)}
                    className="h-full w-full object-contain p-0 scale-110"
                    onError={(ev) => {
                      ev.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div className="flex-1 min-h-0" />
              )}

              <div className="mt-auto w-full text-right text-[16px] font-bold text-lime-800 leading-none">
                {formatMoney(item.price)}
              </div>
            </button>
          ))}
        </div>
      </div>
    ),
    [filteredMenu, itemHasOptions, openItemOptions]
  );

  const closePrintConfirm = () => {
    if (printConfirmBusy) return;
    pendingPrintRef.current = null;
    setPrintConfirmOpen(false);
  };

  const openPrintConfirm = useCallback(
    ({ title, payload, totals: previewTotals, onConfirm }) => {
      pendingPrintRef.current = onConfirm;
      setPrintConfirmTitle(title || "Confirmar impresi?n");
      setPrintConfirmText(buildPrintPreviewText({ title, payload, totals: previewTotals }));
      setPrintConfirmOpen(true);
    },
    []
  );

  const runPrintWithPreview = useCallback(
    async ({ title, payload, totals: previewTotals, onConfirm, previewKey }) => {
      const allowGlobal = printSettings?.showPreview !== false;
      const allowByType = previewKey ? printSettings?.previewByType?.[previewKey] !== false : true;
      if (!allowGlobal || !allowByType) {
        await onConfirm();
        return;
      }
      openPrintConfirm({ title, payload, totals: previewTotals, onConfirm });
    },
    [openPrintConfirm, printSettings]
  );

  const getSentMap = useCallback(
    (order) => (order?.sentItems && typeof order.sentItems === "object" ? order.sentItems : {}),
    []
  );

  const buildComandaDelta = useCallback(
    (order) => {
      const sentMap = getSentMap(order);
      return (order.items || [])
        .map((i) => {
          const sentQty = Number(sentMap[getOrderItemKey(i)] || 0);
          const qty = Number(i.qty || 0);
          const delta = Math.max(0, qty - sentQty);
          return delta > 0 ? { ...i, qty: delta } : null;
        })
        .filter(Boolean);
    },
    [getSentMap, getOrderItemKey]
  );
  const sendComanda = useCallback(async ({ markAsSent = true, silent = false, itemsOverride, returnToSection = false } = {}) => {
    if (!selectedTable?.id || !hasItems) return;
    const itemsToPrint = itemsOverride || (markAsSent ? buildComandaDelta(currentOrder) : currentOrder.items || []);
    if (markAsSent && (!itemsToPrint || itemsToPrint.length === 0)) {
      if (!silent) {
        window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "No hay nuevos articulos para comandar." } }));
      }
      return;
    }
      const nextSentMap = markAsSent
        ? (() => {
            const base = getSentMap(currentOrder);
            const map = { ...base };
            (currentOrder.items || []).forEach((i) => {
              map[getOrderItemKey(i)] = Number(i.qty || 0);
            });
            return map;
          })()
        : undefined;

      const payload = {
        sectionId: selectedSection?.id,
        tableId: selectedTable?.id,
        orderId: currentOrder?.id || currentOrder?.orderId || undefined,
        items: markAsSent ? itemsToPrint : currentOrder.items || [],
        note: orderNote || "",
        covers: currentOrder.covers || covers,
        printers: { ...printerCfg, paperType: printSettings.paperType || undefined },
        type: "KITCHEN_BAR",
        serviceType: currentOrder.serviceType || serviceType,
        roomId: currentOrder.roomId || roomCharge,
        waiterId:
          currentOrder.waiterId || (activeStaffRef.current?.role === "WAITER" ? activeStaffRef.current?.id : undefined),
        mergeItems: markAsSent,
        sentItemsMap: nextSentMap,
      };

    const run = async () => {
      try {
        let serverOrder = null;
        if (markAsSent) {
          const resp = await api.post("/restaurant/order", payload);
          serverOrder = resp?.data || null;
        }
        const title = markAsSent ? "Imprimir comanda" : "Reimprimir comanda";
        const text = buildPrintPreviewText({ title, payload: { ...payload, items: itemsToPrint }, totals });
        const printers = [printerCfg.kitchenPrinter, printerCfg.barPrinter].filter(Boolean);
        await printToAgent({
          printerNames: printers.length ? printers : [printerCfg.cashierPrinter],
          text,
          copies: 1,
        });
        if (markAsSent) {
          const nextSent = {};
          (currentOrder.items || []).forEach((i) => {
            nextSent[getOrderItemKey(i)] = Number(i.qty || 0);
          });
          updateOrderForTable(selectedTable.id, (cur) => ({
            ...cur,
            status: "ENVIADO",
            id: serverOrder?.id || cur?.id || cur?.orderId || undefined,
            orderId: serverOrder?.orderId || cur?.orderId || serverOrder?.id || undefined,
            sentItems: nextSent,
            sentAt: cur.sentAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
          refreshStats();
          if (returnToSection) {
            setSelectedTable(null);
            setSectionLauncher(false);
          }
        }
        if (!silent) {
          window.dispatchEvent(
            new CustomEvent("pms:push-alert", {
              detail: { title: "Restaurant", desc: markAsSent ? "Comanda enviada." : "Comanda reimpresa." },
            })
          );
        }
      } catch (err) {
        if (!silent) {
          const msg = err?.message || err?.response?.data?.message || "No se pudo enviar a impresoras.";
          window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: msg } }));
        }
      }
    };

    if (silent) {
      await run();
      return;
    }

    runPrintWithPreview({
      title: markAsSent ? "Imprimir comanda" : "Reimprimir comanda",
      payload,
      totals,
      onConfirm: run,
      previewKey: "comanda",
    });
  }, [selectedTable, selectedSection, hasItems, buildComandaDelta, currentOrder, orderNote, covers, printerCfg, printSettings, totals, serviceType, roomCharge, printToAgent, updateOrderForTable, refreshStats, openPrintConfirm, getOrderItemKey]);

  const sendToKitchen = async () => sendComanda({ markAsSent: true, silent: true, returnToSection: true });

  const reprintComanda = async () => sendComanda({ markAsSent: false, silent: false });

  useEffect(() => {
    if (!isComandada) return;
    if (autoComandaRef.current) return;
    const delta = buildComandaDelta(currentOrder);
    if (!delta || delta.length === 0) return;
    autoComandaRef.current = true;
    sendComanda({ markAsSent: true, silent: true, itemsOverride: delta })
      .finally(() => {
        autoComandaRef.current = false;
      });
  }, [isComandada, currentOrder, buildComandaDelta, sendComanda]);
  const printSubtotal = async () => {
    if (!selectedTable?.id || !hasItems) return;
    try {
      await flushOrderSave();
      const subtotalPayload = {
        sectionId: selectedSection?.id,
        tableId: selectedTable.id,
        items: currentOrder.items || [],
        note: orderNote,
        covers: currentOrder.covers || covers,
        type: "SUBTOTAL",
        serviceType: currentOrder.serviceType || serviceType,
        roomId: currentOrder.roomId || roomCharge,
        printers: { ...printerCfg, paperType: printSettings.paperType || undefined },
      };
      const invoiceCfg = getInvoicePrintConfig();
      const run = async () => {
        const text = buildPrintPreviewText({ title: "Subtotal", payload: subtotalPayload, totals });
        await printToAgent({ printerNames: [invoiceCfg.printerId], text, copies: invoiceCfg.copies });
        window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Subtotal impreso." } }));
      };
      await runPrintWithPreview({ title: "Subtotal", payload: subtotalPayload, totals, onConfirm: run, previewKey: "subtotal" });
    } catch (err) {
      const msg = err?.message || err?.response?.data?.message || "No se pudo imprimir subtotal.";
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: msg } }));
    }
  };

  const confirmChargeOrder = async () => {
    if (!selectedTable?.id || !hasItems) return;
    try {
      await flushOrderSave();
      const snapshotItems = (currentOrder.items || []).map((i) => ({ ...i }));
      const snapshotTotals = { ...totals };
      const invoiceCfg = getInvoicePrintConfig();
      const paymentMethodsSnapshot = Object.entries(paymentForm)
        .filter(([, v]) => Number(v) > 0)
        .map(([key, amount]) => {
          const def = (availablePaymentMethods || []).find((m) => String(m.key) === String(key));
          return { name: def?.name || key, amount: Number(amount) };
        });
      const snapshotPayload = {
        sectionId: selectedSection?.id,
        tableId: selectedTable.id,
        items: snapshotItems,
        note: orderNote,
        covers: currentOrder.covers || covers,
        type: invoiceCfg.docType,
        serviceType: currentOrder.serviceType || serviceType,
        roomId: currentOrder.roomId || roomCharge,
        printers: { ...printerCfg, paperType: printSettings.paperType || undefined },
        cashierName: activeStaffRef.current?.name || undefined,
        paymentMethods: paymentMethodsSnapshot,
        paid: paidAmount,
        change,
      };
      const paidAmount = sumNumbers(paymentForm);
      const change = Math.max(0, paidAmount - (snapshotTotals.total || 0));
      const closeRes = await api.post("/restaurant/order/close", {
        tableId: selectedTable.id,
        sectionId: selectedSection?.id,
        restaurantOrderId: currentOrder?.id || currentOrder?.orderId || undefined,
        orderId: currentOrder?.id || currentOrder?.orderId || undefined,
        docType: invoiceCfg.docType,
        payments: paymentForm,
        totals,
        note: orderNote,
        covers: currentOrder.covers || covers,
        items: currentOrder.items,
        serviceType: currentOrder.serviceType || serviceType,
        roomId: currentOrder.roomId || roomCharge,
        cashierId: activeStaffRef.current?.role === "CASHIER" ? activeStaffRef.current?.id : undefined,
      });
      const saleNumber = closeRes?.data?.order?.saleNumber || "";
      if (saleNumber) snapshotPayload.saleNumber = saleNumber;

      // Si hay cargo a habitación: buscar la factura activa del huésped y agregar item
      const roomTarget = currentOrder.roomId || roomCharge;
      const isRoomCharge = paymentMethodsSnapshot.some((m) =>
        String(m.name).toLowerCase().includes("habitac") || String(m.name).toLowerCase() === "room"
      );
      if (isRoomCharge && roomTarget) {
        try {
          const resActive = await api.get("/reservations/active");
          const reservations = Array.isArray(resActive.data) ? resActive.data : [];
          const match = reservations.find(
            (r) => String(r.room?.number) === String(roomTarget) || String(r.roomId) === String(roomTarget)
          );
          if (match?.invoice?.id) {
            const itemDesc = snapshotItems.length === 1
              ? `Restaurante: ${snapshotItems[0].name || snapshotItems[0].description || "Consumo"}`
              : `Restaurante: ${snapshotItems.length} productos`;
            await api.post(`/invoices/${match.invoice.id}/items`, {
              description: itemDesc,
              quantity: 1,
              unitPrice: snapshotTotals.total,
            });
          }
        } catch {
          // No bloquear el flujo si falla el cargo al folio
        }
      }
      let nextActiveKey = "";
      setOrdersByTable((prev) => {
        const list = normalizeOrderList(prev[selectedTable.id]);
        const nextList = list.filter((o) => getOrderKey(o) !== getOrderKey(currentOrder));
        nextActiveKey = nextList.length > 0 ? getOrderKey(nextList[0]) : "";
        const next = { ...prev };
        if (nextList.length > 0) {
          next[selectedTable.id] = nextList;
        } else {
          delete next[selectedTable.id];
        }
        return next;
      });
      setActiveOrderByTable((prev) => {
        const next = { ...prev };
        if (nextActiveKey) {
          next[selectedTable.id] = nextActiveKey;
        } else {
          delete next[selectedTable.id];
        }
        return next;
      });
      setPaymentResult({ change, totals: snapshotTotals, payload: snapshotPayload, paid: paidAmount });
      setOrderNote("");
      refreshStats();
    } catch {
      window.alert("Could not charge the order.");
    }
  };

  const canSwitchTable = () => {
    if (!hasItems) return true;
    return ["ADMIN", "MANAGER"].includes(role);
  };

  const guardSwitch = () => {
    if (canSwitchTable()) return true;
    window.alert("No puedes reasignar o ver productos de otra mesa sin permisos.");
    return false;
  };

  const confirmPrint = async () => {
    if (printConfirmBusy) return;
    const fn = pendingPrintRef.current;
    if (typeof fn !== "function") {
      closePrintConfirm();
      return;
    }
    setPrintConfirmBusy(true);
    try {
      await fn();
    } finally {
      setPrintConfirmBusy(false);
      closePrintConfirm();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-white">
      {sectionsLoading && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl px-6 py-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full border-4 border-lime-200 border-t-lime-700 animate-spin" />
            <div className="text-sm font-semibold text-slate-700">Cargando...</div>
          </div>
        </div>
      )}
      {shiftModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md force-light bg-white rounded-2xl shadow-2xl p-5 space-y-3">
            <div>
              <div className="text-xs uppercase text-emerald-600">Apertura de turno</div>
              <div className="text-lg font-semibold text-slate-900">Abrir caja</div>
              <div className="text-xs text-slate-500">Debes abrir un turno para usar el TPV.</div>
              <div className="text-[11px] text-slate-500 mt-1">
                Moneda: {paymentsCfg.monedaBase} · TC {paymentsCfg.tipoCambio}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3 items-stretch">
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-600">Usuario</label>
                  <select
                    className="h-9 w-full rounded-lg border px-3 text-sm bg-white"
                    value={staffLoginForm.username}
                    onChange={(e) => setStaffLoginForm((p) => ({ ...p, username: e.target.value }))}
                  >
                    <option value="">{staffOptionsLoading ? "Cargando..." : "Selecciona un usuario"}</option>
                    {staffOptions.map((s) => (
                      <option key={s.id} value={s.username}>
                        {s.name} {s.role ? `(${s.role})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  className="w-full rounded-lg border px-3 py-1.5 text-sm h-9"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Monto de apertura"
                  value={shiftOpenForm.amount}
                  onFocus={() => setShiftKeypadTarget("amount")}
                  onChange={(e) => {
                    const raw = String(e.target.value || "");
                    const onlyDigits = raw.replace(/\D+/g, "");
                    setShiftOpenForm((f) => ({ ...f, amount: onlyDigits }));
                  }}
                  onBlur={(e) => {
                    const raw = String(e.target.value || "");
                    const onlyDigits = raw.replace(/\D+/g, "");
                    setShiftOpenForm((f) => ({ ...f, amount: onlyDigits }));
                  }}
                />
                <textarea
                  className="w-full rounded-lg border px-3 py-1.5 text-sm h-24 resize-none"
                  placeholder="Nota (opcional)"
                  value={shiftOpenForm.note}
                  onChange={(e) => setShiftOpenForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
              <div className="rounded-xl border bg-slate-50 p-2 flex items-start justify-center">
                <div className="w-full space-y-2">
                  <input
                    className="w-full h-9 rounded-lg border px-3 text-sm bg-white"
                    type="password"
                    placeholder="Password"
                    name="staff_password_shift"
                    autoComplete="new-password"
                    value={staffLoginForm.password}
                    onFocus={() => setShiftKeypadTarget("password")}
                    onChange={(e) => setStaffLoginForm((p) => ({ ...p, password: e.target.value }))}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {["1","2","3","4","5","6","7","8","9"].map((d) => (
                      <button
                        key={d}
                        className="h-10 w-full rounded-lg bg-white border border-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-100"
                        onClick={() => handleStaffDigit(d)}
                        type="button"
                      >
                        {d}
                      </button>
                    ))}
                    <button
                      className="h-10 w-full rounded-lg bg-white border border-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-100"
                      onClick={handleStaffClear}
                      type="button"
                    >
                      C
                    </button>
                    <button
                      className="h-10 w-full rounded-lg bg-white border border-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-100"
                      onClick={() => handleStaffDigit("0")}
                      type="button"
                    >
                      0
                    </button>
                    <button
                      className="h-10 w-full rounded-lg bg-white border border-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-100"
                      onClick={handleStaffBackspace}
                      type="button"
                    >
                      ⌫
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {shiftOpenError && <div className="text-xs text-red-600">{shiftOpenError}</div>}
            {staffLoginError && <div className="text-xs text-red-600">{staffLoginError}</div>}
            <div className="flex items-center justify-between gap-2">
              <button
                className="h-12 px-4 rounded-lg border text-sm"
                onClick={() => navigate("/restaurant")}
                disabled={shiftOpenBusy}
              >
                Regresar
              </button>
              <button
                className="h-12 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:bg-emerald-300"
                onClick={openShiftWithLogin}
                disabled={shiftOpenBusy || shiftLoading || staffLoginBusy}
              >
                {shiftOpenBusy || staffLoginBusy ? "Abriendo..." : shiftLoading ? "Verificando..." : "Abrir turno"}
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="relative h-14 bg-gradient-to-r from-lime-700 to-emerald-600 flex items-center justify-between px-10 shadow">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-white">Restaurant</span>
          
        </div>
          <div className="flex items-center gap-4 relative">
            <div className="hidden md:flex items-center gap-4 text-sm font-semibold">
              <div className="px-4 py-2 rounded-xl bg-white/15 text-white">
                {now.toLocaleDateString()}  {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="px-4 py-2 rounded-xl bg-white/15 text-white">{shift}</div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1.5 rounded-lg bg-white/15">{paymentsCfg.monedaBase} - {paymentsCfg.monedaSec}</span>
                <span className="px-2.5 py-1.5 rounded-lg bg-white/15">TC {paymentsCfg.tipoCambio}</span>
              </div>
            </div>
            <button
              className="h-12 px-3 rounded-xl bg-white/15 text-white text-xs font-semibold hover:bg-white/20"
              onClick={() => setStaffLoginOpen(true)}
            >
              {activeStaff ? `${staffRoleLabel(activeStaff.role)}: ${activeStaff.name}` : "Ingresar mesero/cajero"}
            </button>
            <RestaurantUserMenu
              onOpenCashStatus={() => {
                if (!guardSwitch()) return;
                setCloseOpen(true);
                setOpenInfo((prev) => ({ ...prev, openedAt: prev.openedAt || new Date().toISOString() }));
            }}
          />
        </div>
        </header>

        {staffLoginOpen && !shiftModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div className="force-light w-full max-w-xl md:max-w-1xl force-light bg-white rounded-2xl shadow-2xl p-5 space-y-4 overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl uppercase text-lime-600">Acceso TPV</div>
                    <div className="text-xs text-slate-500">Ingresa usuario y password para continuar.</div>
                </div>
              </div>
              {activeStaff && (
                <div className="text-xs text-slate-600">
                  Actual: <span className="font-semibold">{staffRoleLabel(activeStaff.role)}</span> ·{" "}
                  <span className="font-semibold">{activeStaff.name}</span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4 items-stretch">
                <div className="space-y-2 flex flex-col items-center">
                  <input type="text" name="fake_username" autoComplete="username" className="hidden" />
                  <input type="password" name="fake_password" autoComplete="new-password" className="hidden" />
                  <div className="w-full max-w-[210px] space-y-1">
                    <label className="text-xs text-slate-600">Usuario</label>
                    <select
                      className="h-11 w-full rounded-lg border px-3 text-xs bg-white"
                      value={staffLoginForm.username}
                      onChange={(e) => setStaffLoginForm((p) => ({ ...p, username: e.target.value }))}
                    >
                      <option value="">
                        {staffOptionsLoading ? "Cargando..." : "Selecciona un usuario"}
                      </option>
                      {staffOptions.map((s) => (
                        <option key={s.id} value={s.username}>
                          {s.name} {s.role ? `(${s.role})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full max-w-[210px] space-y-1">
                    <label className="text-xs text-slate-600">Password</label>
                    <input
                      className="w-full h-11 rounded-lg border px-3 text-xs"
                      type="password"
                      placeholder="Password"
                      name="staff_password"
                      autoComplete="new-password"
                      value={staffLoginForm.password}
                      onChange={(e) => setStaffLoginForm((p) => ({ ...p, password: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitStaffLogin();
                      }}
                    />
                  </div>
                  {staffLoginError && <div className="text-xs text-red-600">{staffLoginError}</div>}
                </div>

                <div className="rounded-xl border bg-slate-50 p-3">
                  <div className="grid grid-cols-3 gap-2">
                    {["1","2","3","4","5","6","7","8","9"].map((d) => (
                      <button
                        key={d}
                        className="h-12 w-full rounded-lg bg-white border border-slate-200 text-slate-800 text-lg font-semibold hover:bg-slate-100"
                        onClick={() => handleStaffDigit(d)}
                        type="button"
                      >
                        {d}
                      </button>
                    ))}
                    <button
                      className="h-12 w-full rounded-lg bg-white border border-slate-200 text-slate-800 text-lg font-semibold hover:bg-slate-100"
                      onClick={handleStaffClear}
                      type="button"
                    >
                      C
                    </button>
                    <button
                      className="h-12 w-full rounded-lg bg-white border border-slate-200 text-slate-800 text-lg font-semibold hover:bg-slate-100"
                      onClick={() => handleStaffDigit("0")}
                      type="button"
                    >
                      0
                    </button>
                    <button
                      className="h-12 w-full rounded-lg bg-white border border-slate-200 text-slate-800 text-lg font-semibold hover:bg-slate-100"
                      onClick={handleStaffBackspace}
                      type="button"
                    >
                      ⌫
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button className="h-12 px-3 rounded-lg border text-sm" onClick={() => navigate("/restaurant")}>
                  Regresar
                </button>
                <button
                  className="h-12 px-4 rounded-lg bg-lime-700 text-white text-sm font-semibold disabled:bg-lime-300"
                  disabled={staffLoginBusy}
                  onClick={submitStaffLogin}
                >
                  {staffLoginBusy ? "Ingresando..." : "Ingresar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {printConfirmOpen && (
          <div className="fixed inset-0 z-[70] bg-lime-900/30 backdrop-blur-[1px] flex items-start justify-center p-4">
          <div className="w-full max-w-xl force-light bg-white rounded-2xl shadow-2xl p-4 space-y-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-indigo-600">Impresión</div>
                <div className="text-lg font-semibold text-slate-900">{printConfirmTitle}</div>
              </div>
              <RestaurantCloseXButton onClick={closePrintConfirm} />
            </div>
            <div className="rounded-lg border bg-lime-50 p-3 max-h-[60vh] overflow-auto">
              <pre className="text-[12px] leading-5 font-mono whitespace-pre-wrap text-slate-800">{printConfirmText}</pre>
            </div>
            <div className="flex justify-end gap-2">
              <button className="h-12 px-4 rounded-lg border text-sm" disabled={printConfirmBusy} onClick={closePrintConfirm}>
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:bg-indigo-300"
                disabled={printConfirmBusy}
                onClick={confirmPrint}
              >
                {printConfirmBusy ? "Enviando..." : "Confirmar e imprimir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {voidInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] flex items-start justify-center p-4">
          <div className="w-full max-w-4xl force-light bg-white rounded-3xl shadow-2xl p-6 space-y-4 overflow-y-auto max-h-[85vh]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-red-600">Anular factura</div>
                <div className="text-lg font-semibold text-slate-900">Facturas del turno</div>
                <div className="text-xs text-slate-500">Selecciona una factura emitida para anularla.</div>
              </div>
              <RestaurantCloseXButton onClick={closeVoidInvoiceModal} />
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="max-h-[320px] overflow-y-auto">
                {voidInvoiceLoading ? (
                  <div className="p-4 text-sm text-slate-500">Cargando facturas...</div>
                ) : (voidInvoiceList || []).length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">No hay facturas en el turno actual.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="text-left px-3 py-2">Factura</th>
                        <th className="text-left px-3 py-2">Mesa</th>
                        <th className="text-left px-3 py-2">Total</th>
                        <th className="text-left px-3 py-2">Fecha</th>
                        <th className="text-left px-3 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(voidInvoiceList || []).map((doc) => {
                        const isSelected = voidInvoiceTarget?.id === doc.id;
                        const statusRaw = String(doc?.status || "").toUpperCase();
                        const statusLabel =
                          statusRaw === "CANCELED"
                            ? "Anulada"
                            : statusRaw === "ACCEPTED"
                              ? "Aceptada"
                              : statusRaw === "DRAFT"
                                ? "Borrador"
                                : statusRaw === "NO_DOC"
                                  ? "Sin documento"
                                  : "Emitida";
                        const docLabel = doc?.consecutive || doc?.key || "Sin serie";
                        const totalValue = Number(doc?.order?.total || 0);
                        const tableLabel = doc?.order?.tableId ? `Mesa ${doc.order.tableId}` : "-";
                        const created = doc?.createdAt ? new Date(doc.createdAt).toLocaleString() : "-";
                        return (
                          <tr
                            key={doc.id}
                            className={`cursor-pointer ${isSelected ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                            onClick={() => {
                              setVoidInvoiceTarget(doc);
                              if (voidInvoiceError) setVoidInvoiceError("");
                            }}
                          >
                            <td className="px-3 py-2">
                              <div className="font-semibold text-slate-900">{docLabel}</div>
                              <div className="text-[11px] text-slate-500">{String(doc?.docType || "").toUpperCase()}</div>
                            </td>
                            <td className="px-3 py-2">{tableLabel}</td>
                            <td className="px-3 py-2">{formatMoney(totalValue)}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{created}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                  statusRaw === "CANCELED"
                                    ? "bg-red-50 text-red-700 border border-red-200"
                                    : statusRaw === "NO_DOC"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                }`}
                              >
                                {statusLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button className="h-12 px-4 rounded-lg border text-sm" disabled={voidInvoiceBusy} onClick={closeVoidInvoiceModal}>
                Cerrar
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:bg-red-300"
                disabled={voidInvoiceBusy || !voidInvoiceTarget}
                onClick={openVoidInvoiceAuth}
              >
                Anular factura
              </button>
            </div>
          </div>
        </div>
      )}

      {voidInvoiceAuthOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-sm force-light bg-white rounded-2xl shadow-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-red-600">Autorizacion</div>
                <div className="text-sm font-semibold text-slate-900">Confirmar anulacion</div>
              </div>
              <RestaurantCloseXButton onClick={closeVoidInvoiceAuth} />
            </div>

            <div className="grid gap-2 place-items-center">
              <input type="text" name="fake_username" autoComplete="username" className="hidden" />
              <input type="password" name="fake_password" autoComplete="new-password" className="hidden" />
              <input
                className="w-full max-w-[240px] h-9 rounded-lg border px-3 text-xs"
                placeholder="Usuario administrador"
                name="void_username"
                autoComplete="off"
                value={voidInvoiceForm.username}
                onChange={(e) => setVoidInvoiceForm((f) => ({ ...f, username: e.target.value }))}
              />
              <input
                className="w-full max-w-[240px] h-9 rounded-lg border px-3 text-xs"
                type="password"
                placeholder="Contrasena administrador"
                name="void_password"
                autoComplete="new-password"
                value={voidInvoiceForm.password}
                onChange={(e) => setVoidInvoiceForm((f) => ({ ...f, password: e.target.value }))}
              />
              <input
                className="w-full max-w-[240px] h-9 rounded-lg border px-3 text-xs"
                placeholder="Asunto / motivo"
                name="void_reason"
                autoComplete="off"
                value={voidInvoiceForm.reason}
                onChange={(e) => setVoidInvoiceForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>

            {voidInvoiceError && <div className="text-xs text-red-600">{voidInvoiceError}</div>}

            <div className="flex justify-end gap-2 pt-1">
              <button className="h-12 px-4 rounded-lg border text-sm" disabled={voidInvoiceBusy} onClick={closeVoidInvoiceAuth}>
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:bg-red-300"
                disabled={voidInvoiceBusy}
                onClick={confirmVoidInvoice}
              >
                {voidInvoiceBusy ? "Anulando..." : "Anular factura"}
              </button>
            </div>
          </div>
        </div>
      )}

      {voidInvoiceSuccessOpen && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-xs force-light bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="h-9 w-9 text-emerald-600" />
            </div>
            <div className="text-lg font-semibold text-emerald-700">Factura anulada</div>
          </div>
        </div>
      )}

      {cancelOrderModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-sm force-light bg-white rounded-2xl shadow-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-red-600">Autorizacion</div>
                <div className="text-sm font-semibold text-slate-900">Confirmar anulacion</div>
              </div>
              <RestaurantCloseXButton onClick={closeCancelOrderModal} />
            </div>

            <div className="grid gap-2 place-items-center">
              <input type="text" name="fake_username" autoComplete="username" className="hidden" />
              <input type="password" name="fake_password" autoComplete="new-password" className="hidden" />
              <input
                className="w-full max-w-[240px] h-9 rounded-lg border px-3 text-xs"
                placeholder="Usuario administrador"
                name="cancel_username"
                autoComplete="off"
                value={cancelOrderForm.username}
                onChange={(e) => setCancelOrderForm((f) => ({ ...f, username: e.target.value }))}
              />
              <input
                className="w-full max-w-[240px] h-9 rounded-lg border px-3 text-xs"
                type="password"
                placeholder="Contrasena administrador"
                name="cancel_password"
                autoComplete="new-password"
                value={cancelOrderForm.password}
                onChange={(e) => setCancelOrderForm((f) => ({ ...f, password: e.target.value }))}
              />
              <input
                className="w-full max-w-[240px] h-9 rounded-lg border px-3 text-xs"
                placeholder="Asunto / motivo"
                name="cancel_reason"
                autoComplete="off"
                value={cancelOrderForm.reason}
                onChange={(e) => setCancelOrderForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>

            {cancelOrderError && <div className="text-xs text-red-600">{cancelOrderError}</div>}

            <div className="flex justify-end gap-2 pt-1">
              <button className="h-12 px-4 rounded-lg border text-sm" disabled={cancelOrderBusy} onClick={closeCancelOrderModal}>
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:bg-red-300"
                disabled={cancelOrderBusy}
                onClick={confirmCancelOrder}
              >
                {cancelOrderBusy ? "Anulando..." : "Anular orden"}
              </button>
            </div>
          </div>
        </div>
      )}

      {closeOpen && (
        <div className="fixed inset-0 z-50 bg-lime-900/30 backdrop-blur-[1px] flex justify-end">
          <div className="w-full max-w-[360px] max-h-[40vh] min-h-[200px] bg-white rounded-l-2xl shadow-2xl p-3 flex flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-lime-500">Cash status</div>
                <div className="text-base font-semibold text-lime-900">Restaurant cash</div>
                <div className="text-xs text-lime-700">
                  Opened: {new Date(openInfo.openedAt).toLocaleString()}  {openInfo.user}
                </div>
              </div>
              <RestaurantCloseXButton onClick={() => setCloseOpen(false)} />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-lg border bg-gradient-to-r from-lime-50 to-slate-50 px-4 py-3 text-sm">
                <div className="text-xs text-lime-700">System sales</div>
                <div className="text-xl font-bold text-lime-900">{canViewTotals ? formatMoney(closeSummary.system) : "***"}</div>
                <div className="text-xs text-lime-500">Total sold (paid sales)</div>
              </div>
              <div className="rounded-lg border bg-gradient-to-r from-lime-50 to-slate-50 px-4 py-3 text-sm">
                <div className="text-xs text-lime-700">Open orders</div>
                <div className="text-xl font-bold text-lime-900">{stats.openOrders}</div>
                <div className="text-xs text-lime-500">Estimated value {formatMoney(stats.openOrderValue || 0)}</div>
              </div>
              <button
                className="px-4 py-2 rounded-lg bg-lime-700 text-white text-sm font-semibold"
                onClick={() => {
                  if (!canViewTotals) {
                    window.alert("You do not have permission to close cash. Ask an administrator.");
                    return;
                  }
                  setCloseStage("X");
                  setCloseAuditOk(false);
                  setCloseSnapshot(null);
                  setCloseModalOpen(true);
                }}
              >
                Go to close
              </button>
            </div>
          </div>
        </div>
      )}

      {closeModalOpen && (
        <div className="fixed inset-0 z-50 bg-lime-900/30 backdrop-blur-[1px] flex items-start justify-center p-4">
          <div className="w-full max-w-sm force-light bg-white rounded-2xl shadow-2xl p-3 space-y-3 overflow-y-auto max-h-[65vh]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-lime-500">{closeStage === "Z" ? "Cash close Z" : "Cash close X"}</div>
                <div className="text-base font-semibold text-lime-900">Restaurant cash</div>
                <div className="text-[11px] text-slate-500">
                  Moneda: {paymentsCfg.monedaBase} - TC {paymentsCfg.tipoCambio}
                </div>
              </div>
              <RestaurantCloseXButton onClick={() => setCloseModalOpen(false)} />
            </div>

            {closeStage === "X" ? (
              <>
                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-lg border bg-gradient-to-r from-lime-50 to-slate-50 px-4 py-3 text-sm">
                    <div className="text-xs text-lime-700">Reported (manual)</div>
                    <div className="text-xl font-bold text-lime-900">{canViewTotals ? formatMoney(closeSummary.reported) : "***"}</div>
                    <div className="text-xs text-lime-500">Sum of methods</div>
                  </div>
                </div>

                <div className="rounded-lg border bg-white px-3 py-2">
                  <div className="grid grid-cols-2 gap-2 text-[11px] uppercase text-slate-500 mb-2">
                    <div>Ventas por metodo (sistema)</div>
                    <div>Conteo fisico</div>
                  </div>
                  {closeCompareRows.length === 0 && <div className="text-xs text-slate-500">Sin datos.</div>}
                  {closeCompareRows.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                      {closeCompareRows.map((row) => (
                        <React.Fragment key={row.key}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{row.label}</span>
                            <span className="font-semibold">{formatMoney(row.amount)}</span>
                          </div>
                          <input
                            className="h-9 w-full rounded-lg border px-3 text-xs"
                            placeholder={row.label}
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9.,]*"
                            value={closeForm[row.key] || ""}
                            onChange={(e) => setCloseForm((f) => ({ ...f, [row.key]: e.target.value }))}
                            onBlur={(e) => setCloseForm((f) => ({ ...f, [row.key]: normalizeMoneyInput(e.target.value) }))}
                          />
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
                <textarea
                  className="h-min-[200px] w-max-[150px] rounded-lg border px-3 py-2 text-sm"
                  placeholder="Close notes..."
                  value={closeForm.notes}
                  onChange={(e) => setCloseForm((f) => ({ ...f, notes: e.target.value }))}
                />
                <div className="text-sm text-lime-700 bg-lime-50 border border-lime-100 rounded-lg px-3 py-2">
                  System: {formatMoney(closeSummary.system)}  Reported: {formatMoney(closeSummary.reported)}  Difference: {formatMoney(closeSummary.diff)}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    className="h-12 px-4 rounded-lg border text-sm"
                    onClick={() => setCloseModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-lime-700 text-white text-sm font-semibold"
                    disabled={closeLoading}
                    onClick={async () => {
                      if (!canCloseX) {
                        window.alert("No tienes permiso para cierre X.");
                        return;
                      }
                      if (closeLoading) return;
                      setCloseLoading(true);
                      try {
                        await api.post("/restaurant/close", {
                          totals: closeSummary,
                          payments: closeForm,
                          note: closeForm.notes,
                          breakdown: stats.byMethod || {},
                          type: "X",
                        });
                        setCloseSnapshot({ totals: closeSummary, byMethod: stats.byMethod || {} });
                        setCloseStage("Z");
                        setCloseAuditOk(false);
                        // Print X close report
                        try {
                          const byMethodLabeled = {};
                          for (const row of closeMethodRows) { if (row.amount > 0) byMethodLabeled[row.label] = row.amount; }
                          const declaredLabeled = {};
                          for (const row of closeCompareRows) {
                            const val = Number(parseMoneyInput(closeForm[row.key] || "0")) || 0;
                            if (val > 0) declaredLabeled[row.label] = val;
                          }
                          const xText = buildCloseReportText({
                            stage: "X", hotelName: hotel?.name || "", openedAt: openInfo.openedAt,
                            closedAt: new Date().toISOString(), systemTotal: closeSummary.system,
                            byMethod: byMethodLabeled, declared: declaredLabeled, diff: closeSummary.diff,
                            salesCount: stats?.salesCount || 0, note: closeForm.notes,
                            staffName: activeStaff?.name || openInfo.user,
                          });
                          if (printerCfg.cashierPrinter) await printToAgent({ printerNames: [printerCfg.cashierPrinter], text: xText, copies: 1 });
                        } catch {}
                      } catch (e) {
                        const msg = e?.response?.data?.message || "Could not record the cash close.";
                        window.alert(msg);
                      } finally {
                        setCloseLoading(false);
                      }
                    }}
                  >
                    {closeLoading ? "Sending..." : "Completar cierre X"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border bg-gradient-to-r from-amber-50 to-slate-50 px-4 py-3 text-sm">
                  <div className="text-xs text-amber-700">Auditoria de cierre Z</div>
                  <div className="text-xl font-bold text-amber-900">{canViewTotals ? formatMoney(auditTotals.reported) : "***"}</div>
                  <div className="text-xs text-amber-600">Reported (desde cierre X)</div>
                </div>

                <div className="rounded-lg border bg-white px-3 py-2">
                  <div className="text-[11px] uppercase text-slate-500 mb-2">Ventas por metodo (sistema)</div>
                  {auditRows.length === 0 && <div className="text-xs text-slate-500">Sin datos.</div>}
                  {auditRows.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                      {auditRows.map((row) => (
                        <div key={row.key} className="flex items-center justify-between gap-2">
                          <span className="truncate">{row.label}</span>
                          <span className="font-semibold">{formatMoney(row.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  System: {formatMoney(auditTotals.system)}  Reported: {formatMoney(auditTotals.reported)}  Difference: {formatMoney(auditTotals.diff)}
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={closeAuditOk} onChange={(e) => setCloseAuditOk(e.target.checked)} />
                  Confirmo que el conteo fisico coincide con el cierre X.
                </label>

                <div className="flex justify-end gap-2">
                  <button
                    className="h-12 px-4 rounded-lg border text-sm"
                    onClick={() => setCloseModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold"
                    disabled={closeLoading || !canCloseZ || !closeAuditOk}
                    title={canCloseZ ? "" : "No tienes permiso para cierre Z"}
                    onClick={async () => {
                      if (!canCloseZ) {
                        window.alert("No tienes permiso para cierre Z.");
                        return;
                      }
                      if (!closeAuditOk) return;
                      if (closeLoading) return;
                      setCloseLoading(true);
                      try {
                        await api.post("/restaurant/close", {
                          totals: auditTotals,
                          payments: closeForm,
                          note: closeForm.notes,
                          breakdown: stats.byMethod || {},
                          type: "Z",
                        });
                        // Print Z close report before resetting state
                        try {
                          const byMethodLabeled = {};
                          for (const row of auditRows) { if (row.amount > 0) byMethodLabeled[row.label] = row.amount; }
                          const declaredLabeled = {};
                          for (const row of closeCompareRows) {
                            const val = Number(parseMoneyInput(closeForm[row.key] || "0")) || 0;
                            if (val > 0) declaredLabeled[row.label] = val;
                          }
                          const zText = buildCloseReportText({
                            stage: "Z", hotelName: hotel?.name || "", openedAt: openInfo.openedAt,
                            closedAt: new Date().toISOString(), systemTotal: auditTotals.system,
                            byMethod: byMethodLabeled, declared: declaredLabeled, diff: auditTotals.diff,
                            salesCount: stats?.salesCount || 0, note: closeForm.notes,
                            staffName: activeStaff?.name || openInfo.user,
                          });
                          if (printerCfg.cashierPrinter) await printToAgent({ printerNames: [printerCfg.cashierPrinter], text: zText, copies: 1 });
                        } catch {}
                        setCloseModalOpen(false);
                        setCloseOpen(false);
                        setCloseForm({ cash: "", card: "", sinpe: "", transfer: "", room: "", notes: "" });
                        setCloseSnapshot(null);
                        setOrdersByTable({});
                        setActiveOrderByTable({});
                        setPaymentResult(null);
                        setPaymentForm({});
                        setSelectedPaymentKeys([]);
                        setSplitPayments(false);
                        resetToLobby();
                        setShiftModalOpen(true);
                        refreshStats();
                      } catch (e) {
                        const msg = e?.response?.data?.message || "Could not record the cash close.";
                        window.alert(msg);
                      } finally {
                        setCloseLoading(false);
                      }
                    }}
                  >
                    {closeLoading ? "Sending..." : "Completar cierre Z"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {itemOptionsOpen && itemOptionsItem && (
        <div className="fixed inset-0 z-[55] bg-black/30 backdrop-blur-[1px] flex items-start justify-center p-4">
          <div className="w-full max-w-3xl force-light bg-white rounded-3xl shadow-2xl p-6 space-y-5 overflow-y-auto max-h-[85vh]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {itemOptionsItem.imageUrl ? (
                  <div className="h-16 w-16 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center">
                    <img
                      alt=""
                      src={sanitizeImageUrl(itemOptionsItem.imageUrl)}
                      className="h-full w-full object-contain p-1"
                      onError={(ev) => {
                        ev.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                ) : null}
                <div>
                  <div className="text-xs uppercase text-emerald-600">Detalles del articulo</div>
                  <div className="text-lg font-semibold text-slate-900">{itemOptionsItem.name}</div>
                  {itemOptionsItem.description && (
                    <div className="text-xs text-slate-500">{itemOptionsItem.description}</div>
                  )}
                </div>
              </div>
              <RestaurantCloseXButton onClick={closeItemOptions} />
            </div>

            {itemOptionMeta.sizeOptions.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-700">Tamanos</div>
                <div className="flex flex-wrap gap-2">
                  {itemOptionMeta.sizeOptions.map((s, idx) => {
                    const sizeId = resolveOptionId(s, idx);
                    const active = itemOptionsSize === sizeId;
                    const label = String(s.label || s.name || `Tamano ${idx + 1}`);
                    const price = Number(s.price ?? itemOptionsItem.price ?? 0);
                    return (
                      <button
                        key={sizeId}
                        type="button"
                        onClick={() => setItemOptionsSize(sizeId)}
                        className={`px-3 py-2 rounded-lg border text-sm font-semibold transition ${
                          active ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{label}</span>
                          <span className={active ? "text-emerald-100" : "text-slate-500"}>{formatMoney(price)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {itemOptionMeta.detailOptions.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-700">Detalles / extras</div>
                <div className="flex flex-wrap gap-2">
                  {itemOptionMeta.detailOptions.map((d, idx) => {
                    const detailId = resolveOptionId(d, idx);
                    const active = itemOptionsDetails.includes(detailId);
                    const label = String(d.label || d.name || `Detalle ${idx + 1}`);
                    const delta = Number(d.priceDelta ?? d.price ?? 0);
                    const deltaLabel = delta ? `+${formatMoney(delta)}` : "";
                    return (
                      <button
                        key={detailId}
                        type="button"
                        onClick={() =>
                          setItemOptionsDetails((prev) =>
                            prev.includes(detailId) ? prev.filter((p) => p !== detailId) : [...prev, detailId]
                          )
                        }
                        className={`px-3 py-2 rounded-lg border text-sm font-semibold transition ${
                          active ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{label}</span>
                          {deltaLabel && <span className={active ? "text-emerald-100" : "text-slate-500"}>{deltaLabel}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <div className="text-sm font-semibold text-slate-700">Nota</div>
                <textarea
                  className="w-full rounded-xl border px-3 py-2 text-sm min-h-[90px]"
                  placeholder="Opcional: indicaciones especiales"
                  value={itemOptionsNote}
                  onChange={(e) => setItemOptionsNote(e.target.value)}
                />
              </div>
              <div className="rounded-xl border bg-lime-50 px-4 py-3 text-sm space-y-2">
                <div className="text-xs text-slate-600 uppercase">Resumen</div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Base</span>
                  <span className="font-semibold text-slate-900">{formatMoney(itemOptionMeta.basePrice)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Extras</span>
                  <span className="font-semibold text-slate-900">{formatMoney(itemOptionMeta.extras)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-semibold">
                  <span className="text-slate-900">Total</span>
                  <span className="text-emerald-700">{formatMoney(itemOptionMeta.total)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button className="h-12 px-4 rounded-lg border text-sm" onClick={closeItemOptions}>
                Cancelar
              </button>
              <button
                className="h-12 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:bg-emerald-300"
                onClick={confirmItemOptions}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentsModalOpen && (
        <div className="fixed inset-0 z-50 bg-lime-900/30 backdrop-blur-[1px] flex items-start justify-center p-4">
          <div className="w-full max-w-4xl force-light bg-white rounded-3xl shadow-2xl p-6 space-y-4 overflow-y-auto max-h-[85vh]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-emerald-600">Payment</div>
                <div className="text-lg font-semibold text-slate-900">{selectedTable?.name}</div>
              </div>
            </div>
            <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
              <div className="space-y-4">
                <div className="rounded-xl border bg-lime-50 px-4 py-4 text-sm">
                  <div className="text-xs text-slate-600">Total due</div>
                  <div className="text-2xl font-bold text-slate-900">{formatMoney(displayTotals.total)}</div>
                  <div className="text-xs text-slate-500">
                    Subtotal {formatMoney(displayTotals.subtotal)}  Service {formatMoney(displayTotals.service)}  Taxes {formatMoney(displayTotals.tax)}
                    {displayTotals.discountTotal > 0 && (
                      <span className="block">Descuento {formatMoney(displayTotals.discountTotal)}</span>
                    )}
                  </div>
                </div>

                {paymentResult ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 space-y-1">
                    <div className="text-lg font-semibold text-emerald-700">Cobro exitoso</div>
                    {paymentChange > 0 && (
                      <div className="text-sm text-emerald-700">Vuelto: {formatMoney(paymentChange)}</div>
                    )}
                    <div className="text-xs text-slate-600">Puedes imprimir la factura o cerrar sin imprimir.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-800">Forma de pago</div>
                      <div className="flex items-center gap-2">
                        <button
                          className={`h-8 px-3 rounded-full text-xs font-semibold border transition ${
                            splitPayments ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-700"
                          }`}
                          onClick={handleSplitToggle}
                        >
                          {splitPayments ? "Pago dividido: Si" : "Pago dividido: No"}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {availablePaymentMethods.map((method) => {
                        const active = selectedPaymentKeys.includes(method.key);
                        return (
                          <button
                            key={method.key}
                            className={`px-3 py-2 rounded-lg border text-sm font-semibold transition ${
                              active
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                            onClick={() => handlePaymentMethodToggle(method.key)}
                          >
                            {method.name}
                          </button>
                        );
                      })}
                      {availablePaymentMethods.length === 0 && (
                        <div className="text-sm text-slate-500">No hay formas de pago activas.</div>
                      )}
                    </div>


                    {(currentOrder.serviceType || serviceType) === "ROOM" && (currentOrder.roomId || roomCharge) && (
                      <div className="text-xs text-slate-600">
                        Habitación: <span className="font-semibold">{currentOrder.roomId || roomCharge}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {paymentResult ? (
                  <div className="text-sm text-slate-600">
                    Pagado: <span className="font-semibold">{formatMoney(paymentResult?.paid ?? displayTotals.total)}</span>
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-slate-800">Montos</div>
                    {selectedPaymentMethods.length > 0 ? (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {selectedPaymentMethods.map((method) => (
                          <div key={method.key} className="space-y-1">
                            <div className="text-xs text-slate-600">{method.name}</div>
                            <input
                              className="h-11 w-full rounded-lg border px-3 text-sm"
                              placeholder="0.00"
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9.,-]*"
                              value={paymentForm[method.key] ?? ""}
                              onChange={(e) => updatePaymentAmount(method.key, e.target.value)}
                              onBlur={(e) => updatePaymentAmount(method.key, normalizeMoneyInput(e.target.value))}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">Selecciona una forma de pago para ingresar el monto.</div>
                    )}

                    <div className="text-sm text-lime-800 bg-lime-50 border border-lime-100 rounded-lg px-3 py-2">
                      Pagado: {formatMoney(paymentTotal)}  Diferencia: {formatMoney(paymentDiff)}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {paymentResult ? (
                <>
                  <button
                    className="h-12 px-4 rounded-lg border text-sm"
                    onClick={finalizePaymentAndExit}
                    disabled={paymentPrintBusy}
                  >
                    Cerrar sin imprimir
                  </button>
              <button
                    className="h-12 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:bg-emerald-300"
                    onClick={printPaidInvoice}
                    disabled={paymentPrintBusy}
                  >
                    {paymentPrintBusy ? "Imprimiendo..." : "Imprimir"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="h-12 px-4 rounded-lg border text-sm"
                    onClick={openSplitOrderModal}
                    disabled={!hasItems}
                  >
                    Split Order
                  </button>
              <button
                    className="h-12 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:bg-emerald-300"
                    disabled={!hasItems || selectedPaymentKeys.length === 0}
                    onClick={confirmChargeOrder}
                  >
                    Confirm Payment
                  </button>
              <button
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-500"
                    onClick={closePaymentsModal}
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {splitOrderModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl force-light bg-white rounded-2xl shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-slate-500">Dividir cuentas</div>
                <div className="text-lg font-semibold text-slate-900">Separar ordenes</div>
              </div>
              <RestaurantCloseXButton onClick={closeSplitOrderModal} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-700">Cuentas</div>
              <div className="flex items-center gap-2">
                <button
                  className={`h-8 px-3 rounded-lg border text-xs font-semibold ${
                    splitOrderCount === 2 ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-600"
                  }`}
                  onClick={() => {
                    setSplitOrderCount(2);
                    setSplitOrderMap((prev) => {
                      const next = { ...prev };
                      Object.keys(next).forEach((k) => {
                        if (next[k] === "C") next[k] = "B";
                      });
                      return next;
                    });
                  }}
                >
                  2 cuentas
                </button>
              <button
                  className={`h-8 px-3 rounded-lg border text-xs font-semibold ${
                    splitOrderCount === 3 ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-600"
                  }`}
                  onClick={() => setSplitOrderCount(3)}
                >
                  3 cuentas
                </button>
              </div>
            </div>
            <div className={`grid gap-3 ${splitOrderCount === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {["A", "B", ...(splitOrderCount === 3 ? ["C"] : [])].map((bucket) => (
                <div key={`bucket-${bucket}`} className="rounded-xl border border-slate-200 bg-slate-50 p-2 flex flex-col">
                  <div className="text-xs font-semibold text-slate-600 text-center mb-2">
                    {bucket === "A" ? "Cuenta A (actual)" : bucket === "B" ? "Cuenta B" : "Cuenta C"}
                  </div>
                  <div className="flex-1 space-y-2 max-h-72 overflow-y-auto pr-1">
                    {(currentOrder.items || [])
                      .map((item, idx) => ({ item, idx, key: getSplitItemKey(item, idx) }))
                      .filter(({ item, key }) => {
                        const split = splitOrderMap[key] || { A: getItemQty(item), B: 0, C: 0 };
                        return (split[bucket] || 0) > 0;
                      })
                      .map(({ item, idx, key }) => {
                        const split = splitOrderMap[key] || { A: getItemQty(item), B: 0, C: 0 };
                        const qty = split[bucket] || 0;
                        const canMoveLeft = bucket !== "A";
                        const canMoveRight = bucket !== (splitOrderCount === 3 ? "C" : "B");
                        return (
                          <div key={`bucket-${bucket}-${key}`} className="bg-white border rounded-lg px-2 py-2 flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-slate-800 truncate">{item.name}</div>
                              <div className="text-[11px] text-slate-500">
                                {qty} x {formatMoney(item.price)}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                className="h-7 w-7 rounded border text-xs disabled:opacity-40"
                                disabled={!canMoveLeft}
                                onClick={() =>
                                  setSplitOrderMap((prev) => ({
                                    ...prev,
                                    [key]: (() => {
                                      const next = { ...(prev[key] || { A: 0, B: 0, C: 0 }) };
                                      if (bucket === "A" || next[bucket] <= 0) return next;
                                      next[bucket] = Math.max(0, next[bucket] - 1);
                                      if (bucket === "B") next.A += 1;
                                      if (bucket === "C") next.B += 1;
                                      return next;
                                    })(),
                                  }))
                                }
                              >
                                &lt;
                              </button>
              <button
                                className="h-7 w-7 rounded border text-xs disabled:opacity-40"
                                disabled={!canMoveRight}
                                onClick={() =>
                                  setSplitOrderMap((prev) => ({
                                    ...prev,
                                    [key]: (() => {
                                      const next = { ...(prev[key] || { A: 0, B: 0, C: 0 }) };
                                      if ((bucket === "C" && splitOrderCount === 3) || next[bucket] <= 0) return next;
                                      next[bucket] = Math.max(0, next[bucket] - 1);
                                      if (bucket === "A") next.B += 1;
                                      if (bucket === "B") next.C += 1;
                                      return next;
                                    })(),
                                  }))
                                }
                              >
                                &gt;
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button className="h-12 px-4 rounded-lg border text-sm" onClick={closeSplitOrderModal}>
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold"
                onClick={confirmSplitOrder}
              >
                Split Order
              </button>
            </div>
          </div>
        </div>
      )}
      {tablePickerOpen && (
        <div className="fixed inset-0 z-40 bg-lime-900/30 backdrop-blur-[1px] flex justify-end">
          <div className="w-full md:w-[560px] h-full bg-white rounded-l-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-lime-500">{tablePickerMode === "MOVE" ? "Change table" : "Quick table"}</div>
                <div className="text-base font-semibold text-lime-900">{tablePickerMode === "MOVE" ? "Select destination table" : "Select table"}</div>
              </div>
              <RestaurantCloseXButton onClick={() => setTablePickerOpen(false)} />
            </div>
            {(sections || []).length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
                {[
                  { id: "ALL", name: "All" },
                  ...(sections || []).map((s) => ({ id: String(s.id), name: s.name || s.id })),
                ].map((sec, idx) => {
                  const active = String(tablePickerSectionId || "ALL") === String(sec.id);
                  return (
                    <button
                      key={`tab-${sec.id}-${idx}`}
                      className={`px-4 py-2 text-xs font-semibold border-t border-l border-r rounded-t-md transition ${
                        active
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                          : "bg-slate-100 border-transparent text-slate-500 hover:bg-white hover:border-slate-200"
                      }`}
                      onClick={() => {
                        setTablePickerSectionId(sec.id);
                        setMoveTargetTable(null);
                      }}
                    >
                      {sec.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto">
              {tablePickerTables.map((t, idx) => {
                const hasOrder = Boolean(tableOrderSummary[t.id]?.hasItems);
                const orderCount = tableOrderSummary[t.id]?.count || 0;
                const pickerKey = String(`${t.section?.id || "sec"}-${t.id || t.name || idx}`);
                const isSelected = tablePickerMode === "MOVE" && moveTargetTable?.id === t.id;
                return (
                  <button
                    key={pickerKey}
                    className={`rounded-2xl border ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-100"
                        : hasOrder
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-lime-100 bg-lime-50"
                    } hover:bg-lime-100 text-left px-4 py-3 shadow-sm`}
                    onClick={() => (tablePickerMode === "MOVE" ? setMoveTargetTable(t) : handleSelectTable(t, t.section))}
                  >
                    <div className="text-xs text-lime-500">{t.section?.name || "Section"}</div>
                    <div className="text-base font-semibold text-lime-900">{t.name}</div>
                    <div className="text-xs text-lime-700/80">{t.seats} seats</div>
                    {hasOrder && (
                      <div className="text-[11px] text-emerald-700 mt-1">
                        {orderCount > 1 ? `${orderCount} ordenes` : "Orden activa"}
                      </div>
                    )}
                    {tableOrderSummary[t.id]?.sentAt && (
                      <div className="text-[11px] text-emerald-600">
                        {formatElapsed(tableOrderSummary[t.id].sentAt)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {tablePickerMode === "MOVE" && (
              <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3">
                <div className="text-xs text-slate-600">
                  Destino:{" "}
                  <span className="font-semibold text-slate-900">
                    {moveTargetTable?.name || "Selecciona una mesa"}
                  </span>
                </div>
                <button
                  className="h-12 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:bg-emerald-300"
                  disabled={!moveTargetTable?.id || moveTargetTable?.id === selectedTable?.id}
                  onClick={() => moveTargetTable && moveToTable(moveTargetTable)}
                >
                  Confirmar cambio
                </button>
              </div>
            )}
          </div>
        </div>
      )}

       <div className="flex flex-1">
         <div className="flex-1 flex flex-col">
            

          {sectionLauncher || !selectedTable ? (
            <div key={sectionLauncher ? "restaurant-launcher" : `restaurant-section-${String(selectedSection?.id || "none")}`} className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-y-auto">
              {sectionLauncher ? (
                <div className="col-span-3">
                  {sectionsLoading && <div className="text-sm text-lime-700">Loading sections...</div>}
                  {!sectionsLoading && sectionsError && <div className="text-sm text-lime-700">{sectionsError}</div>}
                  {!sectionsLoading && !sectionsError && (sections || []).length === 0 && (
                    <div className="rounded-2xl border border-lime-200 bg-lime-50 p-4">
                      <div className="text-base font-semibold text-lime-900">No sections configured</div>
                      <div className="text-sm text-lime-700 mt-1">
                        Create sections and tables from <span className="font-semibold">Management → Restaurant → Sections, tables and menu</span>.
                      </div>
                      {["ADMIN", "MANAGER"].includes(role) && (
                        <button
                          className="mt-3 h-10 px-4 rounded-xl bg-lime-700 text-white text-sm font-semibold hover:bg-lime-600"
                          onClick={() => navigate("/management?view=restaurantConfig")}
                        >
                          Open Management
                        </button>
                      )}
                    </div>
                  )}
                  {!sectionsLoading && (sections || []).length > 0 && (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(sections || []).map((sec, secIdx) => (
                        <div
                          key={String(sec.id || sec.name || `sec-${secIdx}`)}
                          className="rounded-md bg-gradient-to-br from-lime-100 to-purple-50 border border-lime-100 shadow hover:shadow-md transition p-2 text-left cursor-pointer aspect-square flex flex-col"
                          onClick={() => {
                            if (sec?.quickCashEnabled) {
                              startQuickCash(sec);
                              return;
                            }
                            setSelectedSection(sec);
                            setSelectedTable(null);
                            setSectionLauncher(false);
                          }}
                        >
                          <div className="relative w-full aspect-[4/3] rounded-md overflow-hidden bg-white/70 border border-white/60 shadow-sm">
                            {sec?.imageUrl ? (
                              <img src={sanitizeImageUrl(sec.imageUrl)} alt={sec.name || sec.id} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-xs text-lime-500/70">
                                Sin imagen
                              </div>
                            )}
                          </div>
                          <div className="text-xs uppercase text-lime-500">Section</div>
                          <div className="text-base font-semibold text-lime-900 leading-tight line-clamp-2">{sec.name || sec.id}</div>
                          <div className="text-sm text-lime-700/90 mt-1">{(sec.tables || []).length} tables</div>
                          <div className="text-sm text-lime-700/80 mt-1">
                            Menu: <span className="font-semibold">{sec?.activeMenu?.name || "-"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="col-span-3">
                  {selectedSection ? (
                    <div className="space-y-2">
                      <div className="text-s text-lime-700">
                        Floor plan of <span className="font-semibold">{selectedSection.name}</span>.
                      </div>
                      <div className="text-[16px] text-lime-700/80">
                        Active menu: <span className="font-semibold">{selectedSection?.activeMenu?.name || "-"}</span>
                      </div>
                      <div
                        className="relative w-full h-[60vh] md:h-[70vh] min-h-[420px] max-h-[780px] rounded-2xl border border-lime-200 bg-lime-50/60 overflow-hidden"
                        onPointerDown={handleFloorPointerDown}
                        onPointerMove={handleFloorPointerMove}
                        onPointerUp={handleFloorPointerUp}
                        onPointerCancel={handleFloorPointerUp}
                        onPointerLeave={handleFloorPointerUp}
                        onWheel={handleFloorWheel}
                        style={{ touchAction: "none", cursor: floorDragging ? "grabbing" : "grab" }}
                      >
                        <div className="absolute inset-x-3 top-2 flex justify-between text-[13px] text-dark-600">
                          <span>Entrance</span>
                          <span>Bar / Kitchen</span>
                        </div>
                        <div className="absolute inset-0">
                          <div
                            className="absolute inset-0"
                            style={{
                              transform: `translate(${floorPan.x}px, ${floorPan.y}px) scale(${floorZoom})`,
                              transformOrigin: "center",
                            }}
                          >
                            {(selectedSection.objects || []).map((o, objIdx) => (
                              <div
                                key={String(o.id || `${o.kind || "obj"}-${objIdx}`)}
                                className={`absolute -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none ${
                                  String(o.kind || "").toUpperCase() === "LABEL" ? "px-2 py-1" : "rounded-xl border border-slate-200 bg-white/70 shadow-sm"
                                }`}
                                style={{
                                  left: `${Number(o.x ?? 50)}%`,
                                  top: `${Number(o.y ?? 50)}%`,
                                  width: `${Number(o.w ?? 18)}%`,
                                  height: `${Number(o.h ?? 10)}%`,
                                  transform: `translate(-50%, -50%) rotate(${Number(o.rotation || 0)}deg)`,
                                  backgroundColor: o.color ? `${o.color}20` : undefined,
                                  borderColor: o.color ? `${o.color}55` : undefined,
                                  zIndex: Number(o.zIndex ?? 0),
                                }}
                                title={`${o.kind}${o.label ? ` - ${o.label}` : ""}`}
                              >
                                <div
                                  className={`h-full w-full flex items-center justify-center gap-2 text-lime-800 px-2 ${
                                    String(o.kind || "").toUpperCase() === "LABEL" ? "text-sm font-semibold" : "text-[11px]"
                                  }`}
                                >
                                  {(() => {
                                    const { Icon, label } = getFloorObjectMeta(o.kind);
                                    const iconDataUrl = o?.meta?.iconDataUrl;
                                    const iconUrl = o?.meta?.iconUrl;
                                    const isBar = String(o.kind || "").toUpperCase() === "BAR";
                                    const iconSrc = iconDataUrl || iconUrl || (isBar ? BAR_DECOR_ICON_URL : "");
                                    const hasCustom = Boolean(iconSrc);
                                    return (
                                      <>
                                        {String(o.kind || "").toUpperCase() !== "LABEL" && (
                                          <span
                                            className="inline-flex items-center justify-center h-6 w-6 rounded-lg overflow-hidden border border-white/40"
                                            style={{ backgroundColor: o.color || getFloorObjectMeta(o.kind).bg }}
                                            title={label}
                                          >
                                            {hasCustom ? (
                                              <img alt="" src={iconSrc} className="h-full w-full object-contain bg-white/80" />
                                            ) : (
                                              <Icon size={14} className="text-white" />
                                            )}
                                          </span>
                                        )}
                                        <span className="truncate">{o.label || label}</span>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            ))}
                            {(selectedSection.tables || []).map((t, idx) => {
                              const hasCustom = typeof t.x === "number" && typeof t.y === "number";
                              const cols = 5;
                              const col = idx % cols;
                              const row = Math.floor(idx / cols);
                              const fallbackX = (col + 0.5) * (100 / cols);
                              const fallbackY = 25 + row * 20;
                              const x = hasCustom ? Math.min(95, Math.max(5, t.x)) : fallbackX;
                              const y = hasCustom ? Math.min(90, Math.max(15, t.y)) : fallbackY;
                              const hasOrder = Boolean(tableOrderSummary[t.id]?.hasItems);
                              const iconSize = Number(t.size ?? 56) || 56;
                              const rotation = Number(t.rotation ?? 0) || 0;
                              const color = String(t.color || t.colorHex || t.iconColor || "").trim();
                              const tableKey = String(t.id || t.name || `table-${idx}`);
                              return (
                                <button
                                  key={tableKey}
                                  data-floor-table="true"
                                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 select-none group cursor-pointer"
                                  style={{ left: `${x}%`, top: `${y}%` }}
                                  onClick={() => {
                                    if (!guardSwitch() && selectedTable?.id !== t.id) return;
                                    handleSelectTable(t, selectedSection);
                                  }}
                                >
                                  <div
                                    className={`rounded-2xl border shadow-sm transition px-2 py-2 ${
                                      hasOrder
                                        ? "bg-emerald-600/90 border-emerald-500 group-hover:bg-emerald-500/90"
                                        : "bg-white/90 border-lime-200 group-hover:border-lime-300"
                                    }`}
                                  >
                                    {(() => {
                                      const { Free, Occupied } = getTableIcons(t.kind);
                                      return (
                                        <div
                                          style={{
                                            width: iconSize,
                                            height: iconSize,
                                            transform: `rotate(${rotation}deg)`,
                                            color: color || undefined,
                                          }}
                                        >
                                          {(() => {
                                            const kind = String(t.kind || "mesa").toLowerCase();
                                            const isCamastro = kind === "camastro";
                                            const isTaburete =
                                              kind === "taburete" || kind === "butaca" || kind === "stool" || kind === "barstool";
                                            const isMesa = kind === "mesa";
                                            if (hasOrder) {
                                              if (isCamastro && camastroOccupiedIconOk) {
                                                return (
                                                  <img
                                                    alt="Camastro ocupado"
                                                    src={CAMASTRO_OCCUPIED_ICON_URL}
                                                    className="w-full h-full object-contain"
                                                    onError={() => setCamastroOccupiedIconOk(false)}
                                                  />
                                                );
                                              }
                                              if (isTaburete && tabureteOccupiedIconOk) {
                                                return (
                                                  <img
                                                    alt="Taburete ocupado"
                                                    src={TABURETE_OCCUPIED_ICON_URL}
                                                    className="w-full h-full object-contain"
                                                    onError={() => setTabureteOccupiedIconOk(false)}
                                                  />
                                                );
                                              }
                                              if (occupiedIconOk) {
                                                return (
                                                  <img
                                                    alt="Mesa ocupada"
                                                    src={OCCUPIED_TABLE_ICON_URL}
                                                    className="w-full h-full object-contain"
                                                    onError={() => setOccupiedIconOk(false)}
                                                  />
                                                );
                                              }
                                            } else {
                                              if (isCamastro && camastroFreeIconOk) {
                                                return (
                                                  <img
                                                    alt="Camastro libre"
                                                    src={CAMASTRO_FREE_ICON_URL}
                                                    className="w-full h-full object-contain"
                                                    onError={() => setCamastroFreeIconOk(false)}
                                                  />
                                                );
                                              }
                                              if (isTaburete && tabureteFreeIconOk) {
                                                return (
                                                  <img
                                                    alt="Taburete libre"
                                                    src={TABURETE_FREE_ICON_URL}
                                                    className="w-full h-full object-contain"
                                                    onError={() => setTabureteFreeIconOk(false)}
                                                  />
                                                );
                                              }
                                              if (isMesa && freeIconOk) {
                                                return (
                                                  <img
                                                    alt="Mesa libre"
                                                    src={FREE_TABLE_ICON_URL}
                                                    className="w-full h-full object-contain"
                                                    onError={() => setFreeIconOk(false)}
                                                  />
                                                );
                                              }
                                            }
                                            const Icon = hasOrder ? Occupied : Free;
                                            return <Icon className="w-full h-full" />;
                                          })()}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <div
                                    className={`text-sm font-bold rounded-lg px-2 py-0.5 border shadow-sm transition ${
                                      hasOrder
                                        ? "bg-emerald-600/90 border-emerald-500 text-white group-hover:bg-emerald-500/90"
                                        : "bg-white/90 border-lime-200 text-lime-900 group-hover:border-lime-300"
                                    }`}
                                  >
                                    {t.id || t.name}
                                  </div>
                                  {tableOrderSummary[t.id]?.sentAt && (
                                    <div className="text-[10px] text-emerald-700 font-semibold">
                                      {formatElapsed(tableOrderSummary[t.id].sentAt)}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {(selectedSection.tables || []).length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center text-sm text-lime-700">
                            No tables configured in this section.
                          </div>
                        )}
                      </div>
                      </div>
                    ) : (
                      <div className="text-sm text-lime-700">Select a section to view its tables.</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div key={`restaurant-pos-${String(selectedTable?.id || "none")}`} className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-y-auto items-start">
                {/* Top filter bar: family -> sub-family -> sub-sub-family */}
                <div className="col-span-3 self-start w-full flex flex-col lg:flex-row lg:items-start gap-3 bg-gradient-to-r from-lime-50 via-emerald-50 to-lime-100 border border-lime-100 rounded-2xl shadow-sm px-4 py-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-24 shrink-0 text-[11px] uppercase text-lime-700 font-semibold">Familias</div>
                      <div className="flex-1 min-w-0 flex flex-nowrap items-center gap-2 overflow-x-auto">
                        <button
                          className={`h-9 px-3 rounded-lg border text-sm font-semibold ${
                            !category ? "bg-lime-600 border-lime-600 text-white" : "bg-white border-lime-200 text-lime-700"
                          }`}
                          onClick={() => {
                            setCategory("");
                            setSubCategory("");
                            setSubSubCategory("");
                          }}
                        >
                          All
                        </button>
                        {categories.map((cat) => (
                          <button
                            key={cat}
                            className={`h-9 px-3 rounded-lg border text-sm font-semibold ${
                              category === cat ? "bg-lime-600 border-lime-600 text-white" : "bg-white border-lime-200 text-lime-700"
                            }`}
                            onClick={() => {
                              setCategory(cat);
                              setSubCategory("");
                              setSubSubCategory("");
                            }}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {category && subCategories.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 shrink-0 text-[11px] uppercase text-lime-700 font-semibold">Sub-familias</div>
                        <div className="flex-1 min-w-0 flex flex-nowrap items-center gap-2 overflow-x-auto">
                          <button
                            className={`h-9 px-3 rounded-lg border text-sm font-semibold ${
                              !subCategory ? "bg-lime-600 border-lime-600 text-white" : "bg-white border-lime-200 text-lime-700"
                            }`}
                            onClick={() => {
                              setSubCategory("");
                              setSubSubCategory("");
                            }}
                          >
                            All
                          </button>
                          {subCategories.map((sub) => (
                            <button
                              key={String(sub)}
                              className={`h-9 px-3 rounded-lg border text-sm font-semibold ${
                                subCategory === sub ? "bg-lime-600 border-lime-600 text-white" : "bg-white border-lime-200 text-lime-700"
                              }`}
                              onClick={() => {
                                setSubCategory(sub);
                                setSubSubCategory("");
                              }}
                            >
                              {sub}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {category && subCategory && subSubCategories.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 shrink-0 text-[11px] uppercase text-lime-700 font-semibold">Sub-sub-familias</div>
                        <div className="flex-1 min-w-0 flex flex-nowrap items-center gap-2 overflow-x-auto">
                          <button
                            className={`h-9 px-3 rounded-lg border text-sm font-semibold ${
                              !subSubCategory ? "bg-lime-600 border-lime-600 text-white" : "bg-white border-lime-200 text-lime-700"
                            }`}
                            onClick={() => setSubSubCategory("")}
                          >
                            All
                          </button>
                          {subSubCategories.map((sub2) => (
                            <button
                              key={String(sub2)}
                              className={`h-9 px-3 rounded-lg border text-sm font-semibold ${
                                subSubCategory === sub2 ? "bg-lime-600 border-lime-600 text-white" : "bg-white border-lime-200 text-lime-700"
                              }`}
                              onClick={() => setSubSubCategory(sub2)}
                            >
                              {sub2}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full lg:w-auto lg:shrink-0 lg:basis-80">
                    <input
                      className="h-10 w-full lg:w-[260px] rounded-lg border border-lime-200 px-3 text-sm"
                      placeholder="Buscar articulo..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <button
                      className="h-10 px-3 rounded-lg bg-white text-lime-900 text-sm font-semibold border border-lime-200 hover:bg-lime-50"
                      onClick={() => setSearch("")}
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                <div className="col-span-2 min-h-0 flex flex-col">
                  {menuGrid}
                </div>
                <div className="bg-white border border-lime-100 rounded-2xl shadow p-4 flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-1">
                      {orderTabs.map((tab) => {
                        const active = tab.key === activeOrderKey;
                        return (
                          <button
                            key={tab.key}
                            className={`h-8 px-3 border-t border-l border-r rounded-t-md text-xs font-semibold whitespace-nowrap transition ${
                              active
                                ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                                : "bg-slate-100 border-transparent text-slate-500 hover:bg-white hover:border-slate-200"
                            }`}
                            onClick={() => selectOrderForTable(selectedTable?.id, tab.key)}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                      <button
                        className="h-8 w-8 flex items-center justify-center border-t border-l border-r rounded-t-md text-sm font-bold bg-slate-900 text-white"
                        onClick={() => createNewOrderForTable(selectedTable?.id)}
                        title="Nueva orden"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs uppercase text-lime-500">Order</div>
                      <div className="text-base font-semibold text-lime-900">
                        {selectedSection ? `${selectedSection.name} - ` : ""}
                        {selectedTable?.name || "No table"}
                      </div>
                      {currentOrder.status && (
                        <div className="text-[11px] text-lime-600 mt-1">{currentOrder.status}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-lime-600">
                      <label className="text-xs text-lime-500">Pax</label>
                      <input
                        type="number"
                        className="w-14 h-9 rounded-lg border border-lime-200 text-center"
                        value={currentOrder.covers || covers}
                        onChange={(e) => handleCoversChange(e.target.value)}
                        min={1}
                      />
                      <button
                        className={`h-9 px-3 rounded-lg border text-sm font-semibold hover:bg-lime-50 max-w-[140px] truncate ${selectedGuestId ? "bg-lime-100 border-lime-400 text-lime-900" : "bg-white border-lime-300 text-lime-800"}`}
                        onClick={() => setShowCustomerPanel((v) => !v)}
                        title={selectedGuestId ? (guestsList.find((g) => g.id === selectedGuestId) ? `${guestsList.find((g) => g.id === selectedGuestId).firstName} ${guestsList.find((g) => g.id === selectedGuestId).lastName}` : "Cliente") : "Customer"}
                      >
                        {selectedGuestId
                          ? (() => { const g = guestsList.find((x) => x.id === selectedGuestId); return g ? `${g.firstName} ${g.lastName}`.trim() : "Cliente"; })()
                          : "Customer"}
                      </button>
                    </div>
                  </div>

                  {showCustomerPanel && (
                    <div className="mb-3 p-2 rounded-lg border border-lime-200 bg-lime-50 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase text-lime-600 font-semibold">Cliente</span>
                        {selectedGuestId && (
                          <button
                            className="text-xs text-red-500 hover:underline"
                            onClick={() => {
                              setSelectedGuestId("");
                              if (selectedTable?.id) updateOrderForTable(selectedTable.id, (cur) => ({ ...cur, guestId: "" }));
                            }}
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                      <input
                        className="w-full h-8 rounded-lg border border-lime-200 px-3 text-sm"
                        placeholder="Buscar cliente..."
                        value={guestSearch}
                        onChange={(e) => setGuestSearch(e.target.value)}
                        autoFocus
                      />
                      <select
                        className="w-full h-9 rounded-lg border border-lime-200 px-3 text-sm bg-white"
                        value={selectedGuestId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedGuestId(val);
                          if (selectedTable?.id) updateOrderForTable(selectedTable.id, (cur) => ({ ...cur, guestId: val }));
                          setShowCustomerPanel(false);
                        }}
                      >
                        <option value="">Sin cliente</option>
                        {(guestsList || [])
                          .filter((g) => {
                            if (!guestSearch.trim()) return true;
                            const q = guestSearch.toLowerCase();
                            return (
                              `${g.firstName || ""} ${g.lastName || ""}`.toLowerCase().includes(q) ||
                              (g.idNumber || "").toLowerCase().includes(q) ||
                              (g.email || "").toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 50)
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.firstName} {g.lastName}{g.idNumber ? ` — ${g.idNumber}` : ""}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <textarea
                    className="w-full rounded-lg border border-lime-100 px-3 py-2 text-sm min-h-[70px]"
                    placeholder="Kitchen Notes..."
                    value={orderNote}
                    onChange={(e) => handleNoteChange(e.target.value)}
                  />

                  <div className="mt-3 space-y-2">
                    <div className="text-xs uppercase text-lime-500">Services Types</div>
                    <div className="grid grid-cols-2 gap-2">
                      {filteredServiceOptions.map((opt) => (
                        <button
                          key={opt.id}
                          className={`h-9 rounded-lg border text-sm font-semibold ${serviceType === opt.id ? "bg-lime-600 border-lime-600 text-white" : "bg-white border-lime-200 text-lime-700"}`}
                          onClick={() => handleServiceTypeChange(opt.id)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  {serviceType === "ROOM" && (
                      <input
                        className="w-full h-10 rounded-lg border border-lime-200 px-3 text-sm"
                        placeholder="Room / room charge"
                        value={roomCharge}
                        onChange={(e) => handleRoomChargeChange(e.target.value)}
                      />
                    )}
                  </div>

                  {taxesCfg.permitirDescuentos && (
                    <div className="mt-3 space-y-1">
                      <div className="text-xs uppercase text-lime-500">Descuento de la orden</div>
                      <select
                        className="w-full h-10 rounded-lg border border-lime-200 px-3 text-sm bg-white"
                        value={currentOrder.discountId || ""}
                        onChange={(e) => handleOrderDiscountChange(e.target.value)}
                      >
                        <option value="">Sin descuento</option>
                        {discountOptions.map((d) => (
                          <option key={String(d.id)} value={String(d.id)}>
                            {d.name} ({Number(d.value || 0)}%)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-2">
                    {(currentOrder.items || []).length === 0 && (
                      <div className="text-sm text-lime-600 bg-lime-50 border border-dashed border-lime-200 rounded-xl p-3">
                        Agrega productos con un tap.
                      </div>
                    )}
                    {(currentOrder.items || []).map((item, idx) => (
                      <div key={getOrderItemKey(item) || String(item.id || item.code || `${item.name}-${idx}`)} className="border border-lime-100 rounded-xl p-3">
                        <div className="flex justify-between items-center gap-2">
                          <div>
                            <div className="font-semibold text-lime-900">{item.name}</div>
                            <div className="text-xs text-lime-600">
                              {canEditItemPrice && !isComandada ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-lime-500">Precio</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="h-7 w-24 rounded-md border border-lime-200 bg-white px-2 text-right text-xs text-lime-900 focus:outline-none focus:ring-2 focus:ring-lime-300"
                                    value={Number.isFinite(Number(item.price)) ? Number(item.price) : ""}
                                    onChange={(e) => handleItemPriceChange(getOrderItemKey(item), e.target.value)}
                                  />
                                </div>
                              ) : (
                                <span>{formatMoney(item.price)} c/u</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="h-8 w-8 rounded-lg bg-lime-50 text-lg disabled:opacity-50"
                              onClick={() => updateQty(getOrderItemKey(item), -1)}
                              disabled={isComandada}
                            >
                              -
                            </button>
                            <div className="w-8 text-center font-semibold">{item.qty}</div>
                            <button
                              className="h-8 w-8 rounded-lg bg-purple-800 text-white text-lg"
                              onClick={() => updateQty(getOrderItemKey(item), 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-sm">
                          <div className="text-lime-700">{formatMoney(item.price * item.qty)}</div>
                          <div className="flex items-center gap-2">
                            <button
                              className="text-xs text-red-600 hover:underline disabled:opacity-50"
                              onClick={() => removeItem(getOrderItemKey(item))}
                              disabled={isComandada}
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                        {taxesCfg.permitirDescuentos && (
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-lime-600">Desc.</span>
                            <select
                              className="h-7 rounded border border-lime-200 bg-white px-2 text-[11px]"
                              value={item.discountId || ""}
                              onChange={(e) => handleItemDiscountChange(getOrderItemKey(item), e.target.value)}
                            >
                              <option value="">Sin descuento</option>
                              {discountOptions.map((d) => (
                                <option key={String(d.id)} value={String(d.id)}>
                                  {d.name} ({Number(d.value || 0)}%)
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-1 text-sm text-lime-800">
                    <div className="flex justify-between">
                      <span>Sub total</span>
                      <span>{formatMoney(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Service {taxesCfg.servicio || 0}%</span>
                      <span>{formatMoney(totals.service)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxes {taxesCfg.iva || 0}%</span>
                      <span>{formatMoney(totals.tax)}</span>
                    </div>
                    {totals.discountTotal > 0 && (
                      <div className="flex justify-between text-amber-700">
                        <span>Descuento</span>
                        <span>-{formatMoney(totals.discountTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg mt-1">
                      <span>Total</span>
                      <span>{formatMoney(totals.total)}</span>
                    </div>
                  </div>
                  

                  <div className={`mt-4 grid gap-2 ${isQuickCashContext ? "grid-cols-1" : "grid-cols-2"}`}>
                    {!isQuickCashContext && (
                      <button
                        className="h-12 rounded-xl bg-lime-50 text-lime-700 font-semibold transition-colors hover:bg-lime-100 active:bg-lime-200 disabled:opacity-60"
                        onClick={sendToKitchen}
                        disabled={!hasItems}
                      >
                        Comandar
                      </button>
                    )}
              <button
                      className="h-12 rounded-xl bg-emerald-600 text-white font-semibold transition-colors hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-300"
                      onClick={openPayments}
                      disabled={!hasItems}
                    >
                      Cobrar
                    </button>
              {!isQuickCashContext && (
                      <button
                        className="h-12 rounded-xl bg-emerald-100 text-emerald-800 font-semibold transition-colors hover:bg-emerald-200 active:bg-emerald-300 disabled:opacity-60"
                        onClick={printSubtotal}
                        disabled={!hasItems}
                      >
                        Subtotal
                      </button>
                    )}
                  </div>
                </div>
              </div>
          )}
        </div>
      </div>
      {(sectionLauncher || !selectedTable) && (
        <div className="fixed bottom-4 left-4 z-40 w-auto max-w-[calc(100%-2rem)]">
          <div className="bg-white/95 backdrop-blur border border-lime-200 shadow-xl rounded-2xl px-5 py-3 inline-flex flex-col md:flex-row md:items-center gap-3">
            <div>
              <div className="text-[11px] uppercase text-lime-500">Secciones</div>
              <div className="text-base font-semibold text-lime-900">Gestionar facturas</div>
            </div>
            <button
              className="h-12 px-6 rounded-2xl bg-red-600 text-white text-lg font-semibold transition-colors hover:bg-red-700 active:bg-red-800"
              onClick={openVoidInvoiceModal}
            >
              Anular factura
            </button>
            <button
              className="h-12 px-6 rounded-2xl bg-emerald-500 text-white text-lg font-semibold transition-colors hover:bg-emerald-600 active:bg-emerald-700"
              onClick={resetToLobby}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {selectedTable && !sectionLauncher && (
        <div className="fixed bottom-4 left-4 z-40 w-auto max-w-[calc(100%-2rem)]">
          <div className="bg-white/95 backdrop-blur border border-lime-200 shadow-xl rounded-2xl px-5 py-3 inline-flex flex-col md:flex-row md:items-center gap-3">
            <div>
              <div className="text-[11px] uppercase text-lime-500">Mesa</div>
              <div className="text-base font-semibold text-lime-900">{selectedTable?.name || "Mesa"}</div>
            </div>
            <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 text-sm">
              <button
                className="h-12 px-4 rounded-2xl bg-white border border-lime-200 text-lime-800 text-base font-semibold transition-colors hover:bg-lime-50 active:bg-lime-100"
                onClick={() => createNewOrderForTable(selectedTable?.id)}
              >
                Nueva orden
              </button>
              {!isQuickCashContext && (
                <>
                  <button
                    className="h-12 px-4 rounded-2xl bg-white border border-lime-200 text-lime-800 text-base font-semibold transition-colors hover:bg-lime-50 active:bg-lime-100"
                    onClick={() => {
                      setTablePickerMode("MOVE");
                      setTablePickerOpen(true);
                      setMoveTargetTable(null);
                    }}
                  >
                    Change table
                  </button>
                  <button
                    className="h-12 px-4 rounded-2xl bg-white border border-lime-200 text-lime-800 text-base font-semibold transition-colors hover:bg-lime-50 active:bg-lime-100"
                    onClick={openSplitOrderModal}
                    disabled={!hasItems}
                  >
                    Split Order
                  </button>
                  <button
                    className="h-12 px-4 rounded-2xl bg-white border border-lime-200 text-lime-800 text-base font-semibold transition-colors hover:bg-lime-50 active:bg-lime-100"
                    onClick={reprintComanda}
                    disabled={!hasItems}
                    title="Reprint comanda without re-sending to kitchen/KDS"
                  >
                    Reprint comanda
                  </button>
                </>
              )}
              <button
                className="h-12 px-4 rounded-2xl bg-white border border-lime-200 text-lime-800 text-base font-semibold transition-colors hover:bg-lime-50 active:bg-lime-100 ml-1"
                onClick={cancelEmptyOrder}
                
                title="Cancelar orden"
              >
                Cancelar orden
              </button>
              <button
                className="h-12 px-4 rounded-2xl bg-emerald-500 text-white text-base font-semibold transition-colors hover:bg-emerald-600 active:bg-emerald-700 ml-1"
                onClick={resetToLobby}
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}






