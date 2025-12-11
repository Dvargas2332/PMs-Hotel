import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CircleUser, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

const FALLBACK_SECTIONS = [
  {
    id: "sec-salon",
    name: "Salon Principal",
    tables: [
      { id: "S01", name: "Salon 1", seats: 4 },
      { id: "S02", name: "Salon 2", seats: 2 },
      { id: "S03", name: "Salon 3", seats: 4 },
    ],
  },
  {
    id: "sec-terraza",
    name: "Terraza",
    tables: [
      { id: "T01", name: "Terraza 1", seats: 4 },
      { id: "T02", name: "Terraza 2", seats: 6 },
    ],
  },
  {
    id: "sec-barra",
    name: "Barra",
    tables: [
      { id: "B01", name: "Barra 1", seats: 2 },
      { id: "B02", name: "Barra 2", seats: 2 },
    ],
  },
];

const FALLBACK_MENU = [
  { id: "E01", name: "Nachos", price: 8, category: "Entradas" },
  { id: "E02", name: "Ceviche", price: 9, category: "Entradas" },
  { id: "E03", name: "Alitas BBQ", price: 7.5, category: "Entradas" },
  { id: "P01", name: "Hamburguesa", price: 11, category: "Platos" },
  { id: "P02", name: "Pasta Alfredo", price: 12, category: "Platos" },
  { id: "P03", name: "Pollo a la plancha", price: 10, category: "Platos" },
  { id: "P04", name: "Taco trio", price: 9, category: "Platos" },
  { id: "B01", name: "Refresco", price: 3, category: "Bebidas" },
  { id: "B02", name: "Cerveza", price: 4, category: "Bebidas" },
  { id: "B03", name: "Limonada", price: 3.5, category: "Bebidas" },
  { id: "D01", name: "Brownie", price: 5, category: "Postres" },
  { id: "D02", name: "Helado", price: 4, category: "Postres" },
  { id: "C01", name: "Combo Burger + Refresco", price: 13.5, category: "Combos" },
  { id: "C02", name: "Alitas + Cerveza", price: 11, category: "Combos" },
];

function formatMoney(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

const sumNumbers = (obj = {}) => Object.values(obj).reduce((acc, v) => acc + (Number(v) || 0), 0);

export default function RestaurantPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [userMenu, setUserMenu] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [sectionLauncher, setSectionLauncher] = useState(true);

  const [covers, setCovers] = useState(2);
  const [orderNote, setOrderNote] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sections, setSections] = useState([]);
  const [menuItems, setMenuItems] = useState(FALLBACK_MENU);
  const [ordersByTable, setOrdersByTable] = useState({});
  const [now, setNow] = useState(new Date());
  const [printerCfg, setPrinterCfg] = useState({ kitchenPrinter: "", barPrinter: "" });

  const [closeOpen, setCloseOpen] = useState(false);
  const [closeForm, setCloseForm] = useState({ cash: "", card: "", sinpe: "", transfer: "", room: "", notes: "" });
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);

  const [closesOpen, setClosesOpen] = useState(false);
  const [closesLoading, setClosesLoading] = useState(false);
  const [closes, setCloses] = useState([]);
  const [closesError, setClosesError] = useState("");

  const [openInfo, setOpenInfo] = useState(() => ({ openedAt: new Date().toISOString(), user: "Cajero" }));
  const [taxesCfg, setTaxesCfg] = useState({ iva: 13, servicio: 10 });
  const [paymentsCfg, setPaymentsCfg] = useState({ monedaBase: "CRC", monedaSec: "USD", tipoCambio: 530, cobros: [] });
  const [stats, setStats] = useState({ systemTotal: 0, openOrders: 0, salesCount: 0, openOrderValue: 0, lastCloseAt: null, byMethod: {} });

  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ cash: "", card: "", sinpe: "", transfer: "", room: "" });
  const [serviceType, setServiceType] = useState("DINE_IN"); // DINE_IN, TAKEOUT, DELIVERY, ROOM
  const [roomCharge, setRoomCharge] = useState("");

  const role = useMemo(() => (user?.role || "").toUpperCase(), [user?.role]);
  const canViewTotals = useMemo(() => role === "ADMIN" || role === "MANAGER", [role]);

  const allTables = useMemo(() => {
    const list = [];
    (sections.length ? sections : FALLBACK_SECTIONS).forEach((sec) => {
      (sec.tables || []).forEach((t) => list.push({ ...t, section: sec }));
    });
    return list;
  }, [sections]);

  const categories = useMemo(() => {
    const set = new Set((menuItems || []).map((m) => m.category).filter(Boolean));
    const list = Array.from(set);
    return list.length ? list : ["Entradas", "Platos", "Bebidas", "Postres", "Combos"];
  }, [menuItems]);

  const filteredMenu = useMemo(() => {
    return (menuItems || []).filter((m) => {
      const inCat = !category || m.category === category;
      const matches = !search || m.name.toLowerCase().includes(search.toLowerCase());
      return inCat && matches;
    });
  }, [category, search, menuItems]);

  const shift = useMemo(() => {
    const h = now.getHours();
    if (h < 15) return "Turno Manana";
    if (h < 22) return "Turno Tarde";
    return "Turno Noche";
  }, [now]);

  const currentOrder = useMemo(() => {
    if (!selectedTable?.id) return { items: [], covers, note: orderNote, status: "NUEVA", serviceType, roomId: roomCharge };
    const stored = ordersByTable[selectedTable.id];
    return {
      items: stored?.items || [],
      covers: stored?.covers || covers,
      note: orderNote || stored?.note || "",
      status: stored?.status || "NUEVA",
      updatedAt: stored?.updatedAt,
      serviceType: stored?.serviceType || serviceType,
      roomId: stored?.roomId || roomCharge,
    };
  }, [ordersByTable, selectedTable?.id, covers, orderNote, serviceType, roomCharge]);

  const totals = useMemo(() => {
    const serviceRate = Number(taxesCfg.servicio || 0) / 100;
    const taxRate = Number(taxesCfg.iva || 0) / 100;
    const subtotal = (currentOrder.items || []).reduce((acc, i) => acc + i.price * i.qty, 0);
    const service = subtotal * serviceRate;
    const tax = subtotal * taxRate;
    const total = subtotal + service + tax;
    return { subtotal, service, tax, total };
  }, [currentOrder.items, taxesCfg.iva, taxesCfg.servicio]);

  const systemTotal = useMemo(() => {
    if (typeof stats.systemTotal === "number") return stats.systemTotal || 0;
    return Object.values(ordersByTable).reduce(
      (acc, o) => acc + (o.items || []).reduce((s, i) => s + i.price * i.qty, 0),
      0
    );
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
  const hasItems = useMemo(() => (currentOrder.items || []).length > 0, [currentOrder.items]);
  const hasOpenOrders = useMemo(
    () => Object.values(ordersByTable).some((o) => (o.items || []).length > 0),
    [ordersByTable]
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

  const loadSections = useCallback(async () => {
    try {
      const { data } = await api.get("/restaurant/sections");
      if (Array.isArray(data) && data.length > 0) {
        setSections(data);
        return;
      }
    } catch {
      /* ignore */
    }
    setSections(FALLBACK_SECTIONS);
  }, []);

  const loadPrinters = useCallback(async () => {
    try {
      const { data } = await api.get("/restaurant/config");
      setPrinterCfg({ kitchenPrinter: data?.kitchenPrinter || "", barPrinter: data?.barPrinter || "" });
    } catch {
      setPrinterCfg({ kitchenPrinter: "", barPrinter: "" });
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get("/restaurant/taxes");
      if (data && typeof data === "object") setTaxesCfg({ iva: data.iva ?? 13, servicio: data.servicio ?? 10 });
    } catch {
      setTaxesCfg({ iva: 13, servicio: 10 });
    }
    try {
      const { data } = await api.get("/restaurant/payments");
      if (data && typeof data === "object") {
        setPaymentsCfg({
          monedaBase: data.monedaBase || "CRC",
          monedaSec: data.monedaSec || "USD",
          tipoCambio: Number(data.tipoCambio || 0) || 530,
          cobros: Array.isArray(data.cobros) ? data.cobros : [],
        });
      }
    } catch {
      setPaymentsCfg({ monedaBase: "CRC", monedaSec: "USD", tipoCambio: 530, cobros: [] });
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    try {
      const { data } = await api.get("/restaurant/orders");
      if (Array.isArray(data)) {
        const map = {};
        data.forEach((o) => {
          if (!o?.tableId) return;
          map[o.tableId] = {
            ...o,
            items: Array.isArray(o.items) ? o.items : [],
            covers: o.covers || 2,
            note: o.note || "",
            status: o.status || "ENVIADO",
            serviceType: o.serviceType || "DINE_IN",
            roomId: o.roomId || "",
          };
        });
        setOrdersByTable(map);
        if (selectedTable?.id && map[selectedTable.id]) {
          setCovers(map[selectedTable.id].covers || covers);
          setOrderNote(map[selectedTable.id].note || "");
          setServiceType(map[selectedTable.id].serviceType || "DINE_IN");
          setRoomCharge(map[selectedTable.id].roomId || "");
        }
      }
    } catch {
      /* ignore */
    }
  }, [selectedTable?.id, covers]);

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
    refreshOrders();
    refreshStats();
  }, [loadSections, loadPrinters, loadSettings, refreshOrders, refreshStats]);

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
      setMenuItems(FALLBACK_MENU);
      setCategory(FALLBACK_MENU[0]?.category || "");
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
    const prev = ordersByTable[table.id];
    setCovers(prev?.covers || table?.seats || 2);
    setOrderNote(prev?.note || "");
    setServiceType(prev?.serviceType || "DINE_IN");
    setRoomCharge(prev?.roomId || "");
    loadMenu(section?.id);
    setSectionLauncher(false);
    setTablePickerOpen(false);
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

  const updateOrderForTable = (tableId, updater) => {
    setOrdersByTable((prev) => {
      const cur = prev[tableId] || { items: [], covers, note: orderNote, status: "NUEVA", serviceType, roomId: roomCharge };
      const next = updater(cur);
      return { ...prev, [tableId]: { ...next, serviceType, roomId: roomCharge } };
    });
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

  const sendToKitchen = async () => {
    if (!selectedTable?.id || !hasItems) return;
    const payload = {
      sectionId: selectedSection?.id,
      tableId: selectedTable?.id,
      items: currentOrder.items || [],
      note: orderNote || "",
      covers: currentOrder.covers || covers,
      printers: printerCfg,
      status: "ENVIADO",
      serviceType: currentOrder.serviceType || serviceType,
      roomId: currentOrder.roomId || roomCharge,
    };
    try {
      await api.post("/restaurant/order", payload);
      await api.post("/restaurant/print", payload);
      updateOrderForTable(selectedTable.id, (cur) => ({ ...cur, status: "ENVIADO", updatedAt: new Date().toISOString() }));
      refreshStats();
      window.alert("Pedido enviado a cocina.");
    } catch {
      window.alert("No se pudo enviar a impresoras.");
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
    setPaymentForm({ cash: "", card: "", sinpe: "", transfer: "", room: activeService === "ROOM" ? roomTarget : "" });
    setPaymentsModalOpen(true);
  };

  const confirmChargeOrder = async () => {
    if (!selectedTable?.id || !hasItems) return;
    try {
      await api.post("/restaurant/order/close", {
        tableId: selectedTable.id,
        sectionId: selectedSection?.id,
        payments: paymentForm,
        totals,
        note: orderNote,
        covers: currentOrder.covers || covers,
        items: currentOrder.items,
        serviceType: currentOrder.serviceType || serviceType,
        roomId: currentOrder.roomId || roomCharge,
      });
      setOrdersByTable((prev) => {
        const next = { ...prev };
        delete next[selectedTable.id];
        return next;
      });
      setPaymentsModalOpen(false);
      setOrderNote("");
      setPaymentForm({ cash: "", card: "", sinpe: "", transfer: "", room: "" });
      refreshStats();
      window.alert("Orden cobrada.");
    } catch {
      window.alert("No se pudo cobrar la orden.");
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

  const openCloses = async () => {
    if (!canViewTotals) return;
    setClosesOpen(true);
    setClosesLoading(true);
    setClosesError("");
    try {
      const { data } = await api.get("/restaurant/close");
      setCloses(Array.isArray(data) ? data : []);
    } catch (e) {
      setClosesError("No se pudieron cargar los cierres");
    } finally {
      setClosesLoading(false);
    }
  };
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <header className="relative h-14 bg-gradient-to-r from-amber-700 to-slate-800 text-white flex items-center justify-between px-6 shadow">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold">Restaurante</span>
          <span className="text-sm text-amber-200">Bienvenido</span>
        </div>
        <div className="flex items-center gap-4 relative">
          <div className="hidden md:flex items-center gap-3 text-xs">
            <div className="px-3 py-1 rounded-lg bg-white/10 text-white">
              {now.toLocaleDateString()}  {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="px-3 py-1 rounded-lg bg-white/10 text-white">{shift}</div>
            <div className="flex items-center gap-1">
              <span className="px-2 py-1 rounded bg-white/10">{paymentsCfg.monedaBase} -> {paymentsCfg.monedaSec}</span>
              <span className="px-2 py-1 rounded bg-white/10">TC {paymentsCfg.tipoCambio}</span>
            </div>
          </div>
          <button
            className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-semibold"
            onClick={() => {
              if (!guardSwitch()) return;
              setCloseOpen(true);
              setOpenInfo((prev) => ({ ...prev, openedAt: prev.openedAt || new Date().toISOString() }));
            }}
          >
            Estado de caja
          </button>
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-semibold"
            onClick={() => setUserMenu((s) => !s)}
          >
            <CircleUser className="w-5 h-5" />
            <span className="hidden sm:inline">{user?.name || user?.email || "Cajero"}</span>
          </button>
          {userMenu && (
            <div className="absolute right-0 top-12 w-48 bg-white text-amber-900 rounded-lg shadow-lg border">
              <div className="px-3 py-2 text-sm border-b">
                <div className="font-semibold">{user?.name || "Usuario"}</div>
                <div className="text-xs text-amber-700/80">{user?.email}</div>
              </div>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-amber-50"
                onClick={() => {
                  setUserMenu(false);
                  navigate("/launcher");
                }}
              >
                <LogOut className="w-4 h-4" />
                <span>Salir</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {closeOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="w-full max-w-[360px] max-h-[40vh] min-h-[200px] bg-white rounded-l-2xl shadow-2xl p-3 flex flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-amber-500">Estado de caja</div>
                <div className="text-lg font-semibold text-amber-900">Caja Restaurante</div>
                <div className="text-xs text-amber-700">
                  Apertura: {new Date(openInfo.openedAt).toLocaleString()}  {openInfo.user}
                </div>
              </div>
              <button
                className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 text-lg leading-none flex items-center justify-center hover:bg-amber-200"
                onClick={() => setCloseOpen(false)}
                aria-label="Cerrar"
              >
                X
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-lg border bg-gradient-to-r from-amber-50 to-slate-50 px-4 py-3 text-sm">
                <div className="text-xs text-amber-700">Ventas sistema</div>
                <div className="text-xl font-bold text-amber-900">{canViewTotals ? formatMoney(closeSummary.system) : "***"}</div>
                <div className="text-xs text-amber-500">Total vendido (ventas cobradas)</div>
              </div>
              <div className="rounded-lg border bg-gradient-to-r from-amber-50 to-slate-50 px-4 py-3 text-sm">
                <div className="text-xs text-amber-700">Ordenes abiertas</div>
                <div className="text-xl font-bold text-amber-900">{stats.openOrders}</div>
                <div className="text-xs text-amber-500">Valor estimado {formatMoney(stats.openOrderValue || 0)}</div>
              </div>
              <button
                className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-semibold"
                onClick={() => {
                  if (!canViewTotals) {
                    window.alert("No tienes permisos para cerrar caja. Solicita a un administrador.");
                    return;
                  }
                  setCloseModalOpen(true);
                }}
              >
                Ir a cierre
              </button>
            </div>
          </div>
        </div>
      )}

      {closeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-3 space-y-3 overflow-y-auto max-h-[65vh]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-amber-500">Cierre de caja</div>
                <div className="text-lg font-semibold text-amber-900">Caja Restaurante</div>
              </div>
              <button
                className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 text-lg leading-none flex items-center justify-center hover:bg-amber-200"
                onClick={() => setCloseModalOpen(false)}
                aria-label="Cerrar"
              >
                X
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-lg border bg-gradient-to-r from-amber-50 to-slate-50 px-4 py-3 text-sm">
                <div className="text-xs text-amber-700">Reportado (manual)</div>
                <div className="text-xl font-bold text-amber-900">{canViewTotals ? formatMoney(closeSummary.reported) : "***"}</div>
                <div className="text-xs text-amber-500">Suma de metodos</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <input
                className="h-11 w-full rounded-lg border px-3 text-sm"
                placeholder="Efectivo"
                type="number"
                value={closeForm.cash}
                onChange={(e) => setCloseForm((f) => ({ ...f, cash: e.target.value }))}
              />
              <input
                className="h-11 w-full rounded-lg border px-3 text-sm"
                placeholder="Tarjeta"
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
                placeholder="Transferencia"
                type="number"
                value={closeForm.transfer}
                onChange={(e) => setCloseForm((f) => ({ ...f, transfer: e.target.value }))}
              />
              <input
                className="h-11 w-full rounded-lg border px-3 text-sm"
                placeholder="Cargo a habitacion"
                type="number"
                value={closeForm.room}
                onChange={(e) => setCloseForm((f) => ({ ...f, room: e.target.value }))}
              />
            </div>
            <textarea
              className="w-full rounded-lg border px-3 py-2 text-sm min-h-[90px]"
              placeholder="Notas del cierre..."
              value={closeForm.notes}
              onChange={(e) => setCloseForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Sistema: {formatMoney(closeSummary.system)}  Reportado: {formatMoney(closeSummary.reported)}  Diferencia: {formatMoney(closeSummary.diff)}
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border text-sm"
                onClick={() => setCloseModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-semibold"
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
                    window.alert("No se pudo registrar el cierre.");
                  } finally {
                    setCloseLoading(false);
                  }
                }}
              >
                {closeLoading ? "Enviando..." : "Registrar cierre"}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-4 space-y-3 overflow-y-auto max-h-[70vh]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-emerald-600">Cobro</div>
                <div className="text-lg font-semibold text-slate-900">{selectedTable?.name}</div>
              </div>
              <button
                className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 text-lg leading-none flex items-center justify-center hover:bg-amber-200"
                onClick={() => setPaymentsModalOpen(false)}
                aria-label="Cerrar"
              >
                X
              </button>
            </div>
            <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm">
              <div className="text-xs text-slate-600">Total a cobrar</div>
              <div className="text-2xl font-bold text-slate-900">{formatMoney(totals.total)}</div>
              <div className="text-xs text-slate-500">Subtotal {formatMoney(totals.subtotal)}  Servicio {formatMoney(totals.service)}  Impuestos {formatMoney(totals.tax)}</div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <input className="h-11 w-full rounded-lg border px-3 text-sm" placeholder="Efectivo" type="number" value={paymentForm.cash} onChange={(e) => setPaymentForm((f) => ({ ...f, cash: e.target.value }))} />
              <input className="h-11 w-full rounded-lg border px-3 text-sm" placeholder="Tarjeta" type="number" value={paymentForm.card} onChange={(e) => setPaymentForm((f) => ({ ...f, card: e.target.value }))} />
              <input className="h-11 w-full rounded-lg border px-3 text-sm" placeholder="SINPE" type="number" value={paymentForm.sinpe} onChange={(e) => setPaymentForm((f) => ({ ...f, sinpe: e.target.value }))} />
              <input className="h-11 w-full rounded-lg border px-3 text-sm" placeholder="Transferencia" type="number" value={paymentForm.transfer} onChange={(e) => setPaymentForm((f) => ({ ...f, transfer: e.target.value }))} />
              <input className="h-11 w-full rounded-lg border px-3 text-sm" placeholder="Habitacion" type="number" value={paymentForm.room} onChange={(e) => setPaymentForm((f) => ({ ...f, room: e.target.value }))} />
            </div>
            <div className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              Pagado: {formatMoney(paymentTotal)}  Cambio/Dif: {formatMoney(paymentDiff)}
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded-lg border text-sm" onClick={() => setPaymentsModalOpen(false)}>
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:bg-emerald-300"
                disabled={!hasItems}
                onClick={confirmChargeOrder}
              >
                Confirmar cobro
              </button>
            </div>
          </div>
        </div>
      )}
      {tablePickerOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 flex justify-end">
          <div className="w-full md:w-[560px] h-full bg-white rounded-l-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-amber-500">Mesa rapida</div>
                <div className="text-lg font-semibold text-amber-900">Selecciona mesa</div>
              </div>
              <button
                className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 text-lg leading-none flex items-center justify-center hover:bg-amber-200"
                onClick={() => setTablePickerOpen(false)}
                aria-label="Cerrar"
              >
                X
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto">
              {allTables.map((t) => {
                const hasOrder = Boolean(ordersByTable[t.id]?.items?.length);
                return (
                  <button
                    key={`${t.section?.id}-${t.id}`}
                    className={`rounded-2xl border ${hasOrder ? "border-emerald-200 bg-emerald-50" : "border-amber-100 bg-amber-50"} hover:bg-amber-100 text-left px-4 py-3 shadow-sm`}
                    onClick={() => handleSelectTable(t, t.section)}
                  >
                    <div className="text-xs text-amber-500">{t.section?.name || "Seccion"}</div>
                    <div className="text-lg font-semibold text-amber-900">{t.name}</div>
                    <div className="text-xs text-amber-700/80">{t.seats} puestos</div>
                    {hasOrder && <div className="text-[11px] text-emerald-700 mt-1">Orden activa</div>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {closesOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-5 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs uppercase text-amber-500">Cierres recientes</div>
                <div className="text-lg font-semibold text-amber-900">Restaurante</div>
              </div>
              <button
                className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 text-lg leading-none flex items-center justify-center hover:bg-amber-200"
                onClick={() => setClosesOpen(false)}
                aria-label="Cerrar"
              >
                X
              </button>
            </div>
            {closesLoading && <div className="text-sm text-amber-700">Cargando...</div>}
            {closesError && <div className="text-sm text-red-600">{closesError}</div>}
            {!closesLoading && !closesError && (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {(closes || []).length === 0 && <div className="text-sm text-amber-700">Sin cierres.</div>}
                {(closes || []).map((c) => (
                  <div key={c.id} className="border border-amber-100 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-amber-900">{c.turno || c.id}</div>
                        <div className="text-xs text-amber-600">
                          {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-amber-800">
                        Sistema: {formatMoney(c.totals?.system || 0)}
                      </div>
                    </div>
                    <div className="text-xs text-amber-700 mt-1">
                      Reportado: {formatMoney(c.totals?.reported || 0)}  Dif: {formatMoney(c.totals?.diff || 0)}
                    </div>
                    <div className="text-xs text-amber-700 mt-1">
                      Pagos: ef {formatMoney(c.payments?.cash || 0)}, tj {formatMoney(c.payments?.card || 0)}, sinpe {formatMoney(c.payments?.sinpe || 0)}, trans {formatMoney(c.payments?.transfer || 0)}, hab {formatMoney(c.payments?.room || 0)}
                    </div>
                    {c.breakdown && typeof c.breakdown === "object" && Object.keys(c.breakdown || {}).length > 0 && (
                      <div className="text-xs text-amber-700 mt-2 space-y-1">
                        <div className="font-semibold text-amber-800">Detalle</div>
                        {Object.entries(c.breakdown).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2">
                            <span className="text-amber-600">{k}</span>
                            <span className="text-amber-900">{typeof v === "number" ? formatMoney(v) : String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1">
        <div className="flex-1 flex flex-col">
          <header className="px-4 py-3 bg-white border-b flex items-center gap-3 shadow-sm">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="text-lg font-semibold text-amber-900">
                  {selectedTable
                    ? `${selectedSection?.name || ""}${selectedSection ? " - " : ""}${selectedTable?.name}`
                    : sectionLauncher
                      ? "Elige una seccion"
                      : selectedSection
                        ? selectedSection.name
                        : "Elige una seccion"}
                </div>
                <button
                  className="px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-sm font-semibold"
                  onClick={() => {
                    if (!guardSwitch()) return;
                    setSelectedTable(null);
                    setSelectedSection(null);
                    setTablePickerOpen(true);
                    setSectionLauncher(true);
                  }}
                >
                  Nueva orden
                </button>
              </div>
              {!selectedTable && !sectionLauncher && (
                <button
                  className="h-11 px-4 rounded-xl bg-amber-100 text-amber-800 text-sm font-semibold"
                  onClick={() => {
                    if (!guardSwitch()) return;
                    resetToLobby();
                  }}
                >
                  Volver
                </button>
              )}
              {selectedTable && (
                <div className="flex items-center gap-2">
                  <button
                    className="h-11 px-4 rounded-xl bg-amber-100 text-amber-800 text-sm font-semibold"
                    onClick={() => {
                      if (!guardSwitch()) return;
                      resetToLobby();
                    }}
                  >
                    Cambiar mesa
                  </button>
                  <button
                    className="h-11 px-4 rounded-xl bg-amber-700 text-white text-sm font-semibold"
                    onClick={() => {
                      if (hasOpenOrders) {
                        window.alert("No puedes cerrar con ordenes abiertas. Finaliza o cobra primero.");
                        return;
                      }
                      setCloseOpen(true);
                    }}
                  >
                    Cierre
                  </button>
                </div>
              )}
            </div>
          </header>

          {sectionLauncher || !selectedTable ? (
            <div className="flex flex-1 overflow-hidden">
              {["ADMIN", "MANAGER"].includes(role) && (
                <aside className="w-56 bg-amber-50 border-r border-amber-100 p-4 space-y-2">
                  <div className="text-xs uppercase text-amber-600">Menu</div>
                  <button
                    className="w-full text-left px-3 py-2 rounded-lg bg-white border border-amber-100 text-sm hover:border-amber-200"
                    onClick={openCloses}
                  >
                    Reportes
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 rounded-lg bg-white border border-amber-100 text-sm hover:border-amber-200"
                    onClick={() => setTablePickerOpen(true)}
                  >
                    Seleccion rapida
                  </button>
                </aside>
              )}
              <div className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-y-auto">
                {sectionLauncher ? (
                  <div className="col-span-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(sections.length ? sections : FALLBACK_SECTIONS).map((sec) => (
                      <div
                        key={sec.id || sec.name}
                        className="rounded-md bg-gradient-to-br from-amber-100 to-purple-50 border border-amber-100 shadow hover:shadow-md transition p-2 text-left cursor-pointer aspect-square flex flex-col"
                        onClick={() => {
                          setSelectedSection(sec);
                          setSelectedTable(null);
                          setSectionLauncher(false);
                        }}
                      >
                        <div className="text-xs uppercase text-amber-500">Seccion</div>
                        <div className="text-lg font-semibold text-amber-900 leading-tight line-clamp-2">{sec.name || sec.id}</div>
                        <div className="text-xs text-amber-700/90 mt-1">{(sec.tables || []).length} mesas</div>
                        <div className="mt-auto text-[11px] text-amber-500">Tap para ver mesas</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="col-span-3">
                    {selectedSection ? (
                      <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {(selectedSection.tables || []).map((t) => {
                          const hasOrder = Boolean(ordersByTable[t.id]?.items?.length);
                          return (
                            <button
                              key={t.id}
                              className={`rounded-xl bg-white border px-4 py-3 text-left shadow hover:border-amber-300 ${hasOrder ? "border-emerald-200" : "border-amber-100"}`}
                              onClick={() => {
                                if (!guardSwitch() && selectedTable?.id !== t.id) return;
                                handleSelectTable(t, selectedSection);
                              }}
                            >
                              <div className="text-xs uppercase text-amber-500">{selectedSection.name}</div>
                              <div className="text-lg font-semibold text-amber-900">{t.name}</div>
                              <div className="text-xs text-amber-600">{t.seats} puestos</div>
                              {hasOrder && <div className="text-[11px] text-emerald-700 mt-1">Orden activa</div>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-amber-700">Selecciona una seccion para ver sus mesas.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              <aside className="w-64 bg-gradient-to-b from-amber-900 via-slate-900 to-slate-800 text-white flex flex-col p-4 gap-3">
                <div>
                  <div className="text-xs uppercase text-amber-200/80">Seccion</div>
                  <div className="text-sm font-semibold">{selectedSection?.name}</div>
                  <div className="text-xs text-amber-200/80">{selectedTable?.name}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-amber-200/80 mb-2">Categorias</div>
                  <div className="grid grid-cols-1 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        className={`text-left rounded-lg px-3 py-2 text-sm ${category === cat ? "bg-amber-600 text-white" : "bg-slate-900 text-amber-100/90"}`}
                        onClick={() => setCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <input
                    className="h-10 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm text-white placeholder:text-slate-200/70"
                    placeholder="Buscar plato..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button
                    className="w-full h-10 rounded-lg bg-amber-600 text-white text-sm font-semibold"
                    onClick={() => setSearch("")}
                  >
                    Limpiar
                  </button>
                </div>
              </aside>
              <div className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-y-auto">
                <div className="col-span-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                  {filteredMenu.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addItem(item)}
                      className="rounded-lg bg-white border border-amber-100 shadow-sm hover:shadow-md transition text-left p-2 flex flex-col gap-1 text-sm aspect-square"
                    >
                      <div className="text-[11px] uppercase tracking-wide text-amber-500">{item.category}</div>
                      <div className="text-sm font-semibold text-amber-900 leading-tight line-clamp-2">{item.name}</div>
                      <div className="text-amber-700 font-semibold text-sm">{formatMoney(item.price)}</div>
                      <div className="mt-auto text-[11px] text-amber-500">Tap para agregar</div>
                    </button>
                  ))}
                </div>

                <div className="bg-white border border-amber-100 rounded-2xl shadow p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs uppercase text-amber-500">Orden</div>
                      <div className="text-lg font-semibold text-amber-900">
                        {selectedSection ? `${selectedSection.name} - ` : ""}
                        {selectedTable?.name || "Sin mesa"}
                      </div>
                      {currentOrder.status && (
                        <div className="text-[11px] text-amber-600 mt-1">{currentOrder.status}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <label className="text-xs text-amber-500">Pax</label>
                      <input
                        type="number"
                        className="w-14 h-9 rounded-lg border border-amber-200 text-center"
                        value={currentOrder.covers || covers}
                        onChange={(e) => handleCoversChange(e.target.value)}
                        min={1}
                      />
                    </div>
                  </div>

                  <textarea
                    className="w-full rounded-lg border border-amber-100 px-3 py-2 text-sm min-h-[70px]"
                    placeholder="Notas para cocina"
                    value={orderNote}
                    onChange={(e) => handleNoteChange(e.target.value)}
                  />

                  <div className="mt-3 space-y-2">
                    <div className="text-xs uppercase text-amber-500">Tipo de servicio</div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "DINE_IN", label: "Comer aqui" },
                        { id: "TAKEOUT", label: "Para llevar" },
                        { id: "DELIVERY", label: "Delivery" },
                        { id: "ROOM", label: "Habitacion" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          className={`h-9 rounded-lg border text-sm font-semibold ${serviceType === opt.id ? "bg-amber-600 border-amber-600 text-white" : "bg-white border-amber-200 text-amber-700"}`}
                          onClick={() => handleServiceTypeChange(opt.id)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {serviceType === "ROOM" && (
                      <input
                        className="w-full h-10 rounded-lg border border-amber-200 px-3 text-sm"
                        placeholder="Habitacion / cargo a cuarto"
                        value={roomCharge}
                        onChange={(e) => handleRoomChargeChange(e.target.value)}
                      />
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-2">
                    {(currentOrder.items || []).length === 0 && (
                      <div className="text-sm text-amber-600 bg-amber-50 border border-dashed border-amber-200 rounded-xl p-3">
                        Agrega productos con un tap.
                      </div>
                    )}
                    {(currentOrder.items || []).map((item) => (
                      <div key={item.id} className="border border-amber-100 rounded-xl p-3">
                        <div className="flex justify-between items-center gap-2">
                          <div>
                            <div className="font-semibold text-amber-900">{item.name}</div>
                            <div className="text-xs text-amber-600">{formatMoney(item.price)} c/u</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="h-8 w-8 rounded-lg bg-amber-50 text-lg"
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
                          <div className="text-amber-700">{formatMoney(item.price * item.qty)}</div>
                          <button
                            className="text-xs text-red-600 hover:underline"
                            onClick={() => removeItem(item.id)}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-1 text-sm text-amber-800">
                    <div className="flex justify-between">
                      <span>Sub total</span>
                      <span>{formatMoney(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Servicio {taxesCfg.servicio || 0}%</span>
                      <span>{formatMoney(totals.service)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Impuestos {taxesCfg.iva || 0}%</span>
                      <span>{formatMoney(totals.tax)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg mt-1">
                      <span>Total</span>
                      <span>{formatMoney(totals.total)}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      className="h-12 rounded-xl bg-amber-50 text-amber-700 font-semibold disabled:opacity-60"
                      onClick={sendToKitchen}
                      disabled={!hasItems}
                    >
                      Enviar a cocina
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



