//src/pages/Management/Taxes/Taxes.jsx

import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { SimpleTable } from "../../../components/ui/table";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

export default function Taxes() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ code: "", name: "", percent: 13, scope: "room" });

  const load = async () => {
    const { data } = await api.get("/taxes");
    setItems(data || []);
  };
  useEffect(() => {
    load();
  }, []);

  const onCreate = async () => {
    const payload = { ...form, percent: Number(form.percent || 0) };
    const { data } = await api.post("/taxes", payload);
    setItems((prev) => [...prev, data]);
    setForm({ code: "", name: "", percent: 13, scope: "room" });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="space-y-3 p-5">
        <h3 className="font-medium">{t("mgmt.taxes.new")}</h3>
        <Input placeholder={t("mgmt.taxes.codePlaceholder")} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
        <Input placeholder={t("mgmt.taxes.namePlaceholder")} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder={t("mgmt.taxes.percentPlaceholder")} type="number" min="0" value={form.percent} onChange={(e) => setForm((f) => ({ ...f, percent: e.target.value }))} />
          <Input placeholder={t("mgmt.taxes.scopePlaceholder")} value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))} />
        </div>
        <Button onClick={onCreate}>{t("mgmt.taxes.create")}</Button>
      </Card>

      <div>
        <SimpleTable
          cols={[{ key: "code", label: t("mgmt.taxes.columns.code") }, { key: "name", label: t("mgmt.taxes.columns.name") }, { key: "percent", label: "%" },
            { key: "scope", label: t("mgmt.taxes.columns.scope") }]}
          rows={items.map((x) => ({ ...x, percent: Number(x.percent || 0).toFixed(2) }))}
        />
      </div>
    </div>
  );
}
