import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CircleUser, LogOut, Bell } from "lucide-react";
import useConfigStore from "../store/configStore";
import { api } from "../lib/api";

const TYPE_STYLES = {
  checkin:      "bg-emerald-100 text-emerald-900",
  checkout:     "bg-sky-100 text-sky-900",
  housekeeping: "bg-amber-100 text-amber-900",
  payment:      "bg-purple-100 text-purple-900",
  system:       "bg-gray-100 text-gray-900",
};

export default function Layout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { config, setFx } = useConfigStore();
  const fx = config?.accounting?.fx || {};
  const fmtFx = (v) => (v || v === 0 ? Number(v).toFixed(2) : "—");

  // Panel de alertas y listado
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]); // [{id?, type, title, desc, at?}]
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const panelRef = useRef(null);
  const menusRef = useRef(null);

  useEffect(() => {
    // Toggle abierto/cerrado
    const onToggle = () => setAlertsOpen((v) => !v);
    const onOpen   = () => setAlertsOpen(true);
    const onClose  = () => setAlertsOpen(false);

    // Reemplazar lista completa
    const onSet = (e) => {
      const list = Array.isArray(e.detail) ? e.detail : [];
      setAlerts(list);
      setAlertsOpen(true);
    };

    // Agregar una alerta
    const onPush = (e) => {
      const item = e.detail;
      if (!item) return;
      setAlerts((prev) => [{ id: crypto.randomUUID?.() ?? Date.now(), ...item }, ...prev]);
      setAlertsOpen(true);
    };

    // Limpiar
    const onClear = () => setAlerts([]);

    window.addEventListener("pms:toggle-alerts", onToggle);
    window.addEventListener("pms:open-alerts", onOpen);
    window.addEventListener("pms:close-alerts", onClose);
    window.addEventListener("pms:set-alerts", onSet);
    window.addEventListener("pms:push-alert", onPush);
    window.addEventListener("pms:clear-alerts", onClear);

    // Cerrar con ESC
    const onKey = (e) => {
      if (e.key === "Escape") setAlertsOpen(false);
    };
    window.addEventListener("keydown", onKey);

    // Cerrar al hacer click fuera
    const onDocClick = (e) => {
      if (!alertsOpen && !userMenuOpen) return;
      const clickAlerts = panelRef.current && panelRef.current.contains(e.target);
      const clickMenus = menusRef.current && menusRef.current.contains(e.target);
      if (!clickAlerts && !clickMenus) {
        setAlertsOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);

    return () => {
      window.removeEventListener("pms:toggle-alerts", onToggle);
      window.removeEventListener("pms:open-alerts", onOpen);
      window.removeEventListener("pms:close-alerts", onClose);
      window.removeEventListener("pms:set-alerts", onSet);
      window.removeEventListener("pms:push-alert", onPush);
      window.removeEventListener("pms:clear-alerts", onClear);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [alertsOpen, userMenuOpen]);

  useEffect(() => {
    // Traer el fx del backend por hotel
    const loadFx = async () => {
      try {
        const { data } = await api.get("/hotel/currency");
        if (data) {
          const next = {
            ...fx,
            base: data.base || fx.base || "CRC",
            buy: Number(data.buy || 0),
            sell: Number(data.sell || 0),
            rates: { ...(fx.rates || {}), USD: Number(data.sell || data.buy || 0) },
          };
          setFx(next);
        }
      } catch (err) {
        console.error("No se pudo cargar tipo de cambio", err);
      }
    };
    loadFx();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const menu = [
    { to: ".", label: "Dashboard", end: true }, // index de /frontdesk
    { to: "planning", label: "Planner" },
    { to: "reservas", label: "Reservas" },
    { to: "facturacion", label: "Facturación" },
    { to: "habitaciones", label: "Habitaciones" },
    { to: "clientes", label: "Clientes" },
    { to: "reportes", label: "Reportes" },
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      {/* Sidebar */}
      <aside className="w-48 flex-shrink-0 overflow-hidden bg-gradient-to-b from-emerald-600 via-emerald-700 to-sky-700 text-white flex flex-col shadow-lg">
        <div className="px-2 py-4 border-b border-emerald-500/50 flex items-center justify-center">
          <img
            src="/kazehanalogo.png"
            alt="Logo del hotel"
            className="object-contain max-w-full"
            style={{ width: 130, height: 130 }}
          />
        </div>
        <nav className="flex-1 p-2.5 space-y-2">
          {menu.map((m) => (
            <NavLink
              key={m.label}
              to={m.to}
              end={m.end}
              className={({ isActive }) =>
                `block p-2 rounded ${isActive ? "bg-white/10 font-semibold" : "hover:bg-white/10"}`
              }
            >
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-5 border-t border-emerald-500/50 flex items-center gap-3">
          <img src="/kazehanalogo.png" alt="Logo" className="h-14 w-14 object-contain" />
          <div className="leading-tight">
            <div className="font-semibold text-white">Front Desk</div>
            <div className="text-xs text-emerald-100/80">Kazehana PMS</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header className="bg-white/90 backdrop-blur border-b border-emerald-100 shadow p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-emerald-900">Hotel Proyect</h1>
          <div className="flex items-center gap-4 relative" ref={menusRef}>
            <div className="hidden md:flex items-center">
              <div className="rounded-lg px-4 py-2 text-sm text-white bg-gradient-to-r from-emerald-600 via-emerald-700 to-sky-700 shadow">
                <span className="font-semibold">USD</span>
                <span className="ml-3">Compra ₡{fmtFx(fx.buy || fx.rates?.USD)}</span>
                <span className="ml-2">Venta ₡{fmtFx(fx.sell || fx.rates?.USD)}</span>
              </div>
            </div>
            <button
              className="relative p-2 rounded-lg border border-emerald-100 bg-white hover:bg-emerald-50/60"
              onClick={() => {
                setAlertsOpen((s) => !s);
                setUserMenuOpen(false);
              }}
              aria-label="Alertas"
            >
              <Bell className="w-4 h-4" />
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-3 px-1.5 py-0.5 rounded-full">
                  {alerts.length}
                </span>
              )}
            </button>
            <div className="relative">
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-emerald-50/60 text-sm"
                onClick={() => {
                  setUserMenuOpen((v) => !v);
                  setAlertsOpen(false);
                }}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <CircleUser className="w-5 h-5 text-gray-600" />
                <div className="text-left text-sm leading-tight">
                  <div className="font-medium text-gray-800">{user?.name || user?.email || "Usuario"}</div>
                  <div className="text-xs text-gray-500">{user?.role || "Hotel"}</div>
                </div>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border shadow-xl rounded-xl overflow-hidden z-30">
                  <div className="px-3 py-2 text-sm border-b">
                    <div className="font-semibold text-gray-800">{user?.name || "Usuario"}</div>
                    <div className="text-xs text-gray-500">{user?.email || user?.role || ""}</div>
                  </div>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate("/launcher");
                    }}
                  >
                    <LogOut className="w-4 h-4 text-emerald-700" />
                    <span>Salir</span>
                  </button>
                </div>
              )}
            </div>
            <span className="text-sm text-gray-600">{new Date().toLocaleDateString()}</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>

      {/* Panel de Alertas */}
      {alertsOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/20 z-40" />
          <div
            ref={panelRef}
            className="fixed top-20 right-6 w-[420px] max-h-[70vh] overflow-auto bg-white border shadow-2xl rounded-xl p-4 z-50"
            role="dialog"
            aria-modal="true"
            aria-label="Panel de alertas"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Alertas</div>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                  onClick={() => setAlerts([])}
                  title="Limpiar alertas"
                >
                  Limpiar
                </button>
                <button
                  className="text-sm text-gray-500 hover:text-gray-700"
                  onClick={() => setAlertsOpen(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>

            {alerts.length === 0 ? (
              <div className="text-sm text-gray-600">No hay alertas pendientes.</div>
            ) : (
              <ul className="space-y-3">
                {alerts.map((a) => {
                  const badge = TYPE_STYLES[a.type] || TYPE_STYLES.system;
                  return (
                    <li key={a.id ?? a.title} className="rounded-lg border bg-white p-3">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-xs ${badge}`}>
                          {a.type ?? "system"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {a.at ? new Date(a.at).toLocaleTimeString() : ""}
                        </span>
                      </div>
                      <div className="mt-1 font-medium">{a.title}</div>
                      {a.desc && <div className="text-sm text-gray-600">{a.desc}</div>}

                      {/* Acciones rápidas sugeridas */}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {a.type === "checkin" && (
                          <button
                            className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                            onClick={() => navigate("/frontdesk/reservas?q=today")}
                          >
                            Ver check-ins
                          </button>
                        )}
                        {a.type === "checkout" && (
                          <button
                            className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                            onClick={() => navigate("/frontdesk/reservas?q=today")}
                          >
                            Ver check-outs
                          </button>
                        )}
                        {a.type === "housekeeping" && (
                          <button
                            className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                            onClick={() => navigate("/frontdesk/habitaciones")}
                          >
                            Ir a habitaciones
                          </button>
                        )}
                        {a.type === "payment" && (
                          <button
                            className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                            onClick={() => navigate("/frontdesk/facturacion")}
                          >
                            Ir a facturación
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
