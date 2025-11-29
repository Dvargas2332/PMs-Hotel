import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * PMS • Reservaciones (v2)
 * - Listado con filtros (nombre o ID OTA en un solo campo)
 * - Crear reserva (modal)
 * - Drawer con Detalle/Editar + Acciones: Duplicar, Cancelar (con motivo), Eliminar (con motivo)
 * - Enviar confirmación por Email y WhatsApp
 * - Pagos avanzados: método -> campos dinámicos; moneda CRC/USD con conversión por tipo de cambio
 * - "Canal" ahora es "Tarifa" y debe venir del módulo Management (mock con useRatePlans)
 */

/** --- Datos base de ejemplo --- **/
const roomTypes = [
  { id: 1, name: "Standard", price: 50 },
  { id: 2, name: "Deluxe", price: 80 },
  { id: 3, name: "Suite", price: 120 },
];

const rateTypes = ["Standard", "Flexible", "No reembolsable"];

// 🔗 Simulación de tarifas (rate plans) traídas de Management → Frontdesk Config
function useRatePlans() {
  // Reemplazar por fetch/axios → GET /management/frontdesk/rate-plans
  return [
    { id: "BAR", name: "BAR (Flexible)" },
    { id: "NRF", name: "No Reembolsable" },
    { id: "CORP", name: "Corporativa" },
    { id: "OTA-Booking", name: "Booking.com" },
    { id: "OTA-Expedia", name: "Expedia" },
  ];
}

const statusOptions = [
  "Pendiente",
  "Confirmada",
  "Check-in",
  "Check-out",
  "No show",
  "Cancelada",
];

const paymentMethods = [
  "Efectivo",
  "Tarjeta",
  "Transferencia",
  "Depósito",
  "SINPE Móvil",
];

// Tipo de cambio definido por Management (solo lectura en UI)
// TODO: sustituir este valor con el que exponga Management (contexto/API)
const MANAGEMENT_FX_RATE = 530;

/** --- Utilidades --- **/
const uid = () => Math.random().toString(36).slice(2, 9);

function diffNights(ci, co) {
  if (!ci || !co) return 1;
  const a = new Date(ci);
  const b = new Date(co);
  const ms = b - a;
  const nights = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
  return nights;
}

function computeReservationTotal(rooms, payments, fxRateCRC = 530) {
  const roomsTotal = rooms.reduce((acc, r) => {
    const price = r.pricePerNight ?? roomTypes.find((t) => t.name === r.type)?.price ?? 0;
    const nights = r.nights || diffNights(r.checkIn, r.checkOut) || 1;
    const deposit = Number(r.deposit || 0);
    return acc + price * nights - deposit;
  }, 0);
  const paidUSD = (payments || []).reduce((acc, p) => {
    const amt = Number(p.amount || 0);
    const usd = (p.currency || "USD") === "CRC" ? amt / (Number(p.fxRate || fxRateCRC) || 1) : amt;
    return acc + usd;
  }, 0);
  return Math.max(0, Number(roomsTotal) - Number(paidUSD));
}

function earliestCheckIn(rooms) {
  return rooms.reduce((min, r) => (min && min < r.checkIn ? min : r.checkIn), "");
}

function formatMoney(n) {
  return (Number(n) || 0).toFixed(2);
}

function buildConfirmationMessage(res) {
  const first = res.rooms?.[0] || {};
  const nights =
    res.rooms?.reduce(
      (acc, rm) => acc + (rm.nights || diffNights(rm.checkIn, rm.checkOut)),
      0
    ) || 0;
  return [
    `Hola ${res.guest?.name || ""},`,
    `¡Gracias por reservar con nosotros!`,
    `
Detalles de tu reserva:`,
    `• Tarifa: ${res.ratePlan || "—"}${res.otaId ? ` • ID OTA: ${res.otaId}` : ""}`,
    `• Entrada: ${first.checkIn || "—"} • Noches: ${nights}`,
    `• Habitación: ${first.type || "—"}${first.roomNumber ? ` • #${first.roomNumber}` : ""}`,
    `• Total estimado: $${formatMoney(
      computeReservationTotal(res.rooms || [], res.payments || [], MANAGEMENT_FX_RATE)
    )}`,
    res.tag ? `• Nota: ${res.tag}` : "",
    `
Cualquier consulta, estamos para ayudarte.`,
  ]
    .filter(Boolean)
    .join("");
}

/** --- Componentes UI básicos --- **/
function Badge({ color = "gray", children }) {
  const cls = {
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-700",
    blue: "bg-blue-100 text-blue-700",
    slate: "bg-slate-100 text-slate-700",
    orange: "bg-orange-100 text-orange-700",
  }[color];
  return <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{children}</span>;
}

function Modal({ open, onClose, title, children, size = "max-w-4xl" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-start justify-center p-4 sm:p-8">
        <div className={`w-full ${size} bg-white rounded-2xl shadow-xl overflow-hidden`}>
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button onClick={onClose} className="px-3 py-1 rounded hover:bg-gray-100">✕</button>
          </div>
          <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Drawer({ open, onClose, title, children }) {
  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}>
      <div
        className={`absolute inset-0 transition ${open ? 'bg-black/40' : 'bg-transparent'} `}
        onClick={onClose}
      />
      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-[600px] bg-white shadow-2xl transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="px-3 py-1 rounded hover:bg-gray-100">✕</button>
        </div>
        <div className="p-5 h-[calc(100%-56px)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ReasonModal({ open, onClose, title = "Motivo", onConfirm }) {
  const [reason, setReason] = useState("");
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={title} size="max-w-xl">
      <div className="space-y-4">
        <textarea
          className="w-full border rounded p-3 min-h-[120px]"
          placeholder="Describe el motivo..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 rounded bg-gray-100" onClick={onClose}>Cancelar</button>
          <button
            className="px-3 py-2 rounded bg-red-600 text-white"
            onClick={() => {
              onConfirm?.(reason.trim());
              setReason("");
            }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** --- Formulario compartido (crear / editar) --- **/
function ReservationForm({ value, onChange, onSubmit, submitLabel = "Guardar", ratePlans = [] }) {
  const [form, setForm] = useState(value);

  useEffect(() => setForm(value), [value]);

  // Actualizar nights al modificar fechas
  const updateRoomField = (idx, field, val) => {
    const next = { ...form };
    const r = { ...next.rooms[idx], [field]: val };

    if (field === "checkIn") {
      const ci = new Date(val);
      const co = new Date(r.checkOut);
      if (!r.checkOut || co <= ci) {
        const nextDay = new Date(ci);
        nextDay.setDate(ci.getDate() + 1);
        r.checkOut = nextDay.toISOString().split("T")[0];
      }
      r.nights = diffNights(r.checkIn, r.checkOut);
    } else if (field === "checkOut") {
      if (!r.checkIn) return; // esperar a que haya checkIn
      r.nights = diffNights(r.checkIn, val);
    }

    next.rooms[idx] = r;
    setForm(next);
    onChange?.(next);
  };

  const addRoom = () => {
    const next = {
      ...form,
      rooms: [
        ...form.rooms,
        {
          type: "",
          roomNumber: "",
          adults: 1,
          children: 0,
          babies: 0,
          nights: 1,
          deposit: 0,
          checkIn: "",
          checkOut: "",
          rateType: "",
          pricePerNight: 0,
        },
      ],
    };
    setForm(next);
    onChange?.(next);
  };

  const removeRoom = (idx) => {
    const next = { ...form, rooms: form.rooms.filter((_, i) => i !== idx) };
    setForm(next);
    onChange?.(next);
  };

  const addPayment = () => {
    const next = {
      ...form,
      payments: [
        ...form.payments,
        {
          date: "",
          amount: 0,
          currency: "USD", // USD | CRC
          fxRate: MANAGEMENT_FX_RATE,
          method: "Efectivo",
          // campos condicionales
          depositRef: "",
          sinpeRef: "",
          cardLast4: "",
          cardTxnDate: "",
          notes: "",
        },
      ],
    };
    setForm(next);
    onChange?.(next);
  };

  const updatePayment = (i, field, val) => {
    const next = { ...form };
    next.payments[i] = { ...next.payments[i], [field]: val };
    setForm(next);
    onChange?.(next);
  };

  const update = (path, val) => {
    const next = { ...form };
    // path e.g. guest.name
    const keys = path.split(".");
    let ref = next;
    for (let i = 0; i < keys.length - 1; i++) ref = ref[keys[i]];
    ref[keys[keys.length - 1]] = val;
    setForm(next);
    onChange?.(next);
  };

  const total = useMemo(
    () => computeReservationTotal(form.rooms, form.payments, MANAGEMENT_FX_RATE),
    [form]
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(form);
      }}
      className="space-y-6"
    >
      {/* Tarifa / OTA / Estado */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded">
        <div>
          <label className="block text-sm font-medium">Tarifa</label>
          <select
            className="mt-1 w-full border rounded p-2"
            value={form.ratePlan || ""}
            onChange={(e) => update("ratePlan", e.target.value)}
          >
            <option value="">Selecciona tarifa</option>
            {ratePlans.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">ID OTA</label>
          <input
            className="mt-1 w-full border rounded p-2"
            value={form.otaId}
            onChange={(e) => update("otaId", e.target.value)}
            placeholder="p. ej. 12345678"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Estado</label>
          <select
            className="mt-1 w-full border rounded p-2"
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="">Selecciona estado</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Etiqueta / Notas cortas</label>
          <input
            className="mt-1 w-full border rounded p-2"
            value={form.tag || ""}
            onChange={(e) => update("tag", e.target.value)}
            placeholder="p. ej. Aniversario, VIP"
          />
        </div>
      </div>

      {/* Huésped */}
      <div className="bg-white p-4 rounded shadow">
        <h4 className="font-semibold mb-3">Perfil del huésped</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            className="border rounded p-2"
            placeholder="Nombre completo"
            value={form.guest.name}
            onChange={(e) => update("guest.name", e.target.value)}
          />
          <input
            className="border rounded p-2"
            placeholder="Número de identificación"
            value={form.guest.idNumber}
            onChange={(e) => update("guest.idNumber", e.target.value)}
          />
          <input
            className="border rounded p-2"
            placeholder="Teléfono"
            value={form.guest.phone}
            onChange={(e) => update("guest.phone", e.target.value)}
          />
          <input
            type="email"
            className="border rounded p-2"
            placeholder="Correo electrónico"
            value={form.guest.email}
            onChange={(e) => update("guest.email", e.target.value)}
          />
          <input
            className="border rounded p-2"
            placeholder="Tarjeta de crédito (opcional)"
            value={form.guest.creditCard}
            onChange={(e) => update("guest.creditCard", e.target.value)}
          />
          <textarea
            className="border rounded p-2 md:col-span-2"
            placeholder="Notas / Comentarios de OTA"
            value={form.guest.notes}
            onChange={(e) => update("guest.notes", e.target.value)}
          />
        </div>
      </div>

      {/* Habitaciones */}
      <div className="bg-white p-4 rounded shadow">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold">Habitaciones</h4>
          <button type="button" onClick={addRoom} className="px-3 py-1.5 rounded bg-green-600 text-white">
            + Agregar habitación
          </button>
        </div>

        {form.rooms.map((r, idx) => {
          const price = r.pricePerNight || roomTypes.find((t) => t.name === r.type)?.price || 0;
          const subtotal = price * (r.nights || 1) - (r.deposit || 0);
          return (
            <div key={idx} className="border rounded p-4 mb-3 relative">
              {form.rooms.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRoom(idx)}
                  className="absolute top-2 right-2 text-red-600 font-bold"
                >
                  ✕
                </button>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                <select
                  className="border rounded p-2"
                  value={r.type}
                  onChange={(e) => updateRoomField(idx, "type", e.target.value)}
                >
                  <option value="">Tipo de habitación</option>
                  {roomTypes.map((t) => (
                    <option key={t.id} value={t.name}>{`${t.name} ($${t.price}/noche)`}</option>
                  ))}
                </select>
                <select
                  className="border rounded p-2"
                  value={r.rateType}
                  onChange={(e) => updateRoomField(idx, "rateType", e.target.value)}
                >
                  <option value="">Tipo de tarifa</option>
                  {rateTypes.map((rt) => (
                    <option key={rt} value={rt}>{rt}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-2">
                <input
                  className="border rounded p-2"
                  type="text"
                  placeholder="Habitación # (opcional)"
                  value={r.roomNumber || ""}
                  onChange={(e) => updateRoomField(idx, "roomNumber", e.target.value)}
                />
                <div>
                  <label className="block text-sm">Adultos</label>
                  <input
                    className="border rounded p-2 w-full"
                    type="number"
                    min={1}
                    value={r.adults}
                    onChange={(e) => updateRoomField(idx, "adults", Number(e.target.value))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm">Niños</label>
                    <input
                      className="border rounded p-2 w-full"
                      type="number"
                      min={0}
                      value={r.children}
                      onChange={(e) => updateRoomField(idx, "children", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm">Bebés</label>
                    <input
                      className="border rounded p-2 w-full"
                      type="number"
                      min={0}
                      value={r.babies}
                      onChange={(e) => updateRoomField(idx, "babies", Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-sm">Check-in</label>
                  <input
                    className="border rounded p-2 w-full"
                    type="date"
                    value={r.checkIn}
                    onChange={(e) => updateRoomField(idx, "checkIn", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm">Check-out</label>
                  <input
                    className="border rounded p-2 w-full"
                    type="date"
                    min={
                      r.checkIn
                        ? new Date(new Date(r.checkIn).getTime() + 86400000).toISOString().split("T")[0]
                        : undefined
                    }
                    value={r.checkOut}
                    onChange={(e) => updateRoomField(idx, "checkOut", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm">Tarifa por noche</label>
                  <input
                    className="border rounded p-2 w-full"
                    type="number"
                    min={0}
                    value={r.pricePerNight || price}
                    onChange={(e) => updateRoomField(idx, "pricePerNight", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm">Depósito / anticipo</label>
                  <input
                    className="border rounded p-2 w-full"
                    type="number"
                    min={0}
                    value={r.deposit}
                    onChange={(e) => updateRoomField(idx, "deposit", Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="mt-2 font-semibold">Noches: {r.nights || diffNights(r.checkIn, r.checkOut)} • Subtotal: ${formatMoney(subtotal)}</div>
            </div>
          );
        })}
      </div>

      {/* Pagos avanzados */}
      <div className="bg-white p-4 rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold">Abonos / Pagos</h4>
          <button type="button" onClick={addPayment} className="px-3 py-1.5 rounded bg-yellow-600 text-white">
            + Agregar pago
          </button>
          /</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 bg-slate-50 p-3 rounded">
          <div className="md:col-span-2">
            <label className="block text-sm">Tipo de cambio (CRC → USD)</label>
            <input
              className="mt-1 border rounded p-2 w-full bg-gray-100"
              value={MANAGEMENT_FX_RATE}
              readOnly
            />
          </div>
          <div className="md:col-span-2 flex items-end text-sm text-slate-600">
            Los pagos en colones se convierten automáticamente a USD usando el tipo de cambio de Management.
          </div>

        {(form.payments || []).map((p, i) => {
          const appliedUSD = (p.currency || "USD") === "CRC"
            ? (Number(p.amount || 0) / (Number(p.fxRate || MANAGEMENT_FX_RATE) || 1))
            : Number(p.amount || 0);
          return (
            <div key={i} className="grid grid-cols-1 md:grid-cols-7 gap-3 mb-3 border rounded p-3">
              <div>
                <label className="block text-sm">Fecha</label>
                <input
                  className="border rounded p-2 w-full"
                  type="date"
                  value={p.date}
                  onChange={(e) => updatePayment(i, "date", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm">Método</label>
                <select
                  className="border rounded p-2 w-full"
                  value={p.method}
                  onChange={(e) => updatePayment(i, "method", e.target.value)}
                >
                  {paymentMethods.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm">Moneda</label>
                <select
                  className="border rounded p-2 w-full"
                  value={p.currency || "USD"}
                  onChange={(e) => {
                    const curr = e.target.value;
                    updatePayment(i, "currency", curr);
                    if (curr === "CRC") updatePayment(i, "fxRate", MANAGEMENT_FX_RATE);
                  }}
                >
                  <option value="USD">USD</option>
                  <option value="CRC">CRC</option>
                </select>
              </div>
              <div>
                <label className="block text-sm">Monto</label>
                <input
                  className="border rounded p-2 w-full"
                  type="number"
                  min={0}
                  value={p.amount}
                  onChange={(e) => updatePayment(i, "amount", Number(e.target.value))}
                />
              </div>
              { (p.currency || "USD") === "CRC" && (
                <div>
                  <label className="block text-sm">TC usado</label>
                  <input
                    className="border rounded p-2 w-full bg-gray-100"
                    value={p.fxRate || MANAGEMENT_FX_RATE}
                    readOnly
                  />
                </div>
              )}
              {/* Campos condicionales por método */}
              {p.method === "Depósito" && (
                <div className="md:col-span-2">
                  <label className="block text-sm">Ref. depósito</label>
                  <input
                    className="border rounded p-2 w-full"
                    value={p.depositRef || ""}
                    onChange={(e) => updatePayment(i, "depositRef", e.target.value)}
                    placeholder="Número de referencia"
                  />
                </div>
              )}
              {p.method === "SINPE Móvil" && (
                <div className="md:col-span-2">
                  <label className="block text-sm">N° comprobante SINPE</label>
                  <input
                    className="border rounded p-2 w-full"
                    value={p.sinpeRef || ""}
                    onChange={(e) => updatePayment(i, "sinpeRef", e.target.value)}
                    placeholder="Comprobante"
                  />
                </div>
              )}
              {p.method === "Tarjeta" && (
                <>
                  <div>
                    <label className="block text-sm">Fecha transacción</label>
                    <input
                      className="border rounded p-2 w-full"
                      type="date"
                      value={p.cardTxnDate || ""}
                      onChange={(e) => updatePayment(i, "cardTxnDate", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm">Últimos 4</label>
                    <input
                      className="border rounded p-2 w-full"
                      maxLength={4}
                      value={p.cardLast4 || ""}
                      onChange={(e) => updatePayment(i, "cardLast4", e.target.value.replace(/\D/g, "").slice(0,4))}
                      placeholder="0000"
                    />
                  </div>
                </>
              )}
              <div className="md:col-span-2">
                <label className="block text-sm">Notas</label>
                <input
                  className="border rounded p-2 w-full"
                  value={p.notes || ""}
                  onChange={(e) => updatePayment(i, "notes", e.target.value)}
                  placeholder="Observaciones del pago"
                />
              </div>
              <div className="md:col-span-7 text-right text-sm text-slate-600">
                Aplicado en USD: <span className="font-semibold">${formatMoney(appliedUSD)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-lg font-bold">Total (USD): ${formatMoney(total)}</div>
        <div className="flex-1" />
        <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

/** --- Tabla de reservas --- **/
function ReservationTable({ data, onRowClick }) {
  return (
    <div className="overflow-x-auto bg-white rounded shadow">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-700 text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-3">Huésped</th>
            <th className="text-left px-4 py-3">OTA</th>
            <th className="text-left px-4 py-3">Tarifa</th>
            <th className="text-left px-4 py-3">Entrada</th>
            <th className="text-left px-4 py-3">Salida</th>
            <th className="text-left px-4 py-3">Noches</th>
            <th className="text-left px-4 py-3">Hab.</th>
            <th className="text-left px-4 py-3">Estado</th>
            <th className="text-right px-4 py-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-center text-slate-500" colSpan={9}>
                No hay reservas que coincidan con los filtros.
              </td>
            </tr>
          )}
          {data.map((r) => {
            const nights = r.rooms.reduce((acc, rm) => acc + (rm.nights || diffNights(rm.checkIn, rm.checkOut)), 0);
            const total = computeReservationTotal(r.rooms, r.payments || [], MANAGEMENT_FX_RATE);
            const first = r.rooms[0] || {};
            const badge =
              r.status === "Confirmada"
                ? { c: "green", t: "Confirmada" }
                : r.status === "Pendiente"
                ? { c: "yellow", t: "Pendiente" }
                : r.status === "Cancelada"
                ? { c: "red", t: "Cancelada" }
                : r.status === "Check-in"
                ? { c: "blue", t: "Check-in" }
                : r.status === "Check-out"
                ? { c: "slate", t: "Check-out" }
                : { c: "orange", t: r.status };
            return (
              <tr
                key={r.id}
                className="border-t hover:bg-slate-50 cursor-pointer"
                onClick={() => onRowClick?.(r)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{r.guest.name || "—"}</div>
                  <div className="text-xs text-slate-500">{r.guest.idNumber || r.guest.email || r.guest.phone || ""}</div>
                </td>
                <td className="px-4 py-3">{r.otaId || "—"}</td>
                <td className="px-4 py-3">{r.ratePlan || "—"}</td>
                <td className="px-4 py-3">{first.checkIn || "—"}</td>
                <td className="px-4 py-3">{first.checkOut || "—"}</td>
                <td className="px-4 py-3">{nights}</td>
                <td className="px-4 py-3">{first.type || "—"}</td>
                <td className="px-4 py-3">
                  <Badge color={badge.c}>{badge.t}</Badge>
                </td>
                <td className="px-4 py-3 text-right font-semibold">${formatMoney(total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** --- Toolbar de filtros --- **/
function ReservationFilters({ search, setSearch, status, setStatus, dateFrom, setDateFrom, dateTo, setDateTo, onNew }) {
  return (
    <div className="bg-white rounded shadow p-4 mb-4">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium">Buscar</label>
          <input
            className="mt-1 w-full border rounded p-2"
            placeholder="Nombre del huésped o ID de OTA"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Estado</label>
          <select className="mt-1 border rounded p-2" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Desde</label>
          <input className="mt-1 border rounded p-2" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium">Hasta</label>
          <input className="mt-1 border rounded p-2" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="flex-1" />
        <button onClick={onNew} className="px-4 py-2 rounded bg-blue-600 text-white">+ Nueva reserva</button>
      </div>
    </div>
  );
}

/** --- Drawer de detalle/edición --- **/
function ReservationDrawer({ open, onClose, reservation, onSave, onDeleteRequest, onCancelRequest, onDuplicate, onSendEmail, onSendWA, ratePlans }) {
  const [tab, setTab] = useState("detalle");
  useEffect(() => setTab("detalle"), [reservation?.id]);

  if (!reservation) return null;
  const total = computeReservationTotal(reservation.rooms, reservation.payments || [], MANAGEMENT_FX_RATE);
  const first = reservation.rooms[0] || {};

  return (
    <Drawer open={open} onClose={onClose} title={`Reserva • ${reservation.guest.name || reservation.otaId || reservation.id}`}>
      {/* Acciones rápidas */}
      <div className="flex flex-wrap gap-2 justify-end mb-3">
        <button onClick={() => onSendEmail(reservation)} className="px-3 py-1.5 rounded bg-purple-600 text-white">Enviar Email</button>
        <button onClick={() => onSendWA(reservation)} className="px-3 py-1.5 rounded bg-green-600 text-white">WhatsApp</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mb-4 border-b">
        {[
          { key: "detalle", label: "Detalle" },
          { key: "editar", label: "Editar" },
        ].map((t) => (
          <button
            key={t.key}
            className={`px-3 py-2 -mb-px border-b-2 ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => onDuplicate(reservation)} className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200">Duplicar</button>
        <button onClick={() => onCancelRequest(reservation)} className="px-3 py-1.5 rounded bg-orange-50 text-orange-700 hover:bg-orange-100">Cancelar</button>
        <button onClick={() => onDeleteRequest(reservation)} className="px-3 py-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100">Eliminar</button>
      </div>

      {tab === "detalle" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500">Huésped</div>
              <div className="font-medium">{reservation.guest.name || '—'}</div>
              <div className="text-xs text-slate-500">{reservation.guest.email || reservation.guest.phone || ' '}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Tarifa / ID OTA</div>
              <div className="font-medium">{reservation.ratePlan || '—'} {reservation.otaId ? `• ${reservation.otaId}` : ''}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Estado</div>
              <div className="font-medium">{reservation.status}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Entrada / Noches</div>
              <div className="font-medium">{first.checkIn || '—'} • {reservation.rooms.reduce((acc, rm) => acc + (rm.nights || diffNights(rm.checkIn, rm.checkOut)), 0)}</div>
            </div>
          </div>

          <div className="bg-slate-50 rounded p-3">
            <div className="text-xs text-slate-500 mb-1">Habitaciones</div>
            <ul className="list-disc ml-5 space-y-1">
              {reservation.rooms.map((rm, i) => (
                <li key={i}>
                  {rm.type || '—'} {rm.roomNumber ? `• #${rm.roomNumber}` : ''} • {rm.checkIn} → {rm.checkOut} • {rm.nights || diffNights(rm.checkIn, rm.checkOut)} noche(s)
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-slate-500 text-sm">Creada: {new Date(reservation.createdAt).toLocaleString()}</div>
            <div className="text-lg font-bold">Total: ${formatMoney(total)}</div>
          </div>
        </div>
      ) : (
        <ReservationForm
          value={reservation}
          onChange={() => {}}
          onSubmit={(data) => onSave({ ...data })}
          submitLabel="Guardar cambios"
          ratePlans={ratePlans}
        />
      )}
    </Drawer>
  );
}

/** --- Página principal --- **/
export default function ReservationsPage() {
  const [params] = useSearchParams();
  const q = params.get("q") || ""; // viene del Dashboard

  const ratePlans = useRatePlans();

  // Estado de filtros
  const [search, setSearch] = useState(q);
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Modal/Drawing
  const [showCreate, setShowCreate] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  // Motivos (cancelar / eliminar)
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [showDeleteReason, setShowDeleteReason] = useState(false);

  // Auditoría simple de ejemplo
  const [auditTrail, setAuditTrail] = useState([]); // {id, type, reason, at}

  // Datos de reservas (mock)
  const [reservations, setReservations] = useState(() => {
    const today = new Date();
    const t = (d) => d.toISOString().split("T")[0];
    const d1 = new Date(today); d1.setDate(today.getDate() + 2);
    const d2 = new Date(today); d2.setDate(today.getDate() + 5);
    const d3 = new Date(today); d3.setDate(today.getDate() + 10);
    return [
      {
        id: uid(),
        createdAt: new Date().toISOString(),
        ratePlan: "OTA-Booking",
        otaId: "BKG-948312",
        status: "Confirmada",
        tag: "VIP",
        fxRateCRC: 530,
        guest: { name: "María Rodríguez", idNumber: "1-2345-6789", phone: "+506 8888 8888", email: "maria@mail.com", notes: "Llega tarde", creditCard: "**** 1234" },
        rooms: [
          { type: "Deluxe", roomNumber: "204", adults: 2, children: 0, babies: 0, nights: 3, deposit: 50, checkIn: t(d1), checkOut: t(d2), rateType: "Flexible", pricePerNight: 85 },
        ],
        payments: [{ date: t(new Date()), amount: 50, currency: "USD", method: "Tarjeta", cardLast4: "1234" }],
      },
      {
        id: uid(),
        createdAt: new Date().toISOString(),
        ratePlan: "BAR",
        otaId: "",
        status: "Pendiente",
        fxRateCRC: 530,
        guest: { name: "Juan Pérez", idNumber: "2-1111-2222", phone: "+506 7000 0000", email: "juan@mail.com", notes: "", creditCard: "" },
        rooms: [
          { type: "Standard", roomNumber: "101", adults: 1, children: 0, babies: 0, nights: 1, deposit: 0, checkIn: t(today), checkOut: t(d1), rateType: "Standard", pricePerNight: 50 },
        ],
        payments: [],
      },
      {
        id: uid(),
        createdAt: new Date().toISOString(),
        ratePlan: "OTA-Expedia",
        otaId: "EXP-55221",
        status: "Cancelada",
        fxRateCRC: 530,
        guest: { name: "Laura Gómez", idNumber: "", phone: "", email: "", notes: "", creditCard: "" },
        rooms: [
          { type: "Suite", roomNumber: "302", adults: 2, children: 1, babies: 0, nights: 2, deposit: 0, checkIn: t(d3), checkOut: t(new Date(d3.getTime() + 2*86400000)), rateType: "No reembolsable", pricePerNight: 120 },
        ],
        payments: [],
      },
    ];
  });

  // Formulario para crear nueva
  const emptyReservation = useMemo(
    () => ({
      id: uid(),
      createdAt: new Date().toISOString(),
      ratePlan: "",
      otaId: "",
      status: "Pendiente",
      tag: "",
      fxRateCRC: 530,
      guest: { name: "", idNumber: "", phone: "", email: "", notes: "", creditCard: "" },
      rooms: [
        {
          type: "",
          roomNumber: "",
          adults: 1,
          children: 0,
          babies: 0,
          nights: 1,
          deposit: 0,
          checkIn: "",
          checkOut: "",
          rateType: "",
          pricePerNight: 0,
        },
      ],
      payments: [],
    }),
    []
  );

  const [draftCreate, setDraftCreate] = useState(emptyReservation);

  useEffect(() => {
    // Si el usuario llegó con ?q= desde el dashboard
    if (!q) return;
    setSearch((prev) => (prev ? prev : q));
  }, [q]);

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      const s = (search || "").trim().toLowerCase();
      const byText = s
        ? (r.guest.name || "").toLowerCase().includes(s) || (r.otaId || "").toLowerCase().includes(s)
        : true;
      const byStatus = status ? r.status === status : true;
      const ci = earliestCheckIn(r.rooms || []);
      const byFrom = dateFrom ? (!ci || ci >= dateFrom ? true : ci >= dateFrom) : true; // lógica simple
      const byTo = dateTo ? (!ci || ci <= dateTo ? true : ci <= dateTo) : true;
      return byText && byStatus && byFrom && byTo;
    });
  }, [reservations, search, status, dateFrom, dateTo]);

  const openDrawer = (r) => {
    setSelected(r);
    setDrawerOpen(true);
  };

  const handleSaveEdit = (data) => {
    setReservations((list) => list.map((x) => (x.id === data.id ? { ...x, ...data } : x)));
    setSelected({ ...data });
    alert("Cambios guardados");
  };

  const handleDeleteRequest = () => setShowDeleteReason(true);
  const handleCancelRequest = () => setShowCancelReason(true);

  const applyCancel = (reason) => {
    if (!reason) return;
    setReservations((list) =>
      list.map((x) =>
        x.id === selected.id
          ? { ...x, status: "Cancelada", audit: [...(x.audit || []), { type: "CANCEL", reason, at: new Date().toISOString() }] }
          : x
      )
    );
    setAuditTrail((a) => [...a, { id: selected.id, type: "CANCEL", reason, at: new Date().toISOString() }]);
    setShowCancelReason(false);
  };

  const applyDelete = (reason) => {
    if (!reason) return;
    setAuditTrail((a) => [...a, { id: selected.id, type: "DELETE", reason, at: new Date().toISOString() }]);
    setReservations((list) => list.filter((x) => x.id !== selected.id));
    setDrawerOpen(false);
    setSelected(null);
    setShowDeleteReason(false);
  };

  const handleDuplicate = (r) => {
    const clone = {
      ...r,
      id: uid(),
      createdAt: new Date().toISOString(),
      status: "Pendiente",
      otaId: "",
    };
    setReservations((list) => [clone, ...list]);
    setSelected(clone);
    setDrawerOpen(true);
  };

  const handleCreate = (res) => {
    setReservations((list) => [{ ...res }, ...list]);
    setShowCreate(false);
    setDraftCreate(emptyReservation);
  };

  // --- Confirmaciones ---
  const sendEmail = (r) => {
    if (!r?.guest?.email) {
      alert("No hay correo del huésped");
      return;
    }
    const subject = "Confirmación de Reserva";
    const body = buildConfirmationMessage(r);
    window.location.href = `mailto:${encodeURIComponent(r.guest.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const sendWhatsApp = (r) => {
    if (!r?.guest?.phone) {
      alert("No hay teléfono del huésped");
      return;
    }
    const phone = String(r.guest.phone).replace(/\D/g, "");
    const msg = buildConfirmationMessage(r);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Reservaciones</h1>
        <div className="text-sm text-slate-500">Listado • filtros • CRUD • confirmaciones • pagos avanzados</div>
      </div>

      <ReservationFilters
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        onNew={() => {
          setDraftCreate(emptyReservation);
          setShowCreate(true);
        }}
      />

      <ReservationTable data={filtered} onRowClick={openDrawer} />

      {/* Modal: Nueva reserva */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Crear nueva reserva">
        <ReservationForm value={draftCreate} onChange={setDraftCreate} onSubmit={handleCreate} submitLabel="Crear" ratePlans={ratePlans} />
      </Modal>

      {/* Drawer: Detalle/Editar */}
      <ReservationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        reservation={selected}
        onSave={handleSaveEdit}
        onDeleteRequest={handleDeleteRequest}
        onCancelRequest={handleCancelRequest}
        onDuplicate={handleDuplicate}
        onSendEmail={sendEmail}
        onSendWA={sendWhatsApp}
        ratePlans={ratePlans}
      />

      {/* Motivos */}
      <ReasonModal
        open={showCancelReason}
        onClose={() => setShowCancelReason(false)}
        title="Motivo de cancelación"
        onConfirm={applyCancel}
      />
      <ReasonModal
        open={showDeleteReason}
        onClose={() => setShowDeleteReason(false)}
        title="Motivo de eliminación"
        onConfirm={applyDelete}
      />
    </div>
  );
}
