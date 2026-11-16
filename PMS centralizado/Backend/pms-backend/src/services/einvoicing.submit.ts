/**
 * Servicio puro de envío de documentos electrónicos a Hacienda CR.
 *
 * Puede ser invocado desde controladores Express o desde otros flujos
 * (por ejemplo, anulación automática de documentos de restaurante).
 */

import prisma from "../lib/prisma.js";
import { atvSend, atvStatus, atvToken, type AtvEnvironment } from "./einvoice.atv.js";
import { signCrXml } from "./einvoice.sign.js";

function nowIso() {
  return new Date().toISOString();
}

function escapeXml(value: any) {
  const s = String(value ?? "");
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeIdType(value: string | undefined | null, idNumber?: string | null) {
  const direct = String(value || "").trim();
  if (direct) return direct;
  const digits = String(idNumber || "").replace(/\D/g, "");
  if (digits.length >= 12) return "03";
  if (digits.length === 10) return "02";
  if (digits.length === 9) return "01";
  return "01";
}

function normalizeReceiverIdentity(receiver: any) {
  if (!receiver || typeof receiver !== "object") return null;
  const idType = normalizeIdType(receiver.idType || receiver.idTypeCode, receiver.idNumber || receiver.identification);
  const idNumber = String(receiver.idNumber || receiver.identification || receiver.id || "").trim();
  if (!idNumber) return null;
  return { idType, idNumber };
}

function deriveStatusFromResponse(resp: any) {
  const body = resp && typeof resp === "object" && "body" in resp ? (resp as any).body : resp;
  const text = String(
    body?.estado || body?.status || body?.ind_estado || body?.["ind-estado"] || body?.state || ""
  ).toLowerCase();
  if (text.includes("acept")) return "ACCEPTED";
  if (text.includes("rech")) return "REJECTED";
  return null;
}

function buildSandboxXml(doc: any) {
  const payloadJson = JSON.stringify(doc.payload || {}, null, 2);
  const receiverJson = JSON.stringify(doc.receiver || {}, null, 2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<ElectronicDocument sandbox="true">
  <DocType>${escapeXml(doc.docType)}</DocType>
  <Status>${escapeXml(doc.status)}</Status>
  <Key>${escapeXml(doc.key || "")}</Key>
  <Consecutive>${escapeXml(doc.consecutive || "")}</Consecutive>
  <Branch>${escapeXml(doc.branch || "")}</Branch>
  <Terminal>${escapeXml(doc.terminal || "")}</Terminal>
  <CreatedAt>${escapeXml(doc.createdAt || nowIso())}</CreatedAt>
  <Receiver><![CDATA[${receiverJson}]]></Receiver>
  <Payload><![CDATA[${payloadJson}]]></Payload>
  <Signature>SIMULATED-SANDBOX</Signature>
</ElectronicDocument>
`;
}

async function updateInvoiceEinvoiceStatus(opts: {
  hotelId: string;
  invoiceId: string;
  docType: string;
  status: string;
  consecutive?: string | null;
  key?: string | null;
}) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: opts.invoiceId, hotelId: opts.hotelId },
    select: { id: true, eInvoice: true },
  });
  if (!invoice) return;

  const currentEinvoice = (invoice.eInvoice || {}) as any;
  const docs = { ...(currentEinvoice.docs || {}) };
  docs[opts.docType] = {
    ...(docs[opts.docType] || {}),
    status: opts.status,
    consecutive: opts.consecutive ?? docs[opts.docType]?.consecutive,
    key: opts.key ?? docs[opts.docType]?.key,
    updatedAt: nowIso(),
  };

  await prisma.invoice.updateMany({
    where: { id: opts.invoiceId, hotelId: opts.hotelId },
    data: {
      eInvoice: {
        ...(currentEinvoice || {}),
        docs,
        lastUpdatedAt: nowIso(),
      },
    },
  });
}

async function ensureEinvoicingEnabled(hotelId: string) {
  const cfg = await prisma.eInvoicingConfig.findUnique({
    where: { hotelId },
    select: { enabled: true, environment: true, provider: true, settings: true },
  });
  if (!cfg?.enabled) {
    const err: any = new Error("Facturacion electronica no esta habilitada");
    err.status = 400;
    throw err;
  }
  return cfg;
}

export class SubmitDocumentError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public detail?: any
  ) {
    super(message);
    this.name = "SubmitDocumentError";
  }
}

export interface SubmitDocumentOpts {
  hotelId: string;
  documentId: string;
  actorId?: string;
}

/**
 * Envía un documento electrónico a Hacienda (modo API) o simula el envío (sandbox).
 * Actualiza el estado del documento y devuelve el registro fresco.
 * Lanza SubmitDocumentError ante errores controlados.
 */
export async function submitDocumentToHacienda(opts: SubmitDocumentOpts) {
  const { hotelId, documentId } = opts;
  if (!documentId) throw new SubmitDocumentError("id requerido", 400);

  const cfg = await ensureEinvoicingEnabled(hotelId);
  const settings = (cfg.settings || {}) as any;
  const atvMode = String(settings?.atv?.mode || "manual").toLowerCase();

  const doc = await prisma.eInvoicingDocument.findFirst({ where: { id: documentId, hotelId } });
  if (!doc) throw new SubmitDocumentError("Documento no encontrado", 404);
  if (!doc.key) throw new SubmitDocumentError("Documento sin clave (key)", 400);

  if (atvMode === "api") {
    const creds =
      ((await prisma.eInvoicingConfig.findUnique({ where: { hotelId }, select: { credentials: true } }))?.credentials || {}) as any;
    const crypto = (creds.crypto || {}) as any;
    const atvCreds = (creds.atv || {}) as any;

    // Hacienda directo: cada hotel pone sus credenciales y su certificado.
    const atvEnvironment: AtvEnvironment =
      String(cfg.environment || "").toLowerCase() === "production" ? "production" : "sandbox";
    const clientId = String(settings?.atv?.clientId || (atvEnvironment === "production" ? "api-prod" : "api-stag")).trim();
    const clientSecret = String(atvCreds?.clientSecret || "").trim();
    const atvUsername = String(settings?.atv?.username || "").trim();
    const atvPassword = String(atvCreds?.password || "");

    const issues: string[] = [];
    if (!atvUsername) issues.push("ATV_USERNAME_MISSING");
    if (!atvPassword) issues.push("ATV_PASSWORD_MISSING");
    if (!clientSecret) issues.push("ATV_CLIENT_SECRET_MISSING");
    if (!clientId) issues.push("ATV_CLIENT_ID_MISSING");
    if (issues.length) {
      throw new SubmitDocumentError(
        "Faltan las credenciales ATV del emisor: usuario, contraseña y client secret en Facturación Electrónica.",
        400,
        issues
      );
    }
    if (!crypto?.certificateBase64 || !crypto?.certificatePassword) {
      throw new SubmitDocumentError(
        "Certificado de firma requerido. Cada hotel debe configurar su certificado .p12 y su contraseña antes de enviar.",
        400
      );
    }

    const issuer = (settings?.issuer || {}) as any;
    const issuerIdNumber = String(issuer?.idNumber || "").trim();
    const issuerIdType = normalizeIdType(issuer?.idType || issuer?.idTypeCode, issuerIdNumber);
    if (!issuerIdNumber) {
      throw new SubmitDocumentError("Emisor sin identificacion (issuer.idNumber)", 400);
    }

    const receiverIdentity = normalizeReceiverIdentity(doc.receiver);

    await prisma.eInvoicingDocument.updateMany({
      where: { id: doc.id, hotelId },
      data: { status: "SIGNED", response: { step: "SIGNED", at: nowIso() } },
    });

    try {
      const { accessToken } = await atvToken({
        environment: atvEnvironment,
        clientId,
        clientSecret,
        username: atvUsername,
        password: atvPassword,
      });

      let xmlSigned = doc.xmlSigned || "";
      if (!xmlSigned) {
        const payloadAny = (doc.payload || {}) as any;
        const xmlBase64 = String(payloadAny?.xmlUnsignedBase64 || payloadAny?.xmlBase64 || "");
        const xmlRaw = String(payloadAny?.xml || payloadAny?.xmlUnsigned || "");
        if (!xmlBase64 && !xmlRaw) {
          throw new SubmitDocumentError("No se encontro XML para firmar. Provee xml o xmlBase64 en el payload del documento.", 400);
        }
        const unsigned = xmlRaw || Buffer.from(xmlBase64, "base64").toString("utf8");
        const signed = await signCrXml(
          unsigned,
          String(crypto?.certificateBase64 || ""),
          String(crypto?.certificatePassword || "")
        );
        xmlSigned = signed.xmlSignedBase64;
        await prisma.eInvoicingDocument.updateMany({
          where: { id: doc.id, hotelId },
          data: { xmlSigned },
        });
      }

      const sendResp = await atvSend({
        environment: atvEnvironment,
        token: accessToken,
        clave: doc.key,
        issuedAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : nowIso(),
        emisor: { tipoIdentificacion: issuerIdType, numeroIdentificacion: issuerIdNumber },
        receptor: receiverIdentity
          ? { tipoIdentificacion: receiverIdentity.idType, numeroIdentificacion: receiverIdentity.idNumber }
          : null,
        consecutivoReceptor: (doc.payload as any)?.consecutivoReceptor || (doc.payload as any)?.receiverConsecutive || null,
        xmlSignedBase64: xmlSigned,
      });

      await prisma.eInvoicingDocument.updateMany({
        where: { id: doc.id, hotelId },
        data: { status: "SENT", response: { step: "SENT", sendResp, at: nowIso() } },
      });

      await prisma.eInvoicingAcknowledgement.create({
        data: {
          hotelId,
          documentId: doc.id,
          type: "HACIENDA_RECEIPT",
          status: "RECEIVED",
          message: "Enviado a la recepción de Hacienda.",
          payload: { sendResp, at: nowIso() },
        },
      });

      const statusResp = await atvStatus({
        environment: atvEnvironment,
        token: accessToken,
        clave: doc.key,
      });
      const derived = deriveStatusFromResponse(statusResp);

      await prisma.eInvoicingAcknowledgement.create({
        data: {
          hotelId,
          documentId: doc.id,
          type: "HACIENDA_STATUS",
          status: "RECEIVED",
          message: "Estado consultado en Hacienda.",
          payload: { statusResp, at: nowIso() },
        },
      });

      if (derived) {
        await prisma.eInvoicingDocument.updateMany({
          where: { id: doc.id, hotelId },
          data: { status: derived, response: { step: "STATUS", statusResp, at: nowIso() } },
        });

        if (doc.invoiceId) {
          await updateInvoiceEinvoiceStatus({
            hotelId,
            invoiceId: doc.invoiceId,
            docType: String(doc.docType),
            status: derived,
            consecutive: doc.consecutive,
            key: doc.key,
          });
        }
      } else {
        await prisma.eInvoicingDocument.updateMany({
          where: { id: doc.id, hotelId },
          data: { response: { step: "STATUS", statusResp, at: nowIso() } },
        });
      }
    } catch (err: any) {
      throw new SubmitDocumentError(err?.message || "No se pudo enviar el comprobante a Hacienda", 502);
    }

    return prisma.eInvoicingDocument.findFirst({ where: { id: documentId, hotelId } });
  }

  // Modo sandbox / manual
  if (doc.status === "ACCEPTED") return doc;
  if (doc.status === "CANCELED") throw new SubmitDocumentError("Documento cancelado", 400);

  const xmlSigned = doc.xmlSigned || buildSandboxXml(doc);

  await prisma.eInvoicingDocument.updateMany({
    where: { id: doc.id, hotelId },
    data: {
      status: "SIGNED",
      xmlSigned,
      response: { sandboxSimulated: true, step: "SIGNED", at: nowIso() },
    },
  });

  await prisma.eInvoicingAcknowledgement.create({
    data: {
      hotelId,
      documentId: doc.id,
      type: "HACIENDA_RECEIPT",
      status: "RECEIVED",
      message: "Sandbox simulated receipt",
      payload: { sandboxSimulated: true, at: nowIso() },
    },
  });

  await prisma.eInvoicingDocument.updateMany({
    where: { id: doc.id, hotelId },
    data: {
      status: "SENT",
      response: { sandboxSimulated: true, step: "SENT", provider: cfg.provider, environment: cfg.environment, at: nowIso() },
    },
  });

  await prisma.eInvoicingAcknowledgement.create({
    data: {
      hotelId,
      documentId: doc.id,
      type: "HACIENDA_STATUS",
      status: "ACCEPTED",
      message: "Sandbox simulated ACCEPTED",
      payload: { sandboxSimulated: true, status: "ACCEPTED", at: nowIso() },
    },
  });

  await prisma.eInvoicingDocument.updateMany({
    where: { id: doc.id, hotelId },
    data: {
      status: "ACCEPTED",
      response: { sandboxSimulated: true, step: "ACCEPTED", provider: cfg.provider, environment: cfg.environment, at: nowIso() },
    },
  });

  if (doc.invoiceId) {
    await updateInvoiceEinvoiceStatus({
      hotelId,
      invoiceId: doc.invoiceId,
      docType: String(doc.docType),
      status: "ACCEPTED",
      consecutive: doc.consecutive,
      key: doc.key,
    });
  }

  return prisma.eInvoicingDocument.findFirst({ where: { id: documentId, hotelId } });
}
