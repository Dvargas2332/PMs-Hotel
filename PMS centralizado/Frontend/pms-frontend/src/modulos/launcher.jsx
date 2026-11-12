import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Bell,
  Hotel,
  Settings,
  Banknote,
  UtensilsCrossed,
  FileCheck2,
  LogOut,
  X,
  ArrowRight,
  Sparkles,
  Info,
} from "lucide-react";

import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tooltip, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { filterAllowedAlerts, isAllowedAlert } from "../lib/alertFilter";
import { api } from "../lib/api";
import HelpPanel from "../components/HelpPanel";

const THEMES = {
  frontdesk: { from: "from-emerald-500/90", to: "to-sky-500/80", text: "text-white" },
  management: { from: "from-indigo-500/90", to: "to-blue-500/80", text: "text-white" },
  accounting: { from: "from-amber-500/90", to: "to-orange-500/80", text: "text-white" },
  restaurant: { from: "from-lime-500/90", to: "to-emerald-500/80", text: "text-white" },
  einvoicing: { from: "from-violet-500/90", to: "to-fuchsia-600/80", text: "text-white" },
};

// La base se identifica por su número de migraciones aplicadas (v1.0.71), no por
// el timestamp de la carpeta de Prisma (20261105190000), que no dice nada.
// El respaldo, si el conteo no llega, es la fecha con guiones: 05-11-2026.
function dbVersionLabel(info) {
  if (!info) return null;
  if (info.dbMigrations) return `v1.0.${info.dbMigrations}`;
  if (info.dbAppliedAt) {
    const d = new Date(info.dbAppliedAt);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}-${mm}-${d.getFullYear()}`;
  }
  return null;
}

export default function Launcher() {
  const navigate = useNavigate();
  const { hotel, user, loginUser, logout, logoutUser } = useAuth();
  const { t } = useLanguage();

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [alerts, setAlerts] = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [versionInfo, setVersionInfo] = useState(null);
  const [userLogin, setUserLogin] = useState({
    username: "",
    password: "",
    loading: false,
    error: "",
  });

  const modules = useMemo(
    () => [
      {
        code: "frontdesk",
        name: t("modules.frontdesk.name"),
        path: "/frontdesk",
        icon: Hotel,
        description: t("modules.frontdesk.desc"),
        tag: t("modules.frontdesk.tag"),
        theme: THEMES.frontdesk,
      },
      {
        code: "restaurant",
        name: t("modules.restaurant.name"),
        path: "/restaurant",
        icon: UtensilsCrossed,
        description: t("modules.restaurant.desc"),
        tag: t("modules.restaurant.tag"),
        theme: THEMES.restaurant,
      },
      {
        code: "accounting",
        name: t("modules.accounting.name"),
        path: "/accounting",
        icon: Banknote,
        description: t("modules.accounting.desc"),
        tag: t("modules.accounting.tag"),
        theme: THEMES.accounting,
      },
      {
        code: "einvoicing",
        name: t("modules.einvoicing.name"),
        path: "/e-invoicing",
        icon: FileCheck2,
        description: t("modules.einvoicing.desc"),
        tag: t("modules.einvoicing.tag"),
        theme: THEMES.einvoicing,
      },
      {
        code: "management",
        name: t("modules.management.name"),
        path: "/management",
        icon: Settings,
        description: t("modules.management.desc"),
        tag: t("modules.management.tag"),
        theme: THEMES.management,
      },
    ],
    [t]
  );

  // Módulos permitidos por membresía del HOTEL
  const filtered = useMemo(() => {
    const allowed = hotel?.allowedModules;
    if (!Array.isArray(allowed) || allowed.length === 0) return modules;
    // Backwards-compatible: some backends may not yet include new module codes
    // in the membership allow-list. Keep showing Electronic Invoicing so it can
    // be controlled via role permissions like the other modules.
    return modules.filter((m) => !m.code || allowed.includes(m.code) || m.code === "einvoicing");
  }, [modules, hotel?.allowedModules]);

  // Suscripción al bus de alertas globales
  useEffect(() => {
    const onToggle = () => setAlertsOpen((v) => !v);
    const onOpen = () => setAlertsOpen(true);
    const onClose = () => setAlertsOpen(false);
    const onSet = (e) => {
      const list = Array.isArray(e.detail) ? e.detail : [];
      setAlerts(filterAllowedAlerts(list));
      setAlertsOpen(true);
    };
    const onPush = (e) => {
      const item = e.detail;
      if (!item || !isAllowedAlert(item)) return;
    const id =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : String(Date.now());
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
    let active = true;
    api
      .get("/version")
      .then((res) => {
        if (!active) return;
        setVersionInfo(res?.data || null);
      })
      .catch(() => {
        if (!active) return;
        setVersionInfo(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleOpenModule = useCallback(
    (path) => {
      // Regla: el login del hotel NO puede entrar a módulos, solo al launcher.
      if (!user) {
        alert(t("launcher.mustLoginUser"));
        return;
      }
      navigate(path);
    },
    [navigate, t, user]
  );

  // Navegación por teclado entre módulos
  useEffect(() => {
    if (!user) {
      setFocusedIndex(-1);
      return;
    }

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
        handleOpenModule(filtered[focusedIndex].path);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, focusedIndex, handleOpenModule, user]);

  const handleUserLoginSubmit = async (e) => {
    e?.preventDefault?.();
    if (userLogin.loading) return;
    setUserLogin((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const u = await loginUser(userLogin.username, userLogin.password);
      if (!u) {
        setUserLogin((prev) => ({
          ...prev,
          error: t("launcher.invalidCreds"),
          loading: false,
        }));
        return;
      }
      setUserLogin({ username: "", password: "", loading: false, error: "" });
    } catch (err) {
      setUserLogin((prev) => ({
        ...prev,
        error: t("launcher.userLoginFailed"),
        loading: false,
      }));
    }
  };

  const handleHotelLogout = () => {
    logout();
    navigate("/login");
  };

  const handleUserLogout = () => {
    logoutUser();
  };

  const allowedModules = useMemo(() =>
    filtered.filter((mod) => {
      if (!user) return false;
      // El perfil ADMIN ve todos los módulos que contrata el hotel.
      const role = String(user.role || user.roleId || "").toUpperCase();
      if (role === "ADMIN") return true;
      const hasAllowedModules = Array.isArray(user.allowedModules) && user.allowedModules.length > 0;
      const allowedByList = hasAllowedModules ? user.allowedModules.includes(mod.code) : false;
      const allowedByPerms = Array.isArray(user.permissions)
        ? user.permissions.some((p) => typeof p === "string" && p.startsWith(`${mod.code}.`))
        : false;
      return allowedByList || allowedByPerms;
    }),
    [filtered, user]
  );

  return (
    <TooltipProvider>
      {/* Fondo con patrón sutil */}
      <div className="h-screen w-full relative overflow-hidden flex flex-col" data-module="launcher" style={{ background: "var(--shell-bg)", color: "var(--color-text-base)" }}>
        {/* Orbs decorativos — solo visibles en dark */}
        <div className="dark:block hidden pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="dark:block hidden pointer-events-none absolute top-1/2 -right-48 h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-3xl" />
        <div className="dark:block hidden pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative mx-auto w-full max-w-7xl px-4 pt-8 pb-0 sm:px-6 lg:px-8 flex flex-col flex-1 overflow-hidden">

          {/* ── TOP BAR ── */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/kazehanalogo.png" alt="Kazehana PMS" className="h-9 w-9 object-contain" />
              <div>
                <div className="text-sm font-bold leading-none" style={{ color: "var(--color-text-base)" }}>Kazehana PMS</div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  v{versionInfo?.appVersion || "0.0.0"}
                  {dbVersionLabel(versionInfo) ? ` · DB ${dbVersionLabel(versionInfo)}` : ""}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Ayuda y soporte */}
              <button
                onClick={() => setHelpOpen(true)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/20"
                style={{ color: "var(--color-text-base)", border: "1px solid var(--card-border)" }}
                aria-label="Ayuda y soporte"
              >
                <Info size={14} className="text-emerald-500" />
                <span className="hidden sm:inline">Ayuda</span>
              </button>
              {/* Campana de alertas */}
              <button
                onClick={() => setAlertsOpen((s) => !s)}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/20"
                style={{ color: "var(--color-text-base)", border: "1px solid var(--card-border)" }}
                aria-label={t("launcher.alerts")}
              >
                <Bell size={16} />
                {alerts.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {alerts.length}
                  </span>
                )}
              </button>
              {/* Logout hotel / usuario */}
              {user ? (
                <button
                  onClick={handleUserLogout}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/20"
                  style={{ color: "var(--color-text-base)", border: "1px solid var(--card-border)" }}
                >
                  <LogOut size={13} className="text-amber-500" />
                  {t("launcher.userLogout")}
                </button>
              ) : (
                <button
                  onClick={handleHotelLogout}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/20"
                  style={{ color: "var(--color-text-base)", border: "1px solid var(--card-border)" }}
                >
                  <LogOut size={13} className="text-rose-500" />
                  {t("launcher.hotelLogout")}
                </button>
              )}
            </div>
          </div>

          {/* ── PANEL DE ALERTAS ── */}
          {alertsOpen && (
            <div className="mb-6 rounded-2xl p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--color-text-base)" }}>
                  <Bell size={14} className="text-amber-500" />
                  {t("launcher.alerts")}
                </div>
                <div className="flex gap-3">
                  <button className="text-xs transition-colors hover:opacity-70" style={{ color: "var(--color-text-muted)" }} onClick={() => setAlerts([])}>
                    {t("launcher.clear")}
                  </button>
                  <button className="text-xs transition-colors hover:opacity-70" style={{ color: "var(--color-text-muted)" }} onClick={() => setAlertsOpen(false)}>
                    <X size={14} />
                  </button>
                </div>
              </div>
              {alerts.length === 0 ? (
                <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>{t("launcher.noAlerts")}</div>
              ) : (
                <ul className="space-y-2">
                  {alerts.map((a) => (
                    <li key={a.id ?? a.title} className="flex items-start gap-3 rounded-xl px-3 py-2" style={{ background: "var(--color-surface-2)", border: "1px solid var(--card-border)" }}>
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                      <div>
                        <div className="text-sm font-medium" style={{ color: "var(--color-text-base)" }}>{a.title || a.msg || t("launcher.alert")}</div>
                        {(a.desc || a.msg) && <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{a.desc || a.msg}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── LAYOUT PRINCIPAL ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">

            {/* ── SIDEBAR HOTEL/USUARIO ── */}
            <div className="flex flex-col gap-4 overflow-y-auto launcher-scroll pr-1">
              {/* Card hotel */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-px shadow-xl shadow-emerald-900/30">
                <div className="relative rounded-[23px] bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-400 p-6 text-center overflow-hidden">
                  {/* Brillo interno */}
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,white,transparent_50%)] opacity-20" />
                  <div className="relative">
                    <img
                      src="/kazehanalogo.png"
                      alt="Kazehana PMS"
                      className="mx-auto mb-4 h-28 w-28 sm:h-36 sm:w-36 xl:h-44 xl:w-44 object-contain drop-shadow-2xl"
                    />
                    <div className="text-lg font-bold text-white">{hotel?.name || "Hotel"}</div>
                    <div className="text-xs text-emerald-100 mt-0.5">{hotel?.email || t("launcher.hotelSession")}</div>
                    {hotel?.membership && (
                      <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                        <Sparkles size={11} />
                        {hotel.membership}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card login / usuario */}
              <div className="rounded-2xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                {user ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                        {(user.name || user.username || "U")[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: "var(--color-text-base)" }}>{user.name || user.username}</div>
                        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                          {Array.isArray(user.roles) ? user.roles.join(", ") : user.role || "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUserLoginSubmit} className="space-y-4" autoComplete="off">
                    <input type="text" name="fake_username" autoComplete="username" className="hidden" />
                    <input type="password" name="fake_password" autoComplete="new-password" className="hidden" />
                    <div>
                      <h2 className="text-sm font-bold" style={{ color: "var(--color-text-base)" }}>{t("launcher.userLoginTitle")}</h2>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Nombre</label>
                        <input
                          name="launcher_username"
                          value={userLogin.username}
                          onChange={(e) => setUserLogin((prev) => ({ ...prev, username: e.target.value }))}
                          placeholder="Nombre completo"
                          autoComplete="off"
                          className="h-10 w-full rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                          style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--color-text-base)" }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{t("launcher.password")}</label>
                        <input
                          // Tipo texto con puntos: así Chrome no ofrece guardar la contraseña.
                          type="text"
                          name="launcher_pass"
                          value={userLogin.password}
                          onChange={(e) => setUserLogin((prev) => ({ ...prev, password: e.target.value }))}
                          placeholder="••••••••"
                          autoComplete="off"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-form-type="other"
                          spellCheck={false}
                          className="h-10 w-full rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                          style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--color-text-base)", WebkitTextSecurity: "disc" }}
                        />
                      </div>
                    </div>
                    {userLogin.error && (
                      <div className="rounded-xl px-3 py-2 text-xs text-red-600 dark:text-red-300" style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)" }}>
                        {userLogin.error}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={userLogin.loading}
                      className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-semibold text-white shadow-md hover:from-emerald-400 hover:to-teal-400 disabled:opacity-60 transition-all"
                    >
                      {userLogin.loading ? t("launcher.signingIn") : t("common.enter")}
                    </button>
                  </form>
                )}
              </div>

            </div>

            {/* ── GRID DE MÓDULOS ── */}
            <div className="flex flex-col overflow-y-auto launcher-scroll pb-6 pr-1">
              {!user ? (
                <div className="flex flex-1 items-center justify-center px-2 py-8">
                  <div className="text-center">
                    <div className="text-3xl sm:text-4xl xl:text-5xl font-bold mb-2" style={{ color: "var(--color-text-base)" }}>{t("Launcher.Welcome")}</div>
                    <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>{t("Launcher.subtitle")}</div>
                  </div>
                </div>
              ) : (
                <>
                  {allowedModules.length > 0 && (
                    <div className="mb-5">
                      <h1 className="text-xl font-bold" style={{ color: "var(--color-text-base)" }}>Módulos disponibles</h1>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {allowedModules.map((mod, idx) => (
                      <ModuleCard
                        key={mod.code}
                        mod={mod}
                        focused={idx === focusedIndex}
                        onOpen={() => handleOpenModule(mod.path)}
                        disabled={false}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
        {/* ── FOOTER ── fijo al fondo, fuera del scroll */}
        <footer className="relative flex shrink-0 items-center justify-between px-4 py-3 text-[11px] sm:px-6 lg:px-8" style={{ color: "var(--color-text-muted)", borderTop: "1px solid var(--card-border)" }}>
          <span>© {new Date().getFullYear()} Kazehana Cloud · Todos los derechos reservados</span>
          <span className="hidden sm:block">
            {t("launcher.version.system")} v{versionInfo?.appVersion || "0.0.0"}
            {dbVersionLabel(versionInfo) ? ` · ${t("launcher.version.db")} ${dbVersionLabel(versionInfo)}` : ""}
          </span>
        </footer>

        <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} contextLabel={hotel?.name} />
      </div>
    </TooltipProvider>
  );
}

function ModuleCard({ mod, onOpen, focused }) {
  const Icon = mod.icon;
  const { t } = useLanguage();
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative w-full text-left focus:outline-none transition-all duration-200 ${
        focused ? "ring-2 ring-emerald-400/60 ring-offset-2 rounded-2xl" : ""
      }`}
    >
      <div
        className="relative overflow-hidden rounded-2xl transition-all duration-200"
        style={{
          background: "var(--card-bg)",
          border: `1px solid ${hovered ? "rgba(0,0,0,0.22)" : "var(--card-border)"}`,
          boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.12)" : "0 1px 4px rgba(0,0,0,0.06)",
          transform: hovered ? "translateY(-2px) scale(1.01)" : "none",
        }}
      >
        {/* Barra de color del módulo */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${mod.theme.from} ${mod.theme.to}`} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div
              className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${mod.theme.from} ${mod.theme.to} shadow-lg transition-transform duration-200 ${
                hovered ? "scale-110" : "scale-100"
              }`}
            >
              <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_25%,white,transparent_55%)] opacity-25" />
              <Icon className="relative h-7 w-7 text-white" />
            </div>
            <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ background: "var(--color-surface-2)", border: "1px solid var(--card-border)", color: "var(--color-text-muted)" }}>
              {mod.tag}
            </span>
          </div>
          <h3 className="text-base font-bold mb-1" style={{ color: "var(--color-text-base)" }}>{mod.name}</h3>
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--color-text-muted)" }}>{mod.description}</p>
          <div
            className="mt-4 flex items-center gap-2 text-xs font-semibold transition-all duration-200"
            style={{ color: hovered ? "var(--color-text-base)" : "var(--color-text-muted)" }}
          >
            <span>{t("common.enter")}</span>
            <ArrowRight
              size={14}
              className={`transition-transform duration-200 ${hovered ? "translate-x-1" : "translate-x-0"}`}
            />
          </div>
        </div>
      </div>
    </button>
  );
}
