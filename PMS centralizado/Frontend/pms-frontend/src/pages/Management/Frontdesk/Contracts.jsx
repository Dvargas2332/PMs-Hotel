// src/pages/Management/Frontdesk/Contracts.jsx

import React, { useEffect, useRef, useState } from "react";
import { CustomSelect } from "../../../components/ui/CustomSelect";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

const BASIC_CHANNELS = ["Booking.com", "Expedia", "Airbnb", "Direct", "Travel Agency"];

export default function Contracts() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [ratePlans, setRatePlans] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const didInit = useRef(false);

  const [form, setForm] = useState({
    id: "",
    channel: "",
    commission: 0.15,
    active: true,
    ratePlanIds: [],
    mealPlanId: "",
  });

  const normalize = (f) => ({
    id: f.id.trim(),
    channel: f.channel.trim(),
    commission: Number(f.commission || 0),
    active: !!f.active,
    ratePlans: (Array.isArray(f.ratePlanIds) ? f.ratePlanIds : []).map(String),
    mealPlanId: f.mealPlanId || null,
  });

  const resetForm = () =>
    setForm({
      id: "",
      channel: "",
      commission: 0.15,
      active: true,
      ratePlanIds: [],
      mealPlanId: "",
    });

  const load = async () => {
    const [{ data: contracts }, { data: rps }, { data: mps }] = await Promise.all([
      api.get("/contracts"),
      api.get("/ratePlans?active=true"),
      api.get("/mealPlans"),
    ]);
    setItems(
      (contracts || []).map((c) => ({
        ...c,
        ratePlans: c.ratePlans || [],
        mealPlanId: c.mealPlanId || "",
      }))
    );
    setRatePlans(rps || []);
    setMealPlans(mps || []);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    load();
  }, []);

  const onCreate = async () => {
    if (submitting) return;
    if (!form.id.trim()) return alert(t("mgmt.contracts.alert.idRequired"));
    if (!form.channel.trim()) return alert(t("mgmt.contracts.alert.channelRequired"));
    if (!Array.isArray(form.ratePlanIds) || form.ratePlanIds.length === 0) return alert(t("mgmt.contracts.alert.ratePlanRequired"));
    setSubmitting(true);
    try {
      const payload = normalize(form);
      await api.post("/contracts", payload);
      await load();
      setSelectedId(null);
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const onRowSelect = (row) => {
    setSelectedId(row.id);
    setForm({
      id: row.id || "",
      channel: row.channel || "",
      commission: row.commission ?? 0.15,
      active: !!row.active,
      ratePlanIds: Array.isArray(row.ratePlans) ? row.ratePlans : [],
      mealPlanId: row.mealPlanId || "",
    });
  };

  const onUpdate = async () => {
    if (!selectedId || submitting) return;
    if (!form.channel.trim()) return alert(t("mgmt.contracts.alert.channelRequired"));
    if (!Array.isArray(form.ratePlanIds) || form.ratePlanIds.length === 0) return alert(t("mgmt.contracts.alert.ratePlanRequired"));
    setSubmitting(true);
    try {
      const payload = normalize(form);
      await api.put(`/contracts/${encodeURIComponent(selectedId)}`, payload);
      await load();
      setSelectedId(null);
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (idFromRow) => {
    const id = idFromRow || selectedId;
    if (!id || submitting) return;
    const ok = window.confirm(t("mgmt.contracts.deleteConfirm"));
    if (!ok) return;
    setSubmitting(true);
    try {
      await api.delete(`/contracts/${encodeURIComponent(id)}`);
      await load();
      if (selectedId === id) {
        setSelectedId(null);
        resetForm();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="space-y-3 p-5">
        <h3 className="font-medium">
          {selectedId ? t("mgmt.contracts.editTitle") : t("mgmt.contracts.newTitle")}
        </h3>

        <Input
          placeholder="ID"
          value={form.id}
          onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
        />
        <div className="flex flex-col">
          <label className="text-sm mb-1">{t("mgmt.contracts.channel")}</label>
          <Input
            list="basic-channels"
            placeholder={t("mgmt.contracts.channelPlaceholder")}
            value={form.channel}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
          />
          <datalist id="basic-channels">
            {BASIC_CHANNELS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="text-xs text-slate-400 mt-1">{t("mgmt.contracts.customHint")}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder={t("mgmt.contracts.commissionPlaceholder")}
            type="number"
            value={form.commission}
            onChange={(e) => setForm((f) => ({ ...f, commission: e.target.value }))}
          />

          <div className="flex flex-col">
            <label className="text-sm mb-1">{t("mgmt.contracts.mealPlan")}</label>
            <CustomSelect
              className="h-10 w-full"
              value={form.mealPlanId}
              onChange={(e) => setForm((f) => ({ ...f, mealPlanId: e.target.value }))}
            >
              <option value="">{t("mgmt.contracts.noMealPlan")}</option>
              {mealPlans.map((mp) => (
                <option key={mp.id} value={mp.id}>
                  {mp.id} - {mp.name}
                </option>
              ))}
            </CustomSelect>
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-sm mb-1">{t("mgmt.contracts.ratePlans")}</label>
          <select
            multiple
            className="min-h-[120px] rounded-lg border px-3 py-2 text-sm"
            style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--color-text-base)" }}
            value={form.ratePlanIds}
            onChange={(e) => {
              const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
              setForm((f) => ({ ...f, ratePlanIds: opts }));
            }}
          >
            {ratePlans.map((rp) => (
              <option key={rp.id} value={rp.id}>
                {rp.id} - {rp.name} ({rp.currency})
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            {t("mgmt.contracts.multiSelectHint")}
          </p>
        </div>

        <div className="flex gap-2">
          {!selectedId ? (
            <Button type="button" onClick={onCreate} disabled={submitting}>
              {t("mgmt.contracts.create")}
            </Button>
          ) : (
            <>
              <Button type="button" onClick={onUpdate} disabled={submitting}>
                {t("mgmt.contracts.saveChanges")}
              </Button>
              <Button
                type="button"
                onClick={() => onDelete()}
                disabled={submitting}
                variant="destructive"
              >
                {t("mgmt.contracts.delete")}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  resetForm();
                }}
                className="bg-white/10 text-slate-300 hover:bg-white/15"
              >
                {t("mgmt.contracts.cancel")}
              </Button>
            </>
          )}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="py-2 pl-4 text-left">ID</th>
              <th className="text-left">{t("mgmt.contracts.columns.channel")}</th>
              <th className="text-left">{t("mgmt.contracts.columns.commission")}</th>
              <th className="text-left">{t("mgmt.contracts.columns.ratePlans")}</th>
              <th className="text-left">{t("mgmt.contracts.columns.mealPlan")}</th>
              <th className="pr-4 text-right">{t("mgmt.contracts.columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  {t("mgmt.contracts.empty")}
                </td>
              </tr>
            )}
            {items.map((x) => {
              const isSel = x.id === selectedId;
              const rpList = (x.ratePlans || []).join(", ");
              return (
                <tr
                  key={x.id}
                  className={`border-t ${isSel ? "bg-indigo-500/10" : "hover:bg-white/5"}`}
                >
                  <td className="py-2 pl-4">{x.id}</td>
                  <td>{x.channel}</td>
                  <td>{((x.commission ?? 0) * 100).toFixed(2)}%</td>
                  <td>{rpList || "-"}</td>
                  <td>{x.mealPlanId || "-"}</td>
                  <td className="pr-4 py-2 text-right space-x-1">
                    <button
                      type="button"
                      className="rounded border border-indigo-600 bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700"
                      onClick={() => onRowSelect(x)}
                      disabled={submitting}
                    >
                      {t("mgmt.contracts.edit")}
                    </button>
                    <button
                      type="button"
                      className="rounded border border-red-600 bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                      onClick={() => onDelete(x.id)}
                      disabled={submitting}
                    >
                      {t("mgmt.contracts.delete")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
