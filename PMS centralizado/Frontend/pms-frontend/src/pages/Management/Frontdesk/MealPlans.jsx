//src/pages/Management/Frontdesk/MealPlans.jsx

import React, { useEffect, useState } from "react";
import { Pencil, Trash2, X, Plus } from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

const EMPTY_FORM = { id: "", name: "" };

export default function MealPlans() {
  const { t } = useLanguage();
  const [items, setItems]     = useState([]);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null); // item being edited
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const load = async () => {
    try {
      const { data } = await api.get("/mealPlans");
      setItems(data || []);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  function startEdit(item) {
    setEditing(item);
    setForm({ id: item.id, name: item.name });
    setError("");
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function onSave() {
    if (!form.name.trim()) { setError("El nombre es requerido"); return; }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const { data } = await api.put(`/mealPlans/${editing.id}`, { name: form.name });
        setItems(prev => prev.map(x => x.id === data.id ? data : x));
        cancelEdit();
      } else {
        if (!form.id.trim()) { setError("El ID es requerido"); setSaving(false); return; }
        const { data } = await api.post("/mealPlans", form);
        setItems(prev => [...prev, data]);
        setForm(EMPTY_FORM);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Error al guardar");
    }
    setSaving(false);
  }

  async function onDelete(item) {
    if (!confirm(`¿Eliminar plan "${item.name}"?`)) return;
    try {
      await api.delete(`/mealPlans/${item.id}`);
      setItems(prev => prev.filter(x => x.id !== item.id));
      if (editing?.id === item.id) cancelEdit();
    } catch (e) {
      alert(e?.response?.data?.message || "Error al eliminar");
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Form */}
      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">
            {editing ? `Editando: ${editing.name}` : t("mgmt.mealPlans.new")}
          </h3>
          {editing && (
            <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {!editing && (
          <Input
            placeholder={t("mgmt.mealPlans.idPlaceholder")}
            value={form.id}
            onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
          />
        )}
        <Input
          placeholder={t("mgmt.mealPlans.name")}
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          {editing && (
            <Button variant="outline" onClick={cancelEdit}>{t("common.cancel")}</Button>
          )}
          <Button onClick={onSave} disabled={saving} className="flex items-center gap-1">
            <Plus className="w-4 h-4" />
            {saving ? "Guardando..." : editing ? t("common.save") : t("mgmt.mealPlans.create")}
          </Button>
        </div>
      </Card>

      {/* List */}
      <div className="space-y-2">
        <h3 className="font-medium text-sm text-slate-400 mb-2">
          {items.length} {items.length === 1 ? "plan" : "planes"} configurados
        </h3>
        {items.length === 0 && (
          <p className="text-xs text-slate-500">Sin planes de comida. Crea uno.</p>
        )}
        {items.map(item => (
          <div
            key={item.id}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition
              ${editing?.id === item.id
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-white/10 bg-white/5 hover:bg-white/8"}`}
          >
            <div>
              <span className="font-medium">{item.name}</span>
              <span className="ml-2 text-[11px] text-slate-500 font-mono">{item.id}</span>
            </div>
            <div className="flex gap-1">
              <button
                className="p-1 text-slate-400 hover:text-slate-100 rounded"
                title="Editar"
                onClick={() => startEdit(item)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                className="p-1 text-slate-400 hover:text-red-400 rounded"
                title="Eliminar"
                onClick={() => onDelete(item)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
