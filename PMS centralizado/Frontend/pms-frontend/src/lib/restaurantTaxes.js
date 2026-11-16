/**
 * Cálculo puro de totales para órdenes de restaurante (frontend).
 *
 * Soporta impuestos por artículo (RestaurantItemTax → Tax) con fallback a las
 * tasas globales de RestaurantConfig.taxes.
 */

function clampPercent(v) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function asNumber(v) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

function resolveItemTaxes(item, globals) {
  if (Array.isArray(item.taxes) && item.taxes.length > 0) {
    return item.taxes;
  }
  const taxes = [];
  const iva = asNumber(globals.iva);
  const servicio = asNumber(globals.servicio);
  if (iva > 0) taxes.push({ percent: iva, kind: "IVA" });
  if (servicio > 0) taxes.push({ percent: servicio, kind: "SERVICE" });
  return taxes;
}

function ratesByKind(taxes) {
  let serviceRate = 0;
  let taxRate = 0;
  for (const t of taxes) {
    const rate = asNumber(t.percent) / 100;
    const kind = String(t.kind || "OTHER").toUpperCase();
    if (kind === "SERVICE") {
      serviceRate += rate;
    } else {
      taxRate += rate;
    }
  }
  return { serviceRate, taxRate };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * @param {Array<{ price: number, qty: number, discountPercent?: number, priceIncludesTaxesAndService?: boolean, taxes?: Array<{ percent: number, kind?: string }> }>} items
 * @param {{ iva?: number, servicio?: number }} globals
 * @param {number} [orderDiscountPercent]
 * @returns {{ subtotal: number, service: number, tax: number, total: number, discountItems: number, discountOrder: number, discountAmount: number }}
 */
export function calculateOrderTotals(items, globals, orderDiscountPercent) {
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

/**
 * Importes ANTES del descuento para mostrar en pantalla y en el comprobante.
 *
 * `calculateOrderTotals` devuelve el subtotal, el servicio y el IVA ya rebajados,
 * así que imprimir además la línea de descuento hacía que la cuenta no cuadrara
 * (subtotal - descuento + servicio + IVA daba menos que el total). Aquí se
 * devuelven los tres conceptos antes del descuento y el descuento completo, de
 * modo que subtotal + servicio + IVA - descuento = total, tal como lo lee el
 * cliente en el papel.
 */
export function beforeDiscountTotals(totals) {
  const total = round2(asNumber(totals?.total));
  const discount = round2(asNumber(totals?.discountTotal ?? totals?.discountAmount ?? totals?.discount));
  const subtotal = round2(asNumber(totals?.subtotal));
  const service = round2(asNumber(totals?.service ?? totals?.servicio ?? totals?.tip10));
  const tax = round2(asNumber(totals?.tax ?? totals?.iva ?? totals?.impuesto));

  if (!(discount > 0) || !(total > 0)) {
    return { subtotal, service, tax, discount: 0, total };
  }

  const gross = round2(total + discount);
  const ratio = gross / total;
  const grossSubtotal = round2(subtotal * ratio);
  const grossService = round2(service * ratio);
  // El IVA absorbe el redondeo para que la suma de los tres conceptos sea exacta.
  const grossTax = round2(gross - grossSubtotal - grossService);
  return { subtotal: grossSubtotal, service: grossService, tax: grossTax, discount, total };
}
