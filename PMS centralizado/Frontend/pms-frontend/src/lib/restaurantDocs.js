/**
 * Generadores de documentos del restaurante (cierres y tickets).
 *
 * Única fuente de formato para el POS y el histórico. El formateo de moneda
 * se inyecta con `money` para respetar la moneda de cada pantalla.
 */

const W = 40;

const defaultMoney = (n) => (Number(n) || 0).toFixed(2);

const center = (s) => {
  const str = String(s || "");
  const pad = Math.max(0, Math.floor((W - str.length) / 2));
  return " ".repeat(pad) + str;
};

const rjust = (label, value) => {
  const l = String(label);
  const v = String(value);
  return l + " ".repeat(Math.max(1, W - l.length - v.length)) + v;
};

const sep = () => "=".repeat(W);
const sep2 = () => "-".repeat(W);

/**
 * Encabezado con los datos del restaurante (Management → Configuraciones → General).
 * Se usa cuando la plantilla de facturación no define un encabezado propio.
 */
export function buildRestaurantHeaderLines(restaurant) {
  const lines = [];
  const tradeName = String(restaurant?.nombreComercial || "").trim();
  const legalName = String(restaurant?.razonSocial || "").trim();
  const name = tradeName || legalName;
  if (name) lines.push(center(name));
  if (legalName && legalName !== name) lines.push(center(legalName));
  const legalId = String(restaurant?.cedula || "").trim();
  if (legalId) lines.push(center(`Cedula: ${legalId}`));
  const phone = String(restaurant?.telefono || "").trim();
  if (phone) lines.push(center(`Tel: ${phone}`));
  const address = String(restaurant?.direccion || "").trim();
  if (address) lines.push(center(address));
  return lines;
}

export function buildCloseReportText({
  stage,
  shiftNumber,
  hotelName,
  restaurant,
  openedAt,
  closedAt,
  openingAmount,
  systemTotal,
  byMethod,
  declared,
  diff,
  salesCount,
  note,
  staffName,
  reprint = false,
}) {
  const lines = [];
  lines.push(sep());
  const headerLines = buildRestaurantHeaderLines(restaurant);
  if (headerLines.length > 0) lines.push(...headerLines);
  else if (hotelName) lines.push(center(hotelName));
  const stageLabel = `CIERRE ${String(stage || "Z").toUpperCase()} DE CAJA`;
  lines.push(center(reprint ? `REIMPRESION ${stageLabel}` : stageLabel));
  lines.push(sep());
  if (shiftNumber) lines.push(`Turno:    #${shiftNumber}`);
  lines.push(`Apertura: ${openedAt ? new Date(openedAt).toLocaleString() : "-"}`);
  lines.push(`Cierre:   ${closedAt ? new Date(closedAt).toLocaleString() : new Date().toLocaleString()}`);
  if (staffName) lines.push(`Cajero:   ${staffName}`);
  lines.push(sep2());
  lines.push(center("VENTAS POR METODO (SISTEMA)"));
  lines.push(sep2());
  const methods = byMethod && typeof byMethod === "object" ? Object.entries(byMethod).filter(([, v]) => Number(v) > 0) : [];
  for (const [key, amt] of methods) lines.push(rjust(`  ${key}:`, defaultMoney(amt)));
  lines.push(sep2());
  lines.push(rjust("TOTAL SISTEMA:", defaultMoney(systemTotal)));
  lines.push(`Transacciones: ${salesCount || 0}`);
  if (declared && typeof declared === "object") {
    const entries = Object.entries(declared).filter(([k, v]) => k && k !== "notes" && Number(v) > 0);
    if (entries.length > 0) {
      lines.push(sep2());
      lines.push(center("CONTEO FISICO DECLARADO"));
      lines.push(sep2());
      let declTotal = 0;
      for (const [key, val] of entries) {
        const a = Number(val) || 0;
        declTotal += a;
        lines.push(rjust(`  ${key}:`, defaultMoney(a)));
      }
      lines.push(sep2());
      lines.push(rjust("TOTAL DECLARADO:", defaultMoney(declTotal)));
      lines.push(rjust("DIFERENCIA:", defaultMoney(diff)));
    }
  }
  if (Number(openingAmount) > 0) {
    lines.push(sep2());
    lines.push(rjust("Fondo apertura:", defaultMoney(openingAmount)));
  }
  if (note) {
    lines.push(sep2());
    lines.push("Notas:");
    lines.push(String(note));
  }
  lines.push(sep());
  lines.push("");
  lines.push("Firma: ________________________");
  lines.push(sep());
  return lines.join("\n");
}

/**
 * Ticket/comanda/factura. `payload` acepta los campos del POS y del histórico:
 * saleNumber/documentNumber, type, cashierName/waiterName, sección, mesa,
 * personas, servicio, habitación, items, note, paymentMethods, canceled.
 */
export function buildPrintPreviewText({ title, payload, totals, money = defaultMoney, restaurant }) {
  const lines = [];
  const header = String(payload?.__printHeader || "").trim();
  const footer = String(payload?.__printFooter || "").trim();

  if (header) {
    lines.push(header);
    lines.push("");
  } else {
    const headerLines = buildRestaurantHeaderLines(restaurant);
    if (headerLines.length > 0) {
      lines.push(...headerLines);
      lines.push(sep2());
    }
  }

  lines.push(String(title || "IMPRIMIR").toUpperCase());
  const date = payload?.date ? new Date(payload.date) : new Date();
  lines.push(`Fecha:    ${date.toLocaleString()}`);
  if (payload?.saleNumber) lines.push(`Venta #:  ${String(payload.saleNumber)}`);
  if (payload?.documentNumber) lines.push(`N° Documento: ${String(payload.documentNumber)}`);
  if (payload?.shiftNumber) lines.push(`Turno:    #${String(payload.shiftNumber)}`);
  if (payload?.type) lines.push(`Tipo:     ${String(payload.type)}`);
  if (payload?.cashierName) lines.push(`Cajero:   ${String(payload.cashierName)}`);
  if (payload?.waiterName) lines.push(`Mesero:   ${String(payload.waiterName)}`);
  if (payload?.sectionId) lines.push(`Sección:  ${String(payload.sectionId)}`);
  if (payload?.tableId) lines.push(`Mesa:     ${String(payload.tableId)}`);
  if (payload?.covers != null) lines.push(`Personas: ${Number(payload.covers) || 0}`);
  if (payload?.serviceType) lines.push(`Servicio: ${String(payload.serviceType)}`);
  if (payload?.roomId) lines.push(`Habitac.: ${String(payload.roomId)}`);
  lines.push(sep2());

  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length > 0) {
    for (const it of items) {
      const qty = Math.trunc(Number(it?.qty ?? it?.quantity ?? 1)) || 1;
      const name = String(it?.name || it?.label || it?.title || it?.id || "Item");
      const price = it?.price ?? it?.unitPrice ?? it?.amount;
      const hasPrice = price != null && String(price).trim() !== "";
      if (hasPrice) lines.push(rjust(`  ${qty} x ${name}`, money(qty * (Number(price) || 0))));
      else lines.push(`  ${qty} x ${name}`);
      const note = String(it?.note || it?.detailNote || "").trim();
      if (note) lines.push(`    * ${note}`);
    }
    lines.push(sep2());
  }

  const note = String(payload?.note || "").trim();
  if (note) {
    lines.push(`Nota: ${note}`);
    lines.push("");
  }

  const t = totals && typeof totals === "object" ? totals : null;
  if (t) {
    const subtotal = t.subtotal ?? t.base;
    const total = t.total ?? t.system ?? t.grandTotal ?? t.totalAmount;
    const tax = t.tax ?? t.iva ?? t.impuesto;
    const service = t.service ?? t.servicio ?? t.tip10;
    if (subtotal != null) lines.push(rjust("Subtotal:", money(subtotal)));
    if (Number(t?.discountTotal) > 0) lines.push(rjust("Descuento:", `- ${money(t.discountTotal)}`));
    if (service != null) lines.push(rjust("Servicio (10%):", money(service)));
    if (tax != null) lines.push(rjust("Impuesto (IVA):", money(tax)));
    if (total != null) lines.push(rjust("TOTAL:", money(total)));
  }

  const payMethods = Array.isArray(payload?.paymentMethods) ? payload.paymentMethods : [];
  if (payMethods.length > 0) {
    lines.push(sep2());
    for (const pm of payMethods) {
      if (pm?.name && Number(pm?.amount) > 0) lines.push(rjust(`  ${pm.name}:`, money(pm.amount)));
    }
    if (payload?.paid != null) lines.push(rjust("  Recibido:", money(payload.paid)));
    if (payload?.change != null && Number(payload.change) > 0) lines.push(rjust("  Cambio:", money(payload.change)));
  }

  if (payload?.canceled) {
    lines.push(sep2());
    lines.push(center("*** DOCUMENTO ANULADO ***"));
    if (payload?.cancelReason) lines.push(`Motivo: ${payload.cancelReason}`);
  }

  if (footer) {
    lines.push("");
    lines.push(footer);
  }

  return lines.join("\n");
}
