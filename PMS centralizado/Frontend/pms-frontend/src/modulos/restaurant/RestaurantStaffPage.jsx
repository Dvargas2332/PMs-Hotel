import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, UserPlus, UserX } from "lucide-react";
import { api } from "../../lib/api";
import RestaurantUserMenu from "./RestaurantUserMenu";

const ROLE_OPTIONS = [
  { value: "CASHIER", label: "Cajero" },
  { value: "WAITER", label: "Mesero" },
];

const emptyForm = {
  name: "",
  username: "",
  password: "",
  role: "WAITER",
  accessRoleId: "",
  launcherId: "",
  active: true,
};

export default function RestaurantStaffPage() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState("");
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState([]);
  const shift = useMemo(() => {
    const h = now.getHours();
    if (h < 15) return "Morning shift";
    if (h < 22) return "Afternoon shift";
    return "Night shift";
  }, [now]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/restaurant/staff");
      setStaff(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "No se pudo cargar el personal.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    api
      .get("/launcher")
      .then(({ data }) => {
        if (Array.isArray(data)) setProfiles(data);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const term = String(search || "").trim().toLowerCase();
    if (!term) return staff;
    return (staff || []).filter((s) => {
      const name = String(s.name || "").toLowerCase();
      const user = String(s.username || "").toLowerCase();
      const role = String(s.role || "").toLowerCase();
      return name.includes(term) || user.includes(term) || role.includes(term);
    });
  }, [staff, search]);

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId("");
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: String(form.name || "").trim(),
        username: String(form.username || "").trim(),
        password: String(form.password || "").trim(),
        role: form.role,
        launcherId: form.launcherId || undefined,
        active: form.active !== false,
      };

      if (!payload.name || !payload.username) {
        setError("Nombre y usuario son requeridos.");
        setSaving(false);
        return;
      }
      if (!editingId && !payload.password) {
        setError("Password requerido para crear.");
        setSaving(false);
        return;
      }

      if (editingId) {
        const updatePayload = { ...payload };
        if (!updatePayload.password) delete updatePayload.password;
        const { data } = await api.patch(`/restaurant/staff/${editingId}`, updatePayload);
        setStaff((prev) => (prev || []).map((s) => (s.id === editingId ? data : s)));
      } else {
        const { data } = await api.post("/restaurant/staff", payload);
        setStaff((prev) => [data, ...(prev || [])]);
      }
      resetForm();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "No se pudo guardar.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      username: row.username || "",
      password: "",
      role: row.role || "WAITER",
      accessRoleId: row.accessRoleId || "",
      launcherId: row.launcherId || "",
      active: row.active !== false,
    });
  };

  const toggleActive = async (row) => {
    if (!row?.id) return;
    try {
      const { data } = await api.patch(`/restaurant/staff/${row.id}`, { active: !row.active });
      setStaff((prev) => (prev || []).map((s) => (s.id === row.id ? data : s)));
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "No se pudo actualizar.";
      setError(msg);
    }
  };

  const remove = async (row) => {
    if (!row?.id) return;
    if (!window.confirm("Eliminar este usuario?")) return;
    try {
      await api.delete(`/restaurant/staff/${row.id}`);
      setStaff((prev) => (prev || []).filter((s) => s.id !== row.id));
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "No se pudo eliminar.";
      setError(msg);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-lime-50 text-black">
      <header className="relative h-14 bg-gradient-to-r from-lime-700 to-emerald-600 flex items-center justify-between px-10 shadow">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-white">Restaurant</span>
          <span className="text-sm text-white/80">Cajeros y Meseros</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-sm font-semibold">
            <div className="px-4 py-2 rounded-xl bg-white/15 text-white">
              {now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="px-4 py-2 rounded-xl bg-white/15 text-white">{shift}</div>
          </div>
          <button
            className="px-3 py-2 rounded-xl bg-white/15 text-white text-xs font-semibold hover:bg-white/20"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 inline mr-1 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
          <RestaurantUserMenu />
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-4">
        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-lime-200 bg-white/95 shadow p-4 space-y-3" autoComplete="off">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-lime-900">Crear / Editar</div>
              <div className="h-9 w-9 rounded-xl bg-lime-700 text-white flex items-center justify-center shadow">
                <UserPlus className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-2">
              <input
                className="w-full h-10 rounded-lg border border-lime-200 px-3 text-sm bg-white"
                placeholder="Nombre"
                autoComplete="off"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
              <input
                className="w-full h-10 rounded-lg border border-lime-200 px-3 text-sm bg-white"
                placeholder="Usuario"
                autoComplete="off"
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              />
              <input
                className="w-full h-10 rounded-lg border border-lime-200 px-3 text-sm bg-white"
                type="password"
                placeholder={editingId ? "Nuevo password (opcional)" : "Password"}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              />
              <div className="text-xs font-medium text-lime-700">Perfil</div>
              <select
                className="w-full h-10 rounded-lg border border-lime-200 px-3 text-sm bg-white"
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-lime-700/80">Perfil de permisos (Cajero o Mesero).</div>
              <div className="text-xs font-medium text-lime-700">Perfil de permisos</div>
              <select
                className="w-full h-10 rounded-lg border border-lime-200 px-3 text-sm bg-white"
                value={form.launcherId}
                onChange={(e) => setForm((p) => ({ ...p, launcherId: e.target.value }))}
              >
                <option value="">Sin perfil</option>
                {(profiles || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.userId || p.username || p.id}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
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
                disabled={saving}
              >
                {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear"}
              </button>
              <button className="px-3 py-2 rounded-lg border border-lime-200 text-sm text-lime-900" onClick={resetForm}>
                Limpiar
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-lime-200 bg-white/95 shadow p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-lime-900">Listado</div>
              <input
                className="h-9 rounded-lg border border-lime-200 px-3 text-sm bg-white"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {filtered.length === 0 ? (
              <div className="text-sm text-black/60">No hay personal creado.</div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
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
                      <tr key={row.id} className="border-b border-lime-100 last:border-b-0 hover:bg-lime-50/50">
                        <td className="py-2 pr-2">{row.name}</td>
                        <td className="py-2 pr-2">{row.username}</td>
                        <td className="py-2 pr-2">{ROLE_OPTIONS.find((r) => r.value === row.role)?.label || row.role}</td>
                        <td className="py-2 pr-2">{row.launcherName || row.launcherUserId || "-"}</td>
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
                              className="px-2 py-1 rounded-lg border border-lime-200 text-xs text-lime-900 hover:bg-lime-50"
                              onClick={() => startEdit(row)}
                            >
                              Editar
                            </button>
                            <button
                              className="px-2 py-1 rounded-lg border border-lime-200 text-xs text-lime-900 hover:bg-lime-50"
                              onClick={() => toggleActive(row)}
                            >
                              {row.active ? "Desactivar" : "Activar"}
                            </button>
                            <button
                              className="px-2 py-1 rounded-lg border text-xs text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => remove(row)}
                              title="Eliminar"
                            >
                              <UserX className="w-4 h-4 inline" />
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
    </div>
  );
}
