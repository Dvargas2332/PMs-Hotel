import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

const TYPE_STYLES = {
  checkin:      "bg-emerald-100 text-emerald-900",
  checkout:     "bg-sky-100 text-sky-900",
  housekeeping: "bg-amber-100 text-amber-900",
  payment:      "bg-purple-100 text-purple-900",
  system:       "bg-gray-100 text-gray-900",
};

export default function Layout() {
  const navigate = useNavigate();

  // Panel de alertas y listado
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]); // [{id?, type, title, desc, at?}]

  const panelRef = useRef(null);

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
      if (!alertsOpen) return;
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setAlertsOpen(false);
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
  }, [alertsOpen]);

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
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-green-950 text-white flex flex-col">
        <div className="p-4 text-2xl font-bold border-b border-green-900">Hotel Name</div>
        <nav className="flex-1 p-4 space-y-2">
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
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Hotel Proyect</h1>
          <div className="flex items-center gap-4">
            <span>{new Date().toLocaleDateString()}</span>
            <button className="bg-red-700 text-white px-3 py-1 rounded" onClick={() => navigate("/")}>
              Salir
            </button>
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
