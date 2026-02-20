import React, { useMemo, useState, useCallback, useEffect } from "react";
import Timeline, { TimelineHeaders, DateHeader } from "react-calendar-timeline";
import moment from "moment";
import "moment/locale/es";
import { X as XIcon } from "lucide-react";
import { useHotelData } from "../context/useHotelData";
import "react-calendar-timeline/style.css";
import "./Planning.css";
import { api } from "../lib/api";
import { frontdeskTheme } from "../theme/frontdeskTheme";

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

// Localizar fechas a español para encabezados del planning
moment.locale("es");

const mapRemoteReservation = (r) => ({
  id: String(r.id),
  // Si no hay habitación asignada dejamos roomId en null para poder usar lista de espera
  roomId: r.roomId ? String(r.roomId) : null,
  guestName: [r.guest?.firstName, r.guest?.lastName].filter(Boolean).join(" ").trim() || r.guestId,
  checkInDate: toYMD(r.checkInDate || r.checkIn),
  checkOutDate: toYMD(r.checkOutDate || r.checkOut),
  payments: Array.isArray(r.payments) ? r.payments : [],
  channel: r.channel || r.source || "",
  status: r.status,
  rawStatus: r.status,
  room: r.room,
  guest: r.guest,
});
const mapRemoteRoom = (r) => ({
  id: String(r.id),
  title: r.title || (r.number != null ? String(r.number) : String(r.id)),
  type: r.type,
});

export default function Planning() {
  const { settings, rooms, reservations } = useHotelData();
  const { checkIn, checkOut } = settings;
  const [remoteRooms, setRemoteRooms] = useState(null);
  const [remoteReservations, setRemoteReservations] = useState(null);
  const [viewStart, setViewStart] = useState(() => moment().startOf("day"));
  const [viewEnd, setViewEnd] = useState(() => moment().startOf("day").add(15, "day"));
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 720,
  }));

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

  useEffect(() => {
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const roomsData = remoteRooms || rooms;
  const reservationsData = remoteReservations || reservations;
  const windowDays = useMemo(() => Math.max(1, viewEnd.diff(viewStart, "days")), [viewStart, viewEnd]);
  const isCompact = viewport.width < 1024;
  const timelineHeight = Math.max(300, viewport.height - 260);
  const timelineMinWidth = isCompact ? 720 : 960;
  const lineHeight = isCompact ? 32 : 38;

  // Grupos: fila de tipo de habitación y debajo sus habitaciones
  const groups = useMemo(() => {
    const byType = new Map();
    (roomsData || []).forEach((r) => {
      const type = r.type || "No type";
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push(r);
    });

    const result = [];
    Array.from(byType.entries()).forEach(([type, list]) => {
      result.push({ id: `TYPE-${type}`, title: type, isTypeHeader: true });
      list.forEach((r) => {
        result.push({
          id: String(r.id),
          title: r.title || (r.number != null ? String(r.number) : String(r.id)),
          type,
          isTypeHeader: false,
        });
      });
    });
    return result;
  }, [roomsData]);

  const roomTitleById = useMemo(() => {
    const map = new Map();
    (roomsData || []).forEach((r) => {
      map.set(String(r.id), r.title || (r.number != null ? String(r.number) : String(r.id)));
    });
    return map;
  }, [roomsData]);

  // Items (reservations)
  const items = useMemo(() => {
    const today = moment().format("YYYY-MM-DD");
    const colorByType = {
      TODAY_CHECKIN: "linear-gradient(90deg, #10b981 0%, #22c55e 100%)", // check in hoy
      TODAY_CHECKOUT: "linear-gradient(90deg, #f59e0b 0%, #f97316 100%)", // check out hoy
      CHECKED_IN: "linear-gradient(90deg, #0ea5e9 0%, #2563eb 100%)", // en estadia (check-in)
      IN_STAY: "linear-gradient(90deg, #14b8a6 0%, #6366f1 100%)", // en estadia (entre fechas)
      CHECKED_OUT: "linear-gradient(90deg, #94a3b8 0%, #475569 100%)", // finalizo
      CONFIRMED: "linear-gradient(90deg, #4ade80 0%, #22c55e 100%)", // confirmada
      WAITLIST: "linear-gradient(90deg, #c084fc 0%, #8b5cf6 100%)", // lista de espera
      PENDING: "linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)", // normal sin confirmar
    };

    const resolveType = (r) => {
      const code = (r.rawStatus || r.status || "").toUpperCase();
      if (code === "CHECKED_OUT") return "CHECKED_OUT";
      if (code === "CHECKED_IN") return "CHECKED_IN";
      if (code === "WAITLIST") return "WAITLIST";
      if (code === "CONFIRMED") {
        if (today === r.checkInDate) return "TODAY_CHECKIN";
        if (today === r.checkOutDate) return "TODAY_CHECKOUT";
        if (today > r.checkInDate && today < r.checkOutDate) return "IN_STAY";
        return "CONFIRMED";
      }
      if (today === r.checkInDate) return "TODAY_CHECKIN";
      if (today === r.checkOutDate) return "TODAY_CHECKOUT";
      if (today > r.checkInDate && today < r.checkOutDate) return "IN_STAY";
      return "PENDING";
    };

    return (reservationsData || [])
      // Only reservations with an assigned room; the rest go to the waitlist
      .filter((r) => r.roomId)
      .filter((r) => (r.rawStatus || r.status || "").toUpperCase() !== "CANCELED")
      .map((r) => {
        const start = moment(`${r.checkInDate}T${checkIn}`);
        let end = moment(`${r.checkOutDate}T${checkOut}`);
        if (!end.isAfter(start)) {
          end = start.clone().add(1, "hour");
        }
        const hasPayments = Array.isArray(r.payments) && r.payments.length > 0;
        const isOta = typeof r.channel === "string" && /ota|booking|expedia|airbnb/i.test(r.channel || "");
        const type = resolveType(r);
        const background = colorByType[type] || colorByType.PENDING;
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
            roomTitle: roomTitleById.get(String(r.roomId)) || String(r.roomId),
            checkInDate: r.checkInDate,
            checkOutDate: r.checkOutDate,
            guestName: r.guestName,
            hasPayments,
            isOta,
            type,
          },
        };
      });
  }, [reservationsData, checkIn, checkOut, roomTitleById]);

  // Modales
  const [active, setActive] = useState(null); // { type, data }
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  // Reservations without a room => waitlist
  const waitlist = useMemo(
    () => (reservationsData || []).filter((r) => !r.roomId),
    [reservationsData]
  );
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

  // Navegacion de fechas controlada
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

  const checkoutSummary = useMemo(() => {
    if (!active || active.type !== "checkout") return null;
    const nights = Math.max(1, moment(active.data.checkOutDate).diff(moment(active.data.checkInDate), "days") || 1);
    return { nights, hasPayments: active.data.hasPayments };
  }, [active]);

  return (
    <div className="h-full min-h-0 w-full bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-4 md:p-6">
      <div className="mx-auto w-full max-w-full space-y-4 h-full min-h-0 flex flex-col">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Planner</h1>
              <p className="text-sm text-slate-600">Room occupancy overview.</p>
            </div>
            <button
              type="button"
              onClick={() => setWaitlistOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
            >
              Waitlist
              {waitlist.length > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[11px] text-white">
                  {waitlist.length}
                </span>
              )}
            </button>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <LegendDot color="#10b981" label="Check-in" />
                <LegendDot color="#3f3f46" label="Stay" />
                <LegendDot color="#f59e0b" label="Check-out" />
              </div>
              <div className="flex flex-wrap items-center gap-1 justify-end">
                <LegendDot color="#4ade80" label="Reserva confirmada" />
                <LegendDot color="#fbbf24" label="Reserva pendiente" />
                <LegendDot color="#0ea5e9" label="Check-in hoy" />
                <LegendDot color="#f97316" label="Check-out hoy" />
                <LegendDot color="#94a3b8" label="Finalizó estancia" />
                <LegendDot color="#c084fc" label="Waitlist" />
              </div>
            </div>
	        </div>

        <div className="rounded-2xl border bg-white shadow-sm p-3 space-y-3 flex-1 min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              Rango: {viewStart.format("YYYY-MM-DD")} al {viewEnd.format("YYYY-MM-DD")}
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
                {"<- 7d"}
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
                {"7d ->"}
              </button>
            </div>
          </div>
            <div
              className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-100 bg-slate-50/60"
              style={{ height: timelineHeight, maxHeight: timelineHeight }}
            >
              <div className="h-full min-h-0">
                <div className="h-full" style={{ minWidth: timelineMinWidth }}>
                  <Timeline
                    groups={groups}
                    items={items}
                    defaultTimeStart={viewStart}
                    defaultTimeEnd={viewEnd}
                    lineHeight={lineHeight}
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
                    groupRenderer={({ group }) =>
                      group.isTypeHeader ? (
                        <div
                          className="px-10 py-0.5 text-sm font-semibold rounded-r-full h-full flex items-center border-b"
                          style={{
                            background: frontdeskTheme.planning.roomTypeRowBg,
                            color: frontdeskTheme.planning.roomTypeRowFg,
                            borderColor: frontdeskTheme.planning.roomTypeRowBorder,
                          }}
                        >
                          {group.title}
                        </div>
                      ) : (
                        <div className="px-2 py-1 text-sm text-slate-900 font-medium">
                          {group.title}
                        </div>
                      )
                    }
                  >
                    <TimelineHeaders>
                      <DateHeader
                        unit="primaryHeader"
                        labelFormat={(range) => range[0].format("MMMM YYYY")}
                      />
                      <DateHeader
                        unit="day"
                        labelFormat={(range) => range[0].format("ddd D")}
                      />
                    </TimelineHeaders>
                  </Timeline>
                </div>
              </div>
            </div>
        </div>
      </div>

      {/* Waitlist (reservations without a room) */}
      {waitlistOpen && (
        <Modal onClose={() => setWaitlistOpen(false)} title="Waitlist">
          {waitlist.length === 0 ? (
            <div className="text-sm text-gray-500">No reservations in the waitlist.</div>
          ) : (
            <div className="space-y-2 text-sm">
              {waitlist.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 bg-white"
                >
                  <div>
                    <div className="font-medium text-gray-900">{r.guestName || "No name"}</div>
                    <div className="text-xs text-gray-500">
                      {r.checkInDate} → {r.checkOutDate} {r.code ? `• ${r.code}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border px-3 py-1 text-xs hover:bg-gray-50"
                    onClick={() => {
                      window.location.href = "/frontdesk/reservas";
                    }}
                  >
                    Open in reservations
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Modales */}
      {active?.type === "checkin" && (
        <Modal onClose={closeModal} title="Perform check-in">
          <div className="space-y-3">
            <Row label="Guest" value={active.data.guestName} />
            <Row label="Room" value={active.data.roomTitle || active.data.roomId} />
            <Row label="Stay" value={`${active.data.checkInDate} to ${active.data.checkOutDate}`} />
            <div className="flex justify-end gap-2 pt-2">
              <button className="px-3 py-2 rounded bg-gray-100" onClick={closeModal}>
                Cancel
              </button>
              <button
                className="px-3 py-2 rounded bg-emerald-600 text-white"
                onClick={() => {
                  alert("Check-in completed");
                  closeModal();
                }}
              >
                Confirm check-in
              </button>
            </div>
          </div>
        </Modal>
      )}

      {active?.type === "checkout" && (
        <Modal onClose={closeModal} title="Checkout / Invoice">
          <div className="space-y-3">
            <Row label="Guest" value={active.data.guestName} />
            <Row label="Room" value={active.data.roomId} />
            <Row label="Check-out" value={active.data.checkOutDate} />
            <div className="rounded-lg border p-3 bg-white">
              <div className="text-sm text-gray-600">Charges summary</div>
              <ul className="mt-2 text-sm text-gray-700 list-disc ml-5 space-y-1">
                <li>
                  Stay: {checkoutSummary?.nights || 1} night(s) ({active.data.checkInDate} to {active.data.checkOutDate})
                </li>
                <li>Taxes and fees: calculated at invoicing based on hotel configuration</li>
                <li>Charges: integrate POS / minibar charges if applicable</li>
                <li>Payments and deposits: {checkoutSummary?.hasPayments ? "recorded" : "not recorded"}</li>
              </ul>
              <div className="mt-2 font-semibold">Total due: calculated when generating the invoice</div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="px-3 py-2 rounded bg-gray-100" onClick={closeModal}>
                Cancel
              </button>
              <button
                className="px-3 py-2 rounded bg-indigo-600 text-white"
                onClick={() => {
                  alert("Invoice generated and checkout completed");
                  closeModal();
                }}
              >
                Generate invoice and checkout
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
            <button onClick={onClose} className="px-3 py-1 rounded hover:bg-gray-100" aria-label="Close modal">
              <XIcon className="h-4 w-4 text-slate-700" />
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
