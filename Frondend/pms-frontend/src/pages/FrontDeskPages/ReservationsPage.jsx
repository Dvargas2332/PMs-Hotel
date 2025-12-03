import React, { useEffect, useMemo, useState } from "react";
import { useHotelData } from "../../context/HotelDataContext";
import { api } from "../../lib/api";

const STATUS_META = {
  Confirmada: { bg: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  Pendiente: { bg: "bg-amber-100 text-amber-800 border-amber-200" },
  "Check-in": { bg: "bg-blue-100 text-blue-800 border-blue-200" },
  "Check-out": { bg: "bg-slate-100 text-slate-800 border-slate-200" },
  Cancelada: { bg: "bg-rose-100 text-rose-800 border-rose-200" },
};

const emptyForm = {
  guestId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  roomId: "",
  checkInDate: "",
  checkOutDate: "",
  adults: 2,
  children: 0,
  ratePlanId: "",
  price: "",
  currency: "CRC",
  source: "FRONTDESK",
  channel: "DIRECT",
  status: "CONFIRMED",
  paymentMethod: "",
  depositAmount: "",
  code: "",
  hotelId: "",
};

const Badge = ({ status }) => {
  const meta = STATUS_META[status] || { bg: "bg-gray-100 text-gray-700 border-gray-200" };
  return <span className={`px-2 py-1 rounded border text-xs font-medium ${meta.bg}`}>{status || "N/D"}</span>;
};

function ActionButton({ onClick, children, disabled, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200",
    green: "bg-emerald-600 text-white hover:bg-emerald-500 border-emerald-600",
    blue: "bg-blue-600 text-white hover:bg-blue-500 border-blue-600",
    red: "bg-rose-600 text-white hover:bg-rose-500 border-rose-600",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded text-xs border transition ${tones[tone]} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

export default function ReservationsPage() {
  const {
    reservations,
    rooms,
    guests,
    loading,
    refreshReservations,
    refreshRooms,
    refreshGuests,
    createReservation,
    doCheckIn,
    doCheckOut,
    cancelReservation,
    createGuest,
  } = useHotelData();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [ratePlans, setRatePlans] = useState([]);

  useEffect(() => {
    refreshRooms();
    refreshGuests();
    refreshReservations();
    api
      .get("/api/ratePlans")
      .then(({ data }) => {
        if (Array.isArray(data)) setRatePlans(data);
      })
      .catch(() => {});
  }, [refreshRooms, refreshGuests, refreshReservations]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reservations.filter((r) => {
      const matchesSearch =
        !term ||
        (r.guestName || "").toLowerCase().includes(term) ||
        (r.code || "").toLowerCase().includes(term) ||
        (r.roomNumber || "").toLowerCase().includes(term);
      const byFrom = dateFrom ? (!r.checkInDate || r.checkInDate >= dateFrom) : true;
      const byTo = dateTo ? (!r.checkOutDate || r.checkOutDate <= dateTo) : true;
      return matchesSearch && byFrom && byTo;
    });
  }, [reservations, search, dateFrom, dateTo]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.roomId || !form.checkInDate || !form.checkOutDate) {
      alert("Faltan datos de habitación o fechas");
      return;
    }
    if (form.checkOutDate <= form.checkInDate) {
      alert("La fecha de salida debe ser después de la entrada");
      return;
    }
    try {
      setCreating(true);
      let guestId = form.guestId;
      if (!guestId) {
        if (!form.firstName || !form.lastName) {
          alert("Completa nombre y apellido del huésped");
          return;
        }
        const guest = await createGuest({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email || undefined,
          phone: form.phone || undefined,
        });
        guestId = guest?.id;
      }
      await createReservation({
        roomId: form.roomId,
        guestId,
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
        adults: Number(form.adults) || 2,
        children: Number(form.children) || 0,
        ratePlanId: form.ratePlanId || undefined,
        price: form.price || undefined,
        currency: form.currency || "CRC",
        source: form.source || "FRONTDESK",
        channel: form.channel || "DIRECT",
        status: form.status || "CONFIRMED",
        paymentMethod: form.paymentMethod || undefined,
        depositAmount: form.depositAmount || undefined,
        code: form.code || undefined,
        hotelId: form.hotelId || undefined,
      });
      setForm(emptyForm);
      setSearch("");
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "No se pudo crear la reserva";
      alert(msg);
    } finally {
      setCreating(false);
    }
  };

  const canCheckIn = (r) => {
    const code = (r.rawStatus || "").toUpperCase();
    return code === "CONFIRMED" || code === "PENDING";
  };
  const canCheckOut = (r) => (r.rawStatus || "").toUpperCase() === "CHECKED_IN";
  const canCancel = (r) => {
    const code = (r.rawStatus || "").toUpperCase();
    return code !== "CANCELED" && code !== "CHECKED_OUT";
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reservaciones</h1>
          <p className="text-sm text-slate-600">Fuente conectada al backend: rooms, guests y check-in/out reales.</p>
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded border bg-white hover:bg-gray-100 text-sm"
            onClick={() => {
              refreshReservations();
              refreshRooms();
              refreshGuests();
            }}
          >
            Recargar
          </button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Buscar</label>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Huésped, código o habitación"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Desde</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Hasta</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="p-2">Código</th>
                <th className="p-2">Huésped</th>
                <th className="p-2">Habitación</th>
                <th className="p-2">Entrada</th>
                <th className="p-2">Salida</th>
                <th className="p-2">Estado</th>
                <th className="p-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{r.code || r.id}</td>
                  <td className="p-2">
                    <div className="font-medium">{r.guestName || "N/D"}</div>
                    <div className="text-xs text-slate-500">{r.guest?.email || r.guest?.phone}</div>
                  </td>
                  <td className="p-2">{r.roomNumber || r.roomId}</td>
                  <td className="p-2">{r.checkInDate || "N/D"}</td>
                  <td className="p-2">{r.checkOutDate || "N/D"}</td>
                  <td className="p-2">
                    <Badge status={r.status} />
                  </td>
                  <td className="p-2 text-right space-x-2">
                    <ActionButton tone="green" disabled={!canCheckIn(r) || loading.action} onClick={() => doCheckIn(r.id)}>
                      Check-in
                    </ActionButton>
                    <ActionButton tone="blue" disabled={!canCheckOut(r) || loading.action} onClick={() => doCheckOut(r.id)}>
                      Check-out
                    </ActionButton>
                    <ActionButton tone="red" disabled={!canCancel(r) || loading.action} onClick={() => cancelReservation(r.id)}>
                      Cancelar
                    </ActionButton>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="p-3 text-center text-slate-500" colSpan={7}>
                    No hay reservaciones que coincidan con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Crear reserva</h2>
          {creating && <span className="text-xs text-slate-500">Guardando...</span>}
        </div>
        <form className="grid grid-cols-1 lg:grid-cols-3 gap-3" onSubmit={handleCreate}>
          <div className="space-y-2">
            <label className="block text-xs text-slate-500">Huésped existente</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.guestId}
              onChange={(e) => setForm((f) => ({ ...f, guestId: e.target.value }))}
            >
              <option value="">-- Nuevo huésped --</option>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name || `${g.firstName} ${g.lastName}`.trim()} {g.email ? `(${g.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-slate-500">Habitación</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.roomId}
              onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
              required
            >
              <option value="">Selecciona habitación</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number || r.title || r.id}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-slate-500">Plan / Tarifa</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.ratePlanId}
              onChange={(e) => setForm((f) => ({ ...f, ratePlanId: e.target.value }))}
            >
              <option value="">Sin plan</option>
              {ratePlans.map((rp) => (
                <option key={rp.id} value={rp.id}>
                  {rp.name || rp.id}
                </option>
              ))}
            </select>
          </div>

          {!form.guestId && (
            <>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nombre</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Apellidos</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Teléfono</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs text-slate-500 mb-1">Entrada</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={form.checkInDate}
              onChange={(e) => setForm((f) => ({ ...f, checkInDate: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Salida</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={form.checkOutDate}
              onChange={(e) => setForm((f) => ({ ...f, checkOutDate: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Adultos</label>
            <input
              type="number"
              min="1"
              className="w-full border rounded px-3 py-2"
              value={form.adults}
              onChange={(e) => setForm((f) => ({ ...f, adults: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Niños</label>
            <input
              type="number"
              min="0"
              className="w-full border rounded px-3 py-2"
              value={form.children}
              onChange={(e) => setForm((f) => ({ ...f, children: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Código</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="Ej: RES-123"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Estado</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="CONFIRMED">Confirmada</option>
              <option value="PENDING">Pendiente</option>
              <option value="CANCELED">Cancelada</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Fuente</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            >
              <option value="FRONTDESK">Front Desk</option>
              <option value="DIRECT">Directa</option>
              <option value="OTA">OTA</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Canal</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.channel}
              onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
            >
              <option value="DIRECT">Directo</option>
              <option value="BOOKING">Booking</option>
              <option value="EXPEDIA">Expedia</option>
              <option value="AIRBNB">Airbnb</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Precio (opcional)</label>
            <input
              type="number"
              step="0.01"
              className="w-full border rounded px-3 py-2"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="Ej: 120.00"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Moneda</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            >
              <option value="CRC">CRC</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Método de pago</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.paymentMethod}
              onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
              placeholder="Efectivo / Tarjeta / Transferencia"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Depósito / Pago (opcional)</label>
            <input
              type="number"
              step="0.01"
              className="w-full border rounded px-3 py-2"
              value={form.depositAmount}
              onChange={(e) => setForm((f) => ({ ...f, depositAmount: e.target.value }))}
              placeholder="Monto recibido"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Hotel ID (si aplica)</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.hotelId}
              onChange={(e) => setForm((f) => ({ ...f, hotelId: e.target.value }))}
              placeholder="Opcional"
            />
          </div>

          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="px-4 py-2 rounded border bg-gray-100 hover:bg-gray-200 text-sm"
              onClick={() => setForm(emptyForm)}
            >
              Limpiar
            </button>
            <button
              type="submit"
              disabled={creating || loading.action}
              className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 text-sm"
            >
              Crear reserva
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
