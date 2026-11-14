/**
 * Identificación del emisor para un comprobante electrónico.
 *
 * El emisor es el hotel (o el restaurante), nunca el cliente: un tiquete
 * electrónico se emite sin datos del comprador. La cédula puede estar cargada
 * en Facturación Electrónica o en la identificación de la empresa del hotel.
 */

/** Descarta marcadores de posición: "000000000", "111111111", textos y largos imposibles. */
export function isRealIdentification(value: unknown): boolean {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 12) return false;
  return !/^(\d)\1+$/.test(digits);
}

/**
 * Devuelve la cédula del emisor (sólo dígitos) priorizando la de Facturación
 * Electrónica y cayendo a la identificación de la empresa del hotel.
 */
export function resolveIssuerIdNumber(settingsId?: string | null, hotelCompanyId?: string | null): string {
  const fromSettings = String(settingsId ?? "").replace(/\D/g, "");
  if (isRealIdentification(fromSettings)) return fromSettings;
  const fromHotel = String(hotelCompanyId ?? "").replace(/\D/g, "");
  if (isRealIdentification(fromHotel)) return fromHotel;
  return "";
}
