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
} from "lucide-react";

import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tooltip, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

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
      setAlerts(list);
      setAlertsOpen(true);
    };
    const onPush = (e) => {
      const item = e.detail;
      if (!item) return;
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

  return (
    <TooltipProvider>
      <div className="min-h-screen w-full bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 md:grid-cols-3">
          {/* Columna izquierda: logo + info hotel/usuario + login de usuario */}
          <div className="flex items-start justify-center md:col-span-1">
            <div className="flex w-full flex-col items-center justify-center space-y-4 rounded-3xl border bg-white p-6 shadow-lg">
              <div className="flex aspect-square w-full max-w-[320px] items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-400">
                <img
                  src="/kazehanalogo.png"
                  alt="Kazehana PMS"
                  className="h-64 w-64 object-contain drop-shadow-2xl md:h-72 md:w-72"
                />
              </div>

              <div className="space-y-1 text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {hotel?.name || "Hotel"}
                </div>
                <div className="text-xs text-gray-600">
                  {hotel?.email || t("launcher.hotelSession")}
                </div>
                {hotel?.membership && (
                  <div className="mt-1 text-[15px] font-medium text-emerald-700">
                    {t("launcher.membership", { membership: hotel.membership })}
                  </div>
                )}
                
              </div>

              {/* Login de usuario (nivel 2) debajo del logo */}
              <div className="flex w-full justify-center">
                <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                  {user ? (
                    <div className="space-y-1 text-s text-gray-700">
                      <div className="font-semibold text-gray-900">
                        Usuario: {user.name || user.username}
                      </div>
                      <div className="text-[12px] text-gray-500">
                        Rol:{" "}
                        {Array.isArray(user.roles) ? user.roles.join(", ") : user.role || "N/A"}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleUserLoginSubmit} className="space-y-3">
                      <div>
                        <h2 className="text-sm font-semibold text-gray-800">
                        {t("launcher.userLoginTitle")}
                        </h2>
                      </div>
                      <div className="space-y-2">
                        <div className="max-w-[220px] space-y-1">
                          <label className="text-xs font-medium text-slate-700">
                            {t("launcher.username")}
                          </label>
                          <Input
                            value={userLogin.username}
                            onChange={(e) =>
                              setUserLogin((prev) => ({ ...prev, username: e.target.value }))
                            }
                            placeholder="usuario"
                            autoComplete="username"
                          />
                        </div>
                        <div className="max-w-[220px] space-y-1">
                          <label className="text-xs font-medium text-slate-700">
                            {t("launcher.password")}
                          </label>
                          <Input
                            type="password"
                            value={userLogin.password}
                            onChange={(e) =>
                              setUserLogin((prev) => ({ ...prev, password: e.target.value }))
                            }
                            placeholder="********"
                            autoComplete="current-password"
                          />
                        </div>
                      </div>
                      {userLogin.error && (
                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                          {userLogin.error}
                        </div>
                      )}
                      <div className="flex justify-end">
                        <Button type="submit" size="sm" disabled={userLogin.loading}>
                          {userLogin.loading ? t("launcher.signingIn") : t("common.enter")}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAlertsOpen((s) => !s)}
                  className="relative rounded-lg border bg-white p-2 hover:bg-slate-50"
                  aria-label={t("launcher.alerts")}
                >
                  <Bell size={16} className="text-emerald-600" />
                  {alerts.length > 0 && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] leading-3 text-white">
                      {alerts.length}
                    </span>
                  )}
                </button>
                {user && (
                  <button
                    onClick={handleUserLogout}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <LogOut size={14} className="text-amber-600" />
                    {t("launcher.userLogout")}
                  </button>
                )}
                {!user && (
                  <button
                    onClick={handleHotelLogout}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <LogOut size={14} className="text-rose-600" />
                    {t("launcher.hotelLogout")}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Columna derecha: alertas + módulos */}
          <div className="space-y-4 md:col-span-2">
            {/* Panel de alertas */}
            {alertsOpen && (
              <Card className="border-slate-200/80 p-4 shadow">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-semibold">{t("launcher.alerts")}</div>
                  <button
                    className="text-xs text-gray-500 underline hover:text-gray-700"
                    onClick={() => setAlerts([])}
                  >
                    {t("launcher.clear")}
                  </button>
                </div>
                {alerts.length === 0 ? (
                  <div className="text-sm text-gray-500">{t("launcher.noAlerts")}</div>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {alerts.map((a) => (
                      <li
                        key={a.id ?? a.title}
                        className="flex items-start gap-2 rounded-lg border px-3 py-2"
                      >
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
                        <div>
                          <div className="font-medium text-gray-800">
                            {a.title || a.msg || t("launcher.alert")}
                          </div>
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

            {/* Módulos */}
            {!user && (
              <Card className="border-slate-200/80 p-10 shadow">
                <div className=" text-5xl text-center font-semibold text-slate-900">{t("Launcher.Welcome")}</div>
                <div className="mt-3 text-center text-base text-slate-600">
                  {t("Launcher.subtitle")}.
                </div>
              </Card>
            )}
            <div className="grid auto-rows-fr grid-cols-1 gap-6">
              {filtered
                .filter((mod) => {
                  // Antes de que el usuario del launcher inicie sesión,
                  // mostramos todos los módulos atenuados.
                  if (!user) return false;
                  const hasAllowedModules =
                    Array.isArray(user.allowedModules) && user.allowedModules.length > 0;
                  // Una vez logueado, solo mostrar módulos permitidos para ese perfil.
                  const allowedByList = hasAllowedModules ? user.allowedModules.includes(mod.code) : false;
                  const allowedByPerms = Array.isArray(user.permissions)
                    ? user.permissions.some((p) => typeof p === "string" && p.startsWith(`${mod.code}.`))
                    : false;
                  return allowedByList || allowedByPerms;
                })
                .map((mod, idx) => {
                  const disabled = !user;
                  return (
                    <ModuleCard
                      key={mod.name}
                      mod={mod}
                      focused={idx === focusedIndex}
                      onOpen={() => !disabled && handleOpenModule(mod.path)}
                      disabled={disabled}
                    />
                  );
                })}
            </div>
          </div>
        </div>

        <footer className="mx-auto my-8 w-full max-w-6xl px-6 text-[11px] text-gray-600">
          <div className="flex items-center justify-between">
            <span>(©) {new Date().getFullYear()} Kazehana PMS</span>
            <span className="hidden items-center gap-1 sm:inline-flex" />
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}

function ModuleCard({ mod, onOpen, focused, disabled }) {
  const Icon = mod.icon;
  const { t } = useLanguage();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onOpen}
          disabled={disabled}
          className={`h-full w-full text-left transition focus:outline-none ${
            focused && !disabled ? "ring-2 ring-blue-400 ring-offset-2" : ""
          } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <Card className="h-full transform rounded-2xl border border-slate-200 bg-white p-5 shadow-md transition">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <div
                  className={`relative h-16 w-16 rounded-3xl bg-gradient-to-br ${mod.theme.from} ${mod.theme.to} shadow-md`}
                >
                  <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_30%_30%,white,transparent_55%)] opacity-30" />
                  <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_70%_70%,white,transparent_55%)] opacity-20" />
                  <div className="relative flex h-full w-full items-center justify-center">
                    <Icon className={`h-8 w-8 ${mod.theme.text}`} />
                  </div>
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-gray-900">{mod.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{mod.description}</p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="rounded-sm border-gray-200 text-[11px] text-gray-700"
              >
                {mod.tag}
              </Badge>
            </div>
            <div className="mt-4 flex items-center justify-between text-[12px] text-gray-500">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-800">{t("common.enter")}</span>
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
