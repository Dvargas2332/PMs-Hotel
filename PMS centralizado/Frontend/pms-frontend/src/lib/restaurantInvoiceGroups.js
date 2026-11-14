/**
 * Agrupaciones del reporte de facturas del restaurante.
 *
 * El detalle es una fila por comprobante; los otros modos resumen las mismas
 * filas ya filtradas por el servidor. Se separa del componente para poder
 * probarlo sin montar la pantalla.
 */

export const INVOICE_REPORT_MODES = [
  "Detallado",
  "Detallado por Familias",
  "Resumido",
  "Agrupado por Meseros",
  "Agrupado por Monedas",
];

/**
 * @param {Array} rows filas de /restaurant/history/invoices
 * @param {string} mode uno de INVOICE_REPORT_MODES
 * @param {(id: string) => string} nameOf resuelve el nombre del mesero/cajero
 * @returns {Array<{key: string, label: string, count: number, qty: number, amount: number}>}
 */
export function computeInvoiceGroups(rows, mode, nameOf = (id) => String(id || "")) {
  if (!Array.isArray(rows) || !rows.length) return [];
  if (mode === "Detallado") return [];

  const map = new Map();
  const add = (key, label, amount, qty = 1) => {
    const cur = map.get(key) || { key, label, count: 0, qty: 0, amount: 0 };
    cur.count += 1;
    cur.qty += qty;
    cur.amount += Number(amount) || 0;
    map.set(key, cur);
  };

  for (const row of rows) {
    const total = Number(row?.order?.total) || 0;

    if (mode === "Resumido") {
      const docType = String(row?.docType || "-").toUpperCase();
      add(`d:${docType}`, docType, total, 1);
    } else if (mode === "Detallado por Familias") {
      const lineItems = Array.isArray(row?.order?.items) ? row.order.items : [];
      if (!lineItems.length) {
        add("f:sin", "Sin familia", total, 1);
        continue;
      }
      for (const it of lineItems) {
        const family = String(it?.category || "").trim() || "Sin familia";
        const qty = Number(it?.qty) || 0;
        add(`f:${family}`, family, (Number(it?.price) || 0) * qty, qty);
      }
    } else if (mode === "Agrupado por Meseros") {
      const waiterId = String(row?.order?.waiterId || "");
      if (waiterId) {
        add(`w:${waiterId}`, nameOf(waiterId), total, 1);
      } else {
        const cashier = nameOf(row?.order?.cashierId);
        add("w:sin", cashier && cashier !== "-" ? `Sin mesero (cobró ${cashier})` : "Sin mesero", total, 1);
      }
    } else if (mode === "Agrupado por Monedas") {
      const used = Array.isArray(row?.order?.paymentCurrencies) ? row.order.paymentCurrencies : [];
      const currency = String(used[0] || row?.order?.currency || row?.currency || "-").toUpperCase();
      add(`c:${currency}`, currency, total, 1);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

/** Totales de una agrupación (los registros de familias se cuentan por línea). */
export function sumInvoiceGroups(groups) {
  return (Array.isArray(groups) ? groups : []).reduce(
    (acc, g) => ({ count: acc.count + (g?.count || 0), amount: acc.amount + (g?.amount || 0) }),
    { count: 0, amount: 0 }
  );
}
