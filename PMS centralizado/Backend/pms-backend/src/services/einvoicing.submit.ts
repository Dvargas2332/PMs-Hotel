/**
 * Servicio puro de envío de documentos electrónicos a Hacienda CR.
 *
 * Puede ser invocado desde controladores Express o desde otros flujos
 * (por ejemplo, anulación automática de documentos de restaurante).
 */

import prisma from "../lib/prisma.js";
import {
  microfacturaSend,
  microfacturaSignXml,
  microfacturaStatus,
  microfacturaToken,
} from "./microfacturaCr.js";
import {
  resolveMicrofacturaConfig,
  validateHaciendaConfig,
} from "./microfacturaConfig.js";

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
  const provider = "microfacturacr";

  const doc = await prisma.eInvoicingDocument.findFirst({ where: { id: documentId, hotelId } });
  if (!doc) throw new SubmitDocumentError("Documento no encontrado", 404);
  if (!doc.key) throw new SubmitDocumentError("Documento sin clave (key)", 400);

  if (atvMode === "api" && provider === "microfacturacr") {
    const creds =
      ((await prisma.eInvoicingConfig.findUnique({ where: { hotelId }, select: { credentials: true } }))?.credentials || {}) as any;
    const crypto = (creds.crypto || {}) as any;
    const apiCfg = resolveMicrofacturaConfig(cfg, settings, creds);
    const issues = validateHaciendaConfig(apiCfg);
    if (issues.length) {
      throw new SubmitDocumentError(
        "Microfactura no está configurado. Completa ATV username/password/clientId/clientSecret en /e-invoicing.",
        400,
        issues
      );
    }
    if (!crypto?.certificateBase64 || !crypto?.certificatePassword) {
      throw new SubmitDocumentError(
        "Certificado de firma requerido. Cada hotel debe configurar su certificado y contraseña para firmar XML antes de enviar.",
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
      const tokenResp = await microfacturaToken({
        clientId: apiCfg.atv.clientId || "api-stag",
        clientSecret: apiCfg.atv.clientSecret,
        username: apiCfg.atv.username,
        password: apiCfg.atv.password,
        grantType: "password",
      });
      const tokenPayload = (tokenResp as any)?.body || tokenResp;
      const accessToken = String(tokenPayload?.access_token || tokenPayload?.accessToken || "");
      if (!accessToken) {
        throw new Error("Microfactura token response missing access_token");
      }

      let xmlSigned = doc.xmlSigned || "";
      if (!xmlSigned) {
        const payloadAny = (doc.payload || {}) as any;
        const xmlBase64 = String(payloadAny?.xmlUnsignedBase64 || payloadAny?.xmlBase64 || "");
        const xmlRaw = String(payloadAny?.xml || payloadAny?.xmlUnsigned || "");
        if (!xmlBase64 && !xmlRaw) {
          throw new SubmitDocumentError("No se encontro XML para firmar. Provee xml o xmlBase64 en el payload del documento.", 400);
        }
        xmlSigned = await microfacturaSignXml({
          xmlBase64: xmlBase64 || undefined,
          xml: xmlRaw || undefined,
          certBase64: String(crypto?.certificateBase64 || ""),
          certPassword: String(crypto?.certificatePassword || ""),
        });
        await prisma.eInvoicingDocument.updateMany({
          where: { id: doc.id, hotelId },
          data: { xmlSigned },
        });
      }

      const sendResp = await microfacturaSend({
        token: accessToken,
        clientId: apiCfg.atv.clientId || "api-stag",
        clave: doc.key,
        fecha: doc.createdAt ? new Date(doc.createdAt).toISOString() : nowIso(),
        emisor: { tipoIdentificacion: issuerIdType, numeroIdentificacion: issuerIdNumber },
        receptor: receiverIdentity
          ? { tipoIdentificacion: receiverIdentity.idType, numeroIdentificacion: receiverIdentity.idNumber }
          : undefined,
        comprobanteXmlBase64: xmlSigned,
        callbackUrl: settings?.atv?.callbackUrl || undefined,
        consecutivoReceptor: (doc.payload as any)?.consecutivoReceptor || (doc.payload as any)?.receiverConsecutive || undefined,
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
          message: "Sent via Microfactura.",
          payload: { sendResp, at: nowIso() },
        },
      });

      const statusResp = await microfacturaStatus({
        token: accessToken,
        clientId: apiCfg.atv.clientId || "api-stag",
        clave: doc.key,
      });
      const derived = deriveStatusFromResponse(statusResp);

      await prisma.eInvoicingAcknowledgement.create({
        data: {
          hotelId,
          documentId: doc.id,
          type: "HACIENDA_STATUS",
          status: "RECEIVED",
          message: "Status retrieved.",
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
      throw new SubmitDocumentError(err?.message || "Microfactura API call failed", 502);
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
