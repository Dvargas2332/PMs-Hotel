/**
 * Servicio de envío de correo electrónico para Facturación Electrónica CR
 * Envía el XML firmado y la representación gráfica al receptor del comprobante.
 *
 * Usa Nodemailer con la configuración SMTP almacenada por hotel en EInvoicingConfig.
 * Instalar: npm install nodemailer @types/nodemailer
 */

import nodemailer from "nodemailer";

export interface EInvoicingEmailOpts {
  smtpConfig: {
    host: string;
    port: number;
    secure: boolean;         // true = TLS port 465, false = STARTTLS port 587
    user: string;
    password: string;
    fromName?: string;
    fromEmail?: string;
  };
  to: string;               // email del receptor
  docType: string;          // FE, TE, NC, ND
  key: string;              // clave numérica
  consecutive: string;
  issuerName: string;
  issuerIdNumber: string;
  xmlSigned?: string | null; // XML firmado (base64 o string)
  htmlBody?: string | null;  // Representación gráfica HTML
  pdfBuffer?: Buffer | null; // PDF adjunto opcional
}

export async function sendEInvoicingEmail(opts: EInvoicingEmailOpts): Promise<void> {
  const { smtpConfig, to } = opts;

  if (!to || !to.includes("@")) {
    throw new Error(`Email de receptor inválido: "${to}"`);
  }

  const transport = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.password,
    },
  });

  const docLabel: Record<string, string> = {
    FE: "Factura Electrónica",
    TE: "Tiquete Electrónico",
    NC: "Nota de Crédito",
    ND: "Nota de Débito",
  };

  const label = docLabel[opts.docType] || opts.docType;
  const subject = `${label} ${opts.consecutive} - ${opts.issuerName}`;

  const attachments: any[] = [];

  if (opts.xmlSigned) {
    // El XML puede venir como base64 o como string XML directo
    const isBase64 = !opts.xmlSigned.trim().startsWith("<");
    attachments.push({
      filename: `${opts.consecutive}.xml`,
      content: isBase64 ? Buffer.from(opts.xmlSigned, "base64") : opts.xmlSigned,
      contentType: "application/xml",
    });
  }

  if (opts.pdfBuffer) {
    attachments.push({
      filename: `${opts.consecutive}.pdf`,
      content: opts.pdfBuffer,
      contentType: "application/pdf",
    });
  }

  const html = opts.htmlBody ?? buildDefaultHtml(opts);

  await transport.sendMail({
    from: `"${smtpConfig.fromName || opts.issuerName}" <${smtpConfig.fromEmail || smtpConfig.user}>`,
    to,
    subject,
    html,
    attachments,
  });
}

function buildDefaultHtml(opts: EInvoicingEmailOpts): string {
  const docLabel: Record<string, string> = {
    FE: "Factura Electrónica",
    TE: "Tiquete Electrónico",
    NC: "Nota de Crédito",
    ND: "Nota de Débito",
  };
  const label = docLabel[opts.docType] || opts.docType;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #222; margin: 0; padding: 20px; }
  .header { background: #003366; color: white; padding: 16px 24px; border-radius: 4px 4px 0 0; }
  .body { border: 1px solid #ccc; border-top: none; padding: 24px; border-radius: 0 0 4px 4px; }
  .field { margin: 8px 0; }
  .label { color: #666; font-size: 12px; text-transform: uppercase; }
  .value { font-size: 15px; font-weight: bold; }
  .key { font-family: monospace; font-size: 13px; background: #f4f4f4; padding: 4px 8px; border-radius: 3px; }
  .footer { margin-top: 24px; font-size: 12px; color: #888; }
</style></head>
<body>
  <div class="header">
    <h2 style="margin:0">${label}</h2>
    <p style="margin:4px 0 0">${opts.issuerName} · Cédula ${opts.issuerIdNumber}</p>
  </div>
  <div class="body">
    <div class="field">
      <div class="label">Consecutivo</div>
      <div class="value">${opts.consecutive}</div>
    </div>
    <div class="field">
      <div class="label">Clave Numérica</div>
      <div class="key">${opts.key}</div>
    </div>
    <p>Adjunto encontrará el comprobante electrónico en formato XML según la resolución DGT-R-48-2016 del Ministerio de Hacienda de Costa Rica.</p>
    <p>Para consultar la validez de este comprobante puede acceder al portal de <a href="https://www.hacienda.go.cr">Ministerio de Hacienda</a>.</p>
    <div class="footer">
      Este mensaje fue generado automáticamente. Por favor no responda este correo.
    </div>
  </div>
</body>
</html>`;
}
