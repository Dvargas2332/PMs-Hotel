import React, { useMemo, useState } from "react";
import { useHotelData } from "../../context/useHotelData";
import { frontdeskTheme } from "../../theme/frontdeskTheme";
import { useLanguage } from "../../context/LanguageContext";

/**
 * HabitacionesBoard
 * - Fuente única: HotelDataContext  → rooms & reservations (mismo que Planning/Reservas)
 * - Deriva ocupación en tiempo real con las reservas (checkInDate <= hoy < checkOutDate)
 * - Calcula entradas/salidas de hoy para tablero y dashboard
 * - Si una habitación trae status de housekeeping (clean/dirty/maintenance/blocked), se respeta cuando no está ocupada
 */

const STATUS_META = {
  occupied: { labelKey: "frontdesk.rooms.status.occupied", badge: "bg-red-100 text-red-800 border-red-200", tile: "bg-red-50 border-red-200" },
  available: { labelKey: "frontdesk.rooms.status.available", badge: "bg-emerald-100 text-emerald-900 border-emerald-200", tile: "bg-emerald-50 border-emerald-200" },
  clean: { labelKey: "frontdesk.rooms.status.clean", badge: "bg-green-100 text-green-800 border-green-200", tile: "bg-green-50 border-green-200" },
  dirty: { labelKey: "frontdesk.rooms.status.dirty", badge: "bg-amber-100 text-amber-900 border-amber-200", tile: "bg-amber-50 border-amber-200" },
  blocked: { labelKey: "frontdesk.rooms.status.blocked", badge: "bg-gray-200 text-gray-700 border-gray-300", tile: "bg-gray-100 border-gray-300" },
  maintenance: { labelKey: "frontdesk.rooms.status.maintenance", badge: "bg-yellow-100 text-yellow-800 border-yellow-200", tile: "bg-yellow-50 border-yellow-200" },
};

const FILTERS = [
  { key: "all", labelKey: "frontdesk.rooms.filter.all" },
  { key: "occupied", labelKey: "frontdesk.rooms.filter.occupied" },
  { key: "available", labelKey: "frontdesk.rooms.filter.available" },
  { key: "clean", labelKey: "frontdesk.rooms.filter.clean" },
  { key: "dirty", labelKey: "frontdesk.rooms.filter.dirty" },
  { key: "blocked", labelKey: "frontdesk.rooms.filter.blocked" },
  { key: "maintenance", labelKey: "frontdesk.rooms.filter.maintenance" },
];

// Utilidad para YYYY-MM-DD local (sin desfase de zona)
const todayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Filtros de estado válidos
const isCanceled = (status) => {
  const s = (status || "").toUpperCase();
  return s === "CANCELADA" || s === "CANCELED" || s === "NO SHOW" || s === "NO_SHOW";
};
const isActiveReservationToday = (r, day) =>
  r && r.checkInDate <= day && day < r.checkOutDate && !isCanceled(r.status || r.rawStatus);

const isArrivalToday = (r, day) => r.checkInDate === day && !isCanceled(r.status || r.rawStatus);

const isDepartureToday = (r, day) => r.checkOutDate === day && !isCanceled(r.status || r.rawStatus);

/** Hook reutilizable para Dashboard (métricas rápidas) */
export function useHabitacionesMetrics() {
  const { rooms, reservations } = useHotelData();
  const today = todayLocal();

  const enriched = useMemo(() => {
    return (rooms || []).map((room) => {
      const roomId = String(room.id);
      const current = (reservations || []).find(
        (rv) => String(rv.roomId) === roomId && isActiveReservationToday(rv, today)
      );
      // Si hay ocupación manda 'occupied'. Si no, usa el status de housekeeping si existe; si no, 'available'.
      const baseStatus = room.status && STATUS_META[room.status] ? room.status : "available";
      const status = current ? "occupied" : baseStatus;
      return {
        id: roomId,
        number: room.title || room.number || roomId,
        type: room.type || room.category || "",
        status,
        guestName: current?.guestName || null,
      };
    });
  }, [rooms, reservations, today]);

  const arrivalsToday = useMemo(
    () => (reservations || []).filter((r) => isArrivalToday(r, today)).length,
    [reservations, today]
  );

  const departuresToday = useMemo(
    () => (reservations || []).filter((r) => isDepartureToday(r, today)).length,
    [reservations, today]
  );

  const counts = useMemo(() => {
    const c = { occupied: 0, available: 0, clean: 0, dirty: 0, blocked: 0, maintenance: 0 };
    for (const r of enriched) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [enriched]);

  return { roomsEnriched: enriched, arrivalsToday, departuresToday, counts, today };
}

function SummaryCard({ title, value, className = "" }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${className}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-gray-500">{title}</div>
    </div>
  );
}

export default function HabitacionesBoard() {
  const { t } = useLanguage();
  const { roomsEnriched, arrivalsToday, departuresToday, counts } = useHabitacionesMetrics();

  // Búsqueda y filtros UI
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState("all");

  const filteredRooms = useMemo(() => {
    let list = roomsEnriched;

    if (filter !== "all") list = list.filter((r) => r.status === filter);

    if (term.trim()) {
      const s = term.trim().toLowerCase();
      list = list.filter(
        (r) =>
          String(r.number).toLowerCase().includes(s) ||
          (r.type || "").toLowerCase().includes(s) ||
          (r.guestName || "").toLowerCase().includes(s)
      );
    }

    // Orden por número
    return [...list].sort((a, b) => {
      const an = parseInt(a.number, 10);
      const bn = parseInt(b.number, 10);
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
      return String(a.number).localeCompare(String(b.number));
    });
  }, [roomsEnriched, term, filter]);

  return (
    <div
      className="p-6 min-h-screen"
      style={{ background: frontdeskTheme.background.app }}
    >
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t("frontdesk.rooms.title")}</h1>
        <div className="flex gap-2">
          <input
            className="border rounded px-3 py-2 w-64"
            placeholder={t("frontdesk.rooms.searchPlaceholder")}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Resumen superior */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <SummaryCard title={t("frontdesk.rooms.summary.occupied")} value={counts.occupied} className="border-red-200" />
        <SummaryCard title={t("frontdesk.rooms.summary.available")} value={counts.available} className="border-emerald-200" />
        <SummaryCard title={t("frontdesk.rooms.summary.clean")} value={counts.clean} className="border-green-200" />
        <SummaryCard title={t("frontdesk.rooms.summary.dirty")} value={counts.dirty} className="border-amber-200" />
        <SummaryCard title={t("frontdesk.rooms.summary.blocked")} value={counts.blocked} className="border-gray-300" />
        <SummaryCard title={t("frontdesk.rooms.summary.maintenance")} value={counts.maintenance} className="border-yellow-200" />
        <SummaryCard title={t("frontdesk.rooms.summary.arrivals")} value={arrivalsToday} className="border-sky-200" />
        <SummaryCard title={t("frontdesk.rooms.summary.departures")} value={departuresToday} className="border-indigo-200" />
      </div>

      {/* Filtros rápidos */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={
              "px-3 py-1.5 rounded-full border text-sm " +
              (filter === f.key
                ? "bg-green-700 text-white border-green-700"
                : "bg-white hover:bg-gray-50")
            }
            onClick={() => setFilter(f.key)}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {/* Leyenda de colores */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
        {Object.entries(STATUS_META).map(([k, m]) => (
          <span key={k} className="inline-flex items-center gap-2">
            <span className={`inline-block w-3 h-3 rounded ${m.badge.split(" ")[0]}`} />
            {t(m.labelKey)}
          </span>
        ))}
      </div>

      {/* Grid de habitaciones */}
      {filteredRooms.length === 0 ? (
        <div className="py-10 text-center text-gray-500 border rounded-xl bg-white">
          {t("frontdesk.rooms.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filteredRooms.map((r) => {
            const meta = STATUS_META[r.status] || STATUS_META.available;
            return (
              <div key={r.id} className={`p-4 rounded-2xl border shadow-sm ${meta.tile}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-2xl font-bold">#{r.number}</div>
                  <span className={`px-2 py-1 rounded-full border text-xs ${meta.badge}`}>
                    {t(meta.labelKey)}
                  </span>
                </div>
                <div className="text-sm text-gray-600">{r.type || t("common.empty")}</div>
                {r.guestName && (
                  <div className="mt-2 text-xs text-gray-700">
                    {t("frontdesk.rooms.guestLabel")} <span className="font-medium">{r.guestName}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
