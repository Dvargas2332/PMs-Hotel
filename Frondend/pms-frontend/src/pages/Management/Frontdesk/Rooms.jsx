// src/pages/Management/Frontdesk/Rooms.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { SimpleTable } from "../../../components/ui/table";
import { api } from "../../../lib/api";
import { useHotelData } from "../../../context/HotelDataContext";

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Disponible" },
  { value: "CLEANING", label: "Limpieza" },
  { value: "BLOCKED", label: "Bloqueada" },
];

export default function Rooms() {
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

  // Traer habitaciones reales (backend) y actualizar el contexto compartido
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
          <h3 className="font-medium">Nueva habitacion</h3>
          <Input
            placeholder="Numero (obligatorio)"
            value={form.number}
            onChange={handleChange("number")}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Tipo (ej. STD)" value={form.type} onChange={handleChange("type")} />
            <select
              className="border rounded px-3 py-2 text-sm h-10"
              value={form.status}
              onChange={handleChange("status")}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Tarifa base"
              type="number"
              min="0"
              step="0.01"
              value={form.baseRate}
              onChange={handleChange("baseRate")}
            />
            <Input
              placeholder="Moneda (ej. CRC, USD)"
              value={form.currency}
              onChange={handleChange("currency")}
            />
          </div>
          <Input
            placeholder="Notas / descripcion"
            value={form.notes}
            onChange={handleChange("notes")}
          />
          <Button onClick={onCreate} disabled={saving || !form.number.trim()}>
            {saving ? "Guardando..." : "Crear"}
          </Button>
        </CardContent>
      </Card>
      <div>
        <SimpleTable
          cols={[
            { key: "number", label: "Numero" },
            { key: "type", label: "Tipo" },
            { key: "status", label: "Estado" },
            { key: "baseRate", label: "Tarifa" },
            { key: "currency", label: "Moneda" },
          ]}
          rows={rows}
          actions={(row) => (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600"
              onClick={() => onDelete(row.id)}
            >
              Eliminar
            </Button>
          )}
        />
      </div>
    </div>
  );
}
