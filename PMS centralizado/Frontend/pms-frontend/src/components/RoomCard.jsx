import React from "react";

// Tarjeta reutilizable para mostrar una habitación en listas (housekeeping, asignación, etc.)
export default function RoomCard({ room, onClick }) {
  if (!room) return null;

  const {
    number,
    title,
    type,
    status,
    baseRate,
    currency = "CRC",
  } = room;

  const label = title || number || room.id;

  const normalizedStatus = (status || "available").toUpperCase();
  const statusMeta = {
    AVAILABLE: { text: "Disponible", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    OCCUPIED: { text: "Ocupada", cls: "bg-rose-100 text-rose-800 border-rose-200" },
    CLEANING: { text: "Limpieza", cls: "bg-amber-100 text-amber-800 border-amber-200" },
    BLOCKED: { text: "Bloqueada", cls: "bg-gray-100 text-gray-700 border-gray-200" },
    MAINTENANCE: { text: "Mantenimiento", cls: "bg-sky-100 text-sky-800 border-sky-200" },
  }[normalizedStatus] || { text: normalizedStatus, cls: "bg-slate-100 text-slate-700 border-slate-200" };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border bg-white shadow-sm px-4 py-3 flex flex-col gap-1 hover:shadow-md hover:-translate-y-0.5 transition ${
        onClick ? "cursor-pointer" : "cursor-default"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-slate-900">
          Hab. {label}
          {type ? <span className="ml-2 text-xs text-slate-500">{type}</span> : null}
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[11px] border ${statusMeta.cls}`}>
          {statusMeta.text}
        </span>
      </div>
      {typeof baseRate === "number" && (
        <div className="text-xs text-slate-600">
          Tarifa base:{" "}
          <span className="font-medium">
            {currency} {baseRate.toLocaleString()}
          </span>
        </div>
      )}
    </button>
  );
}

