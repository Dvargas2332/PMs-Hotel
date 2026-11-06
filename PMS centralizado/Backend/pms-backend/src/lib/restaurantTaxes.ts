/**
 * Cálculo puro de totales para órdenes de restaurante.
 *
 * Soporta impuestos por artículo (RestaurantItemTax → Tax) con fallback a las
 * tasas globales de RestaurantConfig.taxes.
 */

import { asNumber as asNumberShared } from "./num.js";

export type TaxKind = "IVA" | "SERVICE" | "OTHER";
export interface TaxInput {
  percent: number; // 13 para 13%
  kind?: TaxKind | string;
}

export interface OrderItemInput {
  price: number;
  qty: number;
  discountPercent?: number;
  priceIncludesTaxesAndService?: boolean;
  taxes?: TaxInput[] | null;
}

export interface GlobalTaxConfig {
  iva?: number;      // porcentaje global, ej. 13
  servicio?: number; // porcentaje global, ej. 10
}

export interface OrderTotalsResult {
  subtotal: number;
  service: number;
  tax: number;
  total: number;
  discountItems: number;
  discountOrder: number;
  discountAmount: number;
}

function clampPercent(v: unknown) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function asNumber(v: unknown): number {
  return asNumberShared(v);
}

function resolveItemTaxes(item: OrderItemInput, globals: GlobalTaxConfig): TaxInput[] {
  if (Array.isArray(item.taxes) && item.taxes.length > 0) {
    return item.taxes;
  }
  const taxes: TaxInput[] = [];
  const iva = asNumber(globals.iva);
  const servicio = asNumber(globals.servicio);
  if (iva > 0) taxes.push({ percent: iva, kind: "IVA" });
  if (servicio > 0) taxes.push({ percent: servicio, kind: "SERVICE" });
  return taxes;
}

function ratesByKind(taxes: TaxInput[]): { serviceRate: number; taxRate: number } {
  let serviceRate = 0;
  let taxRate = 0;
  for (const t of taxes) {
    const rate = asNumber(t.percent) / 100;
    const kind = String(t.kind || "OTHER").toUpperCase();
    if (kind === "SERVICE") {
      serviceRate += rate;
    } else {
      // IVA y cualquier otro impuesto se acumulan en tax
      taxRate += rate;
    }
  }
  return { serviceRate, taxRate };
}

export function calculateOrderTotals(
  items: OrderItemInput[],
  globals: GlobalTaxConfig,
  orderDiscountPercent?: number
): OrderTotalsResult {
  let subtotal = 0;
  let service = 0;
  let tax = 0;
  let total = 0;
  let discountItems = 0;

  for (const item of items) {
    const qty = asNumber(item.qty);
    const price = asNumber(item.price);
    const itemDiscountRate = clampPercent(item.discountPercent) / 100;
    const gross = price * qty;
    const discountedGross = gross * (1 - itemDiscountRate);
    discountItems += gross - discountedGross;

    const taxes = resolveItemTaxes(item, globals);
    const { serviceRate, taxRate } = ratesByKind(taxes);
    const totalTaxRate = serviceRate + taxRate;

    const includes = item.priceIncludesTaxesAndService !== false;
    if (includes) {
      const denom = 1 + totalTaxRate;
      const net = denom > 0 ? discountedGross / denom : discountedGross;
      subtotal += net;
      service += net * serviceRate;
      tax += net * taxRate;
      total += discountedGross;
    } else {
      const net = discountedGross;
      subtotal += net;
      service += net * serviceRate;
      tax += net * taxRate;
      total += net + net * serviceRate + net * taxRate;
    }
  }

  const normalizedOrderDiscount = clampPercent(orderDiscountPercent);
  const orderDiscountRate = normalizedOrderDiscount / 100;
  const preTotal = total;
  const orderDiscountAmount = preTotal * orderDiscountRate;
  const factor = preTotal > 0 ? (preTotal - orderDiscountAmount) / preTotal : 1;

  return {
    subtotal: round2(subtotal * factor),
    service: round2(service * factor),
    tax: round2(tax * factor),
    total: round2(preTotal * factor),
    discountItems: round2(discountItems),
    discountOrder: round2(orderDiscountAmount),
    discountAmount: round2(orderDiscountAmount + discountItems),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
