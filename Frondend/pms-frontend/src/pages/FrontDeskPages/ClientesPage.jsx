import React, { useEffect, useMemo, useState } from "react";
import { useHotelData } from "../../context/HotelDataContext";

const emptyForm = { firstName: "", lastName: "", email: "", phone: "" };

export default function ClientesPage() {
  const { guests, loading, refreshGuests, createGuest, updateGuest } = useHotelData();
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    refreshGuests();
  }, [refreshGuests]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return guests;
    return guests.filter(
      (g) =>
        (g.name || "").toLowerCase().includes(term) ||
        (g.email || "").toLowerCase().includes(term) ||
        (g.phone || "").toLowerCase().includes(term)
    );
  }, [guests, search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName) {
      alert("Nombre y apellidos son obligatorios");
      return;
    }
    try {
      if (editId) {
        await updateGuest(editId, form);
      } else {
        await createGuest(form);
      }
      setForm(emptyForm);
      setEditId(null);
      setSearch("");
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "No se pudo guardar el huésped";
      alert(msg);
    }
  };

  const onEdit = (g) => {
    setEditId(g.id);
    setForm({
      firstName: g.firstName || "",
      lastName: g.lastName || "",
      email: g.email || "",
      phone: g.phone || "",
    });
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Huéspedes</h1>
          <p className="text-sm text-slate-600">Listado conectado al backend /guests.</p>
        </div>
        <button
          className="px-3 py-2 rounded border bg-white text-sm hover:bg-gray-100"
          onClick={refreshGuests}
          disabled={loading.guests}
        >
          Recargar
        </button>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold">{editId ? "Editar huésped" : "Crear huésped"}</h2>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nombre</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Apellidos</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Teléfono</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded border bg-gray-100 text-sm"
              onClick={() => {
                setEditId(null);
                setForm(emptyForm);
              }}
            >
              Limpiar
            </button>
            <button
              type="submit"
              disabled={loading.action}
              className="px-4 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-500"
            >
              {editId ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold">Lista</h2>
          <input
            className="border rounded px-3 py-2 text-sm w-full md:w-64"
            placeholder="Buscar por nombre, email o teléfono"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="p-2">Nombre</th>
                <th className="p-2">Email</th>
                <th className="p-2">Teléfono</th>
                <th className="p-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} className="border-t">
                  <td className="p-2">
                    <div className="font-medium">{g.name || `${g.firstName} ${g.lastName}`.trim()}</div>
                  </td>
                  <td className="p-2">{g.email || <span className="text-slate-400">Sin email</span>}</td>
                  <td className="p-2">{g.phone || <span className="text-slate-400">Sin teléfono</span>}</td>
                  <td className="p-2 text-right">
                    <button
                      className="px-3 py-1.5 rounded border bg-white hover:bg-gray-100 text-xs"
                      onClick={() => onEdit(g)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="p-3 text-center text-slate-500" colSpan={4}>
                    No hay huéspedes que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
