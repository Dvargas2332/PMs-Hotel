import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

const UNIT_VALUES = ["un", "g", "kg", "lb", "ml", "l", "oz"];

export default function RestaurantRecipes() {
  const { t } = useLanguage();
  const [recipeForm, setRecipeForm] = useState({ codigo: "", ingrediente: "", cantidad: "", unidad: "" });
  const [recipes, setRecipes] = useState([]);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const itemOptions = useMemo(
    () => items.map((i) => ({ code: i.code || i.id, label: `${i.code || i.id} - ${i.name || i.family || ""}`.trim() })),
    [items]
  );

  useEffect(() => {
    api
      .get("/restaurant/recipes")
      .then(({ data }) => Array.isArray(data) && setRecipes(data))
      .catch(() => {});
    api
      .get("/restaurant/items")
      .then(({ data }) => Array.isArray(data) && setItems(data))
      .catch(() => {});
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
          <h3 className="font-semibold text-lg">{t("mgmt.restaurantRecipes.title")}</h3>
          <p className="text-sm text-gray-600">{t("mgmt.restaurantRecipes.subtitle")}</p>
        </div>
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <Input
              list="rest-item-codes"
              placeholder={t("mgmt.restaurantRecipes.itemCode")}
              value={recipeForm.codigo}
              onChange={(e) => setRecipeForm((f) => ({ ...f, codigo: e.target.value }))}
            />
            <datalist id="rest-item-codes">
              {itemOptions.map((i) => (
                <option key={i.code} value={i.code}>
                  {i.label}
                </option>
              ))}
            </datalist>
          </div>
          <Input
            placeholder={t("mgmt.restaurantRecipes.ingredient")}
            value={recipeForm.ingrediente}
            onChange={(e) => setRecipeForm((f) => ({ ...f, ingrediente: e.target.value }))}
          />
          <Input
            placeholder={t("mgmt.restaurantRecipes.quantity")}
            value={recipeForm.cantidad}
            onChange={(e) => setRecipeForm((f) => ({ ...f, cantidad: e.target.value }))}
          />
          <select
            className="h-11 rounded-lg border px-3 text-sm bg-white"
            value={recipeForm.unidad}
            onChange={(e) => setRecipeForm((f) => ({ ...f, unidad: e.target.value }))}
          >
            <option value="">{t("mgmt.restaurantRecipes.unit")}</option>
            {UNIT_VALUES.map((u) => (
              <option key={u} value={u}>
                {t(`mgmt.restaurantRecipes.unit.${u}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={addRecipe} disabled={saving}>
            {saving ? t("mgmt.restaurantRecipes.saving") : t("mgmt.restaurantRecipes.addIngredient")}
          </Button>
        </div>
        {recipes.length > 0 && (
          <div className="space-y-2">
            {recipes.map((r) => (
              <div key={r.id} className="border rounded-lg px-3 py-2 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold">
                    {r.codigo} - {r.ingrediente}
                  </div>
                  <div className="text-xs text-gray-600">
                    {r.cantidad} {r.unidad}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => removeRecipe(r.id)}>
                  {t("mgmt.restaurantRecipes.remove")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
