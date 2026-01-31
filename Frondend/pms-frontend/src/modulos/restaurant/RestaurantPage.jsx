import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Columns2, DoorOpen, Droplets, Leaf, RectangleHorizontal, Tag, Toilet, UtensilsCrossed, Waves } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { ensurePrintAgentConfigInteractive, printTextToAgent } from "../../lib/printAgent";
import RestaurantUserMenu from "./RestaurantUserMenu";
import RestaurantCloseXButton from "./RestaurantCloseXButton";

const OCCUPIED_TABLE_ICON_URL = `${process.env.PUBLIC_URL || ""}/assets/restaurant/table-occupied.png`;
const CAMASTRO_FREE_ICON_URL = `${process.env.PUBLIC_URL || ""}/assets/restaurant/camastro-free.png`;

function formatMoney(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

function asInt(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : fallback;
}

function buildPrintPreviewText({ title, payload, totals }) {
  const now = new Date();
  const lines = [];

  lines.push(String(title || "IMPRIMIR").toUpperCase());
  lines.push(`Fecha: ${now.toLocaleString()}`);
  if (payload?.type) lines.push(`Tipo: ${String(payload.type)}`);
  if (payload?.sectionId) lines.push(`Sección: ${String(payload.sectionId)}`);
  if (payload?.tableId) lines.push(`Mesa: ${String(payload.tableId)}`);
  if (payload?.covers != null) lines.push(`Personas: ${asInt(payload.covers, 0)}`);
  if (payload?.serviceType) lines.push(`Servicio: ${String(payload.serviceType)}`);
  if (payload?.roomId) lines.push(`Habitación: ${String(payload.roomId)}`);
  lines.push("");

  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length > 0) {
    lines.push("Items:");
    for (const it of items) {
      const qty = asInt(it?.qty ?? it?.quantity ?? 1, 1);
      const name = String(it?.name || it?.label || it?.title || it?.id || "Item");
      const price = it?.price ?? it?.unitPrice ?? it?.amount;
      const hasPrice = price != null && String(price).trim() !== "";
      if (hasPrice) lines.push(`- ${qty} x ${name} @ ${formatMoney(price)} = ${formatMoney(qty * (Number(price) || 0))}`);
      else lines.push(`- ${qty} x ${name}`);
      const note = String(it?.note || "").trim();
      if (note) lines.push(`  Nota: ${note}`);
    }
    lines.push("");
  }

  const note = String(payload?.note || "").trim();
  if (note) {
    lines.push("Nota:");
    lines.push(note);
    lines.push("");
  }

  const t = totals && typeof totals === "object" ? totals : null;
  if (t) {
    const total = t.total ?? t.system ?? t.grandTotal ?? t.totalAmount;
    const tax = t.tax ?? t.iva ?? t.impuesto;
    const service = t.service ?? t.servicio;
    if (service != null) lines.push(`Servicio: ${formatMoney(service)}`);
    if (tax != null) lines.push(`Impuesto: ${formatMoney(tax)}`);
    if (total != null) lines.push(`Total: ${formatMoney(total)}`);
  }

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

const getOrderItemKey = (item, idx) => {
  const base = item?.id ?? item?.code ?? item?.name ?? "item";
  return `${String(base)}-${idx}`;
};

const normalizeOrderList = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const getOrderKey = (order) => String(order?.id || order?.orderId || order?.localId || "");

const buildLocalOrder = (overrides = {}) => ({
  localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  items: [],
  covers: 2,
  note: "",
  status: "NUEVA",
  serviceType: "DINE_IN",
  roomId: "",
  ...overrides,
});

const getOrderSaveKey = (payload) => String(payload?.orderId || payload?.localId || payload?.tableId || "");

export default function RestaurantPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const orderSaveTimerRef = useRef(null);
  const pendingOrderSaveRef = useRef(null);
  const creatingOrderRef = useRef({});
  const pendingCreateUpdateRef = useRef({});
  const addItemRef = useRef(null);

  const pendingPrintRef = useRef(null);
  const [printConfirmOpen, setPrintConfirmOpen] = useState(false);
  const [printConfirmTitle, setPrintConfirmTitle] = useState("");
  const [printConfirmText, setPrintConfirmText] = useState("");
  const [printConfirmBusy, setPrintConfirmBusy] = useState(false);
  const [occupiedIconOk, setOccupiedIconOk] = useState(true);
  const [camastroIconOk, setCamastroIconOk] = useState(true);

  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [tablePickerMode, setTablePickerMode] = useState("NEW"); // NEW | MOVE
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
  const [activeOrderByTable, setActiveOrderByTable] = useState({});
  const activeOrderByTableRef = useRef({});
  const selectedTableRef = useRef(null);
  const [now, setNow] = useState(new Date());
  const [printerCfg, setPrinterCfg] = useState({ kitchenPrinter: "", barPrinter: "", cashierPrinter: "" });
  const [printSettings, setPrintSettings] = useState({
    paperType: "80mm",
    defaultDocType: "TE",
    types: {
      ticket: { enabled: true, printerId: "", copies: 1 },
      electronicInvoice: { enabled: true, printerId: "", copies: 1 },
      closes: { enabled: true, printerId: "", copies: 1 },
      salesReport: { enabled: true, printerId: "", copies: 1 },
      document: { enabled: true, printerId: "", copies: 1 },
    },
  });

  const [closeOpen, setCloseOpen] = useState(false);
  const [closeForm, setCloseForm] = useState({ cash: "", card: "", sinpe: "", transfer: "", room: "", notes: "" });
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);

  const [openInfo, setOpenInfo] = useState(() => ({ openedAt: new Date().toISOString(), user: "Cashier" }));
  const [taxesCfg, setTaxesCfg] = useState({
    iva: 13,
    servicio: 10,
    descuentoMax: 15,
    permitirDescuentos: true,
    impuestoIncluido: true,
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
  const [splitByItem, setSplitByItem] = useState(false);
  const [itemSplitMap, setItemSplitMap] = useState({});
  const [serviceType, setServiceType] = useState("DINE_IN"); // DINE_IN, TAKEOUT, DELIVERY, ROOM
  const [roomCharge, setRoomCharge] = useState("");

  const role = useMemo(() => (user?.role || "").toUpperCase(), [user?.role]);
  const canViewTotals = useMemo(() => role === "ADMIN" || role === "MANAGER", [role]);

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

    const { data } = await api.post("/restaurant/order", payload);
    if (data && typeof data === "object") {
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
        };
        const incomingKey = getOrderKey(incoming);
        const matchKey = payload.orderId || payload.localId || incomingKey;
        const idx = list.findIndex((o) => getOrderKey(o) === String(matchKey));
        const nextList = [...list];
        if (idx >= 0) {
          nextList[idx] = { ...nextList[idx], ...incoming, localId: nextList[idx].localId || payload.localId };
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

  const tableOrderSummary = useMemo(() => {
    const summary = {};
    Object.entries(ordersByTable || {}).forEach(([tableId, entry]) => {
      const list = normalizeOrderList(entry);
      summary[tableId] = {
        count: list.length,
        hasItems: list.some((o) => (o.items || []).length > 0),
      };
    });
    return summary;
  }, [ordersByTable]);

const categories = useMemo(() => {
    const set = new Set((menuItems || []).map((m) => m.category).filter(Boolean));
    return Array.from(set);
  }, [menuItems]);

const subCategories = useMemo(() => {
    if (!category) return [];
    const set = new Set(
      (menuItems || [])
        .filter((m) => m.category === category)
        .map((m) => m.subfamily || m.subCategory || m.subFamily || m.subCategoria || m.subcategoria)
        .filter(Boolean)
    );
    return Array.from(set);
  }, [menuItems, category]);

  const subSubCategories = useMemo(() => {
    if (!category || !subCategory) return [];
    const set = new Set(
      (menuItems || [])
        .filter((m) => m.category === category)
        .filter((m) =>
          !subCategory
            ? true
            : m.subfamily === subCategory ||
              m.subCategory === subCategory ||
              m.subFamily === subCategory ||
              m.subCategoria === subCategory ||
              m.subcategoria === subCategory
        )
        .map((m) => m.subSubFamily || m.subsubfamily || m.subSubFamilia || m.subsubFamilia)
        .filter(Boolean)
    );
    return Array.from(set);
  }, [menuItems, category, subCategory]);

  const filteredMenu = useMemo(() => {
    return (menuItems || []).filter((m) => {
      const inCat = !category || m.category === category;
      const inSub = (
        !subCategory ||
        m.subfamily === subCategory ||
        m.subCategory === subCategory ||
        m.subFamily === subCategory ||
        m.subCategoria === subCategory ||
        m.subcategoria === subCategory
      );
      const inSubSub = (
        !subSubCategory ||
        m.subSubFamily === subSubCategory ||
        m.subsubfamily === subSubCategory ||
        m.subSubFamilia === subSubCategory ||
        m.subsubFamilia === subSubCategory
      );
      const matches = !search || m.name.toLowerCase().includes(search.toLowerCase());
      return inCat && inSub && inSubSub && matches;
    });
  }, [menuItems, category, subCategory, subSubCategory, search]);

  const menuGrid = useMemo(
    () => (
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
        {filteredMenu.map((item, idx) => (
          <button
            key={String(item.id || item.code || `${item.name}-${idx}`)}
            onClick={() => addItemRef.current && addItemRef.current(item)}
            className="relative rounded-xl bg-white border-2 border-lime-300 shadow-sm hover:shadow-lime-200/70 transition text-left p-2.5 flex flex-col gap-2 h-48 aspect-square"
            style={{
              borderColor: item?.color ? String(item.color) : undefined,
            }}
          >
            <div className="absolute top-2 right-2 text-[16px] font-bold text-lime-800 leading-none">
              {formatMoney(item.price)}
            </div>

            {item.imageUrl ? (
              <>
                <div className="pr-14 min-w-0 text-[16px] font-semibold text-lime-900 leading-tight line-clamp-2">
                  {item.name}
                </div>
                <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-lime-100 bg-white flex items-center justify-center">
                  <img
                    alt=""
                    src={item.imageUrl}
                    className="h-full w-full object-contain p-1"
                    onError={(ev) => {
                      ev.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 min-h-0 flex items-center justify-center text-center px-2">
                <div className="text-[17px] font-semibold text-lime-900 leading-snug line-clamp-3">
                  {item.name}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    ),
    [filteredMenu]
  );

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
        label: `Orden ${idx + 1}`,
      })),
    [selectedTableOrders]
  );

  const currentOrder = useMemo(() => {
    if (!selectedTable?.id) return { items: [], covers, note: orderNote, status: "NUEVA", serviceType, roomId: roomCharge };
    const list = selectedTableOrders;
    const byKey = list.find((o) => getOrderKey(o) && getOrderKey(o) === activeOrderKey);
    const stored = byKey || list[0];
    if (!stored) {
      return { items: [], covers, note: orderNote, status: "NUEVA", serviceType, roomId: roomCharge };
    }
    return {
      ...stored,
      items: Array.isArray(stored?.items) ? stored.items : [],
      covers: stored?.covers || covers,
      note: typeof stored?.note === "string" ? stored.note : orderNote || "",
      status: stored?.status || "NUEVA",
      updatedAt: stored?.updatedAt,
      serviceType: stored?.serviceType || serviceType,
      roomId: stored?.roomId || roomCharge,
    };
  }, [selectedTable?.id, selectedTableOrders, activeOrderKey, covers, orderNote, serviceType, roomCharge]);

  useEffect(() => {
    if (!selectedTable?.id) return;
    if (!currentOrder) return;
    const nextCovers = currentOrder.covers || selectedTable?.seats || 2;
    const nextNote = currentOrder.note || "";
    const nextService = currentOrder.serviceType || "DINE_IN";
    const nextRoom = currentOrder.roomId || "";
    if (covers !== nextCovers) setCovers(nextCovers);
    if (orderNote !== nextNote) setOrderNote(nextNote);
    if (serviceType !== nextService) setServiceType(nextService);
    if (roomCharge !== nextRoom) setRoomCharge(nextRoom);
  }, [selectedTable?.id, selectedTable?.seats, currentOrder, covers, orderNote, serviceType, roomCharge]);

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
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  const totals = useMemo(() => {
    const serviceRate = Number(taxesCfg.servicio || 0) / 100;
    const taxRate = Number(taxesCfg.iva || 0) / 100;
    const sums = (currentOrder.items || []).reduce(
      (acc, i) => {
        const qty = Number(i.qty || 0);
        const price = Number(i.price || 0);
        const gross = price * qty;
        const includes = i?.priceIncludesTaxesAndService !== false;
        if (includes) {
          const denom = 1 + serviceRate + taxRate;
          const net = denom > 0 ? gross / denom : gross;
          acc.subtotal += net;
          acc.service += net * serviceRate;
          acc.tax += net * taxRate;
          acc.total += gross;
        } else {
          const net = gross;
          acc.subtotal += net;
          acc.service += net * serviceRate;
          acc.tax += net * taxRate;
          acc.total += net + net * serviceRate + net * taxRate;
        }
        return acc;
      },
      { subtotal: 0, service: 0, tax: 0, total: 0 }
    );
    return sums;
  }, [currentOrder.items, taxesCfg.iva, taxesCfg.servicio]);

  const systemTotal = useMemo(() => {
    if (typeof stats.systemTotal === "number") return stats.systemTotal || 0;
    return Object.values(ordersByTable).reduce((acc, entry) => {
      const list = normalizeOrderList(entry);
      const tableSum = list.reduce((sum, o) => sum + (o.items || []).reduce((s, i) => s + i.price * i.qty, 0), 0);
      return acc + tableSum;
    }, 0);
  }, [stats.systemTotal, ordersByTable]);

  const reportedTotal = useMemo(
    () => sumNumbers({ cash: closeForm.cash, card: closeForm.card, sinpe: closeForm.sinpe, transfer: closeForm.transfer, room: closeForm.room }),
    [closeForm]
  );

  const closeSummary = useMemo(() => {
    const sys = systemTotal || 0;
    const diff = reportedTotal - sys;
    return { system: sys, reported: reportedTotal, diff };
  }, [systemTotal, reportedTotal]);

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

  const selectedPaymentMethods = useMemo(() => {
    if (!selectedPaymentKeys.length) return [];
    const byKey = new Map(availablePaymentMethods.map((m) => [m.key, m]));
    return selectedPaymentKeys.map((k) => byKey.get(k)).filter(Boolean);
  }, [availablePaymentMethods, selectedPaymentKeys]);

  const displayTotals = paymentResult?.totals || totals;
  const paymentChange = paymentResult?.change || 0;

  const itemSplitData = useMemo(() => {
    if (!splitByItem) return { totals: {}, orderTotal: 0 };
    const serviceRate = Number(taxesCfg.servicio || 0) / 100;
    const taxRate = Number(taxesCfg.iva || 0) / 100;
    const totalsByMethod = {};
    let orderTotal = 0;
    (currentOrder.items || []).forEach((item, idx) => {
      const qty = Number(item?.qty || 0);
      const price = Number(item?.price || 0);
      const gross = qty * price;
      const includes = item?.priceIncludesTaxesAndService !== false;
      const lineTotal = includes ? gross : gross + gross * serviceRate + gross * taxRate;
      orderTotal += lineTotal;
      const itemKey = getOrderItemKey(item, idx);
      const methodKey = itemSplitMap[itemKey];
      if (!methodKey) return;
      totalsByMethod[methodKey] = (totalsByMethod[methodKey] || 0) + lineTotal;
    });
    return { totals: totalsByMethod, orderTotal };
  }, [splitByItem, currentOrder.items, itemSplitMap, taxesCfg.iva, taxesCfg.servicio]);

  const itemSplitUnassigned = useMemo(() => {
    if (!splitByItem) return 0;
    const assigned = sumNumbers(itemSplitData.totals);
    return Math.max(0, itemSplitData.orderTotal - assigned);
  }, [splitByItem, itemSplitData]);
  const hasItems = useMemo(() => (currentOrder.items || []).length > 0, [currentOrder.items]);
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
  }, []);

  const refreshOrders = useCallback(async () => {
    try {
      const { data } = await api.get("/restaurant/orders");
      if (Array.isArray(data)) {
        const map = {};
        data.forEach((o, idx) => {
          if (!o?.tableId) return;
          const order = {
            ...o,
            items: Array.isArray(o.items) ? o.items : [],
            covers: o.covers || 2,
            note: o.note || "",
            status: o.status || "ENVIADO",
            serviceType: o.serviceType || "DINE_IN",
            roomId: o.roomId || "",
          };
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
          setCategory(data[0]?.category || "");
          return;
        }
      } catch {
        /* ignore */
      }
      setMenuItems([]);
      setCategory("");
    },
    [serviceType]
  );

  useEffect(() => {
    if (selectedSection?.id) {
      loadMenu(selectedSection.id);
    }
  }, [selectedSection?.id, loadMenu]);

  const handleSelectTable = (table, section) => {
    setSelectedSection(section);
    setSelectedTable(table);
    const list = normalizeOrderList(ordersByTable[table.id]);
    if (list.length === 0) {
      const newOrder = buildLocalOrder({ covers: table?.seats || 2, serviceType: "DINE_IN", sectionId: section?.id });
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

  const openNewOrderPicker = () => {
    if (!guardSwitch()) return;
    setSelectedTable(null);
    setSelectedSection(null);
    setTablePickerMode("NEW");
    setTablePickerOpen(true);
    setSectionLauncher(true);
  };

  const openMoveTablePicker = () => {
    if (!selectedTable?.id) return;
    setTablePickerMode("MOVE");
    setTablePickerOpen(true);
  };

  const moveToTable = async (toTable) => {
    if (!selectedTable?.id || !toTable?.id) return;
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
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Table changed." } }));
    } catch (err) {
      const msg = err?.response?.data?.message || "Could not change table.";
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: msg } }));
    }
  };

  const printToAgent = async ({ printerNames, text, copies = 1 }) => {
    const cfg = ensurePrintAgentConfigInteractive();
    if (!cfg) throw new Error("Print Agent API key not set.");

    const list = Array.from(new Set((printerNames || []).map((p) => String(p || "").trim()).filter(Boolean)));
    if (list.length === 0) throw new Error("No printer configured for this action.");

    for (const printerName of list) {
      // eslint-disable-next-line no-await-in-loop
      await printTextToAgent({ agentUrl: cfg.url, apiKey: cfg.key, printerName, text, copies });
    }
  };

  const getInvoicePrintConfig = () => {
    const docType = String(printSettings?.defaultDocType || "TE").toUpperCase();
    const typeKey = docType === "FE" ? "electronicInvoice" : "ticket";
    const cfg = printSettings?.types?.[typeKey] || {};
    const docCfg = printSettings?.types?.document || {};
    const printerId = String(cfg.printerId || docCfg.printerId || printerCfg.cashierPrinter || "").trim();
    const copies = Number(cfg.copies || docCfg.copies || 1) || 1;
    return { printerId, copies, docType, typeKey };
  };

  const reprintCurrent = async () => {
    if (!selectedTable?.id) return;
    const order = currentOrder || {};
    const isPaid = String(order?.status || "").toUpperCase() === "PAID";
    if (!isPaid) {
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: "Restaurant", desc: "No paid invoice yet. Use 'Reprint comanda' from the table." },
        })
      );
      return;
    }

    const invoiceCfg = getInvoicePrintConfig();
    const payload = {
      sectionId: order?.sectionId || selectedSection?.id,
      tableId: selectedTable.id,
      items: Array.isArray(order?.items) ? order.items : [],
      note: order?.note || orderNote || "",
      covers: order?.covers || covers,
      type: invoiceCfg.docType,
      printers: { ...printerCfg, paperType: printSettings.paperType || undefined },
    };

    const serviceRate = Number(taxesCfg.servicio || 0) / 100;
    const taxRate = Number(taxesCfg.iva || 0) / 100;
    const subtotal = (payload.items || []).reduce((acc, i) => acc + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
    const previewTotals = { subtotal, service: subtotal * serviceRate, tax: subtotal * taxRate, total: subtotal + subtotal * serviceRate + subtotal * taxRate };

    openPrintConfirm({
      title: "Reimpresión de factura",
      payload,
      totals: previewTotals,
      onConfirm: async () => {
        try {
          const text = buildPrintPreviewText({ title: "ReimpresiÐ˜n de factura", payload, totals: previewTotals });
          await printToAgent({
            printerNames: [invoiceCfg.printerId],
            text,
            copies: invoiceCfg.copies,
          });
          window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Reimpresión enviada." } }));
        } catch (err) {
          const msg = err?.message || err?.response?.data?.message || "No se pudo reimprimir.";
          window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: msg } }));
        }
      },
    });
  };

  const requireAdminCodeIfNeeded = () => {
    if (role === "ADMIN") return { adminCode: undefined };
    const code = (window.prompt("Admin PIN required:", "") || "").trim();
    if (!code) return null;
    return { adminCode: code };
  };

  const cancelCurrentOrder = async () => {
    if (!selectedTable?.id) return;

    const exists = Boolean(getOrderKey(currentOrder) || currentOrder?.items?.length || hasItems);
    if (!exists) {
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "No open order to cancel." } }));
      return;
    }

    const ok = window.confirm("Cancel this order?");
    if (!ok) return;

    const reason = (window.prompt("Cancel reason (optional):", "") || "").trim();
    const auth = requireAdminCodeIfNeeded();
    if (!auth) return;

    await flushOrderSave();

    try {
      await api.post("/restaurant/order/cancel", {
        tableId: selectedTable.id,
        restaurantOrderId: currentOrder?.id || currentOrder?.orderId || undefined,
        orderId: currentOrder?.id || currentOrder?.orderId || undefined,
        reason: reason || undefined,
        ...auth,
      });

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

      if (nextActiveKey) {
        const remaining = normalizeOrderList(ordersByTable[selectedTable.id]).filter((o) => getOrderKey(o) !== getOrderKey(currentOrder));
        const nextOrder = remaining.find((o) => getOrderKey(o) === nextActiveKey) || remaining[0];
        setOrderNote(nextOrder?.note || "");
        setCovers(nextOrder?.covers || 2);
        setServiceType(nextOrder?.serviceType || "DINE_IN");
        setRoomCharge(nextOrder?.roomId || "");
      } else {
        setOrderNote("");
        setCovers(2);
        setServiceType("DINE_IN");
        setRoomCharge("");
        setSelectedTable(null);
        setSectionLauncher(false);
      }

      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Order canceled." } }));
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Could not cancel order.";
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: msg } }));
    }
  };

  const voidInvoice = async () => {
    const orderId = currentOrder?.id || currentOrder?.orderId;
    if (!orderId) {
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "No paid order found." } }));
      return;
    }

    const auth = requireAdminCodeIfNeeded();
    if (!auth) return;

    const type = (window.prompt("Document type to void (FE/TE). Leave blank for latest:", "") || "").trim().toUpperCase();
    const reason = window.prompt("Void reason (optional):", "") || "";
    try {
      await api.post("/restaurant/order/void-invoice", { restaurantOrderId: orderId, docType: type || undefined, reason, ...auth });
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Invoice voided." } }));
    } catch (err) {
      const msg = err?.response?.data?.message || "Could not void invoice.";
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: msg } }));
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

  const updateOrderForTable = (tableId, updater, orderKeyOverride = "") => {
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
        });
        nextList = [...list, created];
        idx = nextList.length - 1;
      }

      const cur = nextList[idx] || buildLocalOrder();
      const next = updater(cur);
      const merged = {
        ...cur,
        ...next,
        items: Array.isArray(next?.items) ? next.items : Array.isArray(cur.items) ? cur.items : [],
        covers: next?.covers ?? cur?.covers ?? covers,
        note: typeof next?.note === "string" ? next.note : typeof cur?.note === "string" ? cur.note : orderNote || "",
        serviceType: next?.serviceType || cur?.serviceType || serviceType || "DINE_IN",
        roomId: next?.roomId || cur?.roomId || roomCharge || "",
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
      });

      return { ...prev, [tableId]: nextList };
    });

    if (nextActiveKey) {
      setActiveOrderByTable((prev) => ({ ...prev, [tableId]: nextActiveKey }));
    }
  };

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
      const itemIdx = fromOrder.items.findIndex((i) => i.id === item.id);
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

      const existingIdx = targetOrder.items.findIndex((i) => i.id === movingItem.id);
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
      });
    }
    if (newOrderKey) {
      setActiveOrderByTable((prev) => ({ ...prev, [tableId]: newOrderKey }));
    }
  };

  const addItem = (item) => {
    if (!selectedTable?.id) return;
    updateOrderForTable(selectedTable.id, (cur) => {
      const idx = cur.items.findIndex((i) => i.id === item.id);
      const items = idx >= 0
        ? cur.items.map((i, k) => (k === idx ? { ...i, qty: i.qty + 1 } : i))
        : [...cur.items, { ...item, qty: 1 }];
      return { ...cur, items, covers: cur.covers || covers, note: cur.note || orderNote };
    });
  };

  useEffect(() => {
    addItemRef.current = addItem;
  }, [addItem]);

  const updateQty = (id, delta) => {
    if (!selectedTable?.id) return;
    updateOrderForTable(selectedTable.id, (cur) => {
      const items = cur.items
        .map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i))
        .filter((i) => i.qty > 0);
      return { ...cur, items };
    });
  };

  const removeItem = (id) => {
    if (!selectedTable?.id) return;
    updateOrderForTable(selectedTable.id, (cur) => ({ ...cur, items: cur.items.filter((i) => i.id !== id) }));
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

  const sendComanda = async ({ markAsSent = true, silent = false } = {}) => {
    if (!selectedTable?.id || !hasItems) return;
    const payload = {
      sectionId: selectedSection?.id,
      tableId: selectedTable?.id,
      orderId: currentOrder?.id || currentOrder?.orderId || undefined,
      items: currentOrder.items || [],
      note: orderNote || "",
      covers: currentOrder.covers || covers,
      printers: { ...printerCfg, paperType: printSettings.paperType || undefined },
      type: "KITCHEN_BAR",
      status: markAsSent ? "ENVIADO" : undefined,
      serviceType: currentOrder.serviceType || serviceType,
      roomId: currentOrder.roomId || roomCharge,
    };

    const run = async () => {
      try {
        if (markAsSent) {
          await api.post("/restaurant/order", payload);
        }
        const title = markAsSent ? "Imprimir comanda" : "Reimprimir comanda";
        const text = buildPrintPreviewText({ title, payload, totals });
        const printers = [printerCfg.kitchenPrinter, printerCfg.barPrinter].filter(Boolean);
        await printToAgent({
          printerNames: printers.length ? printers : [printerCfg.cashierPrinter],
          text,
          copies: 1,
        });
        if (markAsSent) {
          updateOrderForTable(selectedTable.id, (cur) => ({ ...cur, status: "ENVIADO", updatedAt: new Date().toISOString() }));
          refreshStats();
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

    openPrintConfirm({
      title: markAsSent ? "Imprimir comanda" : "Reimprimir comanda",
      payload,
      totals,
      onConfirm: run,
    });
  };

  const sendToKitchen = async () => sendComanda({ markAsSent: true, silent: false });

  const reprintComanda = async () => sendComanda({ markAsSent: false, silent: false });

  const backToSection = async () => {
    if (!selectedTable?.id) return;
    const currentStatus = String(currentOrder?.status || "").toUpperCase();
    if (hasItems && currentStatus !== "ENVIADO") {
      await sendComanda({ markAsSent: true, silent: true });
    }
    setSelectedTable(null);
    setSectionLauncher(false);
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
    setSplitByItem(false);
    setItemSplitMap({});
    setPaymentsModalOpen(true);
  };

  const closePaymentsModal = () => {
    if (paymentPrintBusy) return;
    setPaymentsModalOpen(false);
    setPaymentForm({});
    setSelectedPaymentKeys([]);
    setSplitPayments(false);
    setPaymentResult(null);
    setPaymentPrintBusy(false);
    setSplitByItem(false);
    setItemSplitMap({});
  };

  const handleSplitToggle = () => {
    const nextSplit = !splitPayments;
    setSplitPayments(nextSplit);
    if (!nextSplit) {
      setSplitByItem(false);
      setItemSplitMap({});
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

  const toggleSplitByItem = () => {
    const next = !splitByItem;
    setSplitByItem(next);
    if (next) {
      if (!splitPayments) setSplitPayments(true);
      if (!selectedPaymentKeys.length && availablePaymentMethods[0]?.key) {
        setSelectedPaymentKeys([availablePaymentMethods[0].key]);
      }
    } else {
      setItemSplitMap({});
    }
  };

  const handlePaymentMethodToggle = (key) => {
    if (!key) return;
    const totalDue = Number(totals.total || 0);
    const totalValue = Number.isFinite(totalDue) ? totalDue.toFixed(2) : "";
    const isSelected = selectedPaymentKeys.includes(key);

    if (splitByItem) {
      if (isSelected && selectedPaymentKeys.length === 1) return;
      setSelectedPaymentKeys((prev) => (isSelected ? prev.filter((k) => k !== key) : [...prev, key]));
      return;
    }

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

  const assignItemToMethod = (itemKey, methodKey) => {
    setItemSplitMap((prev) => {
      const next = { ...prev };
      if (!methodKey) {
        delete next[itemKey];
      } else {
        next[itemKey] = methodKey;
      }
      return next;
    });
    if (methodKey) {
      if (!splitPayments) setSplitPayments(true);
      setSelectedPaymentKeys((prev) => (prev.includes(methodKey) ? prev : [...prev, methodKey]));
    }
  };

  useEffect(() => {
    if (!splitByItem) return;
    const firstKey = selectedPaymentKeys[0] || availablePaymentMethods[0]?.key;
    if (!firstKey) return;
    setItemSplitMap((prev) => {
      const next = {};
      (currentOrder.items || []).forEach((item, idx) => {
        const key = getOrderItemKey(item, idx);
        const assigned = prev[key];
        if (assigned && selectedPaymentKeys.includes(assigned)) {
          next[key] = assigned;
        } else {
          next[key] = firstKey;
        }
      });
      return next;
    });
  }, [splitByItem, currentOrder.items, selectedPaymentKeys, availablePaymentMethods]);

  useEffect(() => {
    if (!splitByItem) return;
    setPaymentForm((prev) => {
      const next = { ...prev };
      availablePaymentMethods.forEach((method) => {
        const amount = itemSplitData.totals[method.key] || 0;
        next[method.key] = amount ? amount.toFixed(2) : "";
      });
      return next;
    });
  }, [splitByItem, itemSplitData, availablePaymentMethods]);

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
      const invoiceCfg = getInvoicePrintConfig();
      const text = buildPrintPreviewText({ title: "Factura", payload, totals: previewTotals });
      await printToAgent({
        printerNames: [invoiceCfg.printerId],
        text,
        copies: invoiceCfg.copies,
      });
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Factura impresa." } }));
      closePaymentsModal();
    } catch (err) {
      const msg = err?.message || err?.response?.data?.message || "No se pudo imprimir.";
      window.alert(msg);
    } finally {
      setPaymentPrintBusy(false);
    }
  };

  const confirmChargeOrder = async () => {
    if (!selectedTable?.id || !hasItems) return;
    try {
      await flushOrderSave();
      const snapshotItems = (currentOrder.items || []).map((i) => ({ ...i }));
      const snapshotTotals = { ...totals };
      const invoiceCfg = getInvoicePrintConfig();
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
      };
      const paidAmount = sumNumbers(paymentForm);
      const change = Math.max(0, paidAmount - (snapshotTotals.total || 0));
      await api.post("/restaurant/order/close", {
        tableId: selectedTable.id,
        sectionId: selectedSection?.id,
        restaurantOrderId: currentOrder?.id || currentOrder?.orderId || undefined,
        orderId: currentOrder?.id || currentOrder?.orderId || undefined,
        payments: paymentForm,
        totals,
        note: orderNote,
        covers: currentOrder.covers || covers,
        items: currentOrder.items,
        serviceType: currentOrder.serviceType || serviceType,
        roomId: currentOrder.roomId || roomCharge,
      });
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

  const closePrintConfirm = () => {
    if (printConfirmBusy) return;
    pendingPrintRef.current = null;
    setPrintConfirmOpen(false);
  };

  const openPrintConfirm = ({ title, payload, totals: previewTotals, onConfirm }) => {
    pendingPrintRef.current = onConfirm;
    setPrintConfirmTitle(title || "Confirmar impresión");
    setPrintConfirmText(buildPrintPreviewText({ title, payload, totals: previewTotals }));
    setPrintConfirmOpen(true);
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
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      {sectionsLoading && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl px-6 py-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full border-4 border-lime-200 border-t-lime-700 animate-spin" />
            <div className="text-sm font-semibold text-slate-700">Cargando secciones...</div>
          </div>
        </div>
      )}
      <header className="relative h-14 bg-gradient-to-r from-lime-700 to-slate-800 text-white flex items-center justify-between px-6 shadow">
        <div className="flex items-center gap-3">
          <button
            className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-semibold"
            onClick={() => navigate("/restaurant")}
            title="Back to lobby"
          >
            Lobby
          </button>
          <span className="text-lg font-semibold">Restaurant</span>
          <span className="text-sm text-lime-200">Welcome</span>
        </div>
          <div className="flex items-center gap-4 relative">
          <div className="hidden md:flex items-center gap-3 text-xs">
            <div className="px-3 py-1 rounded-lg bg-white/10 text-white">
              {now.toLocaleDateString()}  {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="px-3 py-1 rounded-lg bg-white/10 text-white">{shift}</div>
            <div className="flex items-center gap-1">
              <span className="px-2 py-1 rounded bg-white/10">{paymentsCfg.monedaBase} - {paymentsCfg.monedaSec}</span>
              <span className="px-2 py-1 rounded bg-white/10">TC {paymentsCfg.tipoCambio}</span>
            </div>
          </div>
          <button
            className="px-3 py-2 rounded-lg bg-lime-600 hover:bg-lime-500 text-sm font-semibold"
            onClick={() => {
              if (!guardSwitch()) return;
              setCloseOpen(true);
              setOpenInfo((prev) => ({ ...prev, openedAt: prev.openedAt || new Date().toISOString() }));
            }}
          >
            Cash status
          </button>
          <RestaurantUserMenu />
        </div>
      </header>

      {printConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-lime-900/30 backdrop-blur-[1px] flex items-start justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl p-4 space-y-3 overflow-hidden">
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
              <button className="px-4 py-2 rounded-lg border text-sm" disabled={printConfirmBusy} onClick={closePrintConfirm}>
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

      {closeOpen && (
        <div className="fixed inset-0 z-50 bg-lime-900/30 backdrop-blur-[1px] flex justify-end">
          <div className="w-full max-w-[360px] max-h-[40vh] min-h-[200px] bg-white rounded-l-2xl shadow-2xl p-3 flex flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-lime-500">Cash status</div>
                <div className="text-lg font-semibold text-lime-900">Restaurant cash</div>
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
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-3 space-y-3 overflow-y-auto max-h-[65vh]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-lime-500">Cash close</div>
                <div className="text-lg font-semibold text-lime-900">Restaurant cash</div>
              </div>
              <RestaurantCloseXButton onClick={() => setCloseModalOpen(false)} />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-lg border bg-gradient-to-r from-lime-50 to-slate-50 px-4 py-3 text-sm">
                <div className="text-xs text-lime-700">Reported (manual)</div>
                <div className="text-xl font-bold text-lime-900">{canViewTotals ? formatMoney(closeSummary.reported) : "***"}</div>
                <div className="text-xs text-lime-500">Sum of methods</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <input
                className="h-11 w-full rounded-lg border px-3 text-sm"
                placeholder="Cash"
                type="number"
                value={closeForm.cash}
                onChange={(e) => setCloseForm((f) => ({ ...f, cash: e.target.value }))}
              />
              <input
                className="h-11 w-full rounded-lg border px-3 text-sm"
                placeholder="Card"
                type="number"
                value={closeForm.card}
                onChange={(e) => setCloseForm((f) => ({ ...f, card: e.target.value }))}
              />
              <input
                className="h-11 w-full rounded-lg border px-3 text-sm"
                placeholder="SINPE"
                type="number"
                value={closeForm.sinpe}
                onChange={(e) => setCloseForm((f) => ({ ...f, sinpe: e.target.value }))}
              />
              <input
                className="h-11 w-full rounded-lg border px-3 text-sm"
                placeholder="Bank transfer"
                type="number"
                value={closeForm.transfer}
                onChange={(e) => setCloseForm((f) => ({ ...f, transfer: e.target.value }))}
              />
              <input
                className="h-11 w-full rounded-lg border px-3 text-sm"
                placeholder="Room charge"
                type="number"
                value={closeForm.room}
                onChange={(e) => setCloseForm((f) => ({ ...f, room: e.target.value }))}
              />
            </div>
            <textarea
              className="w-full rounded-lg border px-3 py-2 text-sm min-h-[90px]"
              placeholder="Close notes..."
              value={closeForm.notes}
              onChange={(e) => setCloseForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <div className="text-sm text-lime-700 bg-lime-50 border border-lime-100 rounded-lg px-3 py-2">
              System: {formatMoney(closeSummary.system)}  Reported: {formatMoney(closeSummary.reported)}  Difference: {formatMoney(closeSummary.diff)}
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border text-sm"
                onClick={() => setCloseModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-lime-700 text-white text-sm font-semibold"
                disabled={closeLoading}
                onClick={async () => {
                  if (!canViewTotals) {
                    window.alert("No tienes permisos para cerrar caja.");
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
                    });
                    setCloseModalOpen(false);
                    setCloseOpen(false);
                    setCloseForm({ cash: "", card: "", sinpe: "", transfer: "", room: "", notes: "" });
                    refreshStats();
                  } catch (e) {
                    window.alert("Could not record the cash close.");
                  } finally {
                    setCloseLoading(false);
                  }
                }}
              >
                {closeLoading ? "Sending..." : "Record close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentsModalOpen && (
        <div className="fixed inset-0 z-50 bg-lime-900/30 backdrop-blur-[1px] flex items-start justify-center p-4">
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-6 space-y-4 overflow-y-auto max-h-[85vh]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-emerald-600">Payment</div>
                <div className="text-lg font-semibold text-slate-900">{selectedTable?.name}</div>
              </div>
              <RestaurantCloseXButton onClick={closePaymentsModal} />
            </div>
            <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
              <div className="space-y-4">
                <div className="rounded-xl border bg-lime-50 px-4 py-4 text-sm">
                  <div className="text-xs text-slate-600">Total due</div>
                  <div className="text-2xl font-bold text-slate-900">{formatMoney(displayTotals.total)}</div>
                  <div className="text-xs text-slate-500">
                    Subtotal {formatMoney(displayTotals.subtotal)}  Service {formatMoney(displayTotals.service)}  Taxes {formatMoney(displayTotals.tax)}
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
                        <button
                          className={`h-8 px-3 rounded-full text-xs font-semibold border transition ${
                            splitByItem ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-700"
                          }`}
                          onClick={toggleSplitByItem}
                        >
                          Dividir por articulos
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

                    {splitByItem && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs uppercase text-slate-500">Dividir por articulos</div>
                          {itemSplitUnassigned > 0 && (
                            <div className="text-xs text-amber-700">Pendiente: {formatMoney(itemSplitUnassigned)}</div>
                          )}
                        </div>
                        <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                          {(currentOrder.items || []).map((item, idx) => {
                            const itemKey = getOrderItemKey(item, idx);
                            const qty = Number(item?.qty || 0);
                            const price = Number(item?.price || 0);
                            const lineTotal = qty * price;
                            return (
                              <div key={itemKey} className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-800 truncate">{item?.name || "Item"}</div>
                                  <div className="text-[11px] text-slate-500">
                                    {qty} x {formatMoney(price)} = {formatMoney(lineTotal)}
                                  </div>
                                </div>
                                <select
                                  className="h-9 rounded-lg border px-2 text-xs bg-white"
                                  value={itemSplitMap[itemKey] || ""}
                                  onChange={(e) => assignItemToMethod(itemKey, e.target.value)}
                                >
                                  <option value="">Sin asignar</option>
                                  {availablePaymentMethods.map((m) => (
                                    <option key={m.key} value={m.key}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Los montos se calculan automaticamente segun los articulos asignados.
                        </div>
                      </div>
                    )}

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
                              className={`h-11 w-full rounded-lg border px-3 text-sm ${splitByItem ? "bg-slate-50 text-slate-500" : ""}`}
                              placeholder="0.00"
                              type="number"
                              min="0"
                              step="0.01"
                              value={paymentForm[method.key] ?? ""}
                              onChange={(e) => updatePaymentAmount(method.key, e.target.value)}
                              readOnly={splitByItem}
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
                    className="px-4 py-2 rounded-lg border text-sm"
                    onClick={closePaymentsModal}
                    disabled={paymentPrintBusy}
                  >
                    Cerrar sin imprimir
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:bg-emerald-300"
                    onClick={printPaidInvoice}
                    disabled={paymentPrintBusy}
                  >
                    {paymentPrintBusy ? "Imprimiendo..." : "Imprimir"}
                  </button>
                </>
              ) : (
                <>
                  <button className="px-4 py-2 rounded-lg border text-sm" onClick={closePaymentsModal}>
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:bg-emerald-300"
                    disabled={!hasItems || selectedPaymentKeys.length === 0}
                    onClick={confirmChargeOrder}
                  >
                    Confirm payment
                  </button>
                </>
              )}
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
                <div className="text-lg font-semibold text-lime-900">{tablePickerMode === "MOVE" ? "Select destination table" : "Select table"}</div>
              </div>
              <RestaurantCloseXButton onClick={() => setTablePickerOpen(false)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto">
              {allTables.map((t, idx) => {
                const hasOrder = Boolean(tableOrderSummary[t.id]?.hasItems);
                const orderCount = tableOrderSummary[t.id]?.count || 0;
                const pickerKey = String(`${t.section?.id || "sec"}-${t.id || t.name || idx}`);
                return (
                  <button
                    key={pickerKey}
                    className={`rounded-2xl border ${hasOrder ? "border-emerald-200 bg-emerald-50" : "border-lime-100 bg-lime-50"} hover:bg-lime-100 text-left px-4 py-3 shadow-sm`}
                    onClick={() => (tablePickerMode === "MOVE" ? moveToTable(t) : handleSelectTable(t, t.section))}
                  >
                    <div className="text-xs text-lime-500">{t.section?.name || "Section"}</div>
                    <div className="text-lg font-semibold text-lime-900">{t.name}</div>
                    <div className="text-xs text-lime-700/80">{t.seats} seats</div>
                    {hasOrder && (
                      <div className="text-[11px] text-emerald-700 mt-1">
                        {orderCount > 1 ? `${orderCount} ordenes` : "Orden activa"}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

       <div className="flex flex-1">
         <div className="flex-1 flex flex-col">
            <header className="px-4 py-3 bg-white border-b flex items-center gap-3 shadow-sm">
              <div className="flex items-center justify-between w-full">
                 <div className="flex items-center gap-3">
                  <div className="text-lg font-semibold text-lime-900">
                   {selectedTable
                     ? `${selectedSection?.name || ""}${selectedSection ? " - " : ""}${selectedTable?.name}`
                     : sectionLauncher
                       ? "Elige una seccion"
                       : selectedSection
                         ? selectedSection.name
                         : "Elige una seccion"}
                  </div>
                  {selectedTable?.id && (
                    <>
                      <button
                        className="px-3 py-2 rounded-lg bg-lime-700 hover:bg-lime-600 text-sm font-semibold"
                        onClick={openNewOrderPicker}
                      >
                        New order
                      </button>
                      <button
                        className="px-3 py-2 rounded-lg bg-lime-100 hover:bg-lime-200 text-sm font-semibold text-lime-900 disabled:opacity-50"
                        onClick={openMoveTablePicker}
                        disabled={!hasItems}
                      >
                        Change table
                      </button>
                      <button
                        className="px-3 py-2 rounded-lg bg-white border hover:bg-lime-50 text-sm font-semibold disabled:opacity-50"
                        onClick={cancelCurrentOrder}
                        disabled={!hasItems}
                        title="Cancel open order (Admin only)"
                      >
                        Cancel order
                      </button>
                      <button
                        className="px-3 py-2 rounded-lg bg-white border hover:bg-lime-50 text-sm font-semibold disabled:opacity-50"
                        onClick={reprintCurrent}
                        disabled={String(currentOrder?.status || "").toUpperCase() !== "PAID"}
                        title="Reprint paid invoice/document"
                      >
                        Reprint invoice
                      </button>
                      <button
                        className="px-3 py-2 rounded-lg bg-white border hover:bg-lime-50 text-sm font-semibold disabled:opacity-50"
                        onClick={voidInvoice}
                        disabled={String(currentOrder?.status || "").toUpperCase() !== "PAID"}
                      >
                        Void invoice
                      </button>
                    </>
                  )}
                </div>
               {selectedTable?.id ? (
                  <button
                    className="h-11 px-4 rounded-xl bg-lime-100 text-lime-800 text-sm font-semibold hover:bg-lime-200"
                    onClick={backToSection}
                    title="Back to section"
                  >
                    Back
                  </button>
               ) : (!sectionLauncher && (
                  <button
                    className="h-11 px-4 rounded-xl bg-lime-100 text-lime-800 text-sm font-semibold hover:bg-lime-200"
                    onClick={() => {
                      if (!guardSwitch()) return;
                      resetToLobby();
                    }}
                   >
                     Back
                   </button>
                 ))}
              </div>
            </header>

          {sectionLauncher || !selectedTable ? (
            <div key={sectionLauncher ? "restaurant-launcher" : `restaurant-section-${String(selectedSection?.id || "none")}`} className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-y-auto">
              {sectionLauncher ? (
                <div className="col-span-3">
                  {sectionsLoading && <div className="text-sm text-lime-700">Loading sections...</div>}
                  {!sectionsLoading && sectionsError && <div className="text-sm text-lime-700">{sectionsError}</div>}
                  {!sectionsLoading && !sectionsError && (sections || []).length === 0 && (
                    <div className="rounded-2xl border border-lime-200 bg-lime-50 p-4">
                      <div className="text-sm font-semibold text-lime-900">No sections configured</div>
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
                            setSelectedSection(sec);
                            setSelectedTable(null);
                            setSectionLauncher(false);
                          }}
                        >
                          <div className="text-xs uppercase text-lime-500">Section</div>
                          <div className="text-lg font-semibold text-lime-900 leading-tight line-clamp-2">{sec.name || sec.id}</div>
                          <div className="text-xs text-lime-700/90 mt-1">{(sec.tables || []).length} tables</div>
                          <div className="text-[11px] text-lime-700/80 mt-1">
                            Menu: <span className="font-semibold">{sec?.activeMenu?.name || "-"}</span>
                          </div>
                          <div className="mt-auto text-[11px] text-lime-500">Tap to view tables</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="col-span-3">
                  {selectedSection ? (
                    <div className="space-y-2">
                      <div className="text-xs text-lime-700">
                        Floor plan of <span className="font-semibold">{selectedSection.name}</span>. Tap a table to open it.
                      </div>
                      <div className="text-[11px] text-lime-700/80">
                        Active menu: <span className="font-semibold">{selectedSection?.activeMenu?.name || "-"}</span>
                      </div>
                      <div className="relative w-full h-72 md:h-80 rounded-2xl border border-lime-200 bg-lime-50/60 overflow-hidden">
                        <div className="absolute inset-x-3 top-2 flex justify-between text-[11px] text-lime-600">
                          <span>Entrance</span>
                          <span>Bar / Kitchen</span>
                        </div>
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
                                const hasCustom = Boolean(iconDataUrl || iconUrl);
                                return (
                                  <>
                                    {String(o.kind || "").toUpperCase() !== "LABEL" && (
                                      <span
                                        className="inline-flex items-center justify-center h-6 w-6 rounded-lg overflow-hidden border border-white/40"
                                        style={{ backgroundColor: o.color || getFloorObjectMeta(o.kind).bg }}
                                        title={label}
                                      >
                                        {hasCustom ? (
                                          <img alt="" src={iconDataUrl || iconUrl} className="h-full w-full object-contain bg-white/80" />
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
                              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 select-none group"
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
                                  {hasOrder && occupiedIconOk ? (
                                        <img
                                          alt="Occupied table"
                                          src={OCCUPIED_TABLE_ICON_URL}
                                          className="w-full h-full object-contain"
                                          onError={() => setOccupiedIconOk(false)}
                                        />
                                      ) : !hasOrder && String(t.kind || "mesa").toLowerCase() === "camastro" && camastroIconOk ? (
                                        <img
                                          alt="Camastro"
                                          src={CAMASTRO_FREE_ICON_URL}
                                          className="w-full h-full object-contain"
                                          onError={() => setCamastroIconOk(false)}
                                        />
                                      ) : (
                                        (() => {
                                          const Icon = hasOrder ? Occupied : Free;
                                          return <Icon className="w-full h-full" />;
                                        })()
                                      )}
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
                            </button>
                          );
                        })}
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
                {/* Barra superior: familias + búsqueda */}
                <div className="col-span-3 self-start w-full flex flex-col md:flex-row md:items-center md:space-x-4 gap-2 bg-gradient-to-r from-lime-50 via-emerald-50 to-lime-100 border border-lime-100 rounded-2xl shadow-sm px-4 py-2">
                  <div className="flex-1 flex flex-nowrap items-center gap-2 overflow-x-auto min-w-0">
                    <button
                      className={`h-9 px-3 rounded-lg border text-sm font-semibold ${
                        !category ? "bg-lime-600 border-lime-600 text-white" : "bg-white border-lime-200 text-lime-700"
                      }`}
                      onClick={() => {
                        setCategory("");
                        setSubCategory("");
                      }}
                    >
                      Todas
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
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto md:shrink-0 md:basis-72">
                    <input
                      className="h-10 w-full md:w-[260px] rounded-lg border border-lime-200 px-3 text-sm"
                      placeholder="Buscar artículo..."
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

                <div className="col-span-2 flex flex-col xl:flex-row gap-4">
                  <div className="flex gap-3 items-start">
                    {category && subCategories.length > 0 && (
                      <div className="w-40 shrink-0 rounded-2xl border border-lime-100 bg-lime-50/60 p-3 space-y-2">
                        <div className="text-[11px] uppercase text-lime-600">Subfamilias</div>
                        <button
                          className={`w-full h-9 rounded-lg border text-sm font-semibold ${
                            !subCategory ? "bg-lime-600 border-lime-600 text-white" : "bg-white border-lime-200 text-lime-700"
                          }`}
                          onClick={() => {
                            setSubCategory("");
                            setSubSubCategory("");
                          }}
                        >
                          Todas
                        </button>
                        {subCategories.map((sub) => (
                          <button
                            key={String(sub)}
                            className={`w-full text-left h-9 px-3 rounded-lg border text-sm font-semibold ${
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
                    )}

                    {subCategory && subSubCategories.length > 0 && (
                      <div className="w-40 shrink-0 rounded-2xl border border-lime-100 bg-lime-50/60 p-3 space-y-2">
                        <div className="text-[11px] uppercase text-lime-600">Sub-subfamilias</div>
                        <button
                          className={`w-full h-9 rounded-lg border text-sm font-semibold ${
                            !subSubCategory ? "bg-lime-100 border-lime-300 text-lime-900" : "bg-white border-lime-200 text-lime-700"
                          }`}
                          onClick={() => setSubSubCategory("")}
                        >
                          Todas
                        </button>
                        {subSubCategories.map((sub2) => (
                          <button
                            key={String(sub2)}
                            className={`w-full text-left h-9 px-3 rounded-lg border text-sm font-semibold ${
                              subSubCategory === sub2 ? "bg-lime-600 border-lime-600 text-white" : "bg-white border-lime-200 text-lime-700"
                            }`}
                            onClick={() => setSubSubCategory(sub2)}
                          >
                            {sub2}
                          </button>
                        ))}
                      </div>
                    )}

                    {menuGrid}
                  </div>
                </div>

                <div className="bg-white border border-lime-100 rounded-2xl shadow p-4 flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 overflow-x-auto">
                      {orderTabs.map((tab) => {
                        const active = tab.key === activeOrderKey;
                        return (
                          <button
                            key={tab.key}
                            className={`h-8 px-3 rounded-full border text-xs font-semibold whitespace-nowrap ${
                              active ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-700"
                            }`}
                            onClick={() => selectOrderForTable(selectedTable?.id, tab.key)}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      className="h-8 px-3 rounded-full bg-slate-900 text-white text-xs font-semibold"
                      onClick={() => createNewOrderForTable(selectedTable?.id)}
                    >
                      Nueva orden
                    </button>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs uppercase text-lime-500">Order</div>
                      <div className="text-lg font-semibold text-lime-900">
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
                        className="h-9 px-3 rounded-lg bg-white border border-lime-300 text-sm font-semibold text-lime-800 hover:bg-lime-50"
                        onClick={() => alert("Selecciona un cliente desde el listado de clientes.")}
                      >
                        Cliente
                      
                      </button>
                    </div>
                  </div>

                  <textarea
                    className="w-full rounded-lg border border-lime-100 px-3 py-2 text-sm min-h-[70px]"
                    placeholder="Notas para cocina"
                    value={orderNote}
                    onChange={(e) => handleNoteChange(e.target.value)}
                  />

                  <div className="mt-3 space-y-2">
                    <div className="text-xs uppercase text-lime-500">Tipo de servicio</div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "DINE_IN", label: "Comer aqui" },
                        { id: "TAKEOUT", label: "Takeout" },
                        { id: "DELIVERY", label: "Delivery" },
                        { id: "ROOM", label: "Room charge" },
                      ].map((opt) => (
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

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-2">
                    {(currentOrder.items || []).length === 0 && (
                      <div className="text-sm text-lime-600 bg-lime-50 border border-dashed border-lime-200 rounded-xl p-3">
                        Agrega productos con un tap.
                      </div>
                    )}
                    {(currentOrder.items || []).map((item, idx) => (
                      <div key={String(item.id || item.code || `${item.name}-${idx}`)} className="border border-lime-100 rounded-xl p-3">
                        <div className="flex justify-between items-center gap-2">
                          <div>
                            <div className="font-semibold text-lime-900">{item.name}</div>
                            <div className="text-xs text-lime-600">{formatMoney(item.price)} c/u</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="h-8 w-8 rounded-lg bg-lime-50 text-lg"
                              onClick={() => updateQty(item.id, -1)}
                            >
                              -
                            </button>
                            <div className="w-8 text-center font-semibold">{item.qty}</div>
                            <button
                              className="h-8 w-8 rounded-lg bg-purple-800 text-white text-lg"
                              onClick={() => updateQty(item.id, 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-sm">
                          <div className="text-lime-700">{formatMoney(item.price * item.qty)}</div>
                          <div className="flex items-center gap-2">
                            {orderTabs.length > 1 && (
                              <select
                                className="h-7 rounded border border-slate-200 bg-white px-2 text-[11px]"
                                defaultValue=""
                                onChange={(e) => {
                                  const target = e.target.value;
                                  if (target) moveItemToOrder(item, target);
                                  e.currentTarget.value = "";
                                }}
                              >
                                <option value="">Mover a...</option>
                                {orderTabs
                                  .filter((tab) => tab.key !== activeOrderKey)
                                  .map((tab) => (
                                    <option key={tab.key} value={tab.key}>
                                      {tab.label}
                                    </option>
                                  ))}
                                <option value="__new__">Nueva orden</option>
                              </select>
                            )}
                            <button
                              className="text-xs text-red-600 hover:underline"
                              onClick={() => removeItem(item.id)}
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
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
                    <div className="flex justify-between font-semibold text-lg mt-1">
                      <span>Total</span>
                      <span>{formatMoney(totals.total)}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-600">
                    <div>Tax included in prices: {taxesCfg.impuestoIncluido ? "Yes" : "No"}</div>
                    <div>
                      Discounts: {taxesCfg.permitirDescuentos ? "Enabled" : "Disabled"} • Max {taxesCfg.descuentoMax ?? 0}%
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      className="h-12 rounded-xl bg-lime-50 text-lime-700 font-semibold disabled:opacity-60"
                      onClick={sendToKitchen}
                      disabled={!hasItems}
                    >
                      Comanda
                    </button>
                    <button
                      className="h-12 rounded-xl bg-white border text-lime-800 font-semibold hover:bg-lime-50 disabled:opacity-60"
                      onClick={reprintComanda}
                      disabled={!hasItems}
                      title="Reprint comanda without re-sending to kitchen/KDS"
                    >
                      Reprint comanda
                    </button>
                    <button
                      className="h-12 rounded-xl bg-emerald-600 text-white font-semibold disabled:bg-emerald-300"
                      onClick={openPayments}
                      disabled={!hasItems}
                    >
                      Cobrar
                    </button>
                  </div>
                </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
}
