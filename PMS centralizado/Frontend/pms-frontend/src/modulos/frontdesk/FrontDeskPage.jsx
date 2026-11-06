import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import CheckInModal from "../../components/frontdesk/CheckInModal";
import {
  Search, Users, Bed, DoorOpen, LogIn, LogOut, Plus, X, CreditCard,
  Calendar, Clock, ChevronLeft, ChevronRight, Filter, RefreshCw
} from "lucide-react";

const STATUS_COLORS = {
  AVAILABLE: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", label: "Disponible" },
  OCCUPIED: { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300", label: "Ocupada" },
  CLEANING: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", label: "Limpieza" },
  BLOCKED: { bg: "bg-gray-200 dark:bg-gray-700", text: "text-gray-500 dark:text-gray-400", label: "Bloqueada" },
  MAINTENANCE: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", label: "Mantenimiento" },
};

const RES_STATUS = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CHECKED_IN: "En casa",
  CHECKED_OUT: "Check-out",
  CANCELED: "Cancelada",
};

export default function FrontDeskPage() {
  const { hotel } = useAuth();
  const { t } = useLanguage();
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [activeCheckins, setActiveCheckins] = useState([]);
  const [guests, setGuests] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [view, setView] = useState("house"); // house | reservations | guests
  const [searchGuest, setSearchGuest] = useState("");
  const [showNewReservation, setShowNewReservation] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(null);
  const [dailyReport, setDailyReport] = useState(null);
  const [checkInReservation, setCheckInReservation] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsRes, resRes, activeRes, dailyRes] = await Promise.all([
        api.get("/rooms"),
        api.get("/reservations"),
        api.get("/reservations/active"),
        api.get(`/reports/daily?date=${selectedDate}`),
      ]);
      setRooms(roomsRes.data || []);
      setReservations(resRes.data || []);
      setActiveCheckins(activeRes.data || []);
      setDailyReport(dailyRes.data || null);
    } catch (err) {
      console.error("Frontdesk load error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadGuests = async (q = "") => {
    try {
      const { data } = await api.get(`/guests${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setGuests(Array.isArray(data) ? data : []);
    } catch { setGuests([]); }
  };

  const loadDeposits = async (reservationId) => {
    try {
      const { data } = await api.get(`/reservations/deposits?reservationId=${reservationId}`);
      setDeposits(Array.isArray(data) ? data : []);
    } catch { setDeposits([]); }
  };

  // Quick check-in - opens modal
  const handleCheckIn = (reservation) => {
    setCheckInReservation(reservation);
  };

  // Quick check-out
  const handleCheckOut = async (reservationId) => {
    if (!confirm("¿Confirmar check-out? Esto liberará la habitación.")) return;
    try {
      await api.post(`/reservations/${reservationId}/checkout`);
      loadData();
    } catch (err) {
      alert(err?.response?.data?.message || "Error en check-out");
    }
  };

  // Room status quick change
  const handleRoomStatus = async (roomId, newStatus) => {
    try {
      await api.patch(`/rooms/${roomId}/status`, { status: newStatus });
      loadData();
    } catch (err) {
      alert("Error al cambiar estado");
    }
  };

  // Create deposit
  const handleCreateDeposit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      await api.post("/reservations/deposits", {
        reservationId: showDepositModal,
        amount: Number(form.get("amount")),
        currency: form.get("currency") || "CRC",
        note: form.get("note") || "",
      });
      setShowDepositModal(null);
      loadDeposits(showDepositModal);
      loadData();
    } catch (err) {
      alert(err?.response?.data?.message || "Error al registrar depósito");
    }
  };

  // Room grid cards
  const RoomCard = ({ room }) => {
    const status = STATUS_COLORS[room.status] || STATUS_COLORS.AVAILABLE;
    const checkin = activeCheckins.find((r) => r.roomId === room.id);
    const upcoming = reservations.find(
      (r) => r.roomId === room.id && ["PENDING", "CONFIRMED"].includes(r.status)
    );

    return (
      <div
        className={`rounded-xl border p-3 cursor-pointer transition-all hover:shadow-md ${status.bg}`}
        style={{ borderColor: "var(--card-border)" }}
        onClick={() => {
          if (checkin) { loadDeposits(checkin.id); }
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-lg font-bold" style={{ color: "var(--color-text-base)" }}>{room.number}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.bg} ${status.text}`}>
            {status.label}
          </span>
        </div>
        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {room.type && <div>Tipo: {room.type}</div>}
          {checkin ? (
            <div className="mt-1">
              <div className="font-medium truncate" style={{ color: "var(--color-text-base)" }}>
                {checkin.guest?.firstName} {checkin.guest?.lastName}
              </div>
              <div>Entrada: {new Date(checkin.checkIn).toLocaleDateString()}</div>
              <div>Salida: {new Date(checkin.checkOut).toLocaleDateString()}</div>
              <div className="flex gap-1 mt-1">
                <button
                  className="text-xs px-2 py-0.5 rounded bg-rose-500 text-white hover:bg-rose-600"
                  onClick={(e) => { e.stopPropagation(); handleCheckOut(checkin.id); }}
                >
                  Check-out
                </button>
              </div>
            </div>
          ) : upcoming ? (
            <div className="mt-1 text-amber-600 dark:text-amber-400">
              Próxima: {new Date(upcoming.checkIn).toLocaleDateString()}
            </div>
          ) : (
            <div className="mt-1 text-emerald-600 dark:text-emerald-400">Libre</div>
          )}
        </div>
        {/* Quick status change */}
        <div className="flex gap-1 mt-2 flex-wrap">
          {["AVAILABLE", "CLEANING", "BLOCKED", "MAINTENANCE"].map((st) => (
            room.status !== st && (
              <button
                key={st}
                className="text-[10px] px-1.5 py-0.5 rounded border opacity-60 hover:opacity-100"
                style={{ borderColor: "var(--card-border)", color: "var(--color-text-muted)" }}
                onClick={(e) => { e.stopPropagation(); handleRoomStatus(room.id, st); }}
              >
                {STATUS_COLORS[st]?.label || st}
              </button>
            )
          ))}
        </div>
      </div>
    );
  };

  // Reservation list item
  const ReservationItem = ({ res }) => {
    const isActive = res.status === "CHECKED_IN";
    return (
      <div
        className="rounded-lg border p-3 flex items-center justify-between gap-3"
        style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono opacity-60">{res.code}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              isActive ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" :
              res.status === "CANCELED" ? "bg-gray-100 text-gray-500" :
              "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            }`}>
              {RES_STATUS[res.status] || res.status}
            </span>
          </div>
          <div className="font-medium truncate" style={{ color: "var(--color-text-base)" }}>
            {res.guest?.firstName} {res.guest?.lastName}
          </div>
          <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Hab. {res.room?.number || "—"} · {new Date(res.checkIn).toLocaleDateString()} → {new Date(res.checkOut).toLocaleDateString()}
            {res.ratePlan?.name && <> · {res.ratePlan.name}</>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {["PENDING", "CONFIRMED"].includes(res.status) && (
            <button
              className="text-xs px-2 py-1 rounded bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={() => handleCheckIn(res)}
            >
              <LogIn size={12} className="inline mr-1" />Check-in
            </button>
          )}
          {isActive && (
            <>
              <button
                className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
                onClick={() => { setShowDepositModal(res.id); loadDeposits(res.id); }}
              >
                <CreditCard size={12} className="inline mr-1" />Pago
              </button>
              <button
                className="text-xs px-2 py-1 rounded bg-rose-500 text-white hover:bg-rose-600"
                onClick={() => handleCheckOut(res.id)}
              >
                <LogOut size={12} className="inline mr-1" />Salida
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const arrivals = reservations.filter((r) => r.checkIn?.startsWith(todayStr) && ["PENDING", "CONFIRMED"].includes(r.status));
  const departures = activeCheckins.filter((r) => r.checkOut?.startsWith(todayStr));
  const inHouseCount = activeCheckins.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-emerald-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-base)" }}>
            Front Desk
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {hotel?.name || "Hotel"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date navigator */}
          <button
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().slice(0, 10));
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm rounded-lg px-3 py-1.5 border"
            style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
          />
          <button
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().slice(0, 10));
            }}
          >
            <ChevronRight size={18} />
          </button>
          <button onClick={loadData} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" title="Actualizar">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Daily Flash */}
      {dailyReport && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { label: "Llegadas hoy", value: arrivals.length, icon: LogIn, color: "text-blue-500" },
            { label: "Salidas hoy", value: departures.length, icon: LogOut, color: "text-rose-500" },
            { label: "En casa", value: inHouseCount, icon: Users, color: "text-emerald-500" },
            { label: "Ocupación", value: `${dailyReport.occupancyPct || 0}%`, icon: Bed, color: "text-amber-500" },
            { label: "Ingresos hoy", value: `₡${(dailyReport.revenue || 0).toLocaleString()}`, icon: CreditCard, color: "text-purple-500" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border p-3 text-center"
              style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}
            >
              <item.icon size={18} className={`mx-auto mb-1 ${item.color}`} />
              <div className="text-lg font-bold" style={{ color: "var(--color-text-base)" }}>{item.value}</div>
              <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* View tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: "var(--card-border)" }}>
        {[
          { key: "house", label: "In-House", icon: Bed },
          { key: "reservations", label: "Reservas", icon: Calendar },
          { key: "guests", label: "Huéspedes", icon: Users },
          { key: "arrivals", label: "Llegadas", icon: LogIn },
          { key: "departures", label: "Salidas", icon: LogOut },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`flex items-center gap-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              view === tab.key
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent hover:border-gray-300"
            }`}
            style={{ color: view !== tab.key ? "var(--color-text-muted)" : undefined }}
            onClick={() => setView(tab.key)}
          >
            <tab.icon size={14} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {/* In-House Grid */}
        {view === "house" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {rooms.length === 0 && (
              <div className="col-span-full text-center py-10" style={{ color: "var(--color-text-muted)" }}>
                No hay habitaciones configuradas
              </div>
            )}
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}

        {/* Reservations */}
        {view === "reservations" && (
          <div className="space-y-2">
            <div className="flex gap-2 mb-3">
              <button
                className="text-sm px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-1"
                onClick={() => setShowNewReservation(true)}
              >
                <Plus size={14} /> Nueva Reserva
              </button>
            </div>
            {reservations.length === 0 && (
              <div className="text-center py-10" style={{ color: "var(--color-text-muted)" }}>No hay reservas</div>
            )}
            {reservations.map((res) => (
              <ReservationItem key={res.id} res={res} />
            ))}
          </div>
        )}

        {/* Guests */}
        {view === "guests" && (
          <div className="space-y-3">
            <div className="relative max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                type="text"
                placeholder="Buscar huésped..."
                value={searchGuest}
                onChange={(e) => { setSearchGuest(e.target.value); loadGuests(e.target.value); }}
                className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
              />
            </div>
            {guests.map((g) => (
              <div
                key={g.id}
                className="rounded-lg border p-3 flex items-center justify-between"
                style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}
              >
                <div>
                  <div className="font-medium" style={{ color: "var(--color-text-base)" }}>
                    {g.firstName} {g.lastName}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {g.email && <span>{g.email} · </span>}
                    {g.phone && <span>{g.phone} · </span>}
                    {g.idNumber && <span>ID: {g.idNumber}</span>}
                  </div>
                </div>
              </div>
            ))}
            {guests.length === 0 && searchGuest && (
              <div className="text-center py-6" style={{ color: "var(--color-text-muted)" }}>Sin resultados</div>
            )}
          </div>
        )}

        {/* Arrivals today */}
        {view === "arrivals" && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
              Llegadas del {new Date(selectedDate).toLocaleDateString()}
            </h3>
            {arrivals.length === 0 && (
              <div className="text-center py-10" style={{ color: "var(--color-text-muted)" }}>No hay llegadas hoy</div>
            )}
            {arrivals.map((res) => (
              <ReservationItem key={res.id} res={res} />
            ))}
          </div>
        )}

        {/* Departures today */}
        {view === "departures" && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
              Salidas del {new Date(selectedDate).toLocaleDateString()}
            </h3>
            {departures.length === 0 && (
              <div className="text-center py-10" style={{ color: "var(--color-text-muted)" }}>No hay salidas hoy</div>
            )}
            {departures.map((res) => (
              <ReservationItem key={res.id} res={res} />
            ))}
          </div>
        )}
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDepositModal(null)}>
          <div
            className="rounded-2xl border p-6 w-full max-w-md mx-4 space-y-3"
            style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: "var(--color-text-base)" }}>Registrar Pre-pago</h3>
              <button onClick={() => setShowDepositModal(null)} className="p-1 rounded-lg hover:bg-black/5">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateDeposit} className="space-y-3">
              <div>
                <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Monto</label>
                <input
                  type="number"
                  name="amount"
                  required
                  min="1"
                  step="0.01"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
                  placeholder="0.00"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Moneda</label>
                  <select
                    name="currency"
                    defaultValue="CRC"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
                  >
                    <option value="CRC">CRC</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Nota</label>
                <input
                  type="text"
                  name="note"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
                  placeholder="Ej: Depósito de garantía"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600"
              >
                Registrar Depósito
              </button>
            </form>

            {/* Existing deposits */}
            {deposits.length > 0 && (
              <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--card-border)" }}>
                <h4 className="text-xs font-medium mb-2" style={{ color: "var(--color-text-muted)" }}>Depósitos registrados</h4>
                {deposits.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm py-1">
                    <span style={{ color: "var(--color-text-base)" }}>
                      {d.currency} {Number(d.amount).toLocaleString()}
                    </span>
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {new Date(d.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Reservation Wizard Modal */}
      {showNewReservation && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] bg-black/30 backdrop-blur-sm" onClick={() => setShowNewReservation(false)}>
          <div
            className="w-full max-w-2xl mx-4 rounded-2xl border shadow-xl max-h-[90vh] overflow-y-auto p-5"
            style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: "var(--color-text-base)" }}>Nueva Reservación</h2>
              <button onClick={() => setShowNewReservation(false)} className="p-1.5 rounded-lg hover:bg-black/5">
                <X size={20} />
              </button>
            </div>
            <ReservationWizard
              onSave={async (data) => {
                await api.post("/reservations", data);
                setShowNewReservation(false);
                loadData();
              }}
              onCancel={() => setShowNewReservation(false)}
            />
          </div>
        </div>
      )}
      {checkInReservation && (
        <CheckInModal
          reservation={checkInReservation}
          rooms={rooms}
          onClose={() => setCheckInReservation(null)}
          onCheckedIn={loadData}
        />
      )}
    </div>
  );
}
