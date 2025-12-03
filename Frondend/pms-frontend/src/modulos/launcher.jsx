import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Bell, Hotel, Settings, Banknote, UtensilsCrossed, LogOut, User2 } from "lucide-react";

import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tooltip, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { useAuth } from "../context/AuthContext";

const THEMES = {
  frontdesk: { from: "from-emerald-500/90", to: "to-sky-500/80", text: "text-white" },
  management: { from: "from-indigo-500/90", to: "to-blue-500/80", text: "text-white" },
  accounting: { from: "from-amber-500/90", to: "to-orange-500/80", text: "text-white" },
  restaurant: { from: "from-rose-500/90", to: "to-purple-500/80", text: "text-white" },
};

export default function Launcher() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [alerts, setAlerts] = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const modules = useMemo(
    () => [
      {
        name: "Front Desk",
        path: "/frontdesk",
        icon: Hotel,
        description: "Check-in/out, planning y reservas.",
        tag: "Operación",
        theme: THEMES.frontdesk,
      },
      {
        name: "Restaurant",
        path: "/restaurant",
        icon: UtensilsCrossed,
        description: "Órdenes y mesas.",
        tag: "F&D",
        theme: THEMES.restaurant,
      },
      {
        name: "Accounting",
        path: "/accounting",
        icon: Banknote,
        description: "Facturación y reportes.",
        tag: "Finanzas",
        theme: THEMES.accounting,
      },
      {
        name: "Management",
        path: "/management",
        icon: Settings,
        description: "Tarifas, usuarios, permisos.",
        tag: "Admin",
        theme: THEMES.management,
      },
    ],
    []
  );

  const filtered = modules;

  // Suscribirse a alertas globales
  useEffect(() => {
    const onToggle = () => setAlertsOpen((v) => !v);
    const onOpen = () => setAlertsOpen(true);
    const onClose = () => setAlertsOpen(false);
    const onSet = (e) => {
      const list = Array.isArray(e.detail) ? e.detail : [];
      setAlerts(list);
      setAlertsOpen(true);
    };
    const onPush = (e) => {
      const item = e.detail;
      if (!item) return;
      setAlerts((prev) => [{ id: crypto.randomUUID?.() ?? Date.now(), ...item }, ...prev]);
      setAlertsOpen(true);
    };
    const onClear = () => setAlerts([]);

    window.addEventListener("pms:toggle-alerts", onToggle);
    window.addEventListener("pms:open-alerts", onOpen);
    window.addEventListener("pms:close-alerts", onClose);
    window.addEventListener("pms:set-alerts", onSet);
    window.addEventListener("pms:push-alert", onPush);
    window.addEventListener("pms:clear-alerts", onClear);

    return () => {
      window.removeEventListener("pms:toggle-alerts", onToggle);
      window.removeEventListener("pms:open-alerts", onOpen);
      window.removeEventListener("pms:close-alerts", onClose);
      window.removeEventListener("pms:set-alerts", onSet);
      window.removeEventListener("pms:push-alert", onPush);
      window.removeEventListener("pms:clear-alerts", onClear);
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && focusedIndex >= 0) {
        navigate(filtered[focusedIndex].path);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, focusedIndex, navigate]);

  const openModule = (path) => navigate(path);

  return (
    <TooltipProvider>
      <div className="min-h-screen w-full bg-slate-50">
        <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6 px-6 py-8">
          {/* Columna izquierda: logo grande */}
          <div className="md:col-span-1 flex items-start justify-center">
            <div className="w-full rounded-3xl border bg-white shadow-lg p-6 flex flex-col items-center justify-center space-y-4">
              <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-400 rounded-3xl flex items-center justify-center w-full aspect-square max-w-[320px]">
                <img src="/kazehanalogo.png" alt="Kazehana PMS" className="h-64 w-64 md:h-72 md:w-72 object-contain drop-shadow-2xl" />
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">{user?.name || user?.email || "Usuario"}</div>
                <div className="text-xs text-gray-600">Selecciona un módulo para continuar.</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAlertsOpen((s) => !s)}
                  className="relative p-2 rounded-lg border bg-white hover:bg-slate-50"
                  aria-label="Alertas"
                >
                  <Bell size={16} className="text-emerald-600" />
                  {alerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-3 px-1.5 py-0.5 rounded-full">
                      {alerts.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium shadow-sm"
                >
                  <LogOut size={14} className="text-rose-600" />
                  log out
                </button>
              </div>
            </div>
          </div>

          {/* Columna derecha: módulos en columna */}
          <div className="md:col-span-2 space-y-4">
            {alertsOpen && (
              <Card className="p-4 shadow border-slate-200/80">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">Alertas</div>
                  <button
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                    onClick={() => setAlerts([])}
                  >
                    Limpiar
                  </button>
                </div>
                {alerts.length === 0 ? (
                  <div className="text-sm text-gray-500">No hay alertas.</div>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {alerts.map((a) => (
                      <li key={a.id ?? a.title} className="flex items-start gap-2 border rounded-lg px-3 py-2">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
                        <div>
                          <div className="font-medium text-gray-800">{a.title || a.msg || "Alerta"}</div>
                          {a.desc || a.msg ? (
                            <div className="text-xs text-gray-600">{a.desc || a.msg}</div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}

            <div className="grid auto-rows-fr grid-cols-1 gap-6">
              {filtered.map((mod, idx) => (
                <ModuleCard key={mod.name} mod={mod} focused={idx === focusedIndex} onOpen={() => openModule(mod.path)} />
              ))}
            </div>
          </div>
        </div>

        <footer className="mx-auto my-8 w-full max-w-6xl px-6 text-[11px] text-gray-600">
          <div className="flex items-center justify-between">
            <span>© {new Date().getFullYear()} Kazenohana PMS </span>
            <span className="hidden sm:inline-flex items-center gap-1" />
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}

function ModuleCard({ mod, onOpen, focused }) {
  const Icon = mod.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onOpen}
          className={`text-left transition focus:outline-none h-full w-full ${focused ? "ring-2 ring-offset-2 ring-blue-400" : ""}`}
        >
          <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md hover:shadow-lg transition transform hover:-translate-y-0.5 h-full">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className={`relative h-16 w-16 rounded-3xl bg-gradient-to-br ${mod.theme.from} ${mod.theme.to} shadow-md`}>
                  <div className="absolute inset-0 rounded-3xl opacity-30 bg-[radial-gradient(circle_at_30%_30%,white,transparent_55%)]" />
                  <div className="absolute inset-0 rounded-3xl opacity-20 bg-[radial-gradient(circle_at_70%_70%,white,transparent_55%)]" />
                  <div className="relative flex h-full w-full items-center justify-center">
                    <Icon className={`h-8 w-8 ${mod.theme.text}`} />
                  </div>
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-gray-900">{mod.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{mod.description}</p>
                </div>
              </div>
              <Badge variant="outline" className="rounded-sm text-[11px] border-gray-200 text-gray-700">
                {mod.tag}
              </Badge>
            </div>
            <div className="mt-4 flex items-center justify-between text-[12px] text-gray-500">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-800">Entrar</span>
                <ChevronRight className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-[11px] text-gray-400">{mod.path}</div>
            </div>
          </Card>
        </button>
      </TooltipTrigger>
    </Tooltip>
  );
}

