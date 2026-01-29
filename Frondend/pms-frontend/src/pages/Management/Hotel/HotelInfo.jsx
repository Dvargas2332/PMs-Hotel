//src/pages/Management/Hotel/HotelInfo.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

const MEMBERSHIP_LABELS = {
  BASIC: "Básico",
  STANDARD: "Estándar",
  PRO: "Pro",
  PLATINUM: "Platino",
};



function normalizeNullableText(v) {
  const t = String(v ?? "").trim();
  return t ? t : null;
}

export default function HotelInfo() {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [meta, setMeta] = useState({
    id: "",
    saasClientName: "",
    membership: "",
    membershipMonthlyFee: 0,
    currency: "",
    createdAt: "",
  });

  const [form, setForm] = useState({
    name: "",
    phone1: "",
    phone2: "",
    ownerName: "",
    managerName: "",
    companyId: "",
    managerId: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/hotel");
      setMeta({
        id: data?.id || "",
        saasClientName: data?.saasClientName || data?.saasClient?.name || "",
        membership: data?.membership || "",
        membershipMonthlyFee: data?.membershipMonthlyFee ?? 0,
        currency: data?.currency || "",
        createdAt: data?.createdAt || "",
      });
      setForm({
        name: data?.name || "",
        phone1: data?.phone1 || "",
        phone2: data?.phone2 || "",
        ownerName: data?.ownerName || "",
        managerName: data?.managerName || "",
        companyId: data?.companyId || "",
        managerId: data?.managerId || "",
      });
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const membershipLabel = useMemo(() => {
    const key = String(meta.membership || "").toUpperCase();
    return MEMBERSHIP_LABELS[key] || meta.membership || "-";
  }, [meta.membership]);

  const save = useCallback(async () => {
    if (!loaded || saving) return;
    const name = String(form.name || "").trim();
    if (!name) return;

    setSaving(true);
    try {
      await api.put("/hotel", {
        name,
        phone1: normalizeNullableText(form.phone1),
        phone2: normalizeNullableText(form.phone2),
        ownerName: normalizeNullableText(form.ownerName),
        managerName: normalizeNullableText(form.managerName),
        companyId: normalizeNullableText(form.companyId),
        managerId: normalizeNullableText(form.managerId),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }, [form, load, loaded, saving]);

  useEffect(() => {
    const onSave = () => {
      save().catch(() => {});
    };
    window.addEventListener("pms:save-hotel-info", onSave);
    return () => window.removeEventListener("pms:save-hotel-info", onSave);
  }, [save]);

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">Información general del hotel</h3>
          <div className="text-xs text-slate-500">
            ID: <span className="font-mono">{meta.id || "-"}</span>
            {meta.createdAt ? (
              <span>
                {" "}
                · Creado: {new Date(meta.createdAt).toLocaleString()}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Actualizar"}
          </Button>
          <Button type="button" onClick={save} disabled={!loaded || saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Empresa</div>
          <div className="font-semibold text-slate-900">{meta.saasClientName || "-"}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Membresía</div>
          <div className="font-semibold text-slate-900">{membershipLabel}</div>
        </div>
        
        
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Nombre del hotel</label>
          <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">Identificación de la empresa (hotel)</label>
          <Input value={form.companyId} onChange={(e) => setForm((s) => ({ ...s, companyId: e.target.value }))} />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">Teléfono 1</label>
          <Input value={form.phone1} onChange={(e) => setForm((s) => ({ ...s, phone1: e.target.value }))} />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">Teléfono 2</label>
          <Input value={form.phone2} onChange={(e) => setForm((s) => ({ ...s, phone2: e.target.value }))} />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">Nombre del dueño</label>
          <Input value={form.ownerName} onChange={(e) => setForm((s) => ({ ...s, ownerName: e.target.value }))} />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">Gerente / Encargado</label>
          <Input value={form.managerName} onChange={(e) => setForm((s) => ({ ...s, managerName: e.target.value }))} />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-xs text-slate-500">Identificación del encargado</label>
          <Input value={form.managerId} onChange={(e) => setForm((s) => ({ ...s, managerId: e.target.value }))} />
        </div>
      </div>

      
    </Card>
  );
}
