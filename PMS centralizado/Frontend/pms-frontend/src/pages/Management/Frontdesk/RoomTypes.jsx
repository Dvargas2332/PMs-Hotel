import React, { useEffect, useRef, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

const ROOM_STATUS_VALUES = ["AVAILABLE", "OCCUPIED", "OUT_OF_SERVICE", "BLOCKED"];

export default function RoomTypes() {
  const { t } = useLanguage();

  const [types, setTypes] = useState([]);
  const [typeSelectedId, setTypeSelectedId] = useState(null);
  const [typeSubmitting, setTypeSubmitting] = useState(false);
  const [typeForm, setTypeForm] = useState({ id: "", name: "", beds: "" });

  const [rooms, setRooms] = useState([]);
  const [roomSelectedId, setRoomSelectedId] = useState(null);
  const [roomSubmitting, setRoomSubmitting] = useState(false);
  const [roomForm, setRoomForm] = useState({
    number: "",
    typeId: "",
    floor: 1,
    capacity: 2,
    status: "AVAILABLE",
  });

  const didInit = useRef(false);

  const loadAll = async () => {
    const [{ data: rt }, { data: rs }] = await Promise.all([api.get("/roomTypes"), api.get("/rooms")]);
    setTypes(rt || []);
    setRooms(rs || []);
  };

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    loadAll();
  }, []);

  const normalizeType = (f) => ({
    id: String(f.id || "").trim(),
    name: String(f.name || "").trim(),
    beds: String(f.beds || "").trim(),
  });

  const resetTypeForm = () => setTypeForm({ id: "", name: "", beds: "" });

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
      beds: row.beds || "",
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

    const hasRooms = rooms.some((r) => String(r.type) === String(id));
    if (hasRooms) {
      window.alert(t("mgmt.roomTypes.alert.deleteTypeWithRooms"));
      return;
    }

    const ok = window.confirm(t("mgmt.roomTypes.confirm.deleteType"));
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

  const normalizeRoom = (f) => ({
    number: String(f.number || "").trim(),
    type: String(f.typeId || "").trim(),
    status: f.status || "AVAILABLE",
  });

  const resetRoomForm = () => {
    setRoomForm({ number: "", typeId: "", floor: 1, capacity: 2, status: "AVAILABLE" });
  };

  const onRoomCreate = async () => {
    if (roomSubmitting) return;
    if (!roomForm.typeId) {
      window.alert(t("mgmt.roomTypes.alert.roomTypeRequired"));
      return;
    }
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
      typeId: row.type || "",
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
    const ok = window.confirm(t("mgmt.roomTypes.confirm.deleteRoom"));
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

  const statusLabel = (status) => t(`mgmt.roomTypes.status.${String(status || "").toLowerCase()}`) || status;

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="space-y-3 p-5">
          <h3 className="font-medium">{typeSelectedId ? t("mgmt.roomTypes.editType") : t("mgmt.roomTypes.newType")}</h3>

          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">{t("mgmt.roomTypes.typeCodeLabel")}</label>
              <Input
                placeholder={t("mgmt.roomTypes.typeCodePlaceholder")}
                value={typeForm.id}
                onChange={(e) => setTypeForm((f) => ({ ...f, id: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">{t("mgmt.roomTypes.typeNameLabel")}</label>
              <Input
                placeholder={t("mgmt.roomTypes.typeNamePlaceholder")}
                value={typeForm.name}
                onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">{t("mgmt.roomTypes.bedsLabel")}</label>
              <Input
                placeholder={t("mgmt.roomTypes.bedsPlaceholder")}
                value={typeForm.beds}
                onChange={(e) => setTypeForm((f) => ({ ...f, beds: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2">
            {!typeSelectedId ? (
              <Button type="button" onClick={onTypeCreate} disabled={typeSubmitting}>
                {t("common.create")}
              </Button>
            ) : (
              <>
                <Button type="button" onClick={onTypeUpdate} disabled={typeSubmitting}>
                  {t("common.save")}
                </Button>
                <Button
                  type="button"
                  onClick={() => onTypeDelete()}
                  disabled={typeSubmitting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {t("mgmt.roomTypes.delete")}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setTypeSelectedId(null);
                    resetTypeForm();
                  }}
                  className="bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  {t("common.cancel")}
                </Button>
              </>
            )}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="py-2 pl-4 text-left">{t("mgmt.roomTypes.columns.id")}</th>
                <th className="text-left">{t("mgmt.roomTypes.columns.name")}</th>
                <th className="text-left">{t("mgmt.roomTypes.columns.capacity")}</th>
                <th className="text-left">{t("mgmt.roomTypes.columns.beds")}</th>
                <th className="text-left">{t("mgmt.roomTypes.columns.amenities")}</th>
                <th className="pr-4 text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {types.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">
                    {t("mgmt.roomTypes.emptyTypes")}
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
                    <td>{x.beds || "-"}</td>
                    <td>{(x.amenities || []).join(", ") || "-"}</td>
                    <td className="pr-4 py-2 text-right space-x-1">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs hover:bg-blue-100"
                        onClick={() => onTypeRowSelect(x)}
                        disabled={typeSubmitting}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => onTypeDelete(x.id)}
                        disabled={typeSubmitting}
                      >
                        {t("mgmt.roomTypes.delete")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="space-y-3 p-5">
          <h3 className="font-medium">{roomSelectedId ? t("mgmt.roomTypes.editRoom") : t("mgmt.roomTypes.newRoom")}</h3>

          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder={t("mgmt.roomTypes.roomNumber")}
              value={roomForm.number}
              onChange={(e) => setRoomForm((f) => ({ ...f, number: e.target.value }))}
            />
            <Input
              placeholder={t("mgmt.roomTypes.floor")}
              type="number"
              value={roomForm.floor}
              onChange={(e) => setRoomForm((f) => ({ ...f, floor: e.target.value }))}
            />
            <Input
              placeholder={t("mgmt.roomTypes.capacity")}
              type="number"
              value={roomForm.capacity}
              onChange={(e) => setRoomForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col">
              <label className="text-sm mb-1">{t("mgmt.roomTypes.typeLabel")}</label>
              <select
                className="h-10 rounded-lg border px-3 text-sm"
                value={roomForm.typeId}
                onChange={(e) => setRoomForm((f) => ({ ...f, typeId: e.target.value }))}
                disabled={types.length === 0}
              >
                <option value="">{t("mgmt.roomTypes.selectType")}</option>
                {types.map((roomType) => (
                  <option key={roomType.id} value={roomType.id}>
                    {roomType.id} - {roomType.name}
                  </option>
                ))}
              </select>
              {types.length === 0 && <span className="mt-1 text-xs text-red-500">{t("mgmt.roomTypes.createTypeFirst")}</span>}
            </div>

            <div className="flex flex-col">
              <label className="text-sm mb-1">{t("common.status")}</label>
              <select
                className="h-10 rounded-lg border px-3 text-sm"
                value={roomForm.status}
                onChange={(e) => setRoomForm((f) => ({ ...f, status: e.target.value }))}
              >
                {ROOM_STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            {!roomSelectedId ? (
              <Button type="button" onClick={onRoomCreate} disabled={roomSubmitting}>
                {t("common.create")}
              </Button>
            ) : (
              <>
                <Button type="button" onClick={onRoomUpdate} disabled={roomSubmitting}>
                  {t("common.save")}
                </Button>
                <Button
                  type="button"
                  onClick={() => onRoomDelete()}
                  disabled={roomSubmitting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {t("mgmt.roomTypes.delete")}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setRoomSelectedId(null);
                    resetRoomForm();
                  }}
                  className="bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  {t("common.cancel")}
                </Button>
              </>
            )}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="py-2 pl-4 text-left">{t("mgmt.roomTypes.roomColumns.number")}</th>
                <th className="text-left">{t("mgmt.roomTypes.roomColumns.type")}</th>
                <th className="text-left">{t("mgmt.roomTypes.roomColumns.floor")}</th>
                <th className="text-left">{t("mgmt.roomTypes.roomColumns.capacity")}</th>
                <th className="text-left">{t("mgmt.roomTypes.roomColumns.status")}</th>
                <th className="pr-4 text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">
                    {t("mgmt.roomTypes.emptyRooms")}
                  </td>
                </tr>
              )}
              {rooms.map((room) => {
                const isSel = room.id === roomSelectedId;
                const typeFound = types.find((roomType) => roomType.id === room.type);
                const typeLabel = typeFound ? `${typeFound.id} - ${typeFound.name}` : room.type || "";
                return (
                  <tr key={room.id} className={`border-t ${isSel ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                    <td className="py-2 pl-4">{room.number}</td>
                    <td>{typeLabel}</td>
                    <td>{room.floor}</td>
                    <td>{room.capacity}</td>
                    <td>{statusLabel(room.status)}</td>
                    <td className="pr-4 py-2 text-right space-x-1">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs hover:bg-blue-100"
                        onClick={() => onRoomRowSelect(room)}
                        disabled={roomSubmitting}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => onRoomDelete(room.id)}
                        disabled={roomSubmitting}
                      >
                        {t("mgmt.roomTypes.delete")}
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
