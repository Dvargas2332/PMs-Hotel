/**
 * Representación gráfica de comprobantes electrónicos CR v4.4
 * Hacienda exige que todo comprobante electrónico tenga una representación gráfica
 * que muestre al menos: clave numérica, consecutivo, datos del emisor, receptor,
 * líneas de detalle, impuestos y totales.
 *
 * GET /einvoicing/documents/:id/html  → HTML para imprimir/ver
 * GET /einvoicing/documents/:id/pdf   → PDF generado desde HTML (requiere puppeteer)
 */

import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

function fmtMoney(n: number | string | null | undefined): string {
  const num = parseFloat(String(n ?? 0));
  return isNaN(num) ? "0.00" : num.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const DOC_LABELS: Record<string, string> = {
  FE: "Factura Electrónica",
  TE: "Tiquete Electrónico",
  NC: "Nota de Crédito Electrónica",
  ND: "Nota de Débito Electrónica",
};

export function buildEInvoicingHtml(doc: {
  docType: string;
  key?: string | null;
  consecutive?: string | null;
  createdAt: Date;
  receiver?: any;
  payload?: any;
  status: string;
  referenceKey?: string | null;
  referenceReason?: string | null;
}): string {
  const payload = (doc.payload || {}) as any;
  const issuer = payload.issuer || {};
  const invoiceData = payload.invoice || payload.order || {};
  const items: any[] = payload.items || invoiceData.items || [];
  const receiver = doc.receiver as any;

  const docLabel = DOC_LABELS[doc.docType] || doc.docType;
  const currency = String(invoiceData.currency || "CRC");

  let subtotal = 0, totalTax = 0, totalDiscount = 0;
  for (const item of items) {
    const qty = parseFloat(String(item.qty ?? item.quantity ?? 1));
    const price = parseFloat(String(item.price ?? item.unitPrice ?? 0));
    const disc = parseFloat(String(item.discount ?? 0));
    const tax = parseFloat(String(item.taxAmount ?? 0));
    subtotal += qty * price - disc;
    totalTax += tax;
    totalDiscount += disc;
  }
  const grandTotal = subtotal + totalTax;

  const linesHtml = items.map((item: any, idx: number) => {
    const qty = parseFloat(String(item.qty ?? item.quantity ?? 1));
    const price = parseFloat(String(item.price ?? item.unitPrice ?? 0));
    const lineTax = parseFloat(String(item.taxAmount ?? 0));
    const lineTotal = qty * price + lineTax;
    return `<tr>
      <td>${idx + 1}</td>
      <td>${esc(item.name || item.description || "")}</td>
      ${item.cabysCode ? `<td>${esc(item.cabysCode)}</td>` : `<td></td>`}
      <td class="r">${fmtMoney(qty)}</td>
      <td class="r">${fmtMoney(price)}</td>
      <td class="r">${lineTax > 0 ? esc(`IVA ${item.taxRate ?? 13}%`) : "Exento"}</td>
      <td class="r">${fmtMoney(lineTax)}</td>
      <td class="r"><strong>${fmtMoney(lineTotal)}</strong></td>
    </tr>`;
  }).join("\n");

  const receiverHtml = receiver?.name ? `
    <div class="section">
      <h3>Receptor</h3>
      <div class="grid2">
        <div><span class="lbl">Nombre</span><br>${esc(receiver.name || receiver.legalName || "")}</div>
        <div><span class="lbl">Identificación</span><br>${esc(receiver.idType || "")} ${esc(receiver.idNumber || receiver.identification || "")}</div>
        ${receiver.email ? `<div><span class="lbl">Email</span><br>${esc(receiver.email)}</div>` : ""}
        ${receiver.phone ? `<div><span class="lbl">Teléfono</span><br>${esc(receiver.phone)}</div>` : ""}
      </div>
    </div>` : `<div class="section"><h3>Receptor</h3><p>Consumidor Final</p></div>`;

  const refHtml = doc.referenceKey ? `
    <div class="section ref">
      <h3>Referencia</h3>
      <p><strong>Clave doc. referencia:</strong> <span class="mono">${esc(doc.referenceKey)}</span></p>
      ${doc.referenceReason ? `<p><strong>Motivo:</strong> ${esc(doc.referenceReason)}</p>` : ""}
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${esc(`${docLabel} ${doc.consecutive || ""}`)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 20px; color: #003366; }
  h3 { font-size: 13px; color: #555; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; margin-top: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .header-right { text-align: right; }
  .badge { display: inline-block; background: #003366; color: white; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
  .status-ACCEPTED { background: #2e7d32; }
  .status-SENT { background: #1565c0; }
  .status-DRAFT { background: #616161; }
  .status-CONTINGENCY { background: #e65100; }
  .status-CANCELED { background: #c62828; }
  .section { border: 1px solid #e0e0e0; border-radius: 4px; padding: 14px; margin-bottom: 14px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .lbl { font-size: 11px; color: #888; text-transform: uppercase; }
  .key-box { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 10px; margin-bottom: 14px; word-break: break-all; }
  .key-box .lbl { display: block; margin-bottom: 4px; }
  .mono { font-family: monospace; font-size: 13px; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th { background: #003366; color: white; padding: 6px 8px; text-align: left; font-size: 12px; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .r { text-align: right; }
  .totals { display: flex; justify-content: flex-end; margin-top: 8px; }
  .totals table { width: 280px; }
  .totals td { border: none; padding: 3px 8px; }
  .totals .grand { font-size: 15px; font-weight: bold; border-top: 2px solid #003366; }
  .ref { border-color: #ff9800; background: #fff8e1; }
  .footer { margin-top: 20px; font-size: 11px; color: #999; text-align: center; }
  @media print {
    body { padding: 10px; }
    .badge { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    th { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>${esc(issuer.name || issuer.legalName || "Emisor")}</h1>
    <p>Cédula: ${esc(issuer.idNumber || "")} | ${esc(issuer.address || "")}</p>
    ${issuer.email ? `<p>Email: ${esc(issuer.email)}</p>` : ""}
    ${issuer.phone ? `<p>Tel: ${esc(issuer.phone)}</p>` : ""}
  </div>
  <div class="header-right">
    <h2>${esc(docLabel)}</h2>
    <p><strong>${esc(doc.consecutive || "")}</strong></p>
    <p>${new Date(doc.createdAt).toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })}</p>
    <span class="badge status-${esc(doc.status)}">${esc(doc.status)}</span>
  </div>
</div>

<div class="key-box">
  <span class="lbl">Clave Numérica (Hacienda CR)</span>
  <span class="mono">${esc(doc.key || "—")}</span>
</div>

${receiverHtml}

${refHtml}

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Descripción</th>
      <th>Cód. CABYS</th>
      <th class="r">Cant.</th>
      <th class="r">P. Unit.</th>
      <th class="r">Impuesto</th>
      <th class="r">Monto Imp.</th>
      <th class="r">Total Línea</th>
    </tr>
  </thead>
  <tbody>
    ${linesHtml || '<tr><td colspan="8" style="text-align:center;color:#999">Sin líneas de detalle</td></tr>'}
  </tbody>
</table>

<div class="totals">
  <table>
    <tr><td>Subtotal</td><td class="r">${currency} ${fmtMoney(subtotal)}</td></tr>
    ${totalDiscount > 0 ? `<tr><td>Descuentos</td><td class="r">-${currency} ${fmtMoney(totalDiscount)}</td></tr>` : ""}
    <tr><td>Impuestos (IVA)</td><td class="r">${currency} ${fmtMoney(totalTax)}</td></tr>
    <tr class="grand"><td><strong>TOTAL</strong></td><td class="r"><strong>${currency} ${fmtMoney(grandTotal)}</strong></td></tr>
  </table>
</div>

<div class="footer">
  Comprobante electrónico emitido según Resolución DGT-R-48-2016 · Ministerio de Hacienda · Costa Rica<br>
  Verifique la validez en <strong>www.hacienda.go.cr</strong>
</div>
</body>
</html>`;
}

export async function getDocumentHtml(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const id = String((req.params as any)?.id || "").trim();
  if (!id) return res.status(400).json({ message: "id requerido" });

  const doc = await prisma.eInvoicingDocument.findFirst({ where: { id, hotelId } });
  if (!doc) return res.status(404).json({ message: "Documento no encontrado" });

  const html = buildEInvoicingHtml(doc);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(html);
}

export async function getDocumentPdf(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const id = String((req.params as any)?.id || "").trim();
  if (!id) return res.status(400).json({ message: "id requerido" });

  const doc = await prisma.eInvoicingDocument.findFirst({ where: { id, hotelId } });
  if (!doc) return res.status(404).json({ message: "Documento no encontrado" });

  const html = buildEInvoicingHtml(doc);

  // Intentar generar PDF con puppeteer si está disponible (npm install puppeteer es opcional)
  try {
    // @ts-ignore — puppeteer es opcional; el build no falla si no está instalado
    const puppeteer = await import("puppeteer").catch(() => null) as any;
    if (!puppeteer) {
      // Fallback: devolver HTML con header para que el navegador imprima
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `inline; filename="${doc.consecutive || id}.html"`);
      return res.send(html);
    }

    const browser = await puppeteer.default.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${doc.consecutive || id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err: any) {
    // Si puppeteer falla, entregar HTML
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  }
}
