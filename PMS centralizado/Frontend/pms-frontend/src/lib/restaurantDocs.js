/**
 * Generadores de documentos del restaurante (cierres y tickets).
 *
 * Única fuente de formato para el POS y el histórico. El formateo de moneda
 * se inyecta con `money` para respetar la moneda de cada pantalla.
 */

const W = 42;

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

/** Fecha y hora del ticket: dd-mm-aaaa hh:mm (las barras no se usan en el PMS). */
const stamp = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Fila "Etiqueta     valor" con la etiqueta en una columna fija. */
const metaRow = (label, value, width = 13) => `${String(label).padEnd(width)} ${value}`;

/** Reparte un texto en líneas de `width`, cortando por palabra. */
const wrapText = (text, width) => {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const rows = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
      continue;
    }
    if (current) rows.push(current);
    let rest = word;
    while (rest.length > width) {
      rows.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    current = rest;
  }
  if (current) rows.push(current);
  return rows.length > 0 ? rows : [""];
};

/** Una línea de artículo: cantidad, descripción y importe alineado a la derecha. */
const itemLines = (qty, name, amountText) => {
  const q = String(qty).padStart(3, " ");
  const tail = amountText ? String(amountText) : "";
  const budget = Math.max(8, W - q.length - 1 - (tail ? tail.length + 1 : 0));
  const parts = wrapText(name, budget);
  const first = `${q} ${parts[0]}`;
  const out = [first + " ".repeat(Math.max(1, W - first.length - tail.length)) + tail];
  for (const extra of parts.slice(1)) out.push(`     ${extra}`);
  return out;
};

/** Fila de total: la etiqueta y el importe quedan alineados a la derecha. */
const totalRow = (label, value, labelWidth = 24) => {
  const l = String(label);
  const v = String(value);
  const left = " ".repeat(Math.max(0, labelWidth - l.length)) + l;
  return left + " ".repeat(Math.max(1, W - left.length - v.length)) + v;
};

const DOC_TITLES = {
  FE: "FACTURA ELECTRÓNICA",
  TE: "TIQUETE ELECTRÓNICO",
  COMANDA: "COMANDA",
  CLOSES: "CIERRE DE CAJA",
  DOCUMENT: "DOCUMENTO",
  REPORT: "REPORTE",
};

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
  if (legalId) lines.push(center(`Cédula: ${legalId}`));
  const address = String(restaurant?.direccion || "").trim();
  if (address) lines.push(center(address));
  const phone = String(restaurant?.telefono || "").trim();
  if (phone) lines.push(center(`Tel: ${phone}`));
  const email = String(restaurant?.email || restaurant?.correo || "").trim();
  if (email) lines.push(center(email));
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

  lines.push(sep());
  if (header) {
    lines.push(...header.split("\n").map((l) => l.trimEnd()));
  } else {
    const headerLines = buildRestaurantHeaderLines(restaurant);
    if (headerLines.length > 0) lines.push(...headerLines);
  }
  lines.push(sep());

  const typeKey = String(payload?.type || "").toUpperCase();
  const docTitle = DOC_TITLES[typeKey] || String(title || "DOCUMENTO").toUpperCase();
  lines.push(center(docTitle));
  if (payload?.saleNumber) lines.push(center(`Venta ${String(payload.saleNumber)}`));
  if (payload?.documentNumber) lines.push(center(`N° ${String(payload.documentNumber)}`));
  if (payload?.clave) {
    lines.push(sep2());
    lines.push("Clave numérica:");
    for (const part of wrapText(String(payload.clave), W)) lines.push(part);
  }
  lines.push(sep2());

  const date = payload?.date ? new Date(payload.date) : new Date();
  lines.push(metaRow("Fecha", stamp(date)));
  if (payload?.cashierName) lines.push(metaRow("Cajero", String(payload.cashierName)));
  if (payload?.waiterName) lines.push(metaRow("Mesero", String(payload.waiterName)));
  if (payload?.shiftNumber) lines.push(metaRow("Turno", `#${String(payload.shiftNumber)}`));
  if (payload?.sectionId) lines.push(metaRow("Sección", String(payload.sectionId)));
  if (payload?.tableId) lines.push(metaRow("Mesa", String(payload.tableId)));
  if (payload?.covers != null) lines.push(metaRow("Personas", String(Number(payload.covers) || 0)));
  if (payload?.serviceType) lines.push(metaRow("Servicio", String(payload.serviceType)));
  if (payload?.roomId) lines.push(metaRow("Habitación", String(payload.roomId)));

  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length > 0) {
    lines.push(sep2());
    const amountHead = "IMPORTE";
    lines.push(`${"CANT".padEnd(5)}${"DESCRIPCIÓN".padEnd(W - 5 - amountHead.length)}${amountHead}`);
    lines.push(sep2());
    for (const it of items) {
      const qty = Number(it?.qty ?? it?.quantity ?? 1) || 1;
      const name = String(it?.name || it?.label || it?.title || it?.id || "Item");
      const price = it?.price ?? it?.unitPrice ?? it?.amount;
      const hasPrice = price != null && String(price).trim() !== "";
      const amountText = hasPrice ? money(qty * (Number(price) || 0)) : "";
      lines.push(...itemLines(qty, name, amountText));
      const itemNote = String(it?.note || it?.detailNote || "").trim();
      if (itemNote) for (const part of wrapText(itemNote, W - 6)) lines.push(`     * ${part}`);
    }
    lines.push(sep2());
  }

  const note = String(payload?.note || "").trim();
  if (note) {
    lines.push("Observaciones:");
    for (const part of wrapText(note, W)) lines.push(part);
    lines.push(sep2());
  }

  const t = totals && typeof totals === "object" ? totals : null;
  if (t) {
    const subtotal = t.subtotal ?? t.base;
    const total = t.total ?? t.system ?? t.grandTotal ?? t.totalAmount;
    const tax = t.tax ?? t.iva ?? t.impuesto;
    const service = t.service ?? t.servicio ?? t.tip10;
    if (subtotal != null) lines.push(totalRow("Subtotal", money(subtotal)));
    if (Number(t?.discountTotal) > 0) lines.push(totalRow("Descuento", `-${money(t.discountTotal)}`));
    if (service != null) lines.push(totalRow("Servicio", money(service)));
    if (tax != null) lines.push(totalRow("IVA", money(tax)));
    if (total != null) {
      lines.push(sep2());
      lines.push(totalRow("TOTAL", money(total)));
      lines.push(sep());
    }
  }

  const payMethods = Array.isArray(payload?.paymentMethods) ? payload.paymentMethods : [];
  if (payMethods.length > 0) {
    for (const pm of payMethods) {
      if (pm?.name && Number(pm?.amount) > 0) lines.push(rjust(`${pm.name}:`, money(pm.amount)));
    }
    if (payload?.paid != null) lines.push(rjust("Recibido:", money(payload.paid)));
    if (payload?.change != null) lines.push(rjust("Cambio:", money(payload.change)));
  }

  if (payload?.canceled) {
    lines.push(sep());
    lines.push(center("*** DOCUMENTO ANULADO ***"));
    if (payload?.cancelReason) {
      for (const part of wrapText(`Motivo: ${payload.cancelReason}`, W)) lines.push(part);
    }
    lines.push(sep());
  }

  if (footer) {
    lines.push("");
    for (const part of footer.split("\n")) lines.push(part.trimEnd());
  } else {
    lines.push(sep2());
    lines.push(center("GRACIAS POR SU PREFERENCIA"));
    for (const part of wrapText(
      "Este documento es una representación gráfica del comprobante electrónico autorizado por Hacienda (DGT-R-48-2016).",
      W
    )) {
      lines.push(center(part));
    }
    lines.push(sep2());
  }

  return lines.join("\n");
}
