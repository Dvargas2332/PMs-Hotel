import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CircleUser, LogOut, Bell, Sun, Moon } from "lucide-react";
import useConfigStore from "../store/configStore";
import { api } from "../lib/api";
import { frontdeskTheme } from "../theme/frontdeskTheme";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { filterAllowedAlerts, isAllowedAlert } from "../lib/alertFilter";

const TYPE_STYLES = {
  checkin:      "bg-emerald-100 text-emerald-900",
  checkout:     "bg-sky-100 text-sky-900",
  housekeeping: "bg-amber-100 text-amber-900",
  payment:      "bg-purple-100 text-purple-900",
  system:       "bg-gray-100 text-gray-900",
};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      {[{ value: "light", icon: Sun }, { value: "dark", icon: Moon }].map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
            theme === value ? "bg-emerald-500/30 text-emerald-700 dark:text-emerald-300" : "hover:bg-black/5 dark:hover:bg-white/10"
          }`}
          style={{ color: theme === value ? undefined : "var(--color-text-muted)" }}
          title={value}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { config, setFx } = useConfigStore();
  const fx = config?.accounting?.fx || {};
  const fmtFx = (v) => (v || v === 0 ? Number(v).toFixed(2) : "—");

  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const panelRef = useRef(null);
  const menusRef = useRef(null);

  useEffect(() => {
    const onToggle = () => setAlertsOpen((v) => !v);
    const onOpen   = () => setAlertsOpen(true);
    const onClose  = () => setAlertsOpen(false);
    const onSet = (e) => {
      const list = Array.isArray(e.detail) ? e.detail : [];
      setAlerts(filterAllowedAlerts(list));
      setAlertsOpen(true);
    };
    const onPush = (e) => {
      const item = e.detail;
      if (!item || !isAllowedAlert(item)) return;
      const id = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : String(Date.now());
      setAlerts((prev) => [{ id, ...item }, ...prev]);
      setAlertsOpen(true);
    };
    const onClear = () => setAlerts([]);

    window.addEventListener("pms:toggle-alerts", onToggle);
    window.addEventListener("pms:open-alerts", onOpen);
    window.addEventListener("pms:close-alerts", onClose);
    window.addEventListener("pms:set-alerts", onSet);
    window.addEventListener("pms:push-alert", onPush);
    window.addEventListener("pms:clear-alerts", onClear);

    const onKey = (e) => { if (e.key === "Escape") setAlertsOpen(false); };
    window.addEventListener("keydown", onKey);

    const onDocClick = (e) => {
      if (!alertsOpen && !userMenuOpen) return;
      const clickAlerts = panelRef.current && panelRef.current.contains(e.target);
      const clickMenus = menusRef.current && menusRef.current.contains(e.target);
      if (!clickAlerts && !clickMenus) { setAlertsOpen(false); setUserMenuOpen(false); }
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
        console.error("Could not load FX rate", err);
      }
    };
    loadFx();
  }, []);

  const menu = React.useMemo(
    () => [
      { to: ".", label: t("frontdesk.menu.dashboard"), end: true },
      { to: "planning", label: t("frontdesk.menu.planning") },
      { to: "reservas", label: t("frontdesk.menu.reservations") },
      { to: "inhouse", label: t("frontdesk.menu.inhouse") },
      { to: "facturacion", label: t("frontdesk.menu.billing") },
      { to: "habitaciones", label: t("frontdesk.menu.rooms") },
      { to: "clientes", label: t("frontdesk.menu.guests") },
      { to: "reportes", label: t("frontdesk.menu.reports") },
    ],
    [t]
  );

  return (
    <div className="flex h-screen" style={{ background: "var(--shell-bg)" }}>
      {/* Sidebar — mantiene gradiente de identidad de FrontDesk */}
      <aside className="w-48 flex-shrink-0 overflow-hidden bg-gradient-to-b from-emerald-600 via-emerald-700 to-sky-700 text-white flex flex-col shadow-lg">
        <div className="px-2 py-4 border-b border-emerald-500/50 flex items-center justify-center">
          <img src="/kazehanalogo.png" alt="Logo del hotel" className="object-contain max-w-full" style={{ width: 130, height: 130 }} />
        </div>
        <nav className="flex-1 p-2.5 space-y-2">
          {menu.map((m) => (
            <NavLink
              key={m.label}
              to={m.to}
              end={m.end}
              className={({ isActive }) =>
                `block p-2 rounded ${isActive ? "bg-white/20 font-semibold" : "hover:bg-white/10"}`
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
        <header
          className="backdrop-blur border-b shadow-sm p-4 flex justify-between items-center relative z-20"
          style={{ background: "var(--header-bg)", borderColor: "var(--card-border)" }}
        >
          <h1 className="text-xl font-bold text-emerald-700 dark:text-emerald-400">Hotel Project</h1>
          <div className="flex items-center gap-3 relative" ref={menusRef}>
            {/* FX rate */}
            <div className="hidden md:flex items-center">
              <div className="rounded-lg px-4 py-2 text-sm text-white bg-gradient-to-r from-emerald-600 via-emerald-700 to-sky-700 shadow">
                <span className="font-semibold">USD</span>
                <span className="ml-3">Buy {fmtFx(fx.buy || fx.rates?.USD)}</span>
                <span className="ml-2">Sell {fmtFx(fx.sell || fx.rates?.USD)}</span>
              </div>
            </div>

            <ThemeToggle />

            {/* Bell */}
            <button
              className="relative p-2 rounded-lg transition-colors"
              style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--color-text-base)" }}
              onClick={() => { setAlertsOpen((s) => !s); setUserMenuOpen(false); }}
              aria-label={t("layout.alertsTitle")}
            >
              <Bell className="w-4 h-4" />
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-3 px-1.5 py-0.5 rounded-full">
                  {alerts.length}
                </span>
              )}
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--color-text-base)" }}
                onClick={() => { setUserMenuOpen((v) => !v); setAlertsOpen(false); }}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <CircleUser className="w-5 h-5" style={{ color: "var(--color-text-muted)" }} />
                <div className="text-left text-sm leading-tight">
                  <div className="font-medium" style={{ color: "var(--color-text-base)" }}>{user?.name || user?.email || "User"}</div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{user?.role || "Hotel"}</div>
                </div>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 shadow-xl rounded-xl overflow-hidden z-30" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                  <div className="px-3 py-2 text-sm" style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <div className="font-semibold" style={{ color: "var(--color-text-base)" }}>{user?.name || "User"}</div>
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{user?.email || user?.role || ""}</div>
                  </div>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: "var(--color-text-base)" }}
                    onClick={() => { setUserMenuOpen(false); navigate("/launcher"); }}
                  >
                    <LogOut className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{t("common.logout")}</span>
                  </button>
                </div>
              )}
            </div>

            <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>{new Date().toLocaleDateString()}</span>
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
          <div className="fixed inset-0 bg-black/20 z-40" />
          <div
            ref={panelRef}
            className="fixed top-20 right-6 w-[420px] max-h-[70vh] overflow-auto shadow-2xl rounded-xl p-4 z-50"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--color-text-base)" }}
            role="dialog"
            aria-modal="true"
            aria-label={t("layout.alertsTitle")}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">{t("layout.alertsTitle")}</div>
              <div className="flex items-center gap-2">
                <button className="text-xs underline transition-colors" style={{ color: "var(--color-text-muted)" }} onClick={() => setAlerts([])}>{t("common.clear")}</button>
                <button className="text-sm transition-colors" style={{ color: "var(--color-text-muted)" }} onClick={() => setAlertsOpen(false)}>{t("common.close")}</button>
              </div>
            </div>
            {alerts.length === 0 ? (
              <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>{t("layout.noPendingAlerts")}</div>
            ) : (
              <ul className="space-y-3">
                {alerts.map((a) => {
                  const badge = TYPE_STYLES[a.type] || TYPE_STYLES.system;
                  return (
                    <li key={a.id || a.title} className="rounded-lg p-3" style={{ background: "var(--color-surface)", border: "1px solid var(--card-border)" }}>
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-xs ${badge}`}>{a.type || "system"}</span>
                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{a.at ? new Date(a.at).toLocaleTimeString() : ""}</span>
                      </div>
                      <div className="mt-1 font-medium" style={{ color: "var(--color-text-base)" }}>{a.title}</div>
                      {a.desc && <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>{a.desc}</div>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {a.type === "checkin" && (
                          <button className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/10" style={{ border: "1px solid var(--card-border)", color: "var(--color-text-base)" }} onClick={() => navigate("/frontdesk/reservas?q=today")}>{t("layout.viewCheckins")}</button>
                        )}
                        {a.type === "checkout" && (
                          <button className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/10" style={{ border: "1px solid var(--card-border)", color: "var(--color-text-base)" }} onClick={() => navigate("/frontdesk/reservas?q=today")}>{t("layout.viewCheckouts")}</button>
                        )}
                        {a.type === "housekeeping" && (
                          <button className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/10" style={{ border: "1px solid var(--card-border)", color: "var(--color-text-base)" }} onClick={() => navigate("/frontdesk/habitaciones")}>{t("layout.goToRooms")}</button>
                        )}
                        {a.type === "payment" && (
                          <button className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/10" style={{ border: "1px solid var(--card-border)", color: "var(--color-text-base)" }} onClick={() => navigate("/frontdesk/facturacion")}>{t("layout.goToBilling")}</button>
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
