// src/pages/Management/Discounts/Discounts.jsx
import React, { useEffect, useRef, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

export default function Discounts() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [submitting, setSubmitting] = useState(false); // evita doble envío
  const didInit = useRef(false); // evita doble useEffect en StrictMode

  const [form, setForm] = useState({
    id: "",
    name: "",
    type: "percent", // percent | money
    value: 0,
    requiresPin: false,
    active: true,
    expiresAt: "",
  });

  // API
  const load = async () => {
    const { data } = await api.get("/discounts"); // tu api ya maneja baseURL
    setItems(data || []);
  };

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    load();
  }, []);

  const resetForm = () =>
    setForm({
      id: "",
      name: "",
      type: "percent",
      value: 0,
      requiresPin: false,
      active: true,
      expiresAt: "",
    });

  const onCreate = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = normalize(form);
      await api.post("/discounts", payload);
      await load();
      resetForm();
      setSelectedId(null);
    } finally {
      setSubmitting(false);
    }
  };

  const onUpdate = async () => {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    try {
      const payload = normalize(form);
      await api.put(`/discounts/${encodeURIComponent(selectedId)}`, payload);
      await load();
      setSelectedId(null);
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (!selectedId || submitting) return;
    const ok = window.confirm("¿Eliminar este descuento? Esta acción no se puede deshacer.");
    if (!ok) return;
    setSubmitting(true);
    try {
      await api.delete(`/discounts/${encodeURIComponent(selectedId)}`);
      await load();
      setSelectedId(null);
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const onRowSelect = (row) => {
    setSelectedId(row.id);
    setForm({
      id: row.id || "",
      name: row.name || "",
      type: row.type || "percent",
      value: row.value ?? 0,
      requiresPin: !!row.requiresPin,
      active: !!row.active,
      expiresAt: toInputDate(row.expiresAt),
    });
  };

  // Helpers
  function normalize(f) {
    return {
      id: f.id.trim(),
      name: f.name.trim(),
      type: f.type.trim() === "money" ? "money" : "percent",
      value: Number(f.value || 0),
      requiresPin: !!f.requiresPin,
      active: !!f.active,
      expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : null,
    };
  }
  function toInputDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }

  const editing = !!selectedId;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Formulario */}
      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{editing ? "Editar descuento" : "Nuevo descuento"}</h3>
          {editing && (
            <button
              type="button"
              className="text-xs underline text-gray-500 hover:text-gray-700"
              onClick={() => {
                setSelectedId(null);
                resetForm();
              }}
            >
              Cancelar
            </button>
          )}
        </div>

        {/* ID chico + Nombre grande */}
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <Input
            placeholder="ID"
            value={form.id}
            onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
          />
          <Input
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Input
            placeholder="Tipo (percent/money)"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          />
          <Input
            placeholder="Valor"
            type="number"
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
          />
          <Input
            placeholder="Expira"
            type="date"
            value={form.expiresAt}
            onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            placeholder="Max sin PIN (%)"
            type="number"
            onChange={(e) =>
              localStorage.setItem("discounts.maxPercentWithoutPin", e.target.value)
            }
          />
          <div className="flex items-center gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.requiresPin}
                onChange={(e) => setForm((f) => ({ ...f, requiresPin: e.target.checked }))}
              />
              Requiere PIN
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Activo
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          {!editing ? (
            <Button type="button" onClick={onCreate} disabled={submitting}>
              Crear
            </Button>
          ) : (
            <>
              <Button type="button" onClick={onUpdate} disabled={submitting}>
                Guardar cambios
              </Button>
              <Button
                type="button"
                onClick={onDelete}
                disabled={submitting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Eliminar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  resetForm();
                }}
                className="bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Cancelar
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Tabla con acciones */}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="py-2 pl-4 text-left">ID</th>
              <th className="text-left">Nombre</th>
              <th className="text-left">Tipo</th>
              <th className="text-left">Valor</th>
              <th className="text-left">Expira</th>
              <th className="text-left">PIN</th>
              <th className="text-left">Activo</th>
              <th className="pr-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-gray-500">
                  Sin descuentos aún.
                </td>
              </tr>
            )}
            {items.map((x) => {
              const isSel = x.id === selectedId;
              return (
                <tr
                  key={x.id}
                  className={`border-t ${isSel ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  <td className="py-2 pl-4">{x.id}</td>
                  <td>{x.name}</td>
                  <td>{x.type}</td>
                  <td>{x.value}</td>
                  <td>{x.expiresAt ? new Date(x.expiresAt).toLocaleDateString() : "—"}</td>
                  <td>{x.requiresPin ? "Sí" : "No"}</td>
                  <td>{x.active ? "Sí" : "No"}</td>
                  <td className="pr-4 py-2 text-right space-x-1">
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs hover:bg-blue-100"
                      onClick={() => onRowSelect(x)}
                      disabled={submitting}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      onClick={async () => {
                        if (submitting) return;
                        const ok = window.confirm(`¿Eliminar el descuento "${x.name}"?`);
                        if (!ok) return;
                        setSubmitting(true);
                        try {
                          await api.delete(`/discounts/${encodeURIComponent(x.id)}`);
                          await load();
                          if (selectedId === x.id) {
                            setSelectedId(null);
                            resetForm();
                          }
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      disabled={submitting}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
