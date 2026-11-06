//src/pages/Management/Roles.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { SimpleTable } from "../../components/ui/table";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { Users, ShieldCheck, Lock, ChevronDown, ChevronUp } from "lucide-react";

const RESTAURANT_MANAGEMENT_SECTIONS = new Set([
  "config","general","billing","floorplan","section","sections","table","tables",
  "menu","family","families","item","items","inventory","recipe","recipes",
  "payment","payments","tax","taxes","discount","discounts","printer","printers","staff",
]);

const resolvePermissionModule = (perm) => {
  const parts = String(perm || "").toLowerCase().split(".");
  const mod = parts[0] || "other";
  if (mod !== "restaurant") return mod;
  const section = parts[1] || "";
  return RESTAURANT_MANAGEMENT_SECTIONS.has(section) ? "management" : "restaurant";
};

// ── Sección: Perfiles de acceso ──────────────────────────────────────────────
function LauncherProfiles({ roles }) {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ userId: "", name: "", roleId: "", password: "" });

  const normalizeList = (res) => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  };

  // 001 is reserved for admin; new users start at 002
  const nextUserId = (list) => {
    const maxId = list.reduce((max, a) => Math.max(max, Number(a.userId) || 0), 1);
    return String(Math.max(maxId + 1, 2)).padStart(3, "0");
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const accRes = await api.get("/launcher");
        const list = normalizeList(accRes);
        setAccounts(list);
        if (!editingId) {
          setForm((f) => ({ ...f, userId: nextUserId(list) }));
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const resetForm = () => {
    setForm({ userId: nextUserId(accounts), name: "", roleId: "", password: "" });
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
      console.error("Error guardando perfil de launcher", err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (acc) => {
    setEditingId(acc.id);
    setForm({ userId: acc.userId || acc.username || "", name: acc.name || "", roleId: acc.roleId || "", password: "" });
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
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15">
          <Users className="w-3.5 h-3.5 text-indigo-500" />
        </div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-base)" }}>
          {editingId ? t("mgmt.launcherProfiles.saveChanges") : t("mgmt.launcherProfiles.title")}
        </h3>
      </div>

      <form className="grid gap-3" style={{ gridTemplateColumns: "80px 1fr 1fr 1fr" }} autoComplete="off">
        <input type="text" name="fake_username" autoComplete="username" className="hidden" tabIndex={-1} />
        <input type="password" name="fake_password" autoComplete="new-password" className="hidden" tabIndex={-1} />
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>ID</label>
          <Input className="w-full text-center font-mono font-semibold"
            readOnly
            style={{ opacity: 0.7, cursor: "not-allowed" }}
            value={form.userId} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.launcherProfiles.fullNameLabel")}</label>
          <Input className="w-full" placeholder={t("mgmt.launcherProfiles.fullNamePlaceholder")}
            value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.launcherProfiles.roleLabel")}</label>
          <Select className="w-full" value={form.roleId} onChange={(val) => setForm((f) => ({ ...f, roleId: val }))} options={roleOptions} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.launcherProfiles.passwordLabel")}</label>
          <Input className="w-full" type="password"
            placeholder={editingId ? t("mgmt.launcherProfiles.passwordPlaceholderEdit") : t("mgmt.launcherProfiles.passwordPlaceholderNew")}
            autoComplete="new-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        </div>
      </form>

      <div className="flex gap-2">
        <Button type="button" onClick={handleSave} disabled={saving || loading}>
          {editingId ? t("mgmt.launcherProfiles.saveChanges") : t("mgmt.launcherProfiles.createProfile")}
        </Button>
        {editingId && (
          <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
            {t("mgmt.launcherProfiles.cancel")}
          </Button>
        )}
      </div>

      {loading && <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.launcherProfiles.loading")}</span>}
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
            <div className="flex gap-1.5">
              <Button size="xs" variant="indigo" type="button" onClick={() => handleEdit(r)}>{t("mgmt.launcherProfiles.edit")}</Button>
              <Button size="xs" variant="destructive" type="button" onClick={() => handleDelete(r.id)}>{t("mgmt.launcherProfiles.delete")}</Button>
            </div>
          ),
        }))}
      />
    </div>
  );
}

// ── Sección: Roles ────────────────────────────────────────────────────────────
function RolesSection({ roles, setRoles, filteredRoles, rolePerms, selectedRole, setSelectedRole, t, editingId, setEditingId, formRole, setFormRole }) {
  const roleOptions = useMemo(() => {
    const presets = [
      { module: "frontdesk", id: "FRONTDESK", name: "Frontdesk" },
      { module: "restaurant", id: "RESTAURANT", name: "Restaurant" },
      { module: "accounting", id: "ACCOUNTING", name: "Accounting" },
      { module: "einvoicing", id: "EINVOICING", name: "E-Invoicing" },
      { module: "management", id: "MANAGEMENT", name: "Management" },
    ];
    const options = [{ value: "", label: t("mgmt.roles.selectRoleId") }];
    presets.forEach((r) => options.push({ value: r.id, label: r.name }));
    options.push({ value: "ADMIN", label: t("mgmt.roles.admin") });
    return options;
  }, [t]);

  const roleNameById = useMemo(() => {
    const map = {};
    roleOptions.forEach((opt) => { if (opt.value) map[opt.value] = opt.label || opt.value; });
    return map;
  }, [roleOptions]);

  const resetForm = () => { setFormRole({ id: "", name: "", description: "", jobTitle: "" }); setEditingId(null); };

  const saveRole = async () => {
    if (!formRole.id || !formRole.name) return;
    if (editingId) {
      const { data } = await api.put(`/roles/${editingId}`, formRole);
      setRoles((prev) => prev.map((r) => (r.id === editingId ? data : r)));
    } else {
      const { data } = await api.post("/roles", formRole);
      setRoles((prev) => [...prev, data]);
    }
    resetForm();
  };

  const deleteRole = async (id) => {
    if (id === "ADMIN") return;
    setRoles((prev) => prev.filter((r) => r.id !== id));
    await api.delete(`/roles/${id}`);
    if (selectedRole === id) setSelectedRole("");
  };

  const startEdit = (role) => {
    setFormRole({ id: role.id || "", name: role.name || "", description: role.description || "", jobTitle: role.jobTitle || "" });
    setEditingId(role.id);
  };

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-base)" }}>{t("mgmt.roles.title")}</h3>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.roles.selectRoleId")}</label>
          <Select className="w-full" value={formRole.id}
            onChange={(val) => setFormRole((r) => ({ ...r, id: val, name: r.name ? r.name : roleNameById[val] || r.name }))}
            options={roleOptions} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.roles.namePlaceholder")}</label>
          <Input className="w-full" placeholder={t("mgmt.roles.namePlaceholder")} value={formRole.name}
            onChange={(e) => setFormRole((r) => ({ ...r, name: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.roles.jobTitlePlaceholder")}</label>
          <Input className="w-full" placeholder={t("mgmt.roles.jobTitlePlaceholder")} value={formRole.jobTitle}
            onChange={(e) => setFormRole((r) => ({ ...r, jobTitle: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.roles.descriptionPlaceholder")}</label>
          <Input className="w-full" placeholder={t("mgmt.roles.descriptionPlaceholder")} value={formRole.description}
            onChange={(e) => setFormRole((r) => ({ ...r, description: e.target.value }))} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={saveRole}>{editingId ? t("mgmt.roles.saveChanges") : t("mgmt.roles.createRole")}</Button>
        {editingId && <Button variant="outline" onClick={resetForm}>{t("mgmt.roles.cancel")}</Button>}
      </div>

      <SimpleTable
        cols={[
          { key: "id", label: t("mgmt.roles.columns.id") },
          { key: "name", label: t("mgmt.roles.columns.name") },
          { key: "description", label: t("mgmt.roles.columns.description") },
          { key: "actions", label: t("mgmt.roles.columns.actions") },
        ]}
        rows={filteredRoles.map((role) => ({
          ...role,
          actions: (
            <div className="flex gap-1.5">
              <Button size="xs" variant="indigo" onClick={() => startEdit(role)}>{t("mgmt.roles.edit")}</Button>
              <Button size="xs" variant="destructive" onClick={() => deleteRole(role.id)}
                disabled={role.id === "ADMIN"} title={role.id === "ADMIN" ? t("mgmt.roles.adminDeleteBlocked") : t("mgmt.roles.delete")}>
                {t("mgmt.roles.delete")}
              </Button>
            </div>
          ),
        }))}
      />
    </div>
  );
}

// ── Sección: Permisos ─────────────────────────────────────────────────────────
function PermissionsSection({ filteredPermissions, filteredProfiles, selectedRole, setSelectedRole, selectedProfileOption, setSelectedProfileOption, rolePerms, setRolePerms, t }) {
  const savePerms = async () => {
    if (!selectedRole) return;
    const perms = selectedRole === "ADMIN" ? ["*"] : (rolePerms[selectedRole] || []);
    await api.put(`/permissions/role/${selectedRole}`, { permissions: perms });
    setSelectedRole("");
    setSelectedProfileOption("");
  };

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15">
          <Lock className="w-3.5 h-3.5 text-violet-500" />
        </div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-base)" }}>{t("mgmt.roles.permissionsTitle")}</h3>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.roles.roleLabel")}</span>
        <Select value={selectedProfileOption}
          onChange={(val) => {
            setSelectedProfileOption(val);
            const roleId = String(val || "").split(":::")[1] || "";
            setSelectedRole(roleId);
          }}
          options={[
            { value: "", label: t("mgmt.roles.select") },
            ...filteredProfiles.map((acc) => ({
              value: `${acc.id || acc.username || acc.roleId}:::${acc.roleId}`,
              label: acc.name || acc.username || acc.roleId,
            })),
          ]}
        />
      </div>

      {selectedRole ? (
        <div className="space-y-3">
          {selectedRole === "ADMIN" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/50 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              {t("mgmt.roles.adminFullPermissions")}
            </div>
          )}
          <PermissionsByModule permissions={filteredPermissions} selectedRole={selectedRole} rolePerms={rolePerms} setRolePerms={setRolePerms} />
          <Button onClick={savePerms} disabled={selectedRole === "ADMIN"}>{t("mgmt.roles.savePermissions")}</Button>
        </div>
      ) : (
        <div className="flex items-center justify-center h-24 rounded-xl" style={{ background: "var(--color-surface-2)", border: "1px dashed var(--card-border)" }}>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.roles.select")}</p>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Roles() {
  const { hotel } = useAuth();
  const { t } = useLanguage();
  const [roles, setRoles] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePerms, setRolePerms] = useState({});
  const [formRole, setFormRole] = useState({ id: "", name: "", description: "", jobTitle: "" });
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedProfileOption, setSelectedProfileOption] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [tab, setTab] = useState("profiles");

  const allowedModules = useMemo(() => {
    const list = hotel?.allowedModules;
    if (!Array.isArray(list) || list.length === 0) return null;
    return new Set(list.map((m) => String(m).toLowerCase()));
  }, [hotel?.allowedModules]);

  const isModuleEnabled = useCallback(
    (code) => { if (!code || !allowedModules) return true; return allowedModules.has(String(code).toLowerCase()); },
    [allowedModules]
  );

  const load = useCallback(async () => {
    const [r, p, acc] = await Promise.all([
      api.get("/roles"),
      api.get("/permissions"),
      api.get("/launcher").catch(() => ({ data: [] })),
    ]);
    const rolesData = Array.isArray(r.data) ? r.data : [];
    setRoles(rolesData);
    const basePerms = (Array.isArray(p.data) ? p.data : []).map((x) => x.id || x);
    const extraPerms = ["frontdesk.read","restaurant.pos.open","accounting.read","einvoicing.access","management.settings.write"];
    setPermissions(Array.from(new Set([...extraPerms, ...basePerms])));
    setProfiles(Array.isArray(acc.data) ? acc.data : []);
    const rp = {};
    for (const rr of rolesData) {
      const { data } = await api.get(`/permissions/role/${rr.id}`);
      rp[rr.id] = data?.permissions || [];
    }
    if (rolesData.some((role) => role.id === "ADMIN")) rp.ADMIN = ["*"];
    setRolePerms(rp);
  }, []);

  useEffect(() => {
    load();
    const onChanged = () => load();
    window.addEventListener("pms:launcher-accounts-changed", onChanged);
    return () => window.removeEventListener("pms:launcher-accounts-changed", onChanged);
  }, [load]);

  const filteredPermissions = useMemo(() => {
    if (!allowedModules) return permissions;
    return (permissions || []).filter((perm) => isModuleEnabled(resolvePermissionModule(perm)));
  }, [permissions, allowedModules, isModuleEnabled]);

  const filteredRoles = useMemo(() => {
    if (!allowedModules) return roles;
    return (roles || []).filter((role) => {
      if (role.id === "ADMIN") return true;
      const list = rolePerms[role.id];
      if (!Array.isArray(list) || list.length === 0) return true;
      if (list.includes("*")) return true;
      return list.some((perm) => isModuleEnabled(resolvePermissionModule(perm)));
    });
  }, [roles, rolePerms, allowedModules, isModuleEnabled]);

  const filteredProfiles = useMemo(() => {
    if (!filteredRoles.length) return profiles;
    const allowedIds = new Set(filteredRoles.map((r) => r.id));
    return (profiles || []).filter((acc) => !acc.roleId || allowedIds.has(acc.roleId));
  }, [profiles, filteredRoles]);

  useEffect(() => {
    if (!selectedRole) return;
    const exists = filteredRoles.some((r) => r.id === selectedRole);
    if (!exists) { setSelectedRole(""); setSelectedProfileOption(""); }
  }, [filteredRoles, selectedRole]);

  const TABS = [
    { id: "profiles", label: t("mgmt.launcherProfiles.title"), icon: Users },
    { id: "roles",    label: t("mgmt.roles.title"),            icon: ShieldCheck },
    { id: "perms",    label: t("mgmt.roles.permissionsTitle"),  icon: Lock },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--color-surface-2)", border: "1px solid var(--card-border)" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all"
            style={{
              background: tab === id ? "var(--card-bg)" : "transparent",
              color: tab === id ? "var(--color-text-base)" : "var(--color-text-muted)",
              boxShadow: tab === id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              border: tab === id ? "1px solid var(--card-border)" : "1px solid transparent",
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Contenido del tab activo */}
      {tab === "profiles" && <LauncherProfiles roles={roles} />}
      {tab === "roles" && (
        <RolesSection
          roles={roles} setRoles={setRoles}
          filteredRoles={filteredRoles}
          rolePerms={rolePerms}
          selectedRole={selectedRole} setSelectedRole={setSelectedRole}
          t={t}
          editingId={editingId} setEditingId={setEditingId}
          formRole={formRole} setFormRole={setFormRole}
        />
      )}
      {tab === "perms" && (
        <PermissionsSection
          filteredPermissions={filteredPermissions}
          filteredProfiles={filteredProfiles}
          selectedRole={selectedRole} setSelectedRole={setSelectedRole}
          selectedProfileOption={selectedProfileOption} setSelectedProfileOption={setSelectedProfileOption}
          rolePerms={rolePerms} setRolePerms={setRolePerms}
          t={t}
        />
      )}
    </div>
  );
}

function PermissionsByModule({ permissions, selectedRole, rolePerms, setRolePerms }) {
  const { t } = useLanguage();
  const [openModules, setOpenModules] = useState(() => new Set());

  const restaurantSectionLabel = (key) => {
    const map = {
      access: t("mgmt.roles.restaurantSections.access"), pos: t("mgmt.roles.restaurantSections.access"),
      menu: t("mgmt.roles.restaurantSections.menu"), sections: t("mgmt.roles.restaurantSections.sections"),
      families: t("mgmt.roles.restaurantSections.families"), items: t("mgmt.roles.restaurantSections.items"),
      inventory: t("mgmt.roles.restaurantSections.inventory"), recipes: t("mgmt.roles.restaurantSections.recipes"),
      orders: t("mgmt.roles.restaurantSections.orders"), staff: t("mgmt.roles.restaurantSections.staff"),
      print: t("mgmt.roles.restaurantSections.print"), shift: t("mgmt.roles.restaurantSections.shift"),
      config: t("mgmt.roles.restaurantSections.config"), history: t("mgmt.roles.restaurantSections.history"),
      closes: t("mgmt.roles.restaurantSections.shift"), reprints: t("mgmt.roles.restaurantSections.reprints"),
      kds: "KDS",
    };
    return map[key] || t("mgmt.roles.restaurantSections.other");
  };

  const grouped = useMemo(() => {
    const groups = {};
    (permissions || []).forEach((perm) => {
      const key = resolvePermissionModule(perm);
      groups[key] = groups[key] || [];
      groups[key].push(perm);
    });
    Object.keys(groups).forEach((k) => {
      groups[k] = groups[k].slice().sort((a, b) => {
        const aA = a.endsWith(".access"), bA = b.endsWith(".access");
        if (aA !== bA) return aA ? -1 : 1;
        return a.localeCompare(b);
      });
    });
    return groups;
  }, [permissions]);

  const restaurantGroups = useMemo(() => {
    const bySection = {};
    (grouped.restaurant || []).forEach((perm) => {
      const section = String(perm || "").split(".")[1] || "other";
      const label = restaurantSectionLabel(section);
      bySection[label] = bySection[label] || [];
      bySection[label].push(perm);
    });
    Object.keys(bySection).forEach((k) => { bySection[k] = bySection[k].slice().sort((a, b) => a.localeCompare(b)); });
    return bySection;
  }, [grouped]);

  const managementGroups = useMemo(() => {
    const bySource = {};
    (grouped.management || []).forEach((perm) => {
      const source = (String(perm || "").split(".")[0] || "other").toLowerCase();
      bySource[source] = bySource[source] || [];
      bySource[source].push(perm);
    });
    Object.keys(bySource).forEach((k) => { bySource[k] = bySource[k].slice().sort((a, b) => a.localeCompare(b)); });
    return bySource;
  }, [grouped]);

  const managementModuleLabel = (moduleKey) => {
    const map = { management: t("modules.management.name"), restaurant: t("modules.restaurant.name"), frontdesk: t("modules.frontdesk.name"), accounting: t("modules.accounting.name"), einvoicing: t("modules.einvoicing.name") };
    return map[moduleKey] || moduleKey;
  };

  const prettyLabel = (perm) => {
    const parts = String(perm || "").split(".");
    if (parts.length <= 1) return perm;
    const tail = parts.slice(1).join(" ").replace(/_/g, " ").trim();
    if (!tail) return perm;
    if (tail === "access") return t("mgmt.roles.access");
    return tail;
  };

  const toggle = (perm, checked) => {
    if (selectedRole === "ADMIN") return;
    setRolePerms((prev) => {
      const cur = new Set(prev[selectedRole] || []);
      checked ? cur.add(perm) : cur.delete(perm);
      return { ...prev, [selectedRole]: [...cur] };
    });
  };

  const isModuleOpen = (mod) => openModules.has(mod);
  const toggleModule = (mod) => setOpenModules((prev) => { const next = new Set(prev); next.has(mod) ? next.delete(mod) : next.add(mod); return next; });

  const setAllInModule = (mod, checked) => {
    if (selectedRole === "ADMIN") return;
    setRolePerms((prev) => {
      const cur = new Set(prev[selectedRole] || []);
      (grouped[mod] || []).forEach((p) => { checked ? cur.add(p) : cur.delete(p); });
      return { ...prev, [selectedRole]: [...cur] };
    });
  };

  return (
    <div className="space-y-2">
      {Object.entries(grouped).map(([mod, perms]) => (
        <div key={mod} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold uppercase transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ background: "var(--table-head-bg)", color: "var(--color-text-base)" }}
            onClick={() => toggleModule(mod)}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="pointer-events-none"
                disabled={selectedRole === "ADMIN"}
                onChange={(e) => { e.stopPropagation(); setAllInModule(mod, e.target.checked); }}
                onClick={(e) => e.stopPropagation()}
                checked={selectedRole === "ADMIN" || perms.every((p) => { const l = rolePerms[selectedRole] || []; return l.includes("*") || l.includes(p); })}
              />
              <span>{mod}</span>
            </div>
            {isModuleOpen(mod) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isModuleOpen(mod) && (
            <div className="p-3" style={{ background: "var(--card-bg)" }}>
              {mod === "restaurant" ? (
                <div className="space-y-2">
                  {Object.entries(restaurantGroups).map(([section, list]) => (
                    <div key={section} className="rounded-lg p-2" style={{ background: "var(--color-surface-2)", border: "1px solid var(--card-border)" }}>
                      <div className="text-[10px] font-semibold uppercase mb-2" style={{ color: "var(--color-text-muted)" }}>{section}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {list.map((p) => {
                          const listPerms = rolePerms[selectedRole] || [];
                          const checked = selectedRole === "ADMIN" || listPerms.includes("*") || listPerms.includes(p);
                          return (
                            <label key={p} className="text-xs flex items-center gap-2" style={{ color: "var(--color-text-base)" }}>
                              <input type="checkbox" checked={checked} disabled={selectedRole === "ADMIN"} onChange={(e) => toggle(p, e.target.checked)} />
                              {prettyLabel(p)}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : mod === "management" ? (
                <div className="space-y-2">
                  {Object.entries(managementGroups).map(([source, list]) => (
                    <div key={source} className="rounded-lg p-2" style={{ background: "var(--color-surface-2)", border: "1px solid var(--card-border)" }}>
                      <div className="text-[10px] font-semibold uppercase mb-2" style={{ color: "var(--color-text-muted)" }}>{managementModuleLabel(source)}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {list.map((p) => {
                          const listPerms = rolePerms[selectedRole] || [];
                          const checked = selectedRole === "ADMIN" || listPerms.includes("*") || listPerms.includes(p);
                          return (
                            <label key={p} className="text-xs flex items-center gap-2" style={{ color: "var(--color-text-base)" }}>
                              <input type="checkbox" checked={checked} disabled={selectedRole === "ADMIN"} onChange={(e) => toggle(p, e.target.checked)} />
                              {prettyLabel(p)}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {perms.map((p) => {
                    const list = rolePerms[selectedRole] || [];
                    const checked = selectedRole === "ADMIN" || list.includes("*") || list.includes(p);
                    return (
                      <label key={p} className="text-xs flex items-center gap-2" style={{ color: "var(--color-text-base)" }}>
                        <input type="checkbox" checked={checked} disabled={selectedRole === "ADMIN"} onChange={(e) => toggle(p, e.target.checked)} />
                        {prettyLabel(p)}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
