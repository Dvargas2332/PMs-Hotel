/**
 * Reparto del cobro del POS.
 *
 * El cajero escribe lo que el cliente le entrega ("recibido"). Cuando entrega más
 * que el total, la diferencia es el vuelto, y el vuelto sólo puede salir del
 * efectivo: las tarjetas, SINPE y transferencias se cobran exactas. Por eso el
 * excedente se descuenta del efectivo antes de mandar los pagos, que el servidor
 * exige que sumen exactamente el total (tolerancia 1).
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * @param {Object} params
 * @param {Record<string, number>} params.amounts Montos recibidos por forma de pago, en moneda base.
 * @param {number} params.total Total de la venta en moneda base.
 * @param {string|null} params.cashKey Clave de la forma de pago en efectivo (null si no hay).
 */
export function computePaymentSplit({ amounts = {}, total = 0, cashKey = null } = {}) {
  const received = round2(Object.values(amounts).reduce((sum, v) => sum + (Number(v) || 0), 0));
  const saleTotal = round2(total);
  const change = Math.max(0, round2(received - saleTotal));

  const applied = { ...amounts };
  if (change > 0 && cashKey && applied[cashKey] != null) {
    const net = round2(Number(applied[cashKey]) - change);
    applied[cashKey] = net > 0 ? net : 0;
  }

  const appliedTotal = round2(Object.values(applied).reduce((sum, v) => sum + (Number(v) || 0), 0));
  const missing = round2(saleTotal - appliedTotal);
  // El cobro cuadra cuando lo aplicado es el total: con vuelto si el efectivo lo
  // cubre, o exacto cuando el cliente entrega justo.
  const square = Math.abs(appliedTotal - saleTotal) <= 1;

  return { received, change, applied, appliedTotal, missing, square };
}
