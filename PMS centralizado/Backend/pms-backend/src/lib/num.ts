/**
 * Conversión numérica tolerante.
 *
 * Prisma devuelve los campos `Decimal` como objetos (decimal.js), no como
 * number. Comparar `typeof v === "number"` y descartar el resto convertía en 0
 * cualquier total guardado (arqueos, cierres, estadísticas e importes del XML).
 */
export function asNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "boolean") return value ? 1 : 0;

  const candidate = value as { toNumber?: () => number; valueOf?: () => unknown };
  if (typeof candidate.toNumber === "function") {
    const n = Number(candidate.toNumber());
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof candidate.valueOf === "function") {
    const raw = candidate.valueOf();
    if (raw !== value) {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
  }
  return 0;
}

/** Igual que asNumber pero redondeado a dos decimales (montos). */
export function asMoney(value: unknown): number {
  return Math.round(asNumber(value) * 100) / 100;
}
