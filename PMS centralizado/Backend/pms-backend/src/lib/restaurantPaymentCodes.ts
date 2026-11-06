// src/lib/restaurantPaymentCodes.ts
// Traducción de los medios de cobro del POS a los códigos de Hacienda CR
// (Anexo de medios de pago: 01 efectivo, 02 tarjeta, 03 cheque, 04 transferencia,
//  05 recaudado por terceros, 06 SINPE Móvil, 07 plataformas digitales, 99 otros).

const CODE_BY_KEY: Record<string, string> = {
  cash: "01",
  efectivo: "01",
  contado: "01",
  caja: "01",
  card: "02",
  tarjeta: "02",
  tarjetacredito: "02",
  tarjetadecredito: "02",
  tarjetadebito: "02",
  tarjetadedebito: "02",
  debito: "02",
  credito: "02",
  check: "03",
  cheque: "03",
  transfer: "04",
  transferencia: "04",
  banktransfer: "04",
  sinpe: "06",
  sinpemovil: "06",
  plataforma: "07",
  plataformadigital: "07",
  platform: "07",
  other: "99",
  otro: "99",
  otros: "99",
};

export const HACIENDA_PAYMENT_CODES = new Set(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "99"]);

/** Normaliza "SINPE Móvil" / "sinpe_movil" / "Tarjeta" a la clave interna sin acentos ni signos. */
export function normalizePaymentKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
}

/**
 * Código de Hacienda para un medio de cobro.
 * Prioridad: código explícito del método (si es válido) → clave interna → nombre → 99.
 */
export function resolveHaciendaPaymentCode(input: {
  key?: unknown;
  name?: unknown;
  explicitCode?: unknown;
}) {
  const explicit = String(input.explicitCode ?? "").trim();
  if (explicit && HACIENDA_PAYMENT_CODES.has(explicit.padStart(2, "0"))) {
    return explicit.padStart(2, "0");
  }
  for (const candidate of [input.key, input.name]) {
    const normalized = normalizePaymentKey(candidate);
    if (!normalized) continue;
    if (CODE_BY_KEY[normalized]) return CODE_BY_KEY[normalized];
    // El propio POS puede guardar el código como clave ("01", "02"...).
    if (/^\d{1,2}$/.test(normalized) && HACIENDA_PAYMENT_CODES.has(normalized.padStart(2, "0"))) {
      return normalized.padStart(2, "0");
    }
  }
  return "99";
}

/** ¿Este medio entra a la caja física? Solo el efectivo (código 01). */
export function isCashPaymentMethod(input: { key?: unknown; name?: unknown }) {
  return resolveHaciendaPaymentCode(input) === "01";
}
