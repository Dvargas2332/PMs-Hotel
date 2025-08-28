// src/modulos/management/sections/DashboardManagement.jsx
import React from "react";
import useConfigStore from "../../../store/configStore";
import { useNavigate } from "react-router-dom";

export default function DashboardManagement() {
  const hasHydrated = useConfigStore((s) => s._hasHydrated);
  const hotelName   = useConfigStore((s) => s?.config?.hotel?.name ?? "Hotel sin nombre");
  const timezone    = useConfigStore((s) => s?.config?.hotel?.timezone ?? "Sin zona horaria");
  const roomsLen    = useConfigStore((s) => s?.config?.rooms?.length ?? 0);
  const usersLen    = useConfigStore((s) => s?.config?.users?.length ?? 0);
  const navigate    = useNavigate();

  if (!hasHydrated) return <div className="p-4 text-gray-500">Cargando configuración del hotel…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Management</h1>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white shadow">
          <div className="text-sm text-gray-500">Hotel</div>
          <div className="text-xl font-semibold">{hotelName}</div>
          <div className="text-xs text-gray-400">{timezone}</div>
        </div>

        <div className="p-4 rounded-xl bg-white shadow">
          <div className="text-sm text-gray-500">Habitaciones</div>
          <div className="text-3xl font-bold">{roomsLen}</div>
        </div>

        <div className="p-4 rounded-xl bg-white shadow">
          <div className="text-sm text-gray-500">Usuarios</div>
          <div className="text-3xl font-bold">{usersLen}</div>
        </div>
      </div>

      <button
        type="button"
        className="mt-2 bg-blue-600 px-3 py-1 rounded text-white hover:bg-blue-700"
        onClick={() => navigate("/management/rooms")}
      >
        Administrar habitaciones
      </button>
    </div>
  );
}
