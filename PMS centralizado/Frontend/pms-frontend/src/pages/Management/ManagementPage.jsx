// src/pages/Management/ManagementPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Bell, CircleUser, LogOut } from "lucide-react";
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
import { Sun, Moon } from "lucide-react";
import RestaurantGeneral from "./Restaurant/RestaurantGeneral";
import RestaurantBilling from "./Restaurant/RestaurantBilling";
import RestaurantTaxes from "./Restaurant/RestaurantTaxes";
import RestaurantPayments from "./Restaurant/RestaurantPayments";
import RestaurantFamilies from "./Restaurant/RestaurantFamilies";
import RestaurantRecipes from "./Restaurant/RestaurantRecipes";
import RestaurantInventory from "./Restaurant/RestaurantInventory";

// Vista de perfiles de launcher (UserLauncher)
function LauncherProfiles() {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    userId: "",
    name: "",
    roleId: "",
    password: "",
  });

  const normalizeList = (res) => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [accRes, rolesRes] = await Promise.all([api.get("/launcher"), api.get("/roles")]);
        setAccounts(normalizeList(accRes));
        setRoles(normalizeList(rolesRes));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const resetForm = () => {
    setForm({
      userId: "",
      name: "",
      roleId: "",
      password: "",
    });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.userId.trim() || !form.name.trim() || !form.roleId) return;
    if (!editingId && (!form.password || form.password.length < 4)) return;

    setSaving(true);
    try {
      const payload = {
        userId: form.userId.trim(),
        name: form.name.trim(),
        roleId: form.roleId,
        // En edición, el password es opcional (solo si se quiere cambiar)
        ...(form.password ? { password: form.password } : {}),
      };

      if (editingId) {
        await api.put(`/launcher/${encodeURIComponent(editingId)}`, payload);
      } else {
        await api.post("/launcher", payload);
      }

      const accRes = await api.get("/launcher");
      setAccounts(normalizeList(accRes));
      resetForm();
    } catch (err) {
      // opcional: podríamos mostrar un alert amigable
      console.error("Error guardando perfil de launcher", err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (acc) => {
    setEditingId(acc.id);
    setForm({
      userId: acc.userId || acc.username || "",
      name: acc.name || "",
      roleId: acc.roleId || "",
      password: "",
    });
  };

  const handleDelete = async (id) => {
    if (!id) return;
    if (!window.confirm(t("mgmt.launcherProfiles.deleteConfirm"))) return;
    try {
      await api.delete(`/launcher/${encodeURIComponent(id)}`);
      setAccounts((list) => list.filter((a) => a.id !== id));
      if (editingId === id) resetForm();
    } catch (err) {
      console.error("Error deleting launcher profile", err);
    }
  };

  const roleOptions = [
    { value: "", label: t("mgmt.launcherProfiles.rolePlaceholder") },
    ...roles.map((r) => ({ value: r.id, label: r.name || r.id })),
  ];

  const rows = accounts.map((acc) => ({
    id: acc.id,
    userId: acc.userId || acc.username,
    name: acc.name,
    roleId: acc.roleId,
    roleName: roles.find((r) => r.id === acc.roleId)?.name || acc.roleId,
    createdAt: acc.createdAt ? new Date(acc.createdAt).toLocaleString() : "",
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="space-y-4 p-5">
        <h3 className="font-medium">{t("mgmt.launcherProfiles.title")}</h3>
        

        <form className="grid gap-x-6 gap-y-4 md:grid-cols-2 max-w-[720px]" autoComplete="off">
          <input
            type="text"
            name="fake_username"
            autoComplete="username"
            className="hidden"
            tabIndex={-1}
          />
          <input
            type="password"
            name="fake_password"
            autoComplete="new-password"
            className="hidden"
            tabIndex={-1}
          />
          <div className="space-y-1 md:col-span-1">
            <label className="text-xs text-slate-500">{t("mgmt.launcherProfiles.userLoginIdLabel")}</label>
            <Input
              className="w-full"
              placeholder={t("mgmt.launcherProfiles.userLoginIdPlaceholder")}
              autoComplete="new-password"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              name={editingId ? "launcher_userid_edit" : "launcher_userid_new"}
              value={form.userId}
              onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
            />
          </div>

          <div className="space-y-1 md:col-span-1">
            <label className="text-xs text-slate-500">{t("mgmt.launcherProfiles.fullNameLabel")}</label>
            <Input
              className="w-full"
              placeholder={t("mgmt.launcherProfiles.fullNamePlaceholder")}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1 md:col-span-1">
            <label className="text-xs text-slate-500">{t("mgmt.launcherProfiles.roleLabel")}</label>
            <Select
              className="w-full"
              value={form.roleId}
              onChange={(val) => setForm((f) => ({ ...f, roleId: val }))}
              options={roleOptions}
            />
          </div>

          <div className="space-y-1 md:col-span-1">
            <label className="text-xs text-slate-500">
              {t("mgmt.launcherProfiles.passwordLabel")}
            </label>
            <Input
              className="w-full"
              type="password"
              placeholder={editingId ? t("mgmt.launcherProfiles.passwordPlaceholderEdit") : t("mgmt.launcherProfiles.passwordPlaceholderNew")}
              autoComplete={editingId ? "new-password" : "new-password"}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
        </form>

        <div className="flex gap-2 pt-2">
          <Button type="button" onClick={handleSave} disabled={saving || loading}>
            {editingId ? t("mgmt.launcherProfiles.saveChanges") : t("mgmt.launcherProfiles.createProfile")}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={saving}
            >
              {t("mgmt.launcherProfiles.cancel")}
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">{t("mgmt.launcherProfiles.configuredTitle")}</h3>
          {loading && <span className="text-xs text-slate-400">{t("mgmt.launcherProfiles.loading")}</span>}
        </div>
        <SimpleTable
          cols={[
            { key: "userId", label: t("mgmt.launcherProfiles.columns.userId") },
            { key: "name", label: t("mgmt.launcherProfiles.columns.name") },
            { key: "roleName", label: t("mgmt.launcherProfiles.columns.role") },
            { key: "createdAt", label: t("mgmt.launcherProfiles.columns.created") },
            { key: "actions", label: t("mgmt.launcherProfiles.columns.actions") },
          ]}
          rows={rows.map((r) => ({
            ...r,
            actions: (
              <div className="flex gap-2">
                <Button
                  size="xs"
                  variant="indigo"
                  type="button"
                  onClick={() => handleEdit(r)}
                >
                  {t("mgmt.launcherProfiles.edit")}
                </Button>
                <Button
                  size="xs"
                  variant="destructive"
                  type="button"
                  onClick={() => handleDelete(r.id)}
                >
                  {t("mgmt.launcherProfiles.delete")}
                </Button>
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
}

function ProfilesView() {
  return (
    <div className="space-y-6">
      <LauncherProfiles />
      <div className="pt-6 mt-2" style={{ borderTop: "1px solid var(--card-border)" }}>
        <Roles />
      </div>
    </div>
  );
}

function AppearanceView() {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();

  const options = [
    { value: "light", label: t("mgmt.appearance.light"), icon: Sun },
    { value: "dark",  label: t("mgmt.appearance.dark"),  icon: Moon },
  ];

  return (
    <div className="space-y-6 max-w-sm">
      <div>
        <div className="text-lg font-semibold" style={{ color: "var(--color-text-base)" }}>{t("mgmt.appearance.title")}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.appearance.subtitle")}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-medium transition-all ${
              theme === value
                ? "border-indigo-500/60 bg-indigo-500/15 shadow-lg shadow-indigo-900/30"
                : "hover:bg-black/5 dark:hover:bg-white/10"
            }`}
            style={{
              borderColor: theme === value ? undefined : "var(--card-border)",
              background: theme === value ? undefined : "var(--card-bg)",
              color: theme === value ? "var(--color-text-base)" : "var(--color-text-muted)",
            }}
          >
            <Icon className={`w-6 h-6 ${theme === value ? "text-indigo-500 dark:text-indigo-400" : ""}`} />
            {label}
          </button>
        ))}
      </div>
      <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.appearance.note")}</div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: "light", icon: Sun },
    { value: "dark",  icon: Moon },
  ];
  return (
    <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
            theme === value
              ? "bg-indigo-500/30 text-indigo-600 dark:text-indigo-300"
              : "hover:bg-black/5 dark:hover:bg-white/10"
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

const VIEWS = {
  // Perfiles (launcher + roles internos)
  profiles: ProfilesView,
  usageLog: AuditLog,

  // Frontdesk
  frontdeskConfig: FrontdeskConfig,

  // Accounting
  accountingConfig: AccountingConfig,

  // Restaurant
  restaurantGeneral: RestaurantGeneral,
  restaurantBilling: RestaurantBilling,
  restaurantTaxes: RestaurantTaxes,
  restaurantPayments: RestaurantPayments,
  restaurantFamilies: RestaurantFamilies,
  restaurantRecipes: RestaurantRecipes,
  restaurantInventory: RestaurantInventory,
  restaurantConfig: RestaurantConfig,

  // Channel manager
  channelManager: ChannelManager,

};

export default function ManagementPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hotel } = useAuth();
  const [selected, setSelected] = useState("profiles");
  const [alerts, setAlerts] = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menusRef = useRef(null);

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
    setSelected("frontdeskConfig");
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add("frontdesk");
      return next;
    });
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
        items: [{ id: "profiles", label: t("mgmt.shell.menu.profilesItem"), requires: "management" }],
      },
      {
        title: t("mgmt.shell.menu.auditTitle"),
        key: "audit",
        items: [{ id: "usageLog", label: t("mgmt.shell.menu.auditItem"), requires: "management" }],
      },
      {
        title: t("modules.frontdesk.name"),
        key: "frontdesk",
        items: [
          { id: "frontdeskConfig", label: t("mgmt.shell.menu.frontdesk.config"), requires: "frontdesk" },
        ],
      },
      {
        title: t("modules.restaurant.name"),
        key: "restaurant",
        items: [
          { id: "restaurantConfig", label: t("mgmt.shell.menu.restaurant.config"), requires: "restaurant" },
        ],
      },
      {
        title: t("modules.accounting.name"),
        key: "accounting",
        items: [
          { id: "accountingConfig", label: t("mgmt.shell.menu.accounting.config"), requires: "accounting" },
        ],
      },
      {
        title: t("mgmt.shell.menu.channel.title"),
        key: "channel",
        items: [
          { id: "channelManager", label: t("mgmt.shell.menu.channel.config"), requires: "channel_manager" },
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
    const isValid = filteredMenu.some((g) => g.items.some((i) => i.id === selected));
    if (!isValid) {
      setSelected(filteredMenu[0].items[0].id);
    }
  }, [filteredMenu, selected]);

  const renderSection = () => {
    const Comp = VIEWS[selected];
    return Comp ? <Comp /> : <div className="p-6" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.shell.selectPrompt")}</div>;
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{
        background: "var(--shell-bg)",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-6 py-4 backdrop-blur-sm" style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--sidebar-border)" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/90 to-blue-600/80 shadow-lg shadow-indigo-900/40">
            <img src="/kazehanalogo.png" alt={t("mgmt.shell.logoAlt")} className="h-6 w-6 object-contain" />
          </div>
          <div className="space-y-0.5">
            <div className="text-xs uppercase tracking-wide font-medium bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">{t("modules.management.name")}</div>
            <div className="text-sm font-semibold" style={{ color: "var(--color-text-base)" }}>{t("mgmt.shell.header.title")}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 relative" ref={menusRef}>
          {/* Selector de tema */}
          <ThemeToggle />

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
          <div className="flex flex-col items-center justify-center py-6 gap-3" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/90 to-blue-600/80 shadow-lg shadow-indigo-900/40">
              <img src="/kazehanalogo.png" alt={t("mgmt.shell.logoAlt")} className="h-12 w-12 object-contain" />
            </div>
            <div className="text-xs font-semibold bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent uppercase tracking-wide">{t("modules.management.name")}</div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {isModuleEnabled("frontdesk") && (
              <button
                onClick={handleGeneralInfo}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white px-3 py-2 text-sm font-semibold shadow-lg shadow-indigo-900/40 transition-all mb-2"
              >
                {t("mgmt.shell.generalInfo")}
              </button>
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
                    style={selected !== "profiles" ? { color: "var(--color-text-muted)" } : {}}
                  >
                    <span>{group.title}</span>
                  </button>
                );
              }

              return (
                <div key={group.key}>
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: "var(--color-text-muted)" }}
                    aria-expanded={isOpen}
                  >
                    <span>{group.title}</span>
                    <ChevronRight className={`h-4 w-4 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`} />
                  </button>
                  <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isOpen ? "max-h-[1000px]" : "max-h-0"}`}>
                    <ul className="pl-3 pr-1 pb-1 space-y-0.5">
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <button
                            onClick={() => { setSelected(item.id); if (!expanded.has(group.key)) toggleGroup(group.key); }}
                            className={`flex w-full items-center text-left text-sm rounded-xl px-3 py-2 transition-all ${
                              selected === item.id
                                ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-900/40 font-semibold"
                                : "hover:bg-black/5 dark:hover:bg-white/10"
                            }`}
                            style={selected !== item.id ? { color: "var(--color-text-muted)" } : {}}
                          >
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
          <div className="flex items-center gap-3 px-4 py-4 shrink-0" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
            <img src="/kazehanalogo.png" alt={t("mgmt.shell.logoAlt")} className="h-10 w-10 object-contain opacity-70" />
            <div>
              <div className="text-sm font-semibold leading-tight" style={{ color: "var(--color-text-base)" }}>Kazehana PMS</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{t("modules.management.name")}</div>
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

