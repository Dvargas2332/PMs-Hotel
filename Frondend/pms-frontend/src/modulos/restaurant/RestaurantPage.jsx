import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CircleUser, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

const FALLBACK_SECTIONS = [
  {
    id: "sec-salon",
    name: "Salón Principal",
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

export default function RestaurantPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userMenu, setUserMenu] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [covers, setCovers] = useState(2);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sectionLauncher, setSectionLauncher] = useState(true);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [menuItems, setMenuItems] = useState(FALLBACK_MENU);
  const [ordersByTable, setOrdersByTable] = useState({});
  const [now, setNow] = useState(new Date());
  const [printerCfg, setPrinterCfg] = useState({ kitchenPrinter: "", barPrinter: "" });
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeForm, setCloseForm] = useState({
    cash: "",
    card: "",
    sinpe: "",
    transfer: "",
    room: "",
    notes: "",
  });
  const [closeLoading, setCloseLoading] = useState(false);
  const [closesOpen, setClosesOpen] = useState(false);
  const [closesLoading, setClosesLoading] = useState(false);
  const [closes, setCloses] = useState([]);
  const [closesError, setClosesError] = useState("");
  const [taxesCfg, setTaxesCfg] = useState({ iva: 13, servicio: 10 });
  const [paymentsCfg, setPaymentsCfg] = useState({ monedaBase: "CRC", monedaSec: "USD", tipoCambio: 530 });

  const addItem = (item) => {
    if (!selectedTable?.id) return;
    setOrdersByTable((prev) => {
      const cur = prev[selectedTable.id] || { items: [], covers };
      const idx = cur.items.findIndex((i) => i.id === item.id);
      const items = idx >= 0 ? cur.items.map((i, k) => (k === idx ? { ...i, qty: i.qty + 1 } : i)) : [...cur.items, { ...item, qty: 1 }];
      return { ...prev, [selectedTable.id]: { ...cur, items } };
    });
  };

  const updateQty = (id, delta) => {
    if (!selectedTable?.id) return;
    setOrdersByTable((prev) => {
      const cur = prev[selectedTable.id] || { items: [] };
      const items = cur.items
        .map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i))
        .filter((i) => i.qty > 0);
      return { ...prev, [selectedTable.id]: { ...cur, items } };
    });
  };

  const removeItem = (id) => {
    if (!selectedTable?.id) return;
    setOrdersByTable((prev) => {
      const cur = prev[selectedTable.id] || { items: [] };
      return { ...prev, [selectedTable.id]: { ...cur, items: cur.items.filter((i) => i.id !== id) } };
    });
  };

  const currentOrder = useMemo(() => {
    return selectedTable?.id ? ordersByTable[selectedTable.id] || { items: [], covers } : { items: [], covers };
  }, [ordersByTable, selectedTable?.id, covers]);

  const totals = useMemo(() => {
    const serviceRate = Number(taxesCfg.servicio || 0) / 100;
    const taxRate = Number(taxesCfg.iva || 0) / 100;
    const subtotal = (currentOrder.items || []).reduce((acc, i) => acc + i.price * i.qty, 0);
    const service = subtotal * serviceRate;
    const tax = subtotal * taxRate;
    const total = subtotal + service + tax;
    return { subtotal, service, tax, total };
  }, [currentOrder.items, taxesCfg.iva, taxesCfg.servicio]);
  const closeSummary = useMemo(() => {
    const sys = totals.total || 0;
    const reported =
      Number(closeForm.cash || 0) +
      Number(closeForm.card || 0) +
      Number(closeForm.sinpe || 0) +
      Number(closeForm.transfer || 0) +
      Number(closeForm.room || 0);
    const diff = reported - sys;
    return { system: sys, reported, diff };
  }, [totals.total, closeForm]);

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
    if (h < 15) return "Turno Mañana";
    if (h < 22) return "Turno Tarde";
    return "Turno Noche";
  }, [now]);
  const role = useMemo(() => (user?.role || "").toUpperCase(), [user?.role]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const allTables = useMemo(() => {
    const list = [];
    (sections.length ? sections : FALLBACK_SECTIONS).forEach((sec) => {
      (sec.tables || []).forEach((t) => list.push({ ...t, section: sec }));
    });
    return list;
  }, [sections]);

  const openCloses = async () => {
    if (!["ADMIN", "MANAGER"].includes(role)) return;
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

  useEffect(() => {
    const loadSections = async () => {
      try {
        const { data } = await api.get("/restaurant/sections");
        if (Array.isArray(data) && data.length > 0) {
          setSections(data);
          return;
        }
      } catch {
        // fallback
      }
      setSections(FALLBACK_SECTIONS);
    };
    const loadPrinters = async () => {
      try {
        const { data } = await api.get("/restaurant/config");
        setPrinterCfg({ kitchenPrinter: data?.kitchenPrinter || "", barPrinter: data?.barPrinter || "" });
      } catch {
        setPrinterCfg({ kitchenPrinter: "", barPrinter: "" });
      }
    };
    const loadSettings = async () => {
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
          });
        }
      } catch {
        setPaymentsCfg({ monedaBase: "CRC", monedaSec: "USD", tipoCambio: 530 });
      }
    };
    loadSections();
    loadPrinters();
    loadSettings();
  }, []);

  const loadMenu = useCallback(
    async (sectionId) => {
      try {
        const { data } = await api.get(`/restaurant/menu?section=${encodeURIComponent(sectionId || "")}`);
        if (Array.isArray(data) && data.length > 0) {
          setMenuItems(data);
          setCategory(data[0]?.category || "");
          return;
        }
      } catch {
        // fallback
      }
      setMenuItems(FALLBACK_MENU);
      setCategory(FALLBACK_MENU[0]?.category || "");
    },
    []
  );

  const handleSelectTable = (table, section) => {
    setSelectedSection(section);
    setSelectedTable(table);
    const prev = ordersByTable[table.id];
    setCovers(prev?.covers || table?.seats || 2);
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
  };

  const sendToKitchen = async () => {
    if (!selectedTable?.id) return;
    const payload = {
      sectionId: selectedSection?.id,
      tableId: selectedTable?.id,
      items: currentOrder.items || [],
      note: closeForm.notes || "",
      covers: currentOrder.covers || covers,
      printers: printerCfg,
    };
    try {
      await api.post("/restaurant/order", payload);
      await api.post("/restaurant/print", payload);
      window.alert("Pedido enviado a cocina.");
    } catch {
      window.alert("No se pudo enviar a impresoras.");
    }
  };

  const chargeOrder = async () => {
    if (!selectedTable?.id) return;
    try {
      await api.post("/restaurant/order/close", {
        tableId: selectedTable.id,
        payments: {
          cash: closeForm.cash,
          card: closeForm.card,
          sinpe: closeForm.sinpe,
          transfer: closeForm.transfer,
          room: closeForm.room,
        },
        totals,
        note: closeForm.notes,
      });
      window.alert("Orden cobrada.");
      setOrdersByTable((prev) => ({ ...prev, [selectedTable.id]: { items: [], covers } }));
    } catch {
      window.alert("No se pudo cobrar la orden.");
    }
  };

  const canSwitchTable = () => {
    if ((currentOrder.items || []).length === 0) return true;
    const role = (user?.role || "").toUpperCase();
    return ["ADMIN", "MANAGER"].includes(role);
  };

  const guardSwitch = () => {
    if (canSwitchTable()) return true;
    window.alert("No puedes reasignar o ver productos de otra mesa sin permisos.");
    return false;
  };

  return (
    <div className="flex flex-col h-screen bg-rose-50">
      <header className="relative h-14 bg-gradient-to-r from-rose-800 to-purple-800 text-white flex items-center justify-between px-6 shadow">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold">Restaurante</span>
          <span className="text-sm text-emerald-200">Bienvenido</span>
        </div>
          <div className="flex items-center gap-4 relative">
            <div className="hidden md:flex items-center gap-3 text-xs">
              <div className="px-3 py-1 rounded-lg bg-white/10 text-white">
                {now.toLocaleDateString()} · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="px-3 py-1 rounded-lg bg-white/10 text-white">{shift}</div>
              <div className="flex items-center gap-1">
                <span className="px-2 py-1 rounded bg-white/10">Compra {paymentsCfg.monedaBase} {paymentsCfg.tipoCambio}</span>
                <span className="px-2 py-1 rounded bg-white/10">Venta {paymentsCfg.monedaBase} {paymentsCfg.tipoCambio}</span>
              </div>
            </div>
            <button
              className="px-3 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-sm font-semibold"
              onClick={() => {
                if (!guardSwitch()) return;
                if ((currentOrder.items || []).length > 0) {
                  window.alert("No puedes cerrar con una orden abierta. Finaliza o cobra primero.");
                  return;
                }
                setCloseOpen(true);
              }}
            >
              Cierre
            </button>
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-semibold"
            onClick={() => setUserMenu((s) => !s)}
          >
            <CircleUser className="w-5 h-5" />
            <span className="hidden sm:inline">{user?.name || user?.email || "Cajero"}</span>
          </button>
          {userMenu && (
            <div className="absolute right-0 top-12 w-48 bg-white text-rose-900 rounded-lg shadow-lg border">
              <div className="px-3 py-2 text-sm border-b">
                <div className="font-semibold">{user?.name || "Usuario"}</div>
                <div className="text-xs text-rose-700/80">{user?.email}</div>
              </div>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-rose-50"
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
            <div className="w-full md:w-[600px] h-full bg-white rounded-l-2xl shadow-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-rose-500">Cierre de turno</div>
                  <div className="text-lg font-semibold text-rose-900">Turno #{now.getTime()}</div>
                </div>
                <button className="px-3 py-1 rounded-lg bg-rose-100 text-rose-700 text-sm" onClick={() => setCloseOpen(false)}>
                  Cerrar
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-rose-600">Sistema</div>
                  <div className="text-xl font-bold text-rose-900">{formatMoney(closeSummary.system)}</div>
                  <div className="text-xs text-rose-500">Total vendido por sección/mesa</div>
                </div>
                <div>
                  <div className="text-xs text-rose-600">Reportado</div>
                  <div className="text-xl font-bold text-rose-900">{formatMoney(closeSummary.reported)}</div>
                  <div className="text-xs text-rose-500">Suma de métodos de pago</div>
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
                  placeholder="Cargo a habitación"
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
              <div className="rounded-lg border bg-rose-50 px-4 py-3 text-sm flex justify-between">
                <div>Descuadre</div>
                <div className={closeSummary.diff === 0 ? "text-emerald-700" : closeSummary.diff > 0 ? "text-emerald-700" : "text-red-600"}>
                  {closeSummary.diff === 0 ? "OK" : closeSummary.diff > 0 ? `+${formatMoney(closeSummary.diff)}` : formatMoney(closeSummary.diff)}
                </div>
              </div>
                <div className="flex justify-end gap-2">
                  <button
                    className="px-4 py-2 rounded-lg border text-sm"
                    onClick={() => {
                      setCloseOpen(false);
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-rose-700 text-white text-sm font-semibold"
                  disabled={closeLoading}
                  onClick={async () => {
                    if (closeLoading) return;
                    setCloseLoading(true);
                    try {
                      await api.post("/restaurant/close", {
                        totals: closeSummary,
                        payments: closeForm,
                        note: closeForm.notes,
                        breakdown: {
                          // En el futuro: desglose por articulo/seccion/salonero/cajero/tipoCobro
                          resumen: "Pendiente integrar reporte detallado",
                        },
                      });
                      setCloseOpen(false);
                      setTimeout(() => {
                        const overlay = document.createElement("div");
                        overlay.style.position = "fixed";
                        overlay.style.inset = "0";
                        overlay.style.background = "rgba(0,0,0,0.4)";
                        overlay.style.display = "flex";
                        overlay.style.alignItems = "center";
                        overlay.style.justifyContent = "center";
                        overlay.style.zIndex = "9999";
                        const box = document.createElement("div");
                        box.style.width = "90%";
                        box.style.maxWidth = "520px";
                        box.style.background = "white";
                        box.style.borderRadius = "16px";
                        box.style.padding = "24px";
                        box.style.boxShadow = "0 20px 40px rgba(0,0,0,0.2)";
                        box.innerHTML = `<div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:8px">Buen trabajo</div><div style="color:#475569;font-size:14px;margin-bottom:16px">Gracias</div><button style="background:#e11d48;color:white;padding:10px 16px;border:none;border-radius:10px;font-weight:600;cursor:pointer">Cerrar</button>`;
                        overlay.appendChild(box);
                        box.querySelector("button")?.addEventListener("click", () => {
                          overlay.remove();
                          navigate("/launcher");
                        });
                        document.body.appendChild(overlay);
                      }, 50);
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
      {tablePickerOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 flex justify-end">
          <div className="w-full md:w-[560px] h-full bg-white rounded-l-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-rose-500">Mesa r&aacute;pida</div>
                <div className="text-lg font-semibold text-rose-900">Selecciona mesa</div>
              </div>
              <button
                className="px-3 py-1 rounded-lg bg-rose-100 text-rose-700 text-sm"
                onClick={() => setTablePickerOpen(false)}
              >
                Cerrar
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto">
              {allTables.map((t) => (
                <button
                  key={`${t.section?.id}-${t.id}`}
                  className="rounded-2xl border border-rose-100 bg-rose-50 hover:bg-rose-100 text-left px-4 py-3 shadow-sm"
                  onClick={() => handleSelectTable(t, t.section)}
                >
                  <div className="text-xs text-rose-500">{t.section?.name || "Seccion"}</div>
                  <div className="text-lg font-semibold text-rose-900">{t.name}</div>
                  <div className="text-xs text-rose-700/80">{t.seats} puestos</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {closesOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-5 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs uppercase text-rose-500">Cierres recientes</div>
                <div className="text-lg font-semibold text-rose-900">Restaurant</div>
              </div>
              <button
                className="px-3 py-1 rounded-lg bg-rose-100 text-rose-700 text-sm"
                onClick={() => setClosesOpen(false)}
              >
                Cerrar
              </button>
            </div>
            {closesLoading && <div className="text-sm text-rose-700">Cargando...</div>}
            {closesError && <div className="text-sm text-red-600">{closesError}</div>}
            {!closesLoading && !closesError && (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {(closes || []).length === 0 && <div className="text-sm text-rose-700">Sin cierres.</div>}
                {(closes || []).map((c) => (
                  <div key={c.id} className="border border-rose-100 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-rose-900">{c.turno || c.id}</div>
                        <div className="text-xs text-rose-600">
                          {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-rose-800">
                        Sistema: {formatMoney(c.totals?.system || 0)}
                      </div>
                    </div>
                    <div className="text-xs text-rose-700 mt-1">
                      Reportado: {formatMoney(c.totals?.reported || 0)} · Dif: {formatMoney(c.totals?.diff || 0)}
                    </div>
                    <div className="text-xs text-rose-700 mt-1">
                      Pagos: ef {formatMoney(c.payments?.cash || 0)}, tj {formatMoney(c.payments?.card || 0)}, sinpe{" "}
                      {formatMoney(c.payments?.sinpe || 0)}, trans {formatMoney(c.payments?.transfer || 0)}, hab{" "}
                      {formatMoney(c.payments?.room || 0)}
                    </div>
                    {c.breakdown && typeof c.breakdown === "object" && Object.keys(c.breakdown || {}).length > 0 && (
                      <div className="text-xs text-rose-700 mt-2 space-y-1">
                        <div className="font-semibold text-rose-800">Detalle</div>
                        {Object.entries(c.breakdown).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2">
                            <span className="text-rose-600">{k}</span>
                            <span className="text-rose-900">{typeof v === "number" ? formatMoney(v) : String(v)}</span>
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
                <div className="text-lg font-semibold text-rose-900">
                  {selectedTable ? `${selectedSection?.name || ""} ${selectedSection ? "·" : ""} ${selectedTable?.name}` : sectionLauncher ? "Elige una seccion" : selectedSection ? selectedSection.name : "Elige una seccion"}
                </div>
               <button
                 className="px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-sm font-semibold"
                 onClick={() => {
                   if (!guardSwitch()) return;
                    setOrdersByTable({});
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
                  className="h-11 px-4 rounded-xl bg-rose-100 text-rose-800 text-sm font-semibold"
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
                    className="h-11 px-4 rounded-xl bg-rose-100 text-rose-800 text-sm font-semibold"
                    onClick={() => {
                      if (!guardSwitch()) return;
                      resetToLobby();
                    }}
                  >
                    Cambiar mesa
                  </button>
                  <button
                    className="h-11 px-4 rounded-xl bg-rose-700 text-white text-sm font-semibold"
                    onClick={() => {
                      if ((currentOrder.items || []).length > 0) {
                        window.alert("No puedes cerrar con una orden abierta. Finaliza o cobra primero.");
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

          {/* Lobby y flujo principal */}
          {sectionLauncher || !selectedTable ? (
            <div className="flex flex-1 overflow-hidden">
              {["ADMIN", "MANAGER"].includes(role) && (
                <aside className="w-56 bg-rose-50 border-r border-rose-100 p-4 space-y-2">
                  <div className="text-xs uppercase text-rose-600">Menú</div>
                  <button
                    className="w-full text-left px-3 py-2 rounded-lg bg-white border border-rose-100 text-sm hover:border-rose-200"
                    onClick={openCloses}
                  >
                    Reportes
                  </button>
                  <button className="w-full text-left px-3 py-2 rounded-lg bg-white border border-rose-100 text-sm hover:border-rose-200">
                    Cierres
                  </button>
                </aside>
              )}
              <div className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-y-auto">
                {sectionLauncher ? (
                  <div className="col-span-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(sections.length ? sections : FALLBACK_SECTIONS).map((sec) => (
                      <div
                        key={sec.id || sec.name}
                        className="rounded-md bg-gradient-to-br from-rose-100 to-purple-50 border border-rose-100 shadow hover:shadow-md transition p-2 text-left cursor-pointer aspect-square flex flex-col"
                        onClick={() => {
                          setSelectedSection(sec);
                          setSelectedTable(null);
                          setSectionLauncher(false);
                        }}
                      >
                        <div className="text-xs uppercase text-rose-500">Seccion</div>
                        <div className="text-lg font-semibold text-rose-900 leading-tight line-clamp-2">{sec.name || sec.id}</div>
                        <div className="text-xs text-rose-700/90 mt-1">{(sec.tables || []).length} mesas</div>
                        <div className="mt-auto text-[11px] text-rose-500">Tap para ver mesas</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="col-span-3">
                    {selectedSection ? (
                      <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {(selectedSection.tables || []).map((t) => (
                          <button
                            key={t.id}
                            className="rounded-xl bg-white border border-rose-100 px-4 py-3 text-left shadow hover:border-rose-300"
                            onClick={() => {
                              if (!guardSwitch() && selectedTable?.id !== t.id) return;
                              handleSelectTable(t, selectedSection);
                            }}
                          >
                            <div className="text-xs uppercase text-rose-500">{selectedSection.name}</div>
                            <div className="text-lg font-semibold text-rose-900">{t.name}</div>
                            <div className="text-xs text-rose-600">{t.seats} puestos</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-rose-700">Selecciona una seccion para ver sus mesas.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              <aside className="w-64 bg-rose-950 text-white flex flex-col p-4 gap-3">
                <div>
                  <div className="text-xs uppercase text-rose-200/80">Seccion</div>
                  <div className="text-sm font-semibold">{selectedSection?.name}</div>
                  <div className="text-xs text-rose-200/80">{selectedTable?.name}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-rose-200/80 mb-2">Categorias</div>
                  <div className="grid grid-cols-1 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        className={`text-left rounded-lg px-3 py-2 text-sm ${category === cat ? "bg-rose-700 text-white" : "bg-rose-900 text-rose-100/90"}`}
                        onClick={() => setCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <input
                    className="h-10 w-full rounded-lg border border-rose-700 bg-rose-900 px-3 text-sm text-white placeholder:text-rose-200/70"
                    placeholder="Buscar plato..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button
                    className="w-full h-10 rounded-lg bg-rose-700 text-white text-sm font-semibold"
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
                      className="rounded-lg bg-white border border-rose-100 shadow-sm hover:shadow-md transition text-left p-2 flex flex-col gap-1 text-sm aspect-square"
                    >
                      <div className="text-[11px] uppercase tracking-wide text-rose-500">{item.category}</div>
                      <div className="text-sm font-semibold text-rose-900 leading-tight line-clamp-2">{item.name}</div>
                      <div className="text-rose-700 font-semibold text-sm">{formatMoney(item.price)}</div>
                      <div className="mt-auto text-[11px] text-rose-500">Tap para agregar</div>
                    </button>
                  ))}
                </div>

                <div className="bg-white border border-rose-100 rounded-2xl shadow p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs uppercase text-rose-500">Orden</div>
                      <div className="text-lg font-semibold text-rose-900">
                        {selectedSection ? `${selectedSection.name} · ` : ""}
                        {selectedTable?.name || "Sin mesa"}
                      </div>
                    </div>
                    <div className="text-sm text-rose-600">{currentOrder.covers || covers} pax</div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {(currentOrder.items || []).length === 0 && (
                      <div className="text-sm text-rose-600 bg-rose-50 border border-dashed border-rose-200 rounded-xl p-3">
                        Agrega productos con un tap.
                      </div>
                    )}
                    {(currentOrder.items || []).map((item) => (
                      <div key={item.id} className="border border-rose-100 rounded-xl p-3">
                        <div className="flex justify-between items-center gap-2">
                          <div>
                            <div className="font-semibold text-rose-900">{item.name}</div>
                            <div className="text-xs text-rose-600">{formatMoney(item.price)} c/u</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="h-8 w-8 rounded-lg bg-rose-50 text-lg"
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
                          <div className="text-rose-700">{formatMoney(item.price * item.qty)}</div>
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

                  <div className="mt-4 space-y-1 text-sm text-rose-800">
                    <div className="flex justify-between">
                      <span>Sub total</span>
                      <span>{formatMoney(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Servicio 10%</span>
                      <span>{formatMoney(totals.service)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Impuestos 13%</span>
                      <span>{formatMoney(totals.tax)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg mt-1">
                      <span>Total</span>
                      <span>{formatMoney(totals.total)}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                    className="h-12 rounded-xl bg-rose-50 text-rose-700 font-semibold"
                    onClick={sendToKitchen}
                    disabled={(currentOrder.items || []).length === 0}
                  >
                    Enviar a cocina
                  </button>
                  <button
                    className="h-12 rounded-xl bg-purple-800 text-white font-semibold disabled:bg-purple-300"
                    onClick={chargeOrder}
                    disabled={(currentOrder.items || []).length === 0}
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



