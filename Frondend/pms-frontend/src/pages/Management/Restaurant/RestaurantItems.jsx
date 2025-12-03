import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Checkbox } from "../../../components/ui/checkbox";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

export default function RestaurantItems() {
  const empty = {
    code: "",
    family: "",
    subFamily: "",
    subSubFamily: "",
    cabys: "",
    price: "",
    tax: "",
    notes: "",
    active: true,
  };
  const [form, setForm] = useState(empty);
  const [drafts, setDrafts] = useState([]);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/restaurant/items")
      .then(({ data }) => {
        if (Array.isArray(data)) setItems(data);
      })
      .catch(() => {});
  }, []);

  const genCode = (name = "") => {
    const slug = (name || "ART").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "ART";
    const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    return `${slug}-${rand}`;
  };

  const addDraft = () => {
    if (!form.family || !form.cabys || !form.price) return;
    const draft = { ...form, id: `draft-${Date.now()}`, code: form.code || genCode(form.family) };
    setDrafts((prev) => [...prev, draft]);
    setForm(empty);
  };

  const removeDraft = (id) => setDrafts((prev) => prev.filter((d) => d.id !== id));

  const saveDrafts = async () => {
    if (!drafts.length) return;
    try {
      setSaving(true);
      const payload = drafts.map((d) => ({ ...d, price: Number(d.price || 0), tax: Number(d.tax || 0) }));
      const { data } = await api.post("/restaurant/items", { items: payload });
      const savedList = Array.isArray(data) ? data : [data];
      setItems((prev) => [...prev, ...savedList]);
      setDrafts([]);
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurante", desc: "Articulos guardados" } }));
    } finally {
      setSaving(false);
    }
  };

  const removeItem = (id) => {
    api.delete(`/restaurant/items/${id}`).finally(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Articulos</h3>
            <p className="text-sm text-gray-600">Creacion de articulos con CABYS, familias e impuestos.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDrafts([])} disabled={!drafts.length}>
              Limpiar borradores
            </Button>
            <Button disabled={!drafts.length || saving} onClick={saveDrafts}>
              {saving ? "Guardando..." : "Guardar articulos"}
            </Button>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Codigo" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          <Input placeholder="Familia" value={form.family} onChange={(e) => setForm((f) => ({ ...f, family: e.target.value }))} />
          <Input placeholder="Sub familia" value={form.subFamily} onChange={(e) => setForm((f) => ({ ...f, subFamily: e.target.value }))} />
          <Input placeholder="Sub subfamilia" value={form.subSubFamily} onChange={(e) => setForm((f) => ({ ...f, subSubFamily: e.target.value }))} />
          <Input placeholder="Codigo CABYS" value={form.cabys} onChange={(e) => setForm((f) => ({ ...f, cabys: e.target.value }))} />
          <Input placeholder="Precio" type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          <Input placeholder="Impuestos (%)" type="number" value={form.tax} onChange={(e) => setForm((f) => ({ ...f, tax: e.target.value }))} />
        </div>
        <Textarea placeholder="Notas" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: Boolean(v) }))} />
          Articulo activo
        </label>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={addDraft}>
            Agregar a borrador
          </Button>
        </div>
      </Card>

        {drafts.length > 0 && (
          <Card className="p-4 space-y-2">
            <div className="text-sm font-semibold">Borradores ({drafts.length})</div>
          <div className="grid md:grid-cols-2 gap-2">
            {drafts.map((d) => (
              <div key={d.id} className="border rounded-md px-3 py-2 flex justify-between items-start gap-2">
                <div className="text-sm">
                  <div className="font-semibold">{d.code} - {d.family} / {d.subFamily} {d.subSubFamily ? `/ ${d.subSubFamily}` : ""}</div>
                  <div className="text-xs text-gray-600">CABYS: {d.cabys}</div>
                  <div className="text-xs text-gray-600">Impuesto: {d.tax || 0}%</div>
                  <div className="text-xs text-gray-600">Precio: {Number(d.price || 0).toFixed(2)}</div>
                  {d.notes && <div className="text-xs text-gray-600 mt-1">Notas: {d.notes}</div>}
                  <div className="text-xs mt-1">{d.active ? "Activo" : "Inactivo"}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => removeDraft(d.id)}>
                  Quitar
                </Button>
              </div>
            ))}
          </div>
        </Card>
        )}

      {items.length > 0 && (
        <Card className="p-4 space-y-2">
          <div className="text-sm font-semibold">Articulos existentes ({items.length})</div>
          <div className="grid md:grid-cols-2 gap-2">
            {items.map((i) => (
              <div key={i.id} className="border rounded-md px-3 py-2 flex justify-between items-start gap-2">
                <div className="text-sm">
                  <div className="font-semibold">{i.code || i.id} - {i.family} / {i.subFamily} {i.subSubFamily ? `/ ${i.subSubFamily}` : ""}</div>
                  <div className="text-xs text-gray-600">CABYS: {i.cabys}</div>
                  <div className="text-xs text-gray-600">Impuesto: {i.tax || 0}%</div>
                  <div className="text-xs text-gray-600">Precio: {Number(i.price || 0).toFixed(2)}</div>
                  {i.notes && <div className="text-xs text-gray-600 mt-1">Notas: {i.notes}</div>}
                  <div className="text-xs mt-1">{i.active ? "Activo" : "Inactivo"}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => removeItem(i.id)}>
                  Quitar
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
