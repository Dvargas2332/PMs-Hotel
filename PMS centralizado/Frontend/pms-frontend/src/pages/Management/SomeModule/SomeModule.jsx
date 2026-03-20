// src/pages/Management/SomeModule/SomeModule.jsx
import { useState, useEffect } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import { useCrud } from "../../../hooks/useCrud";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

export default function SomeModule() {
  const { t } = useLanguage();
  const { items, load, createItem, removeItem, loading, error } = useCrud(api, "/some-module");
  const [form, setForm] = useState({ name: "", code: "" });
  const [confirm, setConfirm] = useState(null); // id | null

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async () => {
    if (!form.name?.trim()) return;
    await createItem(form);
    setForm({ name: "", code: "" });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="space-y-3 p-5">
        <h3 className="font-medium">{t("mgmt.someModule.newRecord")}</h3>
        <Input placeholder={t("mgmt.someModule.name")} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Input placeholder={t("mgmt.someModule.code")} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
        <Button onClick={onSubmit} disabled={loading}>{t("mgmt.someModule.save")}</Button>
        {error && <div className="text-sm text-red-600">{t("mgmt.someModule.error")}: {error.message || t("mgmt.someModule.loadFailed")}</div>}
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr><th className="py-2 pl-4 text-left">{t("mgmt.someModule.name")}</th><th>{t("mgmt.someModule.code")}</th><th className="pr-4 text-right">{t("mgmt.someModule.actions")}</th></tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={3} className="py-6 text-center text-gray-500">{t("mgmt.someModule.noData")}</td></tr>
            )}
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="py-2 pl-4">{it.name}</td>
                <td>{it.code}</td>
                <td className="pr-4 py-2 text-right">
                  <button onClick={() => setConfirm(it.id)} className="rounded border px-2 py-1 text-xs">{t("mgmt.someModule.delete")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ConfirmDialog
        open={!!confirm}
        title={t("mgmt.someModule.deleteRecord")}
        message={t("mgmt.someModule.deleteWarn")}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await removeItem(confirm);
          setConfirm(null);
        }}
      />
    </div>
  );
}
