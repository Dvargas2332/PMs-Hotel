import React, { useMemo, useRef } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Search, CircleUser } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useHotelData } from "../../context/HotelDataContext";
import { frontdeskTheme } from "../../theme/frontdeskTheme";

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl border shadow-sm ${className}`}
    style={{
      background: frontdeskTheme.background.surface,
      borderColor: frontdeskTheme.border.soft,
    }}
  >
    {children}
  </div>
);

const KPI = ({ label, value, sub, onClick, tone = "neutral" }) => {
  const colors = {
    neutral: {
      bg: frontdeskTheme.background.surface,
      border: frontdeskTheme.border.soft,
    },
    primary: {
      bg: frontdeskTheme.primary.subtle,
      border: frontdeskTheme.primary.base,
    },
    secondary: {
      bg: frontdeskTheme.secondary.subtle,
      border: frontdeskTheme.secondary.base,
    },
    success: frontdeskTheme.states.success,
    warning: frontdeskTheme.states.warning,
    waitlist: frontdeskTheme.states.waitlist,
  };
  const toneCfg = colors[tone] || colors.neutral;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl p-4 shadow-sm w-full transition ${
        onClick ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : ""
      }`}
      style={{ background: toneCfg.bg, border: `1px solid ${toneCfg.fg || toneCfg.border}` }}
    >
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-slate-700">{label}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </button>
  );
};

const ListItem = ({ title, subtitle }) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
        <CircleUser className="w-5 h-5 text-slate-400" />
      </div>
      <div className="leading-5">
        <div className="font-medium text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
    </div>
  </div>
);

const toYMD = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const fromYMD = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const isCanceled = (status) => {
  const s = (status || "").toUpperCase();
  return s === "CANCELADA" || s === "CANCELED" || s === "NO SHOW" || s === "NO_SHOW";
};

export default function Dashboard() {
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const { rooms, reservations } = useHotelData();

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toYMD(today), [today]);

  const activeReservations = useMemo(
    () => reservations.filter((r) => !isCanceled(r.status)),
    [reservations]
  );

  const inHouseToday = useMemo(
    () =>
      activeReservations.filter(
        (r) => r.checkInDate <= todayStr && todayStr < r.checkOutDate
      ),
    [activeReservations, todayStr]
  );

  const arrivalsToday = useMemo(
    () => activeReservations.filter((r) => r.checkInDate === todayStr),
    [activeReservations, todayStr]
  );

  const departuresToday = useMemo(
    () => activeReservations.filter((r) => r.checkOutDate === todayStr),
    [activeReservations, todayStr]
  );

  const paxInHouse = useMemo(
    () =>
      inHouseToday.reduce(
        (acc, r) => acc + (Number(r.adults || 0) + Number(r.children || 0)),
        0
      ),
    [inHouseToday]
  );

  // Reservations without an assigned room
  const waitlistReservations = useMemo(
    () => activeReservations.filter((r) => !r.roomId || !r.room),
    [activeReservations]
  );

  // Next 7 days reservations (bars)
  const reservationsBars = useMemo(() => {
    const data = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const ymd = toYMD(d);
      const count = activeReservations.filter((r) => r.checkInDate === ymd).length;
      data.push({
        d: d.toLocaleDateString(undefined, { weekday: "short" }),
        v: count,
      });
    }
    return data;
  }, [activeReservations, today]);

  // Ocupación últimos 6 meses (línea simple)
  const occupancyLine = useMemo(() => {
    const arr = [];
    const base = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
      const daysInMonth = (monthEnd - monthStart) / 86400000;
      let roomNights = 0;
      activeReservations.forEach((r) => {
        const a = fromYMD(r.checkInDate);
        const b = fromYMD(r.checkOutDate);
        const start = Math.max(a.getTime(), monthStart.getTime());
        const end = Math.min(b.getTime(), monthEnd.getTime());
        if (end > start) roomNights += (end - start) / 86400000;
      });
      const denom = Math.max(1, rooms.length * daysInMonth);
      const occ = Math.round((roomNights / denom) * 100);
      arr.push({
        m: monthStart.toLocaleString(undefined, { month: "short" }),
        v: occ,
      });
    }
    return arr;
  }, [activeReservations, rooms.length, today]);

  // Revenue últimos 30 días (simple, usando payments si existen)
  const revenue30d = useMemo(() => {
    const now = today;
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 30);
    let total = 0;
    reservations.forEach((r) => {
      (r.payments || []).forEach((p) => {
        if (!p.date || typeof p.amount === "undefined") return;
        const d = fromYMD(p.date);
        if (d >= cutoff && d <= now) {
          const amt = Number(p.amount || 0);
          total += amt;
        }
      });
    });
    return Math.round(total * 100) / 100;
  }, [reservations, today]);

  const todaysGuests = useMemo(() => {
    const list = [];
    inHouseToday.forEach((r) =>
      list.push({
        title: r.guestName || "Guest",
        subtitle: "En casa",
      })
    );
    departuresToday.forEach((r) =>
      list.push({
        title: r.guestName || "Guest",
        subtitle: "Departures today",
      })
    );
    return list.slice(0, 10);
  }, [inHouseToday, departuresToday]);

  const handleSearchKey = (e) => {
    if (e.key === "Enter") {
      const q = e.currentTarget.value.trim();
      if (q) navigate(`/reservas?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: frontdeskTheme.background.app }}
    >
      <div className="mx-auto max-w-[1200px] p-4 md:p-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="font-semibold text-xl">Dashboard</span>
          </div>
          <div className="flex items-center gap-3 relative">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                className="pl-9 pr-3 py-2 rounded-lg border bg-white text-sm outline-none focus:ring-2 focus:ring-sky-200"
                placeholder="Search by name or reservation #"
                onKeyDown={handleSearchKey}
                aria-label="Search reservations"
              />
            </div>
          </div>
        </div>

        {/* Grid principal */}
        <div className="grid grid-cols-12 gap-4">
          {/* KPIs */}
          <div className="col-span-12">
            <Card className="p-4">
              <div className="font-semibold mb-3">KPI</div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <KPI
                  label="Occupancy (today)"
                  value={`${Math.round(
                    (inHouseToday.length / Math.max(1, rooms.length)) * 100
                  )}%`}
                />
                <KPI
                  label="Arrivals today"
                  value={arrivalsToday.length}
                  sub="Tap to view reservations"
                  onClick={() => navigate("/reservas")}
                />
                <KPI
                  label="Departures today"
                  value={departuresToday.length}
                  sub="Tap to view reservations"
                  onClick={() => navigate("/reservas")}
                />
                <KPI label="Rooms" value={rooms.length} />
                <KPI
                  label="En lista de espera"
                  value={waitlistReservations.length}
                  sub="Reservations without a room"
                />
                <KPI
                  label="Ingresos 30d"
                  value={revenue30d.toFixed(2)}
                  sub="Pagos reportados últimos 30 días"
                />
              </div>
            </Card>
          </div>

          {/* Operación */}
          <div className="col-span-12">
            <Card className="p-4">
              <div className="font-semibold mb-3">Operación</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KPI label="In-house (hab)" value={inHouseToday.length} />
                <KPI label="Pax en hotel" value={paxInHouse} sub="Adultos + niños" />
                <KPI
                  label="Occupied today"
                  value={inHouseToday.length}
                  sub="Rooms with active stays"
                />
                <KPI
                  label="Arrivals today"
                  value={arrivalsToday.length}
                  sub="Rooms arriving today"
                />
                <KPI
                  label="Departures today"
                  value={departuresToday.length}
                  sub="Rooms departing today"
                />
              </div>
            </Card>
          </div>

          {/* Next 7 days reservations */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-4">
            <Card className="p-4 h-56">
              <div className="font-semibold mb-3">Reservations (arrivals next 7 days)</div>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reservationsBars} barSize={14}>
                  <XAxis dataKey="d" axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <Tooltip cursor={{ fill: "#F8FAFC" }} />
                  <Bar dataKey="v" radius={[6, 6, 0, 0]} fill={frontdeskTheme.primary.base} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Ocupación 6 meses */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-4">
            <Card className="p-4 h-56">
              <div className="font-semibold mb-3">Ocupación (6 meses)</div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={occupancyLine}>
                  <XAxis dataKey="m" axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <Tooltip cursor={{ stroke: frontdeskTheme.secondary.base }} />
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={frontdeskTheme.secondary.base}
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Guests today */}
          <div className="col-span-12 lg:col-span-4">
            <Card className="p-4 h-full">
              <div className="font-semibold mb-3">Guests today</div>
              {todaysGuests.length === 0 && (
                <div className="text-sm text-slate-500">No guests today.</div>
              )}
              {todaysGuests.map((g, idx) => (
                <ListItem key={idx} title={g.title} subtitle={g.subtitle} />
              ))}
              <button
                className="text-sm text-sky-600 mt-2 hover:underline"
                onClick={() => navigate("/reservas")}
              >
                View in reservations
              </button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
