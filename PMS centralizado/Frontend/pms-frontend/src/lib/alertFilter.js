// Filtro de la campana de notificaciones. Hoy es un parche en el navegador: deja
// pasar sólo unos pocos avisos y descarta el resto por coincidencia de texto.
// El plan para convertir la campana en notificaciones persistentes (tabla,
// endpoint y badge por usuario) está anotado en ManagementPage.jsx, sobre el
// useEffect de `pms:push-alert`; cuando eso exista, este archivo sobra.
const ALLOWED_KINDS = new Set([
  "reservation.channel_manager",
  "einvoice.error",
]);

const CM_REGEX = /(channel manager|channel|ota|booking|expedia|airbnb)/i;
const RESV_REGEX = /(reservation|reserva|check-?in|check-?out)/i;
const EINVOICE_REGEX = /(electronic invoicing|e-?invoicing|factura electr[oó]nica|tiquete electr[oó]nico)/i;
const ERROR_REGEX = /(error|failed|missing|invalid|required|rejected|no se pudo|faltan|falta)/i;

export function isAllowedAlert(detail) {
  if (!detail) return false;
  const kind = String(detail.kind || "").trim();
  if (kind && ALLOWED_KINDS.has(kind)) return true;

  const title = String(detail.title || "");
  const desc = String(detail.desc || "");
  const hay = `${title} ${desc}`.trim();
  if (!hay) return false;

  if (CM_REGEX.test(hay) && RESV_REGEX.test(hay)) return true;
  if (EINVOICE_REGEX.test(hay) && ERROR_REGEX.test(hay)) return true;
  return false;
}

export function filterAllowedAlerts(list) {
  const arr = Array.isArray(list) ? list : [];
  return arr.filter(isAllowedAlert);
}
