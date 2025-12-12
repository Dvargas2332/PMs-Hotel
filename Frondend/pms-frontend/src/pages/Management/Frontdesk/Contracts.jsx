// src/pages/Management/Frontdesk/Contracts.jsx

import React, { useEffect, useRef, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

export default function Contracts() {
  const [items, setItems] = useState([]);
  const [ratePlans, setRatePlans] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const didInit = useRef(false);

  const [form, setForm] = useState({
    id: "",
    channel: "",
    commission: 0.15,    // 0.15 = 15%
    active: true,
    ratePlanIds: [],     // ← multiselect
    mealPlanId: "",      // ← select simple
  });

  // -------- helpers ----------
  const normalize = (f) => ({
    id: f.id.trim(),
    channel: f.channel.trim(),
    commission: Number(f.commission || 0),
    active: !!f.active,
    ratePlans: (Array.isArray(f.ratePlanIds) ? f.ratePlanIds : []).map(String),
    mealPlanId: f.mealPlanId || null,
  });

  const resetForm = () =>
    setForm({
      id: "",
      channel: "",
      commission: 0.15,
      active: true,
      ratePlanIds: [],
      mealPlanId: "",
    });

  const load = async () => {
    const [{ data: contracts }, { data: rps }, { data: mps }] = await Promise.all([
      api.get("/contracts"),
      api.get("/ratePlans?active=true"),
      api.get("/mealPlans"),
    ]);
    setItems(
      (contracts || []).map((c) => ({
        ...c,
        // backend devuelve ratePlans como array de IDs (según la ruta que te pasé)
        ratePlans: c.ratePlans || [],
        mealPlanId: c.mealPlanId || "",
      }))
    );
    setRatePlans(rps || []);
    setMealPlans(mps || []);
  };

  // Cargar datos iniciales solo una vez al montar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    load();
  }, []);

  // -------- CRUD ----------
  const onCreate = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = normalize(form);
      await api.post("/contracts", payload);
      // refrescar lista para evitar duplicados y asegurar join
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
      channel: row.channel || "",
      commission: row.commission ?? 0.15,
      active: !!row.active,
      ratePlanIds: Array.isArray(row.ratePlans) ? row.ratePlans : [],
      mealPlanId: row.mealPlanId || "",
    });
  };

  const onUpdate = async () => {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    try {
      const payload = normalize(form);
      await api.put(`/contracts/${encodeURIComponent(selectedId)}`, payload);
      await load();
      setSelectedId(null);
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (idFromRow) => {
    const id = idFromRow || selectedId;
    if (!id || submitting) return;
    const ok = window.confirm("¿Eliminar el contrato/canal?");
    if (!ok) return;
    setSubmitting(true);
    try {
      await api.delete(`/contracts/${encodeURIComponent(id)}`);
      await load();
      if (selectedId === id) {
        setSelectedId(null);
        resetForm();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // -------- UI ----------
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Form */}
      <Card className="space-y-3 p-5">
        <h3 className="font-medium">
          {selectedId ? "Editar Contrato/Canal" : "Nuevo Contrato/Canal"}
        </h3>

        <Input
          placeholder="ID"
          value={form.id}
          onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
        />
        <Input
          placeholder="Canal (ej. Booking.com)"
          value={form.channel}
          onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
        />

        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Comisión (0.15 = 15%)"
            type="number"
            value={form.commission}
            onChange={(e) => setForm((f) => ({ ...f, commission: e.target.value }))}
          />

          {/* Meal Plan (select simple) */}
          <div className="flex flex-col">
            <label className="text-sm mb-1">Régimen (Meal Plan)</label>
            <select
              className="h-10 rounded-lg border px-3 text-sm"
              value={form.mealPlanId}
              onChange={(e) => setForm((f) => ({ ...f, mealPlanId: e.target.value }))}
            >
              <option value="">— Sin régimen —</option>
              {mealPlans.map((mp) => (
                <option key={mp.id} value={mp.id}>
                  {mp.id} — {mp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Rate Plans (multiselect) */}
        <div className="flex flex-col">
          <label className="text-sm mb-1">Tarifarios (selección múltiple)</label>
          <select
            multiple
            className="min-h-[120px] rounded-lg border px-3 py-2 text-sm"
            value={form.ratePlanIds}
            onChange={(e) => {
              const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
              setForm((f) => ({ ...f, ratePlanIds: opts }));
            }}
          >
            {ratePlans.map((rp) => (
              <option key={rp.id} value={rp.id}>
                {rp.id} — {rp.name} ({rp.currency})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Sostén Ctrl/Cmd para seleccionar múltiples.
          </p>
        </div>

        <div className="flex gap-2">
          {!selectedId ? (
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
                onClick={() => onDelete()}
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

      {/* Tabla */}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="py-2 pl-4 text-left">ID</th>
              <th className="text-left">Canal</th>
              <th className="text-left">Comisión</th>
              <th className="text-left">Tarifarios</th>
              <th className="text-left">Régimen</th>
              <th className="pr-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-500">
                  Sin contratos aún.
                </td>
              </tr>
            )}
            {items.map((x) => {
              const isSel = x.id === selectedId;
              const rpList = (x.ratePlans || []).join(", ");
              return (
                <tr
                  key={x.id}
                  className={`border-t ${isSel ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  <td className="py-2 pl-4">{x.id}</td>
                  <td>{x.channel}</td>
                  <td>{((x.commission ?? 0) * 100).toFixed(2)}%</td>
                  <td>{rpList || "—"}</td>
                  <td>{x.mealPlanId || "—"}</td>
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
                      onClick={() => onDelete(x.id)}
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
