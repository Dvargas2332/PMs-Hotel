import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Circle, CircleDot, Columns2, DoorOpen, Droplets, Leaf, RectangleHorizontal, Tag, Toilet, UtensilsCrossed, Waves } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import RestaurantUserMenu from "./RestaurantUserMenu";
import RestaurantCloseXButton from "./RestaurantCloseXButton";

function formatMoney(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
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

const sumNumbers = (obj = {}) => Object.values(obj).reduce((acc, v) => acc + (Number(v) || 0), 0);

export default function RestaurantPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [tablePickerMode, setTablePickerMode] = useState("NEW"); // NEW | MOVE
  const [sectionLauncher, setSectionLauncher] = useState(true);

  const [covers, setCovers] = useState(2);
  const [orderNote, setOrderNote] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionsError, setSectionsError] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [ordersByTable, setOrdersByTable] = useState({});
  const [now, setNow] = useState(new Date());
  const [printerCfg, setPrinterCfg] = useState({ kitchenPrinter: "", barPrinter: "" });

  const [closeOpen, setCloseOpen] = useState(false);
  const [closeForm, setCloseForm] = useState({ cash: "", card: "", sinpe: "", transfer: "", room: "", notes: "" });
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);

  const [openInfo, setOpenInfo] = useState(() => ({ openedAt: new Date().toISOString(), user: "Cashier" }));
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
    (sections || []).forEach((sec) => {
      (sec.tables || []).forEach((t) => list.push({ ...t, section: sec }));
    });
    return list;
  }, [sections]);

  const categories = useMemo(() => {
    const set = new Set((menuItems || []).map((m) => m.category).filter(Boolean));
    return Array.from(set);
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
    if (h < 15) return "Morning shift";
    if (h < 22) return "Afternoon shift";
    return "Night shift";
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
    setSectionsLoading(true);
    setSectionsError("");
    try {
      const { data } = await api.get("/restaurant/sections");
      setSections(Array.isArray(data) ? data : []);
      if (!Array.isArray(data) || data.length === 0) {
        setSectionsError("No sections/tables configured. Create them from Management.");
      }
    } catch {
      setSections([]);
      setSectionsError("Could not load sections. Check configuration in Management.");
    } finally {
      setSectionsLoading(false);
    }
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
    const prev = ordersByTable[table.id];
    setCovers(prev?.covers || table?.seats || 2);
    setOrderNote(prev?.note || "");
    setServiceType(prev?.serviceType || "DINE_IN");
    setRoomCharge(prev?.roomId || "");
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
      await api.post("/restaurant/order/move", { fromTableId: selectedTable.id, toTableId: toTable.id });
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

  const reprintCurrent = async () => {
    if (!selectedTable?.id) return;
    try {
      await api.post("/restaurant/order/reprint", { tableId: selectedTable.id });
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Reprint sent." } }));
    } catch (err) {
      const msg = err?.response?.data?.message || "Could not reprint.";
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: msg } }));
    }
  };

  const voidInvoice = async () => {
    const orderId = ordersByTable?.[selectedTable?.id]?.id;
    if (!orderId) {
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "No paid order found." } }));
      return;
    }
    const type = (window.prompt("Document type to void (FE/TE). Leave blank for latest:", "") || "").trim().toUpperCase();
    const reason = window.prompt("Void reason (optional):", "") || "";
    try {
      await api.post("/restaurant/order/void-invoice", { restaurantOrderId: orderId, docType: type || undefined, reason });
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
      window.alert("Could not send to printers.");
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
      window.alert("Order paid.");
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

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <header className="relative h-14 bg-gradient-to-r from-amber-700 to-slate-800 text-white flex items-center justify-between px-6 shadow">
        <div className="flex items-center gap-3">
          <button
            className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-semibold"
            onClick={() => navigate("/restaurant")}
            title="Back to lobby"
          >
            Lobby
          </button>
          <span className="text-lg font-semibold">Restaurant</span>
          <span className="text-sm text-amber-200">Welcome</span>
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
            Cash status
          </button>
          <RestaurantUserMenu />
        </div>
      </header>

      {closeOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="w-full max-w-[360px] max-h-[40vh] min-h-[200px] bg-white rounded-l-2xl shadow-2xl p-3 flex flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-amber-500">Cash status</div>
                <div className="text-lg font-semibold text-amber-900">Restaurant cash</div>
                <div className="text-xs text-amber-700">
                  Opened: {new Date(openInfo.openedAt).toLocaleString()}  {openInfo.user}
                </div>
              </div>
              <RestaurantCloseXButton onClick={() => setCloseOpen(false)} />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-lg border bg-gradient-to-r from-amber-50 to-slate-50 px-4 py-3 text-sm">
                <div className="text-xs text-amber-700">System sales</div>
                <div className="text-xl font-bold text-amber-900">{canViewTotals ? formatMoney(closeSummary.system) : "***"}</div>
                <div className="text-xs text-amber-500">Total sold (paid sales)</div>
              </div>
              <div className="rounded-lg border bg-gradient-to-r from-amber-50 to-slate-50 px-4 py-3 text-sm">
                <div className="text-xs text-amber-700">Open orders</div>
                <div className="text-xl font-bold text-amber-900">{stats.openOrders}</div>
                <div className="text-xs text-amber-500">Estimated value {formatMoney(stats.openOrderValue || 0)}</div>
              </div>
              <button
                className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-semibold"
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-3 space-y-3 overflow-y-auto max-h-[65vh]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-amber-500">Cash close</div>
                <div className="text-lg font-semibold text-amber-900">Restaurant cash</div>
              </div>
              <RestaurantCloseXButton onClick={() => setCloseModalOpen(false)} />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-lg border bg-gradient-to-r from-amber-50 to-slate-50 px-4 py-3 text-sm">
                <div className="text-xs text-amber-700">Reported (manual)</div>
                <div className="text-xl font-bold text-amber-900">{canViewTotals ? formatMoney(closeSummary.reported) : "***"}</div>
                <div className="text-xs text-amber-500">Sum of methods</div>
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
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-4 space-y-3 overflow-y-auto max-h-[70vh]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-emerald-600">Payment</div>
                <div className="text-lg font-semibold text-slate-900">{selectedTable?.name}</div>
              </div>
              <RestaurantCloseXButton onClick={() => setPaymentsModalOpen(false)} />
            </div>
            <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm">
              <div className="text-xs text-slate-600">Total due</div>
              <div className="text-2xl font-bold text-slate-900">{formatMoney(totals.total)}</div>
              <div className="text-xs text-slate-500">Subtotal {formatMoney(totals.subtotal)}  Service {formatMoney(totals.service)}  Taxes {formatMoney(totals.tax)}</div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <input className="h-11 w-full rounded-lg border px-3 text-sm" placeholder="Cash" type="number" value={paymentForm.cash} onChange={(e) => setPaymentForm((f) => ({ ...f, cash: e.target.value }))} />
              <input className="h-11 w-full rounded-lg border px-3 text-sm" placeholder="Card" type="number" value={paymentForm.card} onChange={(e) => setPaymentForm((f) => ({ ...f, card: e.target.value }))} />
              <input className="h-11 w-full rounded-lg border px-3 text-sm" placeholder="SINPE" type="number" value={paymentForm.sinpe} onChange={(e) => setPaymentForm((f) => ({ ...f, sinpe: e.target.value }))} />
              <input className="h-11 w-full rounded-lg border px-3 text-sm" placeholder="Bank transfer" type="number" value={paymentForm.transfer} onChange={(e) => setPaymentForm((f) => ({ ...f, transfer: e.target.value }))} />
              <input className="h-11 w-full rounded-lg border px-3 text-sm" placeholder="Room charge" type="number" value={paymentForm.room} onChange={(e) => setPaymentForm((f) => ({ ...f, room: e.target.value }))} />
            </div>
            <div className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              Paid: {formatMoney(paymentTotal)}  Change/Diff: {formatMoney(paymentDiff)}
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded-lg border text-sm" onClick={() => setPaymentsModalOpen(false)}>
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:bg-emerald-300"
                disabled={!hasItems}
                onClick={confirmChargeOrder}
              >
                Confirm payment
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
                <div className="text-xs uppercase text-amber-500">{tablePickerMode === "MOVE" ? "Change table" : "Quick table"}</div>
                <div className="text-lg font-semibold text-amber-900">{tablePickerMode === "MOVE" ? "Select destination table" : "Select table"}</div>
              </div>
              <RestaurantCloseXButton onClick={() => setTablePickerOpen(false)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto">
              {allTables.map((t, idx) => {
                const hasOrder = Boolean(ordersByTable[t.id]?.items?.length);
                const pickerKey = String(`${t.section?.id || "sec"}-${t.id || t.name || idx}`);
                return (
                  <button
                    key={pickerKey}
                    className={`rounded-2xl border ${hasOrder ? "border-emerald-200 bg-emerald-50" : "border-amber-100 bg-amber-50"} hover:bg-amber-100 text-left px-4 py-3 shadow-sm`}
                    onClick={() => (tablePickerMode === "MOVE" ? moveToTable(t) : handleSelectTable(t, t.section))}
                  >
                    <div className="text-xs text-amber-500">{t.section?.name || "Section"}</div>
                    <div className="text-lg font-semibold text-amber-900">{t.name}</div>
                    <div className="text-xs text-amber-700/80">{t.seats} seats</div>
                    {hasOrder && <div className="text-[11px] text-emerald-700 mt-1">Active order</div>}
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
                   onClick={openNewOrderPicker}
                 >
                   New order
                 </button>
                 <button
                   className="px-3 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-sm font-semibold text-amber-900 disabled:opacity-50"
                   onClick={openMoveTablePicker}
                   disabled={!selectedTable?.id || !(ordersByTable[selectedTable.id]?.items?.length)}
                 >
                   Change table
                 </button>
                 <button
                   className="px-3 py-2 rounded-lg bg-white border hover:bg-slate-50 text-sm font-semibold disabled:opacity-50"
                   onClick={reprintCurrent}
                   disabled={!selectedTable?.id}
                 >
                   Reprint
                 </button>
                 <button
                   className="px-3 py-2 rounded-lg bg-white border hover:bg-slate-50 text-sm font-semibold disabled:opacity-50"
                   onClick={voidInvoice}
                   disabled={!selectedTable?.id || String(ordersByTable[selectedTable.id]?.status || "").toUpperCase() !== "PAID"}
                 >
                   Void invoice
                 </button>
                 <button
                   className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white disabled:opacity-50"
                   onClick={openPayments}
                   disabled={!selectedTable?.id || !(ordersByTable[selectedTable.id]?.items?.length)}
                 >
                   Charge
                 </button>
               </div>
              {!selectedTable && !sectionLauncher && (
                 <button
                   className="h-11 px-4 rounded-xl bg-amber-100 text-amber-800 text-sm font-semibold hover:bg-amber-200"
                   onClick={() => {
                     if (!guardSwitch()) return;
                     resetToLobby();
                   }}
                  >
                    Back
                  </button>
                )}
              </div>
            </header>

          {sectionLauncher || !selectedTable ? (
            <div key={sectionLauncher ? "restaurant-launcher" : `restaurant-section-${String(selectedSection?.id || "none")}`} className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-y-auto">
              {sectionLauncher ? (
                <div className="col-span-3">
                  {sectionsLoading && <div className="text-sm text-amber-700">Loading sections...</div>}
                  {!sectionsLoading && sectionsError && <div className="text-sm text-amber-700">{sectionsError}</div>}
                  {!sectionsLoading && !sectionsError && (sections || []).length === 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="text-sm font-semibold text-amber-900">No sections configured</div>
                      <div className="text-sm text-amber-700 mt-1">
                        Create sections and tables from <span className="font-semibold">Management → Restaurant → Sections, tables and menu</span>.
                      </div>
                      {["ADMIN", "MANAGER"].includes(role) && (
                        <button
                          className="mt-3 h-10 px-4 rounded-xl bg-amber-700 text-white text-sm font-semibold hover:bg-amber-600"
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
                          className="rounded-md bg-gradient-to-br from-amber-100 to-purple-50 border border-amber-100 shadow hover:shadow-md transition p-2 text-left cursor-pointer aspect-square flex flex-col"
                          onClick={() => {
                            setSelectedSection(sec);
                            setSelectedTable(null);
                            setSectionLauncher(false);
                          }}
                        >
                          <div className="text-xs uppercase text-amber-500">Section</div>
                          <div className="text-lg font-semibold text-amber-900 leading-tight line-clamp-2">{sec.name || sec.id}</div>
                          <div className="text-xs text-amber-700/90 mt-1">{(sec.tables || []).length} tables</div>
                          <div className="mt-auto text-[11px] text-amber-500">Tap to view tables</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="col-span-3">
                  {selectedSection ? (
                    <div className="space-y-2">
                      <div className="text-xs text-amber-700">
                        Floor plan of <span className="font-semibold">{selectedSection.name}</span>. Tap a table to open it.
                      </div>
                      <div className="relative w-full h-72 md:h-80 rounded-2xl border border-amber-200 bg-amber-50/60 overflow-hidden">
                        <div className="absolute inset-x-3 top-2 flex justify-between text-[11px] text-amber-600">
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
                              className={`h-full w-full flex items-center justify-center gap-2 text-slate-700 px-2 ${
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
                          const hasOrder = Boolean(ordersByTable[t.id]?.items?.length);
                          const TableIcon = hasOrder ? CircleDot : Circle;
                          const tableKey = String(t.id || t.name || `table-${idx}`);
                          return (
                            <button
                              key={tableKey}
                              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl px-3 py-2 shadow text-left text-xs md:text-sm transition border ${
                                hasOrder
                                  ? "bg-emerald-600/90 border-emerald-500 text-white"
                                  : "bg-white border-amber-200 text-amber-900"
                              }`}
                              style={{ left: `${x}%`, top: `${y}%` }}
                              onClick={() => {
                                if (!guardSwitch() && selectedTable?.id !== t.id) return;
                                handleSelectTable(t, selectedSection);
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold leading-tight">{t.name}</div>
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-lg bg-black/10" title={hasOrder ? "Occupied" : "Free"}>
                                  <TableIcon size={16} />
                                </span>
                              </div>
                              <div className="text-[11px] opacity-80">{t.seats} seats</div>
                              {hasOrder && <div className="text-[10px] mt-0.5">Active order</div>}
                            </button>
                          );
                        })}
                          {(selectedSection.tables || []).length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-sm text-amber-700">
                              No tables configured in this section.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-amber-700">Select a section to view its tables.</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div key={`restaurant-pos-${String(selectedTable?.id || "none")}`} className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-y-auto">
                <div className="col-span-2 flex flex-col gap-3">
                  <div className="rounded-2xl bg-white border border-amber-100 shadow-sm p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase text-amber-500">Section / Table</div>
                        <div className="text-sm font-semibold text-amber-900">
                          {selectedSection?.name || "-"} → {selectedTable?.name || "-"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <input
                          className="h-10 w-full md:w-[260px] rounded-lg border border-amber-200 px-3 text-sm"
                          placeholder="Search item..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                        <button className="h-10 px-3 rounded-lg bg-amber-600 text-white text-sm font-semibold" onClick={() => setSearch("")}>
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className={`h-9 px-3 rounded-lg border text-sm font-semibold ${
                          !category ? "bg-amber-600 border-amber-600 text-white" : "bg-white border-amber-200 text-amber-700"
                        }`}
                        onClick={() => setCategory("")}
                      >
                        All
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          className={`h-9 px-3 rounded-lg border text-sm font-semibold ${
                            category === cat ? "bg-amber-600 border-amber-600 text-white" : "bg-white border-amber-200 text-amber-700"
                          }`}
                          onClick={() => setCategory(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                    {filteredMenu.map((item, idx) => (
                      <button
                        key={String(item.id || item.code || `${item.name}-${idx}`)}
                        onClick={() => addItem(item)}
                        className="rounded-lg bg-white border border-amber-100 shadow-sm hover:shadow-md transition text-left p-2 flex flex-col gap-1 text-sm aspect-square"
                      >
                        <div className="text-[11px] uppercase tracking-wide text-amber-500">{item.category}</div>
                        <div className="text-sm font-semibold text-amber-900 leading-tight line-clamp-2">{item.name}</div>
                        <div className="text-amber-700 font-semibold text-sm">{formatMoney(item.price)}</div>
                        <div className="mt-auto text-[11px] text-amber-500">Tap to add</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-amber-100 rounded-2xl shadow p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs uppercase text-amber-500">Order</div>
                      <div className="text-lg font-semibold text-amber-900">
                        {selectedSection ? `${selectedSection.name} - ` : ""}
                        {selectedTable?.name || "No table"}
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
                        { id: "TAKEOUT", label: "Takeout" },
                        { id: "DELIVERY", label: "Delivery" },
                        { id: "ROOM", label: "Room charge" },
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
                        placeholder="Room / room charge"
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
                    {(currentOrder.items || []).map((item, idx) => (
                      <div key={String(item.id || item.code || `${item.name}-${idx}`)} className="border border-amber-100 rounded-xl p-3">
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

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      className="h-12 rounded-xl bg-amber-50 text-amber-700 font-semibold disabled:opacity-60"
                      onClick={sendToKitchen}
                      disabled={!hasItems}
                    >
                      Send to kitchen
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
