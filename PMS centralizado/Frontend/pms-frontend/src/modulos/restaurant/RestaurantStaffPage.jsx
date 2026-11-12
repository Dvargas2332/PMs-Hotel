import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, UserX } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import useNoAutocomplete from "../../hooks/useNoAutocomplete";
import RestaurantUserMenu from "./RestaurantUserMenu";

const ROLE_OPTIONS = [
  { value: "CASHIER", label: "Cajero" },
  { value: "WAITER", label: "Mesero" },
];

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
// El personal del restaurante entra con un password numérico corto, tipo PIN.
const MIN_PASSWORD = 4;
const MAX_PASSWORD = 12;

const emptyForm = {
  name: "",
  username: "",
  password: "",
  confirmPassword: "",
  role: "WAITER",
  accessRoleId: "",
  active: true,
};

const roleLabel = (value) => ROLE_OPTIONS.find((r) => r.value === value)?.label || value || "-";

const notify = (desc) =>
  window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurante", desc } }));

const shiftLabel = (date) => {
  const h = date.getHours();
  if (h < 15) return "Turno mañana";
  if (h < 22) return "Turno tarde";
  return "Turno noche";
};

export default function RestaurantStaffPage({ embedded = false }) {
  const { user } = useAuth();
  useNoAutocomplete();
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [rolesError, setRolesError] = useState("");
  const [form, setForm] = useState({ ...emptyForm });
  const [fieldErrors, setFieldErrors] = useState({});
  const [editingId, setEditingId] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const roleKey = String(user?.role || "").toUpperCase();
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const canWrite = roleKey === "ADMIN" || permissions.includes("restaurant.staff.write");

  const shift = useMemo(() => shiftLabel(now), [now]);

  const loadRoles = useCallback(async () => {
    if (!canWrite) return;
    setRolesError("");
    try {
      const { data } = await api.get("/restaurant/staff/roles");
      setRoles(Array.isArray(data) ? data : []);
    } catch (err) {
      setRolesError(err?.response?.data?.message || "No se pudieron cargar los perfiles de permisos.");
    }
  }, [canWrite]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/restaurant/staff");
      setStaff(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "No se pudo cargar el personal.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    loadRoles();
  }, [refresh, loadRoles]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const term = String(search || "").trim().toLowerCase();
    if (!term) return staff;
    return (staff || []).filter((s) => {
      const haystack = [
        s.name,
        s.username,
        roleLabel(s.role),
        s.accessRoleName,
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return haystack.includes(term);
    });
  }, [staff, search]);

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId("");
    setFieldErrors({});
  };

  const validate = () => {
    const next = {};
    const name = String(form.name || "").trim();
    const username = String(form.username || "").trim().toLowerCase();
    const password = String(form.password || "");
    const confirm = String(form.confirmPassword || "");

    if (!name) next.name = "El nombre es requerido.";
    if (!username) next.username = "El usuario es requerido.";
    else if (!USERNAME_PATTERN.test(username)) {
      next.username = "3-32 caracteres: letras, números, punto, guion o guion bajo.";
    }
    if (!editingId && !password) next.password = "El password es requerido para crear.";
    if (password && !/^\d+$/.test(password)) {
      next.password = "Solo números.";
    } else if (password && (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD)) {
      next.password = `De ${MIN_PASSWORD} a ${MAX_PASSWORD} números.`;
    }
    if (password && password !== confirm) next.confirmPassword = "Los passwords no coinciden.";
    if (form.role !== "CASHIER" && form.role !== "WAITER") next.role = "Selecciona un rol válido.";

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (saving || !canWrite) return;
    if (!validate()) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: String(form.name || "").trim(),
        username: String(form.username || "").trim().toLowerCase(),
        role: form.role,
        accessRoleId: form.accessRoleId || null,
        active: form.active !== false,
      };
      const password = String(form.password || "");
      if (password) payload.password = password;

      if (editingId) {
        await api.patch(`/restaurant/staff/${editingId}`, payload);
        notify("Personal actualizado.");
      } else {
        await api.post("/restaurant/staff", payload);
        notify("Personal creado.");
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setError("");
    setFieldErrors({});
    setForm({
      name: row.name || "",
      username: row.username || "",
      password: "",
      confirmPassword: "",
      role: row.role || "WAITER",
      accessRoleId: row.accessRoleId || "",
      active: row.active !== false,
    });
  };

  const toggleActive = async (row) => {
    if (!row?.id || busyId || !canWrite) return;
    setBusyId(row.id);
    setError("");
    try {
      await api.patch(`/restaurant/staff/${row.id}`, { active: !row.active });
      setStaff((prev) => (prev || []).map((s) => (s.id === row.id ? { ...s, active: !row.active } : s)));
      notify(!row.active ? "Personal activado." : "Personal desactivado.");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "No se pudo actualizar.");
    } finally {
      setBusyId("");
    }
  };

  const remove = async () => {
    if (!deleteTarget?.id || busyId || !canWrite) return;
    const target = deleteTarget;
    setBusyId(target.id);
    setError("");
    try {
      await api.delete(`/restaurant/staff/${target.id}`);
      setStaff((prev) => (prev || []).filter((s) => s.id !== target.id));
      if (editingId === target.id) resetForm();
      setDeleteTarget(null);
      notify("Personal eliminado.");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "No se pudo eliminar.");
      setDeleteTarget(null);
    } finally {
      setBusyId("");
    }
  };

  const hasSearch = String(search || "").trim().length > 0;

  return (
    <div className={embedded ? "text-black" : "min-h-screen bg-gradient-to-br from-white to-lime-50 text-black"}>
      {!embedded && (
        <header className="relative h-14 bg-gradient-to-r from-lime-700 to-emerald-600 flex items-center justify-between px-10 shadow">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-white">Restaurante</span>
          <span className="text-sm text-white/80">Cajeros y meseros</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-sm font-semibold">
            <div className="px-4 py-2 rounded-xl bg-white/15 text-white">
              {now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="px-4 py-2 rounded-xl bg-white/15 text-white">{shift}</div>
          </div>
          <button
            className="px-3 py-2 rounded-xl bg-white/15 text-white text-xs font-semibold hover:bg-white/20 disabled:opacity-60"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 inline mr-1 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
          <RestaurantUserMenu />
        </div>
      </header>
      )}

      <div className={embedded ? "space-y-4" : "max-w-6xl mx-auto p-6 space-y-4"}>
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!canWrite && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Tu usuario no tiene el permiso «Gestionar cajeros y meseros». Solo puedes consultar el listado.</span>
          </div>
        )}

        <div className="grid lg:grid-cols-[380px_1fr] gap-4">
          <div className="rounded-2xl border border-lime-200 bg-white/95 shadow p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-lime-900">
                  {editingId ? "Editar personal" : "Nuevo personal"}
                </div>
              </div>
              <div className="h-9 w-9 rounded-xl bg-lime-700 text-white flex items-center justify-center shadow">
                {editingId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-lime-700" htmlFor="staff-name">
                  Nombre
                </label>
                <input
                  id="staff-name"
                  className={`w-full h-10 rounded-lg border px-3 text-sm bg-white ${
                    fieldErrors.name ? "border-red-300" : "border-lime-200"
                  }`}
                  autoComplete="off"
                  disabled={!canWrite}
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
                {fieldErrors.name && <div className="text-xs text-red-600">{fieldErrors.name}</div>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-lime-700" htmlFor="staff-username">
                  Usuario
                </label>
                <input
                  id="staff-username"
                  className={`w-full h-10 rounded-lg border px-3 text-sm bg-white ${
                    fieldErrors.username ? "border-red-300" : "border-lime-200"
                  }`}
                  placeholder="ej. maria.mesero"
                  autoComplete="off"
                  disabled={!canWrite}
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                />
                {fieldErrors.username && (
                  <div className="text-xs text-red-600">{fieldErrors.username}</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-lime-700" htmlFor="staff-password">
                    {editingId ? "Nuevo password" : "Password"}
                  </label>
                  <input
                    id="staff-password"
                    className={`w-full h-10 rounded-lg border px-3 text-sm bg-white ${
                      fieldErrors.password ? "border-red-300" : "border-lime-200"
                    }`}
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={MAX_PASSWORD}
                    placeholder={editingId ? "Opcional" : `${MIN_PASSWORD} a ${MAX_PASSWORD} números`}
                    autoComplete="new-password"
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    disabled={!canWrite}
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  />
                  {fieldErrors.password && <div className="text-xs text-red-600">{fieldErrors.password}</div>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-lime-700" htmlFor="staff-password-confirm">
                    Confirmar
                  </label>
                  <input
                    id="staff-password-confirm"
                    className={`w-full h-10 rounded-lg border px-3 text-sm bg-white ${
                      fieldErrors.confirmPassword ? "border-red-300" : "border-lime-200"
                    }`}
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={MAX_PASSWORD}
                    placeholder="Repetir"
                    autoComplete="new-password"
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    disabled={!canWrite || !form.password}
                    value={form.confirmPassword}
                    onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  />
                  {fieldErrors.confirmPassword && (
                    <div className="text-xs text-red-600">{fieldErrors.confirmPassword}</div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-lime-700" htmlFor="staff-role">
                  Rol operativo
                </label>
                <select
                  id="staff-role"
                  className="w-full h-10 rounded-lg border border-lime-200 px-3 text-sm bg-white"
                  disabled={!canWrite}
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-lime-700" htmlFor="staff-access-role">
                  Perfil de permisos
                </label>
                <select
                  id="staff-access-role"
                  className="w-full h-10 rounded-lg border border-lime-200 px-3 text-sm bg-white"
                  disabled={!canWrite || roles.length === 0}
                  value={form.accessRoleId}
                  onChange={(e) => setForm((p) => ({ ...p, accessRoleId: e.target.value }))}
                >
                  <option value="">Sin perfil (usa el usuario del PMS)</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || r.id}
                    </option>
                  ))}
                </select>
                {rolesError && (
                  <div className="text-xs text-amber-700">{rolesError}</div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!canWrite}
                  checked={form.active !== false}
                  onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                />
                Activo
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:bg-emerald-300"
                onClick={submit}
                disabled={saving || !canWrite}
              >
                {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear"}
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-lime-200 text-sm text-lime-900 hover:bg-lime-50"
                onClick={resetForm}
              >
                {editingId ? "Cancelar" : "Limpiar"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-lime-200 bg-white/95 shadow p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-lime-900">Listado</div>
                <div className="text-xs text-slate-500">
                  {loading ? "Cargando..." : `${filtered.length} de ${staff.length} registros`}
                </div>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-lime-700 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  className="h-9 w-56 rounded-lg border border-lime-200 pl-9 pr-3 text-sm bg-white"
                  placeholder="Buscar nombre, usuario, perfil..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-lime-200 px-4 py-10 text-center text-sm text-slate-500">
                {hasSearch ? (
                  <>No hay resultados para «{search}».</>
                ) : (
                  <>Todavía no hay cajeros ni meseros creados.</>
                )}
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="text-left text-xs uppercase text-lime-700 border-b border-lime-200">
                      <th className="py-2 pr-2">Nombre</th>
                      <th className="py-2 pr-2">Usuario</th>
                      <th className="py-2 pr-2">Rol</th>
                      <th className="py-2 pr-2">Perfil</th>
                      <th className="py-2 pr-2">Estado</th>
                      <th className="py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-b border-lime-100 last:border-b-0 hover:bg-lime-50/50 ${
                          editingId === row.id ? "bg-lime-50" : ""
                        }`}
                      >
                        <td className="py-2 pr-2 font-medium">{row.name}</td>
                        <td className="py-2 pr-2 text-slate-700">{row.username}</td>
                        <td className="py-2 pr-2">{roleLabel(row.role)}</td>
                        <td className="py-2 pr-2">
                          {row.accessRoleName ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-2 py-1 text-xs text-lime-800">
                              <ShieldCheck className="w-3 h-3" />
                              {row.accessRoleName}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">Sin perfil</span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              row.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                            }`}
                          >
                            {row.active ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="px-2 py-1 rounded-lg border border-lime-200 text-xs text-lime-900 hover:bg-lime-50 disabled:opacity-50"
                              disabled={!canWrite || busyId === row.id}
                              onClick={() => startEdit(row)}
                            >
                              Editar
                            </button>
                            <button
                              className="px-2 py-1 rounded-lg border border-lime-200 text-xs text-lime-900 hover:bg-lime-50 disabled:opacity-50"
                              disabled={!canWrite || busyId === row.id}
                              onClick={() => toggleActive(row)}
                            >
                              {row.active ? "Desactivar" : "Activar"}
                            </button>
                            <button
                              className="px-2 py-1 rounded-lg border text-xs text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
                              disabled={!canWrite || busyId === row.id}
                              onClick={() => setDeleteTarget(row)}
                              title="Eliminar"
                            >
                              {row.id === busyId ? (
                                <UserX className="w-4 h-4 inline animate-pulse" />
                              ) : (
                                <Trash2 className="w-4 h-4 inline" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="text-lg font-semibold text-slate-900">Eliminar personal</div>
            <div className="text-sm text-slate-600">
              Se eliminará a <span className="font-semibold">{deleteTarget.name}</span> ({deleteTarget.username}). Las ventas
              ya registradas conservan su historial, pero el usuario no podrá volver a entrar al TPV.
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(busyId)}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:bg-red-300"
                onClick={remove}
                disabled={Boolean(busyId)}
              >
                {busyId ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
