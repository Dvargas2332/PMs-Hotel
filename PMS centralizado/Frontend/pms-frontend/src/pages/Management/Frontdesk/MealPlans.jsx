//src/pages/Management/Frontdesk/MealPlans.jsx

import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { SimpleTable } from "../../../components/ui/table";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

export default function MealPlans() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ id: "", name: "" });

  const load = async () => {
    const { data } = await api.get("/api/mealPlans");
    setItems(data || []);
  };
  useEffect(() => {
    load();
  }, []);

  const onCreate = async () => {
    const { data } = await api.post("/api/mealPlans", form);
    setItems((prev) => [...prev, data]);
    setForm({ id: "", name: "" });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="space-y-3 p-5">
        <h3 className="font-medium">{t("mgmt.mealPlans.new")}</h3>
        <Input placeholder={t("mgmt.mealPlans.idPlaceholder")} value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} />
        <Input placeholder={t("mgmt.mealPlans.name")} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Button onClick={onCreate}>{t("mgmt.mealPlans.create")}</Button>
      </Card>
      <div>
        <SimpleTable
          cols={[{ key: "id", label: "ID" }, { key: "name", label: t("mgmt.mealPlans.name") }]}
          rows={items}
        />
      </div>
    </div>
  );
}
