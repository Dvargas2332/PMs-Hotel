// Copyright (c) 2025 Diego Vargas. Todos los derechos reservados.
// Uso, copia, modificación o distribución prohibidos sin autorización por escrito.

import React, { useMemo, useRef, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { Search, CircleUser } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useHotelData } from "../../context/HotelDataContext";

// === Paleta ===
const THEME = {
  surfaceSoft: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E5E7EB",
  text: "#0F172A",
  textSoft: "#64748B",
  c1: "#6366F1", // línea ocupación
  c2: "#60A5FA", // barras reservas
  c3: "#22D3EE", // barras revenue
  c4: "#34D399", // clean
  c5: "#F59E0B", // dirty
  c6: "#EF4444", // occupied
};

/** UI util **/
const Card = ({ className = "", children }) => (
  <div className={`rounded-2xl border bg-white shadow-sm ${className}`}>{children}</div>
);

const KPI = ({ label, value, sub, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-left rounded-2xl border p-4 bg-white shadow-sm w-full transition ring-0 outline-none ${
      onClick ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : ""
    }`}
  >
    <div className="text-2xl font-semibold">{value}</div>
    <div className="text-sm text-gray-500">{label}</div>
    {sub ? <div className="mt-2 text-xs text-gray-400">{sub}</div> : null}
  </button>
);

const ListItem = ({ title, subtitle, right }) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
        <CircleUser className="w-5 h-5 text-gray-400" />
      </div>
      <div className="leading-5">
        <div className="font-medium text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">{subtitle}</div>
      </div>
    </div>
    {right && <div className="text-xs text-gray-500 whitespace-nowrap">{right}</div>}
  </div>
);

// ===== Helpers de fechas/moneda =====
const fmtDay = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD
const fromYMD = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const daysBetween = (a, b) => Math.max(0, Math.round((b - a) / 86400000));
const overlapDays = (aStart, aEnd, bStart, bEnd) =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart)) / 86400000;

const fxToUSD = (p, defaultFx = 530) => {
  const amt = Number(p.amount || 0);
  if ((p.currency || "USD") === "USD") return amt;
  const rate = Number(p.fxRate || defaultFx) || 1;
  return amt / rate;
};

const isCanceled = (status) => {
  const s = (status || "").toUpperCase();
  return s === "CANCELADA" || s === "CANCELED" || s === "NO SHOW" || s === "NO_SHOW";
};
const isActiveOnDay = (res, ymd) => res.checkInDate <= ymd && ymd < res.checkOutDate && !isCanceled(res.status);
const isArrival = (res, ymd) => res.checkInDate === ymd && !isCanceled(res.status);
const isDeparture = (res, ymd) => res.checkOutDate === ymd && !isCanceled(res.status);

/*** Modales ***/
function Modal({ open, onClose, title, children, size = "md" }) {
  if (!open) return null;
  const sizes = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl" };
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} mx-auto`}> 
        <div className="rounded-2xl border bg-white shadow-xl">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="font-semibold">{title}</div>
            <button onClick={onClose} className="px-3 py-1 text-sm rounded-lg border hover:bg-gray-50">Cerrar</button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function CheckInList({ arrivals, roomsIndex, onCheckIn, goToReserva }) {
  if (!arrivals.length) return <div className="text-sm text-gray-500">No hay llegadas hoy.</div>;
  return (
    <div className="space-y-2">
      {arrivals.map((r) => {
        const room = roomsIndex.get(String(r.roomId));
        const nights = Math.max(1, daysBetween(fromYMD(r.checkInDate), fromYMD(r.checkOutDate)));
        return (
          <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border">
            <div>
              <div className="font-medium">{r.guestName}</div>
              <div className="text-xs text-gray-500">{room?.title ? `Hab. ${room.title}` : "Sin habitación"} · {nights} noche(s) · {r.adults || 2} pax</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => goToReserva(r)} className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50">Ver reserva</button>
              <button onClick={() => onCheckIn(r)} className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-500">Dar check‑in</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CheckOutList({ departures, roomsIndex, onCheckOut, goToReserva }) {
  if (!departures.length) return <div className="text-sm text-gray-500">No hay salidas hoy.</div>;
  return (
    <div className="space-y-2">
      {departures.map((r) => {
        const room = roomsIndex.get(String(r.roomId));
        const nights = Math.max(1, daysBetween(fromYMD(r.checkInDate), fromYMD(r.checkOutDate)));
        return (
          <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border">
            <div>
              <div className="font-medium">{r.guestName}</div>
              <div className="text-xs text-gray-500">{room?.title ? `Hab. ${room.title}` : "Sin habitación"} · {nights} noche(s)</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => goToReserva(r)} className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50">Ver reserva</button>
              <button onClick={() => onCheckOut(r)} className="px-3 py-1.5 text-sm rounded-lg bg-rose-600 text-white hover:bg-rose-500">Dar check‑out</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===== Dashboard =====
export default function Dashboard() {
  const navigate = useNavigate();
  const searchRef = useRef(null);

  // Fuente única de verdad
  const { rooms, reservations, doCheckIn, doCheckOut } = useHotelData();
  const today = fmtDay(new Date());

  // ===== Derivados operativos =====
  const inHouseToday = useMemo(() => reservations.filter((r) => isActiveOnDay(r, today)), [reservations, today]);
  const arrivalsToday = useMemo(() => reservations.filter((r) => isArrival(r, today)), [reservations, today]);
  const departuresToday = useMemo(() => reservations.filter((r) => isDeparture(r, today)), [reservations, today]);
  const paxInHouse = useMemo(
    () =>
      inHouseToday.reduce(
        (acc, r) => acc + Number(r.adults || 0) + Number(r.children || 0),
        0
      ),
    [inHouseToday]
  );

  // Índice rápido de habitaciones
  const roomsIndex = useMemo(() => new Map(rooms.map((r) => [String(r.id), r])), [rooms]);

  // Estado housekeeping por habitación hoy
  const hkCounts = useMemo(() => {
    let occ = 0, clean = 0, dirty = 0;
    const occSet = new Set(inHouseToday.map((r) => String(r.roomId)));
    rooms.forEach((room) => {
      const id = String(room.id);
      if (occSet.has(id)) occ++;
      else if (room.status === "dirty") dirty++;
      else if (room.status === "clean") clean++;
      else clean++;
    });
    return { occ, clean, dirty };
  }, [rooms, inHouseToday]);

  // ===== Series históricas =====
  const reservationsBars = useMemo(() => {
    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const ymd = fmtDay(d);
      const v = reservations.filter((r) => (r.createdAt ? fmtDay(new Date(r.createdAt)) : r.checkInDate) === ymd).length;
      return { d: d.toLocaleDateString(undefined, { weekday: "short" }), v };
    });
    return days;
  }, [reservations]);

  const revenueBars = useMemo(() => {
    const map = new Map();
    const push = (ym, v) => map.set(ym, (map.get(ym) || 0) + v);
    reservations.forEach((r) => {
      (r.payments || []).forEach((p) => {
        if (!p.date || typeof p.amount === "undefined") return;
        const d = fromYMD(p.date);
        const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        push(ym, fxToUSD(p, r.fxRateCRC || 530));
      });
    });
    const arr = [];
    const base = new Date();
    base.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base);
      d.setMonth(d.getMonth() - i);
      const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      arr.push({ m: d.toLocaleString(undefined, { month: "short" }), v: Math.round((map.get(ym) || 0) * 100) / 100 });
    }
    return arr;
  }, [reservations]);

  const revenue30d = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 30);
    let total = 0;
    reservations.forEach((r) => {
      (r.payments || []).forEach((p) => {
        if (!p.date || typeof p.amount === "undefined") return;
        const d = fromYMD(p.date);
        if (d >= cutoff && d <= now) total += fxToUSD(p, r.fxRateCRC || 530);
      });
    });
    return Math.round(total * 100) / 100;
  }, [reservations]);

  const occupancyLine = useMemo(() => {
    const arr = [];
    const base = new Date(); base.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const ms = new Date(base); ms.setMonth(ms.getMonth() - i);
      const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 1);
      const daysInMonth = daysBetween(ms, me);
      let roomNights = 0;
      reservations.forEach((r) => {
        if (r.status === "Cancelada" || r.status === "No show") return;
        const a = fromYMD(r.checkInDate);
        const b = fromYMD(r.checkOutDate);
        const ov = overlapDays(a, b, ms, me);
        roomNights += ov;
      });
      const denom = Math.max(1, rooms.length * daysInMonth);
      const occ = Math.round((roomNights / denom) * 100);
      arr.push({ m: ms.toLocaleString(undefined, { month: "short" }), v: occ });
    }
    return arr;
  }, [reservations, rooms.length]);

  const todaysGuests = useMemo(() => {
    const list = [];
    inHouseToday.forEach((r) => list.push({ name: r.guestName, subtitle: "In-house" }));
    arrivalsToday.forEach((r) => list.push({ name: r.guestName, subtitle: "Arrival today" }));
    departuresToday.forEach((r) => list.push({ name: r.guestName, subtitle: "Departure today" }));
    return list.slice(0, 10);
  }, [inHouseToday, arrivalsToday, departuresToday]);

  // Buscar reservas
  const handleSearchKey = (e) => {
    if (e.key === "Enter") {
      const q = e.currentTarget.value.trim();
      if (q) navigate(`/reservas?q=${encodeURIComponent(q)}`);
    }
  };

  /*** NUEVO: Modales y acciones de Check‑in/Check‑out ***/
  const [openCI, setOpenCI] = useState(false);
  const [openCO, setOpenCO] = useState(false);

  const goToReserva = (r) => navigate(`/reservas?id=${r.id}`);

  const performCheckIn = (r) => {
    if (typeof doCheckIn === "function") {
      doCheckIn(r.id, { by: "dashboard" });
    } else {
      navigate(`/frontdesk/checkin/${r.id}`);
    }
    setOpenCI(false);
  };
  const performCheckOut = (r) => {
    if (typeof doCheckOut === "function") {
      doCheckOut(r.id, { by: "dashboard" });
    } else {
      navigate(`/frontdesk/checkout/${r.id}`);
    }
    setOpenCO(false);
  };

  return (
    <div className="min-h-screen w-full" style={{ background: THEME.surfaceSoft }}>
      <div className="mx-auto max-w-[1200px] p-4 md:p-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-gray-700">
            <span className="font-semibold text-xl">Dashboard</span>
          </div>
          <div className="flex items-center gap-3 relative">
           
              
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                className="pl-9 pr-3 py-2 rounded-lg border bg-white text-sm outline-none focus:ring-2 focus:ring-sky-200"
                placeholder="Buscar por nombre o # de reserva…"
                onKeyDown={handleSearchKey}
                aria-label="Buscar reservas"
              />
            </div>

          </div>
        </div>

        {/* Grid principal */}
        <div className="grid grid-cols-12 gap-4">
          {/* KPIs comerciales */}
          <div className="col-span-12">
            <Card className="p-4">
              <div className="font-semibold mb-3">KPI</div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <KPI label="Occupancy (hoy)" value={`${Math.round((inHouseToday.length / Math.max(1, rooms.length)) * 100)}%`} />
                <KPI label="Entradas hoy" value={arrivalsToday.length} onClick={() => setOpenCI(true)} sub="Toca para gestionar check-ins" />
                <KPI label="Salidas hoy" value={departuresToday.length} onClick={() => setOpenCO(true)} sub="Toca para gestionar check-outs" />
                <KPI label="Rooms" value={rooms.length} />
                <KPI label="Pax in-house" value={paxInHouse} sub="Adultos + niños hoy" />
                <KPI label="Ingresos 30d (USD)" value={`$${revenue30d.toFixed(2)}`} sub="Pagos reportados últimos 30d" />
              </div>
            </Card>
          </div>

          {/* Operación/housekeeping resumen */}
          <div className="col-span-12">
            <Card className="p-4">
              <div className="font-semibold mb-3">Operación</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI label="In-house" value={inHouseToday.length} />
                <KPI label="Ocupadas" value={hkCounts.occ} />
                <KPI label="Limpias" value={hkCounts.clean} />
                <KPI label="Sucias" value={hkCounts.dirty} />
              </div>
            </Card>
          </div>

          {/* Reservas (barras, últimos 7 días) */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-4">
            <Card className="p-4 h-56">
              <div className="font-semibold mb-3">Reservations (7d)</div>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reservationsBars} barSize={14}>
                  <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fill: "#94A3B8" }} />
                  <YAxis hide />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <Tooltip cursor={{ fill: "#F8FAFC" }} />
                  <Bar dataKey="v" radius={[6, 6, 0, 0]} fill={THEME.c2} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Ocupación (línea 6 meses) */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <Card className="p-4 h-56">
              <div className="font-semibold mb-3">Occupancy (6m)</div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={occupancyLine}>
                  <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ fill: "#94A3B8" }} />
                  <YAxis hide />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <Tooltip cursor={{ stroke: THEME.c1 }} />
                  <Line type="monotone" dataKey="v" stroke={THEME.c1} strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Huéspedes de hoy */}
          <div className="col-span-12 lg:col-span-6 xl:col-span-5">
            <Card className="p-4 h-full">
              <div className="font-semibold mb-3">Today's Guests</div>
              {todaysGuests.map((g, i) => (
                <ListItem key={i} title={g.name} subtitle={g.subtitle} />
              ))}
              <button
                className="text-sm text-sky-600 mt-2 hover:underline"
                onClick={() => navigate("/reservas")}
              >
                Ver en Reservas
              </button>
            </Card>
          </div>

          {/* Housekeeping (donut) */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <Card className="p-4 h-full">
              <div className="font-semibold mb-3">Housekeeping</div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      { name: "Occupied", value: hkCounts.occ, color: THEME.c6 },
                      { name: "Dirty", value: hkCounts.dirty, color: THEME.c5 },
                      { name: "Clean", value: hkCounts.clean, color: THEME.c4 },
                    ]} dataKey="value" nameKey="name" innerRadius={42} outerRadius={60} paddingAngle={4}>
                      <Cell fill={THEME.c6} />
                      <Cell fill={THEME.c5} />
                      <Cell fill={THEME.c4} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Revenue (6 meses) */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <Card className="p-4 h-full">
              <div className="font-semibold mb-3">Revenue (6m)</div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueBars} barSize={12}>
                    <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ fill: "#94A3B8" }} />
                    <YAxis hide />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <Tooltip cursor={{ fill: "#F8FAFC" }} />
                    <Bar dataKey="v" radius={[6, 6, 0, 0]} fill={THEME.c3} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Revenue (comparativo) */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <Card className="p-4 h-full">
              <div className="font-semibold mb-3">Revenue</div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueBars} barSize={12}>
                    <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ fill: "#94A3B8" }} />
                    <YAxis hide />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <Tooltip cursor={{ fill: "#F8FAFC" }} />
                    <Bar dataKey="v" radius={[6, 6, 0, 0]} fill={THEME.c1} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* MODAL: Check‑ins de hoy */}
      <Modal open={openCI} onClose={() => setOpenCI(false)} title="Check‑ins de hoy" size="lg">
        <CheckInList arrivals={arrivalsToday} roomsIndex={roomsIndex} onCheckIn={performCheckIn} goToReserva={goToReserva} />
      </Modal>

      {/* MODAL: Check‑outs de hoy */}
      <Modal open={openCO} onClose={() => setOpenCO(false)} title="Check‑outs de hoy" size="lg">
        <CheckOutList departures={departuresToday} roomsIndex={roomsIndex} onCheckOut={performCheckOut} goToReserva={goToReserva} />
      </Modal>
    </div>
  );
}



