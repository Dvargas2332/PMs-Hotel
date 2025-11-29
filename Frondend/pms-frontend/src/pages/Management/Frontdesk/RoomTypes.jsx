// src/pages/Management/Frontdesk/RoomTypes.jsx
import React, { useEffect, useRef, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

export default function RoomTypes() {
  // ---------- TIPOS ----------
  const [types, setTypes] = useState([]);
  const [typeSelectedId, setTypeSelectedId] = useState(null);
  const [typeSubmitting, setTypeSubmitting] = useState(false);

  const [typeForm, setTypeForm] = useState({
    id: "",
    name: "",
    capacity: 2,
    beds: "",
    amenities: "", // coma separadas en UI
  });

  // ---------- HABITACIONES ----------
  const [rooms, setRooms] = useState([]);
  const [roomSelectedId, setRoomSelectedId] = useState(null);
  const [roomSubmitting, setRoomSubmitting] = useState(false);

  const [roomForm, setRoomForm] = useState({
    number: "",
    typeId: "",
    floor: 1,
    capacity: 2,
    status: "AVAILABLE", // AVAILABLE | OCCUPIED | OUT_OF_SERVICE | BLOCKED
  });

  const didInit = useRef(false);

  const loadAll = async () => {
    const [{ data: rt }, { data: rs }] = await Promise.all([
      api.get("/roomTypes"),
      api.get("/rooms"),
    ]);
    setTypes(rt || []);
    setRooms(rs || []);
  };

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    loadAll();
  }, []);

  // ==========================
  // CRUD: TIPOS
  // ==========================
  const normalizeType = (f) => ({
    id: f.id.trim(),
    name: f.name.trim(),
    capacity: Number(f.capacity || 0),
    beds: f.beds.trim(),
    amenities: (f.amenities || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  });

  const resetTypeForm = () =>
    setTypeForm({ id: "", name: "", capacity: 2, beds: "", amenities: "" });

  const onTypeCreate = async () => {
    if (typeSubmitting) return;
    setTypeSubmitting(true);
    try {
      const payload = normalizeType(typeForm);
      await api.post("/roomTypes", payload);
      await api.post("/audit", { entity: "RoomType", action: "create", after: payload });
      await loadAll();
      resetTypeForm();
      setTypeSelectedId(null);
    } finally {
      setTypeSubmitting(false);
    }
  };

  const onTypeRowSelect = (row) => {
    setTypeSelectedId(row.id);
    setTypeForm({
      id: row.id || "",
      name: row.name || "",
      capacity: row.capacity ?? 2,
      beds: row.beds || "",
      amenities: (row.amenities || []).join(", "),
    });
  };

  const onTypeUpdate = async () => {
    if (!typeSelectedId || typeSubmitting) return;
    setTypeSubmitting(true);
    try {
      const before = types.find((x) => x.id === typeSelectedId);
      const payload = normalizeType(typeForm);
      await api.put(`/roomTypes/${encodeURIComponent(typeSelectedId)}`, payload);
      await api.post("/audit", { entity: "RoomType", action: "update", before, after: payload });
      await loadAll();
      setTypeSelectedId(null);
      resetTypeForm();
    } finally {
      setTypeSubmitting(false);
    }
  };

  const onTypeDelete = async (idFromRow) => {
    const id = idFromRow || typeSelectedId;
    if (!id || typeSubmitting) return;
    const ok = window.confirm("¿Eliminar el tipo de habitación?");
    if (!ok) return;
    setTypeSubmitting(true);
    try {
      const before = types.find((x) => x.id === id);
      await api.delete(`/roomTypes/${encodeURIComponent(id)}`);
      await api.post("/audit", { entity: "RoomType", action: "delete", before });
      await loadAll();
      if (typeSelectedId === id) {
        setTypeSelectedId(null);
        resetTypeForm();
      }
    } finally {
      setTypeSubmitting(false);
    }
  };

  // ==========================
  // CRUD: HABITACIONES
  // ==========================
  const normalizeRoom = (f) => ({
    number: String(f.number).trim(),
    typeId: String(f.typeId).trim(),
    floor: Number(f.floor || 1),
    capacity: Number(f.capacity || 1),
    status: f.status || "AVAILABLE",
  });

  const resetRoomForm = () =>
    setRoomForm({ number: "", typeId: "", floor: 1, capacity: 2, status: "AVAILABLE" });

  const onRoomCreate = async () => {
    if (roomSubmitting) return;
    setRoomSubmitting(true);
    try {
      const payload = normalizeRoom(roomForm);
      await api.post("/rooms", payload);
      await api.post("/audit", { entity: "Room", action: "create", after: payload });
      await loadAll();
      resetRoomForm();
      setRoomSelectedId(null);
    } finally {
      setRoomSubmitting(false);
    }
  };

  const onRoomRowSelect = (row) => {
    setRoomSelectedId(row.id);
    setRoomForm({
      number: row.number || "",
      typeId: row.typeId || row.type?.id || "",
      floor: row.floor ?? 1,
      capacity: row.capacity ?? 2,
      status: row.status || "AVAILABLE",
    });
  };

  const onRoomUpdate = async () => {
    if (!roomSelectedId || roomSubmitting) return;
    setRoomSubmitting(true);
    try {
      const before = rooms.find((x) => x.id === roomSelectedId);
      const payload = normalizeRoom(roomForm);
      await api.put(`/rooms/${encodeURIComponent(roomSelectedId)}`, payload);
      await api.post("/audit", { entity: "Room", action: "update", before, after: payload });
      await loadAll();
      setRoomSelectedId(null);
      resetRoomForm();
    } finally {
      setRoomSubmitting(false);
    }
  };

  const onRoomDelete = async (idFromRow) => {
    const id = idFromRow || roomSelectedId;
    if (!id || roomSubmitting) return;
    const ok = window.confirm("¿Eliminar la habitación?");
    if (!ok) return;
    setRoomSubmitting(true);
    try {
      const before = rooms.find((x) => x.id === id);
      await api.delete(`/rooms/${encodeURIComponent(id)}`);
      await api.post("/audit", { entity: "Room", action: "delete", before });
      await loadAll();
      if (roomSelectedId === id) {
        setRoomSelectedId(null);
        resetRoomForm();
      }
    } finally {
      setRoomSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ========== BLOQUE: TIPOS DE HABITACIÓN ========== */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="space-y-3 p-5">
          <h3 className="font-medium">
            {typeSelectedId ? "Editar tipo de habitación" : "Nuevo tipo de habitación"}
          </h3>

          <div className="grid grid-cols-[120px_1fr] gap-2">
            <Input
              placeholder="ID (ej. STD)"
              value={typeForm.id}
              onChange={(e) => setTypeForm((f) => ({ ...f, id: e.target.value }))}
            />
            <Input
              placeholder="Nombre"
              value={typeForm.name}
              onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="Capacidad"
              type="number"
              value={typeForm.capacity}
              onChange={(e) => setTypeForm((f) => ({ ...f, capacity: e.target.value }))}
            />
            <Input
              placeholder="Camas (ej. 1Q)"
              value={typeForm.beds}
              onChange={(e) => setTypeForm((f) => ({ ...f, beds: e.target.value }))}
            />
            <Input
              placeholder="Amenities (coma separadas)"
              value={typeForm.amenities}
              onChange={(e) => setTypeForm((f) => ({ ...f, amenities: e.target.value }))}
            />
          </div>

          <div className="flex gap-2">
            {!typeSelectedId ? (
              <Button type="button" onClick={onTypeCreate} disabled={typeSubmitting}>
                Crear
              </Button>
            ) : (
              <>
                <Button type="button" onClick={onTypeUpdate} disabled={typeSubmitting}>
                  Guardar cambios
                </Button>
                <Button
                  type="button"
                  onClick={() => onTypeDelete()}
                  disabled={typeSubmitting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Eliminar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setTypeSelectedId(null);
                    resetTypeForm();
                  }}
                  className="bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="py-2 pl-4 text-left">ID</th>
                <th className="text-left">Nombre</th>
                <th className="text-left">Cap</th>
                <th className="text-left">Camas</th>
                <th className="text-left">Amenities</th>
                <th className="pr-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {types.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">
                    Sin tipos aún.
                  </td>
                </tr>
              )}
              {types.map((x) => {
                const isSel = x.id === typeSelectedId;
                return (
                  <tr key={x.id} className={`border-t ${isSel ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                    <td className="py-2 pl-4">{x.id}</td>
                    <td>{x.name}</td>
                    <td>{x.capacity}</td>
                    <td>{x.beds || "—"}</td>
                    <td>{(x.amenities || []).join(", ") || "—"}</td>
                    <td className="pr-4 py-2 text-right space-x-1">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs hover:bg-blue-100"
                        onClick={() => onTypeRowSelect(x)}
                        disabled={typeSubmitting}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => onTypeDelete(x.id)}
                        disabled={typeSubmitting}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      {/* ========== BLOQUE: HABITACIONES ========== */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="space-y-3 p-5">
          <h3 className="font-medium">
            {roomSelectedId ? "Editar habitación" : "Nueva habitación"}
          </h3>

          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="Número"
              value={roomForm.number}
              onChange={(e) => setRoomForm((f) => ({ ...f, number: e.target.value }))}
            />
            <Input
              placeholder="Piso"
              type="number"
              value={roomForm.floor}
              onChange={(e) => setRoomForm((f) => ({ ...f, floor: e.target.value }))}
            />
            <Input
              placeholder="Capacidad"
              type="number"
              value={roomForm.capacity}
              onChange={(e) => setRoomForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Tipo de habitación */}
            <div className="flex flex-col">
              <label className="text-sm mb-1">Tipo</label>
              <select
                className="h-10 rounded-lg border px-3 text-sm"
                value={roomForm.typeId}
                onChange={(e) => setRoomForm((f) => ({ ...f, typeId: e.target.value }))}
              >
                <option value="">— Selecciona tipo —</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} — {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Estado */}
            <div className="flex flex-col">
              <label className="text-sm mb-1">Estado</label>
              <select
                className="h-10 rounded-lg border px-3 text-sm"
                value={roomForm.status}
                onChange={(e) => setRoomForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="AVAILABLE">Disponible</option>
                <option value="OCCUPIED">Ocupada</option>
                <option value="OUT_OF_SERVICE">Fuera de servicio</option>
                <option value="BLOCKED">Bloqueada</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            {!roomSelectedId ? (
              <Button type="button" onClick={onRoomCreate} disabled={roomSubmitting}>
                Crear
              </Button>
            ) : (
              <>
                <Button type="button" onClick={onRoomUpdate} disabled={roomSubmitting}>
                  Guardar cambios
                </Button>
                <Button
                  type="button"
                  onClick={() => onRoomDelete()}
                  disabled={roomSubmitting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Eliminar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setRoomSelectedId(null);
                    resetRoomForm();
                  }}
                  className="bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="py-2 pl-4 text-left">Número</th>
                <th className="text-left">Tipo</th>
                <th className="text-left">Piso</th>
                <th className="text-left">Cap</th>
                <th className="text-left">Estado</th>
                <th className="pr-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">
                    Sin habitaciones aún.
                  </td>
                </tr>
              )}
              {rooms.map((r) => {
                const isSel = r.id === roomSelectedId;
                return (
                  <tr key={r.id} className={`border-t ${isSel ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                    <td className="py-2 pl-4">{r.number}</td>
                    <td>{r.type?.id || r.typeId}</td>
                    <td>{r.floor}</td>
                    <td>{r.capacity}</td>
                    <td>
                      {r.status === "AVAILABLE"
                        ? "Disponible"
                        : r.status === "OCCUPIED"
                        ? "Ocupada"
                        : r.status === "OUT_OF_SERVICE"
                        ? "Fuera de servicio"
                        : "Bloqueada"}
                    </td>
                    <td className="pr-4 py-2 text-right space-x-1">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs hover:bg-blue-100"
                        onClick={() => onRoomRowSelect(r)}
                        disabled={roomSubmitting}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => onRoomDelete(r.id)}
                        disabled={roomSubmitting}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
