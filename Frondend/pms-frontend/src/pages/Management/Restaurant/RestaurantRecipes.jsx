import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

export default function RestaurantRecipes() {
  const [recipeForm, setRecipeForm] = useState({ codigo: "", ingrediente: "", cantidad: "", unidad: "" });
  const [recipes, setRecipes] = useState([]);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const UNIT_OPTIONS = [
    { label: "Unit (un)", value: "un" },
    { label: "Grams (g)", value: "g" },
    { label: "Kilograms (kg)", value: "kg" },
    { label: "Pounds (lb)", value: "lb" },
    { label: "Milliliters (ml)", value: "ml" },
    { label: "Liters (l)", value: "l" },
    { label: "Ounces (oz)", value: "oz" },
  ];

  const itemOptions = useMemo(
    () => items.map((i) => ({ code: i.code || i.id, label: `${i.code || i.id} - ${i.name || i.family || ""}`.trim() })),
    [items]
  );

  useEffect(() => {
    api.get("/restaurant/recipes").then(({ data }) => Array.isArray(data) && setRecipes(data)).catch(() => {});
    api.get("/restaurant/items").then(({ data }) => Array.isArray(data) && setItems(data)).catch(() => {});
  }, []);

  const addRecipe = () => {
    if (saving || !recipeForm.codigo || !recipeForm.ingrediente || !recipeForm.cantidad) return;
    setSaving(true);
    api
      .post("/restaurant/recipes", recipeForm)
      .then(({ data }) => {
        const item = data?.id ? data : { ...recipeForm, id: Date.now().toString() };
        setRecipes((prev) => [...prev, item]);
        setRecipeForm({ codigo: "", ingrediente: "", cantidad: "", unidad: "" });
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  const removeRecipe = (id) => {
    api.delete(`/restaurant/recipes/${id}`).finally(() => {
      setRecipes((prev) => prev.filter((r) => r.id !== id));
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-lg">Recipes</h3>
          <p className="text-sm text-gray-600">Ingredients per item for cost control.</p>
        </div>
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <Input
              list="rest-item-codes"
              placeholder="Item / code"
              value={recipeForm.codigo}
              onChange={(e) => setRecipeForm((f) => ({ ...f, codigo: e.target.value }))}
            />
            <datalist id="rest-item-codes">
              {itemOptions.map((i) => (
                <option key={i.code} value={i.code}>{i.label}</option>
              ))}
            </datalist>
          </div>
          <Input placeholder="Ingredient" value={recipeForm.ingrediente} onChange={(e) => setRecipeForm((f) => ({ ...f, ingrediente: e.target.value }))} />
          <Input placeholder="Quantity" value={recipeForm.cantidad} onChange={(e) => setRecipeForm((f) => ({ ...f, cantidad: e.target.value }))} />
          <select
            className="h-11 rounded-lg border px-3 text-sm bg-white"
            value={recipeForm.unidad}
            onChange={(e) => setRecipeForm((f) => ({ ...f, unidad: e.target.value }))}
          >
            <option value="">Unit</option>
            {UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={addRecipe} disabled={saving}>{saving ? "Saving..." : "Add ingredient"}</Button>
        </div>
        {recipes.length > 0 && (
          <div className="space-y-2">
            {recipes.map((r) => (
              <div key={r.id} className="border rounded-lg px-3 py-2 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold">{r.codigo} - {r.ingrediente}</div>
                  <div className="text-xs text-gray-600">{r.cantidad} {r.unidad}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => removeRecipe(r.id)}>Remove</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
