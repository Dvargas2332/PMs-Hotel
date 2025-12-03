import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

export default function RestaurantInventory() {
  const [inventoryForm, setInventoryForm] = useState({ sku: "", desc: "", stock: "", minimo: "", costo: "" });
  const [inventory, setInventory] = useState([]);
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const UNIT_OPTIONS = [
    { label: "Unidad (un)", value: "un" },
    { label: "Gramos (g)", value: "g" },
    { label: "Kilogramos (kg)", value: "kg" },
    { label: "Libras (lb)", value: "lb" },
    { label: "Mililitros (ml)", value: "ml" },
    { label: "Litros (l)", value: "l" },
    { label: "Onzas (oz)", value: "oz" },
  ];

  useEffect(() => {
    api
      .get("/restaurant/inventory")
      .then(({ data }) => {
        if (Array.isArray(data)) setInventory(data);
      })
      .catch(() => {});
  }, []);

  const genSku = (name = "") => {
    const slug = (name || "SKU").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "SKU";
    const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    return `${slug}-${rand}`;
  };

  const addInventory = () => {
    if (saving || !inventoryForm.desc) return;
    setSaving(true);
    api
      .post("/restaurant/inventory", { ...inventoryForm, sku: inventoryForm.sku || genSku(inventoryForm.desc), unidad: unit })
      .then(({ data }) => {
        const item = data?.id ? data : { ...inventoryForm, unidad: unit, id: Date.now().toString() };
        setInventory((prev) => [...prev, item]);
        setInventoryForm({ sku: "", desc: "", stock: "", minimo: "", costo: "" });
        setUnit("");
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  const removeInventory = (id) => {
    api.delete(`/restaurant/inventory/${id}`).finally(() => {
      setInventory((prev) => prev.filter((i) => i.id !== id));
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-lg">Inventario</h3>
          <p className="text-sm text-gray-600">SKU, existencias y costo por insumo.</p>
        </div>
        <div className="grid md:grid-cols-5 gap-3">
          <Input placeholder="SKU" value={inventoryForm.sku} onChange={(e) => setInventoryForm((f) => ({ ...f, sku: e.target.value }))} />
          <Input placeholder="Descripcion" value={inventoryForm.desc} onChange={(e) => setInventoryForm((f) => ({ ...f, desc: e.target.value }))} />
          <Input placeholder="Stock" type="number" value={inventoryForm.stock} onChange={(e) => setInventoryForm((f) => ({ ...f, stock: e.target.value }))} />
          <Input placeholder="Minimo" type="number" value={inventoryForm.minimo} onChange={(e) => setInventoryForm((f) => ({ ...f, minimo: e.target.value }))} />
          <Input placeholder="Costo" type="number" value={inventoryForm.costo} onChange={(e) => setInventoryForm((f) => ({ ...f, costo: e.target.value }))} />
          <select
            className="h-11 rounded-lg border px-3 text-sm bg-white"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="">Unidad</option>
            {UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={addInventory} disabled={saving}> {saving ? "Guardando..." : "Agregar item"} </Button>
        </div>
        {inventory.length > 0 && (
          <div className="grid md:grid-cols-2 gap-2">
            {inventory.map((i) => (
              <div key={i.id} className="border rounded-lg px-3 py-2 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold">{i.sku} - {i.desc}</div>
                  <div className="text-xs text-gray-600">Stock: {i.stock || 0} {i.unidad || ""} | Min: {i.minimo || 0} {i.unidad || ""} | Costo: {i.costo || 0}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => removeInventory(i.id)}>Quitar</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
