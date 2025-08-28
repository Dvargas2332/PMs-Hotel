import React, { useMemo, useCallback, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import resourceTimelinePlugin from "@fullcalendar/resource-timeline";
import { useHotelData } from "../context/HotelDataContext";

// --- Util: YYYY-MM-DD local (sin timezone UTC shift)
function ymdLocal(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Planning() {
  const { settings, rooms, reservations } = useHotelData();
  const { checkIn, checkOut, timeZone } = settings;

  const resources = useMemo(
    () => (rooms || []).map((r) => ({ id: String(r.id), title: r.title ?? String(r.id) })),
    [rooms]
  );

  const events = useMemo(
    () =>
      (reservations || []).map((r) => ({
        id: String(r.id),
        resourceId: String(r.roomId),
        title: r.guestName,
        start: `${r.checkInDate}T${checkIn}`,
        end: `${r.checkOutDate}T${checkOut}`, // end exclusivo → turnover OK
        extendedProps: {
          roomId: String(r.roomId),
          checkInDate: r.checkInDate,
          checkOutDate: r.checkOutDate,
          guestName: r.guestName,
        },
      })),
    [reservations, checkIn, checkOut]
  );

  // Colores “orejas”
  const CI = "#10b981"; // verde check-in
  const MID = "#3f3f46"; // gris oscuro cuerpo
  const CO = "#f59e0b"; // naranja check-out

  const eventContent = useCallback((arg) => {
    const el = document.createElement("div");
    el.className =
      "px-3 py-1 rounded-full text-xs font-medium text-white border border-white/10 shadow-sm";
    el.style.whiteSpace = "nowrap";
    el.style.overflow = "hidden";
    el.style.textOverflow = "ellipsis";
    // Orejas de color (12px a cada lado)
    el.style.background = `linear-gradient(to right, ${CI} 0 12px, ${MID} 12px calc(100% - 12px), ${CO} calc(100% - 12px))`;
    el.textContent = arg.event.title || "";
    return { domNodes: [el] };
  }, []);

  // ---- Modales simples ----
  const [active, setActive] = useState(null);
  // active = { type: 'checkin'|'checkout', data: {...} }

  const closeModal = () => setActive(null);

  // Determina fase de la reserva respecto a HOY
  const getPhase = (evt) => {
    const todayStr = ymdLocal(new Date());
    const startStr = ymdLocal(new Date(evt.start));
    const endStr = ymdLocal(new Date(evt.end));
    // Si hoy es exactamente el día de check-in
    if (todayStr === startStr) return "checkin";
    // Si hoy es exactamente el día de check-out (independiente de la hora)
    if (todayStr === endStr) return "checkout";
    // In-house si hoy está entre start (incl.) y end (excl.) por fecha
    if (todayStr > startStr && todayStr < endStr) return "inhouse";
    // Futuras o pasadas
    return todayStr < startStr ? "upcoming" : "past";
  };

  const onEventClick = useCallback((clickInfo) => {
    const phase = getPhase(clickInfo.event);
    const { guestName, roomId, checkInDate, checkOutDate } = clickInfo.event.extendedProps;

    if (phase === "checkin") {
      setActive({
        type: "checkin",
        data: { id: clickInfo.event.id, guestName, roomId, checkInDate, checkOutDate },
      });
    } else if (phase === "inhouse" || phase === "checkout") {
      setActive({
        type: "checkout",
        data: { id: clickInfo.event.id, guestName, roomId, checkInDate, checkOutDate },
      });
    } else {
      // No hacer nada para futuras/pasadas (o podrías abrir detalle)
    }
  }, []);

  return (
    <div className="p-4">
      <FullCalendar
        plugins={[resourceTimelinePlugin]}
        timeZone={timeZone}
        initialView="resourceTimeline15d"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "resourceTimeline7d,resourceTimeline15d,resourceTimeline30d",
        }}
        views={{
          resourceTimeline7d: { type: "resourceTimeline", duration: { days: 7 }, buttonText: "7 días" },
          resourceTimeline15d: { type: "resourceTimeline", duration: { days: 15 }, buttonText: "15 días" },
          resourceTimeline30d: { type: "resourceTimeline", duration: { days: 30 }, buttonText: "30 días" },
        }}
        // 1 columna por día (sin horas)
        slotDuration={{ days: 1 }}
        slotLabelInterval={{ days: 1 }}
        slotLabelFormat={{ day: "2-digit", month: "short" }}

        resourceAreaHeaderContent="Hab."
        resourceAreaWidth="120px"
        stickyHeaderDates
        expandRows
        height="auto"

        resources={resources}
        events={events}

        // 👉 Un solo carril por recurso (misma línea siempre)
        eventMaxStack={1}
        // importante: NO apiles múltiples filas
        // (mientras no se solapen en tiempo, quedarán en la misma línea)

        editable={false}
        eventContent={eventContent}
        moreLinkContent={() => ""}

        // 👇 Click en evento → abrir Check-in/Checkout
        eventClick={onEventClick}
      />

      {/* ---------- MODALES ---------- */}
      {active?.type === "checkin" && (
        <Modal onClose={closeModal} title="Realizar Check-in">
          <div className="space-y-3">
            <Row label="Huésped" value={active.data.guestName} />
            <Row label="Habitación" value={active.data.roomId} />
            <Row label="Estadía" value={`${active.data.checkInDate} → ${active.data.checkOutDate}`} />
            <div className="text-sm text-gray-500">
              Confirma documentos, firma y método de pago de garantía.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="px-3 py-2 rounded bg-gray-100" onClick={closeModal}>
                Cancelar
              </button>
              <button
                className="px-3 py-2 rounded bg-emerald-600 text-white"
                onClick={() => {
                  // TODO: aquí disparas tu acción real de check-in (API/Context)
                  // e.g. checkInReservation(active.data.id)
                  alert("Check-in realizado ✔");
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
              {/* Aquí integrarías cargos reales. Por ahora, placeholder. */}
              <div className="text-sm text-gray-600">Resumen de cargos</div>
              <ul className="mt-2 text-sm text-gray-700 list-disc ml-5">
                <li>Estadía (noches): —</li>
                <li>Impuestos / fees: —</li>
                <li>Consumos: —</li>
                <li>Pagos / Depósitos: —</li>
              </ul>
              <div className="mt-2 font-semibold">Total a pagar: —</div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="px-3 py-2 rounded bg-gray-100" onClick={closeModal}>
                Cancelar
              </button>
              <button
                className="px-3 py-2 rounded bg-indigo-600 text-white"
                onClick={() => {
                  // TODO: aquí disparas tu acción real de checkout / facturación
                  // e.g. openInvoice(active.data.id) o crear factura en backend
                  alert("Factura generada y Checkout realizado ✔");
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

/* ------- helpers UI locales ------- */
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-start justify-center p-4 sm:p-8">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button onClick={onClose} className="px-3 py-1 rounded hover:bg-gray-100">
              ✕
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
      <span className="text-gray-900 font-medium">{value || "—"}</span>
    </div>
  );
}
