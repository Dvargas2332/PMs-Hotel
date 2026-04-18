/**
 * Controlador: envío de comprobante electrónico por correo al receptor.
 * POST /einvoicing/documents/:id/send-email
 */

import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import { sendEInvoicingEmail } from "../services/einvoicing.email.js";
import { buildEInvoicingHtml } from "./einvoicing.print.controller.js";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

export async function sendDocumentByEmail(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const id = String((req.params as any)?.id || "").trim();
  if (!id) return res.status(400).json({ message: "id requerido" });

  const doc = await prisma.eInvoicingDocument.findFirst({
    where: { id, hotelId },
  });
  if (!doc) return res.status(404).json({ message: "Documento no encontrado" });

  const cfg = await prisma.eInvoicingConfig.findUnique({
    where: { hotelId },
    select: { settings: true, credentials: true },
  });
  if (!cfg) return res.status(400).json({ message: "Facturación electrónica no configurada" });

  const settings = (cfg.settings || {}) as any;
  const credentials = (cfg.credentials || {}) as any;
  const issuer = (settings.issuer || {}) as any;

  // Determinar SMTP: usar el del módulo correspondiente, o el global
  const source = (doc.payload as any)?.source || "frontdesk";
  const smtpModule = settings[source]?.smtp || settings.smtp || {};
  const smtpCreds = credentials.smtp?.[source] || credentials.smtp || {};

  const smtpHost = String(smtpModule.host || process.env.SMTP_HOST || "").trim();
  if (!smtpHost) {
    return res.status(400).json({
      message: "SMTP no configurado. Configure host/puerto/usuario en Facturación Electrónica → SMTP.",
    });
  }

  // Destinatario: del body o del receptor del documento
  const bodyEmail = String((req.body as any)?.email || "").trim();
  const receiverData = (doc.receiver || {}) as any;
  const toEmail = bodyEmail || receiverData?.email || "";
  if (!toEmail) {
    return res.status(400).json({
      message: "Email del receptor no disponible. Proporcione email en el body o configúrelo en el receptor.",
    });
  }

  const htmlBody = buildEInvoicingHtml(doc);

  try {
    await sendEInvoicingEmail({
      smtpConfig: {
        host: smtpHost,
        port: parseInt(String(smtpModule.port || 587)),
        secure: String(smtpModule.secure || "false") === "true",
        user: String(smtpModule.user || ""),
        password: String(smtpCreds.password || ""),
        fromName: String(smtpModule.fromName || issuer.name || ""),
        fromEmail: String(smtpModule.fromEmail || smtpModule.user || ""),
      },
      to: toEmail,
      docType: String(doc.docType),
      key: String(doc.key || ""),
      consecutive: String(doc.consecutive || ""),
      issuerName: String(issuer.name || issuer.legalName || ""),
      issuerIdNumber: String(issuer.idNumber || ""),
      xmlSigned: doc.xmlSigned || null,
      htmlBody,
    });

    // Registrar el envío en los acks
    await prisma.eInvoicingAcknowledgement.create({
      data: {
        hotelId,
        documentId: doc.id,
        type: "OTHER",
        status: "RECEIVED",
        message: `Email enviado a ${toEmail}`,
        payload: { emailSent: true, to: toEmail, at: new Date().toISOString() },
      },
    });

    return res.json({ success: true, sentTo: toEmail });
  } catch (err: any) {
    return res.status(502).json({
      message: "Error al enviar el email",
      detail: err?.message || String(err),
    });
  }
}
