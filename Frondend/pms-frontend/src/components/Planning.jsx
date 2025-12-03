import React, { useMemo, useState, useCallback, useEffect } from "react";
import Timeline from "react-calendar-timeline";
import moment from "moment";
import { useHotelData } from "../context/HotelDataContext";
import "react-calendar-timeline/style.css";
import "./Planning.css";
import { api } from "../lib/api";

// Util: YYYY-MM-DD local (sin timezone UTC shift)
function ymdLocal(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
const toYMD = (v) => {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const mapRemoteReservation = (r) => ({
  id: String(r.id),
  roomId: String(r.roomId),
  guestName: [r.guest?.firstName, r.guest?.lastName].filter(Boolean).join(" ").trim() || r.guestId,
  checkInDate: toYMD(r.checkInDate || r.checkIn),
  checkOutDate: toYMD(r.checkOutDate || r.checkOut),
  payments: Array.isArray(r.payments) ? r.payments : [],
  channel: r.channel || r.source || "",
});
const mapRemoteRoom = (r) => ({ id: String(r.id), title: r.title ?? r.number ?? String(r.id) });

export default function Planning() {
  const { settings, rooms, reservations } = useHotelData();
  const { checkIn, checkOut } = settings;
  const [remoteRooms, setRemoteRooms] = useState(null);
  const [remoteReservations, setRemoteReservations] = useState(null);
  const [viewStart, setViewStart] = useState(() => moment().startOf("day"));
  const [viewEnd, setViewEnd] = useState(() => moment().startOf("day").add(15, "day"));

  // Cargar datos desde backend/mock para reflejar configuraciones del Management
  useEffect(() => {
    const load = async () => {
      try {
        const [resv, rms] = await Promise.all([api.get("/reservations"), api.get("/rooms")]);
        if (Array.isArray(resv?.data)) setRemoteReservations(resv.data.map(mapRemoteReservation));
        if (Array.isArray(rms?.data)) setRemoteRooms(rms.data.map(mapRemoteRoom));
      } catch {
        // si falla, seguimos con los datos del contexto
      }
    };
    load();
  }, []);

  const roomsData = remoteRooms ?? rooms;
  const reservationsData = remoteReservations ?? reservations;
  const windowDays = useMemo(() => Math.max(1, viewEnd.diff(viewStart, "days")), [viewStart, viewEnd]);

  // Grupos (habitaciones)
  const groups = useMemo(
    () => (roomsData || []).map((r) => ({ id: String(r.id), title: r.title ?? String(r.id) })),
    [roomsData]
  );

  // Items (reservas)
  const items = useMemo(
    () =>
      (reservationsData || []).map((r) => {
        const start = moment(`${r.checkInDate}T${checkIn}`);
        let end = moment(`${r.checkOutDate}T${checkOut}`);
        if (!end.isAfter(start)) {
          end = start.clone().add(1, "hour");
        }
        const hasPayments = Array.isArray(r.payments) && r.payments.length > 0;
        const isOta = typeof r.channel === "string" && /ota|booking|expedia|airbnb/i.test(r.channel || "");
        // Paleta moderna sin tonos rojos: degradado esmeralda → azul petróleo
        const background = "linear-gradient(90deg, #10b981 0%, #0f172a 50%, #0ea5e9 100%)";
        return {
          id: String(r.id),
          group: String(r.roomId),
          title: r.guestName,
          start_time: start,
          end_time: end,
          itemProps: {
            style: {
              background,
              color: "white",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.2)",
              boxShadow: "0 8px 16px rgba(15, 23, 42, 0.15)",
            },
          },
          data: {
            roomId: String(r.roomId),
            checkInDate: r.checkInDate,
            checkOutDate: r.checkOutDate,
            guestName: r.guestName,
            hasPayments,
            isOta,
          },
        };
      }),
    [reservationsData, checkIn, checkOut]
  );

  // Modales
  const [active, setActive] = useState(null); // { type, data }
  const closeModal = () => setActive(null);

  const onItemSelect = useCallback(
    (id) => {
      const found = items.find((it) => String(it.id) === String(id));
      if (!found) return;
      const todayStr = ymdLocal(new Date());
      const { checkInDate, checkOutDate } = found.data;
      let type = null;
      if (todayStr === checkInDate) type = "checkin";
      else if (todayStr === checkOutDate) type = "checkout";
      else if (todayStr > checkInDate && todayStr < checkOutDate) type = "checkout";

      if (type) setActive({ type, data: { id, ...found.data } });
    },
    [items]
  );

  // Navegación de fechas controlada
  const shiftWindow = useCallback(
    (days) => {
      setViewStart((s) => {
        const nextStart = s.clone().add(days, "day");
        setViewEnd(nextStart.clone().add(windowDays, "day"));
        return nextStart;
      });
    },
    [windowDays]
  );

  const handleToday = useCallback(() => {
    const start = moment().startOf("day");
    setViewStart(start);
    setViewEnd(start.clone().add(windowDays, "day"));
  }, [windowDays]);

  const onTimeChange = useCallback(
    (start, end) => {
      const s = moment(start);
      const len = Math.max(1, moment(end).diff(moment(start), "days"));
      setViewStart(s);
      setViewEnd(s.clone().add(len, "day"));
    },
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1400px] space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Planner</h1>
            <p className="text-sm text-slate-600">Vista de ocupación por habitación, sin licencias.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <LegendDot color="#10b981" label="Check-in" />
            <LegendDot color="#3f3f46" label="Estadía" />
            <LegendDot color="#f59e0b" label="Check-out" />
          </div>
        </div>

        <div className="rounded-2xl border bg-white shadow-sm p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              Rango: {viewStart.format("YYYY-MM-DD")} -> {viewEnd.format("YYYY-MM-DD")}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="h-9 rounded-lg border px-3 text-sm"
                value={viewStart.format("YYYY-MM-DD")}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const start = moment(val, "YYYY-MM-DD");
                  setViewStart(start);
                  setViewEnd(start.clone().add(windowDays, "day"));
                }}
              />
              <button
                className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-sm"
                onClick={() => shiftWindow(-7)}
              >
                ← 7d
              </button>
              <button
                className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-sm"
                onClick={handleToday}
              >
                Hoy
              </button>
              <button
                className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-sm"
                onClick={() => shiftWindow(7)}
              >
                7d →
              </button>
            </div>
          </div>
          <Timeline
            groups={groups}
            items={items}
            defaultTimeStart={viewStart}
            defaultTimeEnd={viewEnd}
            lineHeight={48}
            itemHeightRatio={0.8}
            canMove={false}
            canResize={false}
            stackItems
            onItemSelect={onItemSelect}
            itemTouchSendsClick
            sidebarWidth={150}
            visibleTimeStart={viewStart.valueOf()}
            visibleTimeEnd={viewEnd.valueOf()}
            onTimeChange={onTimeChange}
          />
        </div>
      </div>

      {/* Modales */}
      {active?.type === "checkin" && (
        <Modal onClose={closeModal} title="Realizar Check-in">
          <div className="space-y-3">
            <Row label="Huésped" value={active.data.guestName} />
            <Row label="Habitación" value={active.data.roomId} />
            <Row label="Estadía" value={`${active.data.checkInDate} -> ${active.data.checkOutDate}`} />
            <div className="text-sm text-gray-500">Confirma documentos, firma y método de pago de garantía.</div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="px-3 py-2 rounded bg-gray-100" onClick={closeModal}>
                Cancelar
              </button>
              <button
                className="px-3 py-2 rounded bg-emerald-600 text-white"
                onClick={() => {
                  alert("Check-in realizado");
                  closeModal();
                }}
              >
                Confirmar check-in
              </button>
            </div>
          </div>
        </Modal>
      )}

      {active?.type === "checkout" && (
        <Modal onClose={closeModal} title="Checkout / Factura">
          <div className="space-y-3">
            <Row label="Huésped" value={active.data.guestName} />
            <Row label="Habitación" value={active.data.roomId} />
            <Row label="Salida" value={active.data.checkOutDate} />
            <div className="rounded-lg border p-3 bg-white">
              <div className="text-sm text-gray-600">Resumen de cargos</div>
              <ul className="mt-2 text-sm text-gray-700 list-disc ml-5">
                <li>Estadía (noches): ...</li>
                <li>Impuestos / fees: ...</li>
                <li>Consumos: ...</li>
                <li>Pagos / Depósitos: ...</li>
              </ul>
              <div className="mt-2 font-semibold">Total a pagar: ...</div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="px-3 py-2 rounded bg-gray-100" onClick={closeModal}>
                Cancelar
              </button>
              <button
                className="px-3 py-2 rounded bg-indigo-600 text-white"
                onClick={() => {
                  alert("Factura generada y Checkout realizado");
                  closeModal();
                }}
              >
                Generar factura y checkout
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Helpers UI
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-start justify-center p-4 sm:p-8">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button onClick={onClose} className="px-3 py-1 rounded hover:bg-gray-100">
              ×
            </button>
          </div>
          <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="text-sm">
      <span className="text-gray-500">{label}: </span>
      <span className="text-gray-900 font-medium">{value || "-"}</span>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 border border-slate-200 text-[11px] text-slate-700">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
