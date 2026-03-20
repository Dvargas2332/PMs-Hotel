import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { SimpleTable } from "../../../components/ui/table";
import { api } from "../../../lib/api";
import { useHotelData } from "../../../context/useHotelData";
import { useLanguage } from "../../../context/LanguageContext";

const STATUS_VALUES = ["AVAILABLE", "CLEANING", "BLOCKED"];

export default function Rooms() {
  const { t } = useLanguage();
  const { rooms, refreshRooms, addRoom, removeRoom } = useHotelData();
  const [form, setForm] = useState({
    number: "",
    type: "STD",
    status: "AVAILABLE",
    baseRate: "",
    currency: "CRC",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refreshRooms().catch(() => null);
  }, [refreshRooms]);

  const rows = useMemo(() => rooms || [], [rooms]);
  const handleChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onCreate = async () => {
    if (!form.number.trim()) return;
    setSaving(true);
    try {
      const payload = {
        number: form.number.trim(),
        type: form.type.trim() || "STD",
        status: form.status || "AVAILABLE",
        notes: form.notes.trim() || null,
        baseRate: form.baseRate ? Number(form.baseRate) : 0,
        currency: form.currency || "CRC",
      };
      const { data } = await api.post("/rooms", payload);
      addRoom(data);
      await refreshRooms();
      setForm({
        number: "",
        type: "STD",
        status: "AVAILABLE",
        baseRate: "",
        currency: "CRC",
        notes: "",
      });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (roomId) => {
    if (!roomId) return;
    setSaving(true);
    try {
      await api.delete(`/rooms/${roomId}`);
      removeRoom(roomId);
      await refreshRooms();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardContent className="space-y-3 p-5">
          <h3 className="font-medium">{t("mgmt.rooms.new")}</h3>
          <Input placeholder={t("mgmt.rooms.numberRequired")} value={form.number} onChange={handleChange("number")} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder={t("mgmt.rooms.typeExample")} value={form.type} onChange={handleChange("type")} />
            <select className="border rounded px-3 py-2 text-sm h-10" value={form.status} onChange={handleChange("status")}>
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`mgmt.rooms.status.${value.toLowerCase()}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder={t("mgmt.rooms.baseRate")}
              type="number"
              min="0"
              step="0.01"
              value={form.baseRate}
              onChange={handleChange("baseRate")}
            />
            <Input placeholder={t("mgmt.rooms.currencyExample")} value={form.currency} onChange={handleChange("currency")} />
          </div>
          <Input placeholder={t("mgmt.rooms.notes")} value={form.notes} onChange={handleChange("notes")} />
          <Button onClick={onCreate} disabled={saving || !form.number.trim()}>
            {saving ? t("mgmt.rooms.saving") : t("mgmt.rooms.create")}
          </Button>
        </CardContent>
      </Card>
      <div>
        <SimpleTable
          cols={[
            { key: "number", label: t("mgmt.rooms.columns.number") },
            { key: "type", label: t("mgmt.rooms.columns.type") },
            { key: "status", label: t("mgmt.rooms.columns.status") },
            { key: "baseRate", label: t("mgmt.rooms.columns.rate") },
            { key: "currency", label: t("mgmt.rooms.columns.currency") },
          ]}
          rows={rows}
          actions={(row) => (
            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(row.id)}>
              {t("mgmt.rooms.delete")}
            </Button>
          )}
        />
      </div>
    </div>
  );
}
