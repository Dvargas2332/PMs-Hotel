// src/pages/Management/ManagementPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Bell, CircleUser, LogOut, Users, ClipboardList, BedDouble, UtensilsCrossed, Calculator, Network, SlidersHorizontal } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import Roles from "./Roles";
import AuditLog from "./AuditLog";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { SimpleTable } from "../../components/ui/table";
import { Select } from "../../components/ui/select";
import { api } from "../../lib/api";
import { filterAllowedAlerts, isAllowedAlert } from "../../lib/alertFilter";

// Frontdesk
import FrontdeskConfig from "./Frontdesk/FrontdeskConfig";

import AccountingConfig from "./SomeModule/AccountingConfig";
import RestaurantConfig from "./SomeModule/RestaurantConfig";
import ChannelManager from "./SomeModule/ChannelManager";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { Sun, Moon, Globe } from "lucide-react";


function ProfilesView() {
  return <Roles />;
}

function ThemeToggleHeader() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex h-9 w-9 items-center justify-center rounded-xl hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
      style={{ color: "var(--color-text-base)" }}
      title={isDark ? "Cambiar a claro" : "Cambiar a oscuro"}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

function AppearanceView() {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { hotel } = useAuth();
  const isDark = theme === "dark";

  return (
    <div className="space-y-8 max-w-md">
      {/* Header */}
      <div>
        <div className="text-lg font-semibold" style={{ color: "var(--color-text-base)" }}>
          {t("mgmt.appearance.title")}
        </div>
        <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          {t("mgmt.appearance.subtitle")}
        </div>
      </div>

      {/* Tenant badge */}
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15">
          <Globe className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            {t("mgmt.appearance.globalScope")}
          </div>
          <div className="text-sm font-semibold truncate" style={{ color: "var(--color-text-base)" }}>
            {hotel?.name || "Hotel PMS"}
          </div>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-300">
          tenant
        </span>
      </div>

      {/* Switch pill */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isDark
              ? <Moon className="w-4 h-4 text-indigo-400" />
              : <Sun className="w-4 h-4 text-amber-500" />
            }
            <span className="text-sm font-medium" style={{ color: "var(--color-text-base)" }}>
              {isDark ? t("mgmt.appearance.dark") : t("mgmt.appearance.light")}
            </span>
          </div>

          {/* Toggle pill */}
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            role="switch"
            aria-checked={isDark}
            className="relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            style={{ background: isDark ? "rgb(99 102 241)" : "var(--card-border)" }}
          >
            <span
              className="pointer-events-none inline-block h-6 w-6 transform rounded-full shadow-lg ring-0 transition duration-200"
              style={{
                background: "white",
                transform: isDark ? "translateX(20px)" : "translateX(0px)",
              }}
            />
          </button>
        </div>

        {/* Preview strip */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--card-border)" }}
        >
          <div className="flex h-16">
            <div className="w-1/3 bg-gradient-to-b from-indigo-600 to-indigo-700 flex items-center justify-center">
              <div className="space-y-1 px-3 w-full">
                <div className="h-1.5 w-3/4 rounded bg-white/30" />
                <div className="h-1.5 w-1/2 rounded bg-white/20" />
                <div className="h-1.5 w-2/3 rounded bg-white/20" />
              </div>
            </div>
            <div
              className="flex-1 p-2 space-y-1.5"
              style={{ background: isDark ? "#0f172a" : "#f8fafc" }}
            >
              <div className="flex gap-1.5">
                <div className="h-2 w-1/3 rounded" style={{ background: isDark ? "#334155" : "#e2e8f0" }} />
                <div className="h-2 w-1/4 rounded" style={{ background: isDark ? "#1e293b" : "#f1f5f9" }} />
              </div>
              <div className="h-5 rounded" style={{ background: isDark ? "#1e293b" : "#ffffff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}` }} />
              <div className="h-2 w-2/3 rounded" style={{ background: isDark ? "#334155" : "#e2e8f0" }} />
            </div>
          </div>
        </div>

        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {t("mgmt.appearance.note")}
        </p>
      </div>
    </div>
  );
}


const CompanyGeneralInfoView = React.lazy(() => import("./Hotel/CompanyInfo"));

const VIEWS = {
  // Info general
  hotelInfo: CompanyGeneralInfoView,

  // Perfiles (launcher + roles internos)
  profiles: ProfilesView,
  usageLog: AuditLog,

  // Frontdesk
  frontdeskConfig: FrontdeskConfig,

  // Accounting
  accountingConfig: AccountingConfig,

  // Restaurant
  restaurantConfig: RestaurantConfig,

  // Channel manager
  channelManager: ChannelManager,

};

export default function ManagementPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hotel } = useAuth();
  const [selected, setSelected] = useState("hotelInfo");
  // Cada vez que se elige una sección del menú se remonta su pantalla, para que
  // abra en su vista inicial y no en la última que quedó (Restaurante abría en
  // Inventario si se llegó antes con ?tab=inventory).
  const [viewNonce, setViewNonce] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menusRef = useRef(null);

  // ── Campana de notificaciones (estado actual y trabajo futuro) ─────────────
  //
  // Hoy NO son notificaciones reales: `alerts` es estado en memoria que se llena
  // con eventos `pms:push-alert` del navegador y se vacía al recargar. Además
  // `lib/alertFilter` sólo deja pasar tres casos (kind "einvoice.error",
  // "reservation.channel_manager" y textos de facturación electrónica con palabra
  // de error), así que el resto de lo que emite la app se descarta en silencio.
  //
  // Pendiente de producto: convertirla en notificaciones de verdad.
  //   1. Tabla en la base (id, hotelId, userId, kind, title, desc, readAt, createdAt)
  //      con su migración de Prisma y el guard multi-tenant de siempre.
  //   2. Endpoint en la API: GET de las del usuario, PATCH para marcar leídas y
  //      el POST interno que usan los controladores al generar el aviso.
  //   3. Campana persistente por usuario: badge con las no leídas, sondeo corto
  //      (o SSE/WS si algún día hay servidor de eventos) y sobrevive al refresco.
  //   4. Sustituir los `pms:push-alert` por llamadas a ese endpoint, para que el
  //      aviso exista aunque el usuario no estuviera en la pantalla.
  //
  // Al implementarlo, `lib/alertFilter` deja de tener sentido: el filtro pasa a
  // ser por `kind` en el backend, no por coincidencia de texto en el navegador.
  // Escucha eventos globales de alertas para mantener consistencia con el resto del app
  useEffect(() => {
    const onToggle = () => setAlertsOpen((v) => !v);
    const onOpen = () => setAlertsOpen(true);
    const onClose = () => setAlertsOpen(false);
    const onSet = (e) => setAlerts(filterAllowedAlerts(Array.isArray(e.detail) ? e.detail : []));
    const onPush = (e) => {
      const item = e.detail;
      if (!item || !isAllowedAlert(item)) return;
      setAlerts((prev) => [{ id: item.id || crypto.randomUUID?.() || Date.now(), ...item }, ...prev]);
      setAlertsOpen(true);
    };
    const onClear = () => setAlerts([]);

    window.addEventListener("pms:toggle-alerts", onToggle);
    window.addEventListener("pms:open-alerts", onOpen);
    window.addEventListener("pms:close-alerts", onClose);
    window.addEventListener("pms:set-alerts", onSet);
    window.addEventListener("pms:push-alert", onPush);
    window.addEventListener("pms:clear-alerts", onClear);

    const onDocClick = (e) => {
      if (!alertsOpen && !userMenuOpen) return;
      if (menusRef.current && !menusRef.current.contains(e.target)) {
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
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [alertsOpen, userMenuOpen]);

  const handleLogout = () => {
    // Mantiene sesión y regresa al launcher
    navigate("/launcher");
  };

  const handleGeneralInfo = () => {
    setSelected("hotelInfo");
  };


  const allowedModules = useMemo(() => {
    const list = hotel?.allowedModules;
    if (!Array.isArray(list) || list.length == 0) return null;
    return new Set(list.map((m) => String(m).toLowerCase()));
  }, [hotel?.allowedModules]);

  const isModuleEnabled = (code) => {
    if (!code) return true;
    if (!allowedModules) return true;
    return allowedModules.has(String(code).toLowerCase());
  };
  const menu = useMemo(
    () => [
      {
        title: t("mgmt.shell.menu.profilesTitle"),
        key: "profiles",
        icon: Users,
        items: [{ id: "profiles", label: t("mgmt.shell.menu.profilesItem"), icon: Users, requires: "management" }],
      },
      {
        title: t("mgmt.shell.menu.auditTitle"),
        key: "audit",
        icon: ClipboardList,
        items: [{ id: "usageLog", label: t("mgmt.shell.menu.auditItem"), icon: ClipboardList, requires: "management" }],
      },
      {
        title: t("modules.frontdesk.name"),
        key: "frontdesk",
        icon: BedDouble,
        items: [
          { id: "frontdeskConfig", label: t("mgmt.shell.menu.frontdesk.config"), icon: SlidersHorizontal, requires: "frontdesk" },
        ],
      },
      {
        title: t("modules.restaurant.name"),
        key: "restaurant",
        icon: UtensilsCrossed,
        items: [
          { id: "restaurantConfig", label: t("mgmt.shell.menu.restaurant.config"), icon: SlidersHorizontal, requires: "restaurant" },
        ],
      },
      {
        title: t("modules.accounting.name"),
        key: "accounting",
        icon: Calculator,
        items: [
          { id: "accountingConfig", label: t("mgmt.shell.menu.accounting.config"), icon: SlidersHorizontal, requires: "accounting" },
        ],
      },
      {
        title: t("mgmt.shell.menu.channel.title"),
        key: "channel",
        icon: Network,
        items: [
          { id: "channelManager", label: t("mgmt.shell.menu.channel.config"), icon: SlidersHorizontal, requires: "channel_manager" },
        ],
      },
    ],
    [t]
  );

  const filteredMenu = useMemo(() => {
    return menu
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => isModuleEnabled(item.requires)),
      }))
      .filter((group) => group.items.length > 0);
  }, [menu, allowedModules]);

  const selectedGroupKey = useMemo(() => {
    for (const g of filteredMenu) if (g.items.some((i) => i.id === selected)) return g.key;
    return null;
  }, [filteredMenu, selected]);

  const [expanded, setExpanded] = useState(() => new Set(selectedGroupKey ? [selectedGroupKey] : []));
  const toggleGroup = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const view = params.get("view");
    if (!view) return;
    if (!VIEWS[view]) return;

    setSelected((cur) => (cur === view ? cur : view));
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const g of filteredMenu) {
        if (g.items.some((i) => i.id === view)) next.add(g.key);
      }
      return next;
    });
  }, [location.search, filteredMenu]);

  useEffect(() => {
    if (!filteredMenu.length) return;
    // "hotelInfo" es la sección fija de Información general, no vive en el menú.
    const isValid =
      selected === "hotelInfo" || filteredMenu.some((g) => g.items.some((i) => i.id === selected));
    if (!isValid) {
      setSelected(filteredMenu[0].items[0].id);
    }
  }, [filteredMenu, selected]);

  const renderSection = () => {
    const Comp = VIEWS[selected];
    if (!Comp) return <div className="p-6" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.shell.selectPrompt")}</div>;
    return (
      <React.Suspense fallback={<div className="p-6" style={{ color: "var(--color-text-muted)" }}>{t("common.loading")}</div>}>
        <Comp key={`${selected}-${viewNonce}`} />
      </React.Suspense>
    );
  };

  return (
    <div
      className="h-screen w-full flex flex-col overflow-hidden"
      data-module="management"
      style={{
        background: "var(--shell-bg)",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Header */}
      <header className="relative z-20 shrink-0 flex items-center justify-between px-6 py-4 backdrop-blur-sm" style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--sidebar-border)" }}>
        <div className="flex items-center gap-3">
          <img src="/kazehanalogo.png" alt={t("mgmt.shell.logoAlt")} className="h-8 w-8 object-contain" />
          <div className="space-y-0.5">
            <div className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-400">{t("modules.management.name")}</div>
            <div className="text-sm font-semibold" style={{ color: "var(--color-text-base)" }}>{t("mgmt.shell.header.title")}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 relative" ref={menusRef}>
          {/* Toggle tema global */}
          <ThemeToggleHeader />

          {/* Campana alertas */}
          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-xl hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
            style={{ color: "var(--color-text-base)" }}
            onClick={() => { setAlertsOpen((v) => !v); setUserMenuOpen(false); }}
            aria-label={t("mgmt.shell.alertsAria")}
          >
            <Bell className="w-4 h-4" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {alerts.length}
              </span>
            )}
          </button>
          {alertsOpen && (
            <div className="absolute right-0 top-12 w-80 shadow-xl rounded-2xl p-3 z-50 max-h-80 overflow-y-auto" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-sm" style={{ color: "var(--color-text-base)" }}>{t("launcher.alerts")}</div>
                <button className="text-xs transition-colors" style={{ color: "var(--color-text-muted)" }} onClick={() => setAlerts([])}>
                  {t("launcher.clear")}
                </button>
              </div>
              {alerts.length === 0 ? (
                <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>{t("launcher.noAlerts")}</div>
              ) : (
                <ul className="space-y-2">
                  {alerts.map((a) => (
                    <li key={a.id ?? a.title} className="rounded-xl bg-white/5 border border-white/5 px-3 py-2 text-sm">
                      <div className="font-medium text-white">{a.title || t("launcher.alert")}</div>
                      {a.desc && <div className="text-slate-400 text-xs mt-0.5">{a.desc}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Menú usuario */}
          <div className="relative">
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/20 text-sm transition-colors"
              style={{ color: "var(--color-text-base)" }}
              onClick={() => { setUserMenuOpen((v) => !v); setAlertsOpen(false); }}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
            >
              <CircleUser className="w-5 h-5" style={{ color: "var(--color-text-muted)" }} />
              <div className="text-left text-sm leading-tight">
                <div className="font-medium" style={{ color: "var(--color-text-base)" }}>{user?.name || user?.email || t("mgmt.shell.userFallback")}</div>
                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{user?.role || t("mgmt.shell.roleFallback")}</div>
              </div>
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 shadow-xl rounded-2xl overflow-hidden z-50" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="px-3 py-2 text-sm" style={{ borderBottom: "1px solid var(--card-border)" }}>
                  <div className="font-semibold" style={{ color: "var(--color-text-base)" }}>{user?.name || t("mgmt.shell.userFallback")}</div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{user?.email || user?.role || ""}</div>
                </div>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                  style={{ color: "var(--color-text-muted)" }}
                  onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                >
                  <LogOut className="w-4 h-4 text-red-400" />
                  <span>{t("common.logout")}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar nav */}
        <aside className="w-64 shrink-0 flex flex-col overflow-hidden" style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}>
          {/* Logo grande */}
          <div className="flex items-center justify-center py-6" style={{ borderBottom: "1px solid var(--sidebar-border)", background: "rgba(99,102,241,0.08)" }}>
            <img src="/kazehanalogo.png" alt={t("mgmt.shell.logoAlt")} className="h-24 w-24 object-contain" />
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {isModuleEnabled("frontdesk") && (
              <>
                
                <button
                  onClick={handleGeneralInfo}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white px-3 py-2 text-sm font-semibold shadow-lg shadow-indigo-900/40 transition-all"
                >
                  {t("mgmt.shell.generalInfo")}
                </button>
                <div className="my-2" style={{ borderTop: "1px solid var(--sidebar-border)" }} />
              </>
            )}

            <div className="text-[11px] uppercase tracking-wide px-1 pb-1" style={{ color: "var(--color-text-muted)" }}>{t("einv.nav.title")}</div>

            {filteredMenu.map((group) => {
              const isOpen = expanded.has(group.key);

              if (group.key === "profiles") {
                return (
                  <button
                    key={group.key}
                    onClick={() => setSelected("profiles")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                      selected === "profiles"
                        ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-900/40"
                        : "hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                    style={selected !== "profiles" ? { color: "var(--color-text-base)" } : {}}
                  >
                    <span className="flex items-center gap-3">
                      {group.icon ? <group.icon className="w-4 h-4 shrink-0" /> : null}
                      {group.title}
                    </span>
                  </button>
                );
              }

              return (
                <div key={group.key}>
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: "var(--color-text-base)" }}
                    aria-expanded={isOpen}
                  >
                    <span className="flex items-center gap-3">
                      {group.icon ? <group.icon className="w-4 h-4 shrink-0" /> : null}
                      {group.title}
                    </span>
                    <ChevronRight className={`h-4 w-4 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`} />
                  </button>
                  <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isOpen ? "max-h-[1000px]" : "max-h-0"}`}>
                    <ul className="pl-3 pr-1 pb-1 space-y-0.5">
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <button
                            onClick={() => {
                              if (item.href) {
                                navigate(item.href);
                                return;
                              }
                              setSelected(item.id);
                              setViewNonce((n) => n + 1);
                              // Se limpia la query para no arrastrar un ?tab= de
                              // un enlace anterior (p. ej. el tile de Inventario).
                              if (location.search) {
                                navigate({ pathname: location.pathname, search: `?view=${item.id}` }, { replace: true });
                              }
                              if (!expanded.has(group.key)) toggleGroup(group.key);
                            }}
                            className={`flex w-full items-center gap-2.5 text-left text-sm rounded-xl px-3 py-2 transition-all ${
                              selected === item.id
                                ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-900/40 font-semibold"
                                : "hover:bg-black/5 dark:hover:bg-white/10"
                            }`}
                            style={selected !== item.id ? { color: "var(--color-text-base)" } : {}}
                          >
                            {item.icon ? <item.icon className="w-4 h-4 shrink-0" /> : null}
                            {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Logo footer */}
          <div className="flex items-center gap-3 px-4 py-4 shrink-0" style={{ borderTop: "1px solid var(--sidebar-border)", background: "#4f46e5" }}>
            <img src="/kazehanalogo.png" alt={t("mgmt.shell.logoAlt")} className="h-10 w-10 object-contain opacity-70" />
            <div>
              <div className="text-sm font-semibold leading-tight" style={{ color: "#ffffff" }}>Kazehana PMS</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>{t("modules.management.name")}</div>
            </div>
          </div>
        </aside>

        {/* Contenido principal */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}

