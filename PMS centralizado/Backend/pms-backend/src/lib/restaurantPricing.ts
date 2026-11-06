/**
 * Resolución del precio autoritativo de un artículo de restaurante.
 *
 * El POS envía el precio en el body. Este módulo reconstruye, a partir del
 * artículo guardado (precio base, tallas y detalles) y de los overrides de
 * menú, el conjunto de precios válidos para una variante concreta. Así el
 * backend puede rechazar precios inventados sin bloquear variantes legítimas.
 */

import { asNumber as asNumberShared } from "./num.js";

export interface VariantParts {
  sizeKey: string;
  detailKeys: string[];
}

const asNumber = (v: unknown) => asNumberShared(v);

const round2 = (n: number) => Math.round(n * 100) / 100;

export const optionId = (opt: any, index: number): string =>
  String(opt?.id ?? opt?.key ?? opt?.label ?? opt?.name ?? index ?? "");

/**
 * El frontend arma `variantKey` como "size:<id>|detail:<id>|note:<texto>".
 * Las notas no cambian el precio, por eso se ignoran.
 */
export function parseVariantKey(variantKey: unknown): VariantParts {
  const parts = String(variantKey || "")
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  let sizeKey = "";
  const detailKeys: string[] = [];
  for (const part of parts) {
    if (part.startsWith("size:")) sizeKey = part.slice("size:".length);
    else if (part.startsWith("detail:")) detailKeys.push(part.slice("detail:".length));
  }
  return { sizeKey, detailKeys };
}

export interface ResolvePriceInput {
  basePrice: number;
  sizes?: unknown;
  details?: unknown;
  /** Precios alternativos del artículo en menús activos (override por menú). */
  menuOverrides?: Array<number | string | null | undefined>;
  variantKey?: unknown;
}

export interface ResolvePriceResult {
  /** Precios admitidos para la variante, redondeados a 2 decimales. */
  prices: number[];
  /** false cuando la variante no se pudo interpretar (no se puede verificar). */
  verified: boolean;
}

export function resolveAllowedUnitPrices(input: ResolvePriceInput): ResolvePriceResult {
  const sizes = Array.isArray(input.sizes) ? input.sizes : [];
  const details = Array.isArray(input.details) ? input.details : [];
  const { sizeKey, detailKeys } = parseVariantKey(input.variantKey);

  let verified = true;
  let extras = 0;

  for (const key of detailKeys) {
    const idx = details.findIndex((d, i) => optionId(d, i) === key);
    if (idx < 0) {
      verified = false;
      continue;
    }
    const detail = details[idx] as any;
    extras += asNumber(detail?.priceDelta ?? detail?.price);
  }

  const bases: number[] = [];

  if (sizeKey) {
    const idx = sizes.findIndex((s, i) => optionId(s, i) === sizeKey);
    if (idx < 0) {
      verified = false;
    } else {
      bases.push(asNumber((sizes[idx] as any)?.price ?? input.basePrice));
    }
  } else if (sizes.length > 0) {
    // Sin tamaño explícito: cualquiera de las tallas es un precio legítimo.
    for (const size of sizes) {
      bases.push(asNumber((size as any)?.price ?? input.basePrice));
    }
  } else {
    bases.push(asNumber(input.basePrice));
  }

  // El override de menú sólo reemplaza el precio base; con tallas manda la talla.
  if (!sizeKey) {
    for (const override of input.menuOverrides || []) {
      if (override === null || override === undefined || override === "") continue;
      bases.push(asNumber(override));
    }
  }

  return { prices: Array.from(new Set(bases.map((b) => round2(b + extras)))), verified };
}

export function isPriceAllowed(clientPrice: number, result: ResolvePriceResult): boolean {
  if (!result.verified) return true;
  const target = round2(asNumber(clientPrice));
  return result.prices.some((p) => Math.abs(p - target) <= 0.01);
}
