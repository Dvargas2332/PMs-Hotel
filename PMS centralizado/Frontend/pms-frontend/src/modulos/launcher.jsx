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
} from "lucide-react";

import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tooltip, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { filterAllowedAlerts, isAllowedAlert } from "../lib/alertFilter";
import { api } from "../lib/api";
import { Sun, Moon } from "lucide-react";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1">
      {[{ value: "light", icon: Sun }, { value: "dark", icon: Moon }].map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
            theme === value ? "bg-white/20 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"
          }`}
          title={value}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}

const THEMES = {
  frontdesk: { from: "from-emerald-500/90", to: "to-sky-500/80", text: "text-white" },
  management: { from: "from-indigo-500/90", to: "to-blue-500/80", text: "text-white" },
  accounting: { from: "from-amber-500/90", to: "to-orange-500/80", text: "text-white" },
  restaurant: { from: "from-lime-500/90", to: "to-emerald-500/80", text: "text-white" },
  einvoicing: { from: "from-violet-500/90", to: "to-fuchsia-600/80", text: "text-white" },
};

export default function Launcher() {
  const navigate = useNavigate();
  const { hotel, user, loginUser, logout, logoutUser } = useAuth();
  const { t } = useLanguage();

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [alerts, setAlerts] = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
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
      <div className="h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden flex flex-col">
        {/* Orbs decorativos de fondo */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 -right-48 h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative mx-auto w-full max-w-7xl px-4 pt-8 pb-0 sm:px-6 lg:px-8 flex flex-col flex-1 overflow-hidden">

          {/* ── TOP BAR ── */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/kazehanalogo.png" alt="Kazehana PMS" className="h-9 w-9 object-contain" />
              <div>
                <div className="text-sm font-bold text-white leading-none">Kazehana PMS</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  v{versionInfo?.appVersion || "0.0.0"}
                  {versionInfo?.dbVersion ? ` · DB ${String(versionInfo.dbVersion).split("_")[0]}` : ""}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {/* Campana de alertas */}
              <button
                onClick={() => setAlertsOpen((s) => !s)}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
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
                  className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors"
                >
                  <LogOut size={13} className="text-amber-400" />
                  {t("launcher.userLogout")}
                </button>
              ) : (
                <button
                  onClick={handleHotelLogout}
                  className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors"
                >
                  <LogOut size={13} className="text-rose-400" />
                  {t("launcher.hotelLogout")}
                </button>
              )}
            </div>
          </div>

          {/* ── PANEL DE ALERTAS ── */}
          {alertsOpen && (
            <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Bell size={14} className="text-amber-400" />
                  {t("launcher.alerts")}
                </div>
                <div className="flex gap-3">
                  <button className="text-xs text-slate-400 hover:text-white transition-colors" onClick={() => setAlerts([])}>
                    {t("launcher.clear")}
                  </button>
                  <button className="text-xs text-slate-400 hover:text-white transition-colors" onClick={() => setAlertsOpen(false)}>
                    <X size={14} />
                  </button>
                </div>
              </div>
              {alerts.length === 0 ? (
                <div className="text-sm text-slate-400">{t("launcher.noAlerts")}</div>
              ) : (
                <ul className="space-y-2">
                  {alerts.map((a) => (
                    <li key={a.id ?? a.title} className="flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                      <div>
                        <div className="text-sm font-medium text-white">{a.title || a.msg || t("launcher.alert")}</div>
                        {(a.desc || a.msg) && <div className="text-xs text-slate-400 mt-0.5">{a.desc || a.msg}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── LAYOUT PRINCIPAL ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] flex-1 overflow-hidden min-h-0">

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
                      className="mx-auto mb-4 h-50 w-50 object-contain drop-shadow-2xl"
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
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                {user ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-sm">
                        {(user.name || user.username || "U")[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{user.name || user.username}</div>
                        <div className="text-xs text-slate-400">
                          {Array.isArray(user.roles) ? user.roles.join(", ") : user.role || "N/A"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Sesión activa
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUserLoginSubmit} className="space-y-4" autoComplete="off">
                    <input type="text" name="fake_username" autoComplete="username" className="hidden" />
                    <input type="password" name="fake_password" autoComplete="new-password" className="hidden" />
                    <div>
                      <h2 className="text-sm font-bold text-white">{t("launcher.userLoginTitle")}</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Ingrese sus credenciales para acceder</p>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-300">{t("launcher.username")}</label>
                        <input
                          name="launcher_username"
                          value={userLogin.username}
                          onChange={(e) => setUserLogin((prev) => ({ ...prev, username: e.target.value }))}
                          placeholder="usuario"
                          autoComplete="off"
                          className="h-10 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-300">{t("launcher.password")}</label>
                        <input
                          type="password"
                          name="launcher_password"
                          value={userLogin.password}
                          onChange={(e) => setUserLogin((prev) => ({ ...prev, password: e.target.value }))}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className="h-10 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                        />
                      </div>
                    </div>
                    {userLogin.error && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                        {userLogin.error}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={userLogin.loading}
                      className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-60 transition-all"
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
                <div className="flex flex-1 items-center justify-center min-h-[300px]">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-white mb-2">{t("Launcher.Welcome")}</div>
                    <div className="text-sm text-slate-400">{t("Launcher.subtitle")}</div>
                  </div>
                </div>
              ) : (
                <>
                  {allowedModules.length > 0 && (
                    <div className="mb-5">
                      <h1 className="text-xl font-bold text-white">Módulos disponibles</h1>
                      <p className="text-sm text-slate-400 mt-0.5">Seleccione un módulo para continuar · <kbd className="text-xs bg-white/10 px-1.5 py-0.5 rounded">↑↓</kbd> navegar · <kbd className="text-xs bg-white/10 px-1.5 py-0.5 rounded">Enter</kbd> abrir</p>
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
        <footer className="relative flex shrink-0 items-center justify-between px-4 py-3 text-[11px] text-slate-600 sm:px-6 lg:px-8 border-t border-white/5">
          <span>© {new Date().getFullYear()} Kazehana Cloud · Todos los derechos reservados</span>
          <span className="hidden sm:block">
            {t("launcher.version.system")} v{versionInfo?.appVersion || "0.0.0"}
            {versionInfo?.dbVersion ? ` · ${t("launcher.version.db")} ${String(versionInfo.dbVersion).split("_")[0]}` : ""}
          </span>
        </footer>
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
        focused ? "ring-2 ring-white/60 ring-offset-2 ring-offset-slate-900 rounded-2xl" : ""
      }`}
    >
      <div
        className={`relative overflow-hidden rounded-2xl border transition-all duration-200 ${
          hovered
            ? "border-white/20 shadow-2xl shadow-black/40 -translate-y-1 scale-[1.01]"
            : "border-white/10 shadow-lg shadow-black/20"
        } bg-white/5 backdrop-blur-sm`}
      >
        <div className={`h-1.5 w-full bg-gradient-to-r ${mod.theme.from} ${mod.theme.to}`} />
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 to-transparent transition-opacity duration-200 ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        />
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
            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
              {mod.tag}
            </span>
          </div>
          <h3 className="text-base font-bold text-white mb-1">{mod.name}</h3>
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{mod.description}</p>
          <div
            className={`mt-4 flex items-center gap-2 text-xs font-semibold transition-all duration-200 ${
              hovered ? "text-white" : "text-slate-500"
            }`}
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
