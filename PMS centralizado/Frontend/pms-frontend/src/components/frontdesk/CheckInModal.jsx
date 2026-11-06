import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { X, Check, User, Bed, Calendar, CreditCard, Wallet, LogIn } from "lucide-react";
import GuestPicker from "../frontdesk/GuestPicker";

export default function CheckInModal({ reservation, rooms, onClose, onCheckedIn }) {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creditLimit, setCreditLimit] = useState("");

  const room = rooms?.find(r => r.id === reservation?.roomId);
  const guestName = reservation?.guest
    ? `${reservation.guest.firstName || ""} ${reservation.guest.lastName || ""}`.trim()
    : reservation?.guestName || "Sin perfil";

  useEffect(() => {
    if (reservation?.id) {
      api.get(`/reservations/deposits?reservationId=${reservation.id}`)
        .then(r => setDeposits(Array.isArray(r.data) ? r.data : []))
        .catch(() => setDeposits([]));
    }
  }, [reservation?.id]);

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      await api.post(`/reservations/${reservation.id}/checkin`);
      onCheckedIn?.();
      onClose?.();
    } catch (err) {
      alert(err?.response?.data?.message || "Error en check-in");
    } finally {
      setLoading(false);
    }
  };

  if (!reservation) return null;

  const totalDeposits = deposits.reduce((s, d) => s + Number(d.amount || 0), 0);
  const nights = reservation.checkIn && reservation.checkOut
    ? Math.max(1, Math.ceil((new Date(reservation.checkOut) - new Date(reservation.checkIn)) / 86400000))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg mx-3 rounded-2xl border shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--card-border)" }}>
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: "var(--color-text-base)" }}>
              <LogIn size={18} className="text-emerald-500"/> Check-in
            </h2>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{reservation.code || reservation.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5"><X size={18}/></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Guest */}
          <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--card-border)", background: "var(--input-bg)" }}>
            <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              <User size={14} className="text-emerald-500"/> Huésped
            </div>
            <div className="text-sm font-semibold" style={{ color: "var(--color-text-base)" }}>{guestName}</div>
            {reservation.guest && (
              <div className="grid grid-cols-2 gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                {reservation.guest.email && <span>📧 {reservation.guest.email}</span>}
                {reservation.guest.phone && <span>📞 {reservation.guest.phone}</span>}
                {reservation.guest.idNumber && <span>🆔 {reservation.guest.idType || ""} {reservation.guest.idNumber}</span>}
              </div>
            )}
            {!reservation.guest && (
              <p className="text-xs opacity-50">Reserva sin perfil — los datos se guardan en la reserva</p>
            )}
          </div>

          {/* Room + Dates */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--card-border)" }}>
              <Bed size={16} className="mx-auto mb-1 text-blue-500"/>
              <div className="font-semibold" style={{ color: "var(--color-text-base)" }}>Hab. {room?.number || "—"}</div>
              <div style={{ color: "var(--color-text-muted)" }}>{room?.type || ""}</div>
            </div>
            <div className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--card-border)" }}>
              <Calendar size={16} className="mx-auto mb-1 text-amber-500"/>
              <div className="font-semibold" style={{ color: "var(--color-text-base)" }}>{reservation.checkIn ? new Date(reservation.checkIn).toLocaleDateString() : "—"}</div>
              <div style={{ color: "var(--color-text-muted)" }}>Entrada</div>
            </div>
            <div className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--card-border)" }}>
              <Calendar size={16} className="mx-auto mb-1 text-rose-500"/>
              <div className="font-semibold" style={{ color: "var(--color-text-base)" }}>{reservation.checkOut ? new Date(reservation.checkOut).toLocaleDateString() : "—"}</div>
              <div style={{ color: "var(--color-text-muted)" }}>{nights} noches</div>
            </div>
          </div>

          {/* Pre-pagos */}
          {deposits.length > 0 && (
            <div className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: "var(--card-border)" }}>
              <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                <Wallet size={14} className="text-amber-500"/> Pre-pagos ({deposits.length})
              </div>
              {deposits.map(d => (
                <div key={d.id} className="flex justify-between text-xs">
                  <span style={{ color: "var(--color-text-base)" }}>
                    {d.voucher && <span className="opacity-40">#{d.voucher} </span>}
                    {d.currency} {Number(d.amount).toLocaleString()}
                  </span>
                  <span style={{ color: "var(--color-text-muted)" }}>{d.paymentMethod || ""}</span>
                </div>
              ))}
              <div className="border-t pt-1.5 flex justify-between text-xs font-semibold" style={{ borderColor: "var(--card-border)" }}>
                <span style={{ color: "var(--color-text-muted)" }}>Total pre-pagos</span>
                <span style={{ color: "var(--color-text-base)" }}>₡{totalDeposits.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Credit limit */}
          <div className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: "var(--card-border)" }}>
            <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              <CreditCard size={14} className="text-purple-500"/> Crédito para cargos
            </div>
            <input type="number" min="0" value={creditLimit} onChange={e => setCreditLimit(e.target.value)}
              placeholder="Límite de crédito para habitación (opcional)"
              className="w-full rounded-lg border px-2.5 py-2 text-xs"
              style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t" style={{ borderColor: "var(--card-border)" }}>
          <button onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium border hover:bg-slate-50 dark:hover:bg-slate-800"
            style={{ borderColor: "var(--card-border)", color: "var(--color-text-base)" }}>Cancelar</button>
          <button onClick={handleCheckIn} disabled={loading}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Check size={16}/> {loading ? "Procesando..." : "Confirmar Check-in"}
          </button>
        </div>
      </div>
    </div>
  );
}
