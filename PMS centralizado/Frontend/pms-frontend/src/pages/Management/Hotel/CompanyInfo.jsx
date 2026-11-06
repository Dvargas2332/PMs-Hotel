//src/pages/Management/Hotel/CompanyInfo.jsx

import React, { useCallback, useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

const emptyCompany = {
  name: "",
  companyId: "",
  email: "",
  phone1: "",
  phone2: "",
  ownerName: "",
  managerName: "",
  managerId: "",
};

function normalizeNullableText(v) {
  const text = String(v ?? "").trim();
  return text ? text : null;
}

/** Información general de la empresa (SaasClient), compartida por sus hoteles. */
export default function CompanyInfo() {
  const [company, setCompany] = useState({ ...emptyCompany });
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      const { data } = await api.get("/hotel/company");
      setCompany({ ...emptyCompany, ...(data || {}) });
      setMissing(false);
      setLoaded(true);
    } catch (err) {
      if (err?.response?.status === 404) {
        setMissing(true);
      } else {
        setStatus({ type: "error", message: err?.response?.data?.message || "No se pudo cargar la empresa." });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const save = useCallback(async () => {
    if (!loaded || saving || missing) return;
    const name = String(company.name || "").trim();
    if (!name) {
      setStatus({ type: "error", message: "El nombre de la empresa es requerido." });
      return;
    }
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      await api.put("/hotel/company", {
        name,
        companyId: normalizeNullableText(company.companyId),
        email: normalizeNullableText(company.email),
        phone1: normalizeNullableText(company.phone1),
        phone2: normalizeNullableText(company.phone2),
        ownerName: normalizeNullableText(company.ownerName),
        managerName: normalizeNullableText(company.managerName),
        managerId: normalizeNullableText(company.managerId),
      });
      await load();
      setStatus({ type: "ok", message: "Empresa guardada." });
    } catch (err) {
      setStatus({ type: "error", message: err?.response?.data?.message || "No se pudo guardar la empresa." });
    } finally {
      setSaving(false);
    }
  }, [company, load, loaded, missing, saving]);

  useEffect(() => {
    const onSave = () => {
      save().catch(() => {});
    };
    window.addEventListener("pms:save-hotel-info", onSave);
    return () => window.removeEventListener("pms:save-hotel-info", onSave);
  }, [save]);

  const field = (label, value, onChange, placeholder = "") => (
    <div className="space-y-1">
      <label className="text-xs text-slate-500">{label}</label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );

  return (
    <Card className="space-y-4 p-5 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">Información general de la empresa</h3>
          <div className="text-xs text-slate-500">
            Datos del cliente SaaS. Se comparten con todos los hoteles de esta empresa.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Actualizar"}
          </Button>
          <Button type="button" onClick={save} disabled={!loaded || saving || missing}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      {status.message && (
        <div className={`text-xs ${status.type === "error" ? "text-red-600" : "text-emerald-600"}`}>{status.message}</div>
      )}

      {missing ? (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Este hotel no tiene una empresa asociada. Asígnala desde el gestor SaaS.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 max-w-3xl">
          {field("Nombre de la empresa", company.name, (v) => setCompany((s) => ({ ...s, name: v })))}
          {field("Identificación", company.companyId, (v) => setCompany((s) => ({ ...s, companyId: v })))}
          {field("Correo", company.email, (v) => setCompany((s) => ({ ...s, email: v })))}
          {field("Teléfono 1", company.phone1, (v) => setCompany((s) => ({ ...s, phone1: v })))}
          {field("Teléfono 2", company.phone2, (v) => setCompany((s) => ({ ...s, phone2: v })))}
          {field("Dueño", company.ownerName, (v) => setCompany((s) => ({ ...s, ownerName: v })))}
          {field("Gerente", company.managerName, (v) => setCompany((s) => ({ ...s, managerName: v })))}
          {field("Identificación del gerente", company.managerId, (v) => setCompany((s) => ({ ...s, managerId: v })))}
        </div>
      )}
    </Card>
  );
}
