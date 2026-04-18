//src/pages/Management/Hotel/HotelInfo.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

const MEMBERSHIP_LABELS = {
  BASIC: "basic",
  STANDARD: "standard",
  PRO: "pro",
  PLATINUM: "platinum",
};

function normalizeNullableText(v) {
  const text = String(v ?? "").trim();
  return text ? text : null;
}

export default function HotelInfo() {
  const { t } = useLanguage();
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
    const labelKey = MEMBERSHIP_LABELS[key];
    if (!labelKey) return meta.membership || "-";
    return t(`mgmt.hotelInfo.membership.${labelKey}`);
  }, [meta.membership, t]);

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
          <h3 className="font-medium">{t("mgmt.hotelInfo.title")}</h3>
          <div className="text-xs text-slate-500">
            ID: <span className="font-mono">{meta.id || "-"}</span>
            {meta.createdAt ? (
              <span>
                {" "}
                · {t("mgmt.hotelInfo.created")}: {new Date(meta.createdAt).toLocaleString()}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={load} disabled={loading}>
            {loading ? t("common.loading") : t("mgmt.hotelInfo.refresh")}
          </Button>
          <Button type="button" onClick={save} disabled={!loaded || saving}>
            {saving ? t("mgmt.hotelInfo.saving") : t("mgmt.hotelInfo.save")}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-slate-500">{t("mgmt.hotelInfo.company")}</div>
          <div className="font-semibold text-slate-900">{meta.saasClientName || "-"}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-slate-500">{t("mgmt.hotelInfo.membershipLabel")}</div>
          <div className="font-semibold text-slate-900">{membershipLabel}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">{t("mgmt.hotelInfo.hotelName")}</label>
          <Input value={form.name} onChange={(e) => setForm((state) => ({ ...state, name: e.target.value }))} />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">{t("mgmt.hotelInfo.companyId")}</label>
          <Input value={form.companyId} onChange={(e) => setForm((state) => ({ ...state, companyId: e.target.value }))} />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">{t("mgmt.hotelInfo.phone1")}</label>
          <Input value={form.phone1} onChange={(e) => setForm((state) => ({ ...state, phone1: e.target.value }))} />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">{t("mgmt.hotelInfo.phone2")}</label>
          <Input value={form.phone2} onChange={(e) => setForm((state) => ({ ...state, phone2: e.target.value }))} />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">{t("mgmt.hotelInfo.ownerName")}</label>
          <Input value={form.ownerName} onChange={(e) => setForm((state) => ({ ...state, ownerName: e.target.value }))} />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">{t("mgmt.hotelInfo.managerName")}</label>
          <Input value={form.managerName} onChange={(e) => setForm((state) => ({ ...state, managerName: e.target.value }))} />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-xs text-slate-500">{t("mgmt.hotelInfo.managerId")}</label>
          <Input value={form.managerId} onChange={(e) => setForm((state) => ({ ...state, managerId: e.target.value }))} />
        </div>
      </div>
    </Card>
  );
}
