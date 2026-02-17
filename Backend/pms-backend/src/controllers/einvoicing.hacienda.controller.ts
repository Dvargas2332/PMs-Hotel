import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import {
  getHaciendaStatus,
  getHaciendaToken,
  sendHaciendaDocument,
  validateHaciendaConfig,
  type HaciendaApiConfig,
} from "../services/haciendaCr.js";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

function escapeXml(value: any) {
  const s = String(value ?? "");
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function nowIso() {
  return new Date().toISOString();
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

function resolveHaciendaConfig(cfg: any, settings: any, credentials: any): HaciendaApiConfig {
  const env = String(cfg.environment || "sandbox").toLowerCase() === "production" ? "production" : "sandbox";
  const atvSettings = (settings?.atv || {}) as any;
  const atvCreds = (credentials?.atv || {}) as any;

  const clientId = String(atvSettings?.clientId || "").trim() || (env === "production" ? "api-prod" : "api-stag");

  return {
    env,
    atv: {
      username: String(atvSettings?.username || ""),
      password: String(atvCreds?.password || ""),
      clientId,
      clientSecret: String(atvCreds?.clientSecret || ""),
    },
  };
}

function deriveStatusFromResponse(resp: any) {
  const text = String(resp?.estado || resp?.status || resp?.ind_estado || resp?.state || "").toLowerCase();
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

export async function submitEInvoicingDocument(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const id = String((req.params as any)?.id || "").trim();
  if (!id) return res.status(400).json({ message: "id requerido" });

  const cfg = await ensureEinvoicingEnabled(hotelId);
  const env = String(cfg.environment || "sandbox").toLowerCase();
  const settings = (cfg.settings || {}) as any;
  const atvMode = String(settings?.atv?.mode || "manual").toLowerCase();
  const provider = String(cfg.provider || "hacienda-cr");

  // Directo con Hacienda (ATV API)
  if (atvMode === "api" && provider === "hacienda-cr") {
    const creds =
      ((await prisma.eInvoicingConfig.findUnique({ where: { hotelId }, select: { credentials: true } }))?.credentials || {}) as any;
    const apiCfg = resolveHaciendaConfig(cfg, settings, creds);
    const issues = validateHaciendaConfig(apiCfg);
    if (issues.length) {
      return res.status(400).json({
        message:
          "Hacienda API no esta configurada. Completa ATV username/password/clientId/clientSecret y endpoints token/send/status en /e-invoicing.",
        issues,
      });
    }

    const doc = await prisma.eInvoicingDocument.findFirst({ where: { id, hotelId } });
    if (!doc) return res.status(404).json({ message: "Documento no encontrado" });
    if (!doc.key) return res.status(400).json({ message: "Documento sin clave (key)" });
    if (!doc.xmlSigned) {
      return res.status(400).json({ message: "XML firmado requerido antes de enviar a Hacienda." });
    }

    const issuer = (settings?.issuer || {}) as any;
    const issuerIdNumber = String(issuer?.idNumber || "").trim();
    const issuerIdType = normalizeIdType(issuer?.idType || issuer?.idTypeCode, issuerIdNumber);
    if (!issuerIdNumber) {
      return res.status(400).json({ message: "Emisor sin identificacion (issuer.idNumber)" });
    }

    const receiverIdentity = normalizeReceiverIdentity(doc.receiver);

    await prisma.eInvoicingDocument.updateMany({
      where: { id: doc.id, hotelId },
      data: { status: "SIGNED", response: { step: "SIGNED", at: nowIso() } },
    });

    try {
      const token = await getHaciendaToken(apiCfg, "password");
      const sendResp = await sendHaciendaDocument(apiCfg, token, doc.xmlSigned, doc.key, {
        issuedAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : nowIso(),
        issuerIdType,
        issuerIdNumber,
        receiverIdType: receiverIdentity?.idType || undefined,
        receiverIdNumber: receiverIdentity?.idNumber || undefined,
        callbackUrl: settings?.atv?.callbackUrl || undefined,
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
          message: "Sent to Hacienda.",
          payload: { sendResp, at: nowIso() },
        },
      });

      const statusResp = await getHaciendaStatus(apiCfg, token, doc.key);
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
      return res.status(502).json({ message: err?.message || "Hacienda API call failed" });
    }

    const fresh = await prisma.eInvoicingDocument.findFirst({ where: { id, hotelId } });
    return res.json(fresh);
  }

  const doc = await prisma.eInvoicingDocument.findFirst({
    where: { id, hotelId },
  });
  if (!doc) return res.status(404).json({ message: "Documento no encontrado" });

  if (doc.status === "ACCEPTED") return res.json(doc);
  if (doc.status === "CANCELED") return res.status(400).json({ message: "Documento cancelado" });

  const xmlSigned = doc.xmlSigned || buildSandboxXml(doc);

  // Simulated flow: SIGNED -> SENT -> ACCEPTED (with acks)
  const signed = await prisma.eInvoicingDocument.updateMany({
    where: { id: doc.id, hotelId },
    data: {
      status: "SIGNED",
      xmlSigned,
      response: {
        sandboxSimulated: true,
        step: "SIGNED",
        at: nowIso(),
      },
    },
  });
  if (signed.count === 0) return res.status(404).json({ message: "Documento no encontrado" });

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
      response: {
        sandboxSimulated: true,
        step: "SENT",
        provider: cfg.provider,
        environment: cfg.environment,
        at: nowIso(),
      },
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
      response: {
        sandboxSimulated: true,
        step: "ACCEPTED",
        provider: cfg.provider,
        environment: cfg.environment,
        at: nowIso(),
      },
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

  const fresh = await prisma.eInvoicingDocument.findFirst({ where: { id: doc.id, hotelId } });
  return res.json(fresh);
}

export async function refreshEInvoicingDocumentStatus(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const id = String((req.params as any)?.id || "").trim();
  if (!id) return res.status(400).json({ message: "id requerido" });

  const cfg = await ensureEinvoicingEnabled(hotelId);
  const env = String(cfg.environment || "sandbox").toLowerCase();
  const settings = (cfg.settings || {}) as any;
  const atvMode = String(settings?.atv?.mode || "manual").toLowerCase();
  const provider = String(cfg.provider || "hacienda-cr");

  const doc = await prisma.eInvoicingDocument.findFirst({
    where: { id, hotelId },
    select: { id: true, invoiceId: true, docType: true, status: true, consecutive: true, key: true },
  });
  if (!doc) return res.status(404).json({ message: "Documento no encontrado" });

  if (doc.status === "ACCEPTED" || doc.status === "REJECTED" || doc.status === "CANCELED") {
    return res.json(doc);
  }

  if (atvMode === "api" && provider === "hacienda-cr") {
    const creds =
      ((await prisma.eInvoicingConfig.findUnique({ where: { hotelId }, select: { credentials: true } }))?.credentials || {}) as any;
    const apiCfg = resolveHaciendaConfig(cfg, settings, creds);
    const issues = validateHaciendaConfig(apiCfg);
    if (issues.length) return res.status(400).json({ message: "Hacienda API no configurada", issues });
    if (!doc.key) return res.status(400).json({ message: "Documento sin clave (key)" });

    try {
      const token = await getHaciendaToken(apiCfg, "password");
      const statusResp = await getHaciendaStatus(apiCfg, token, doc.key);
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
      await prisma.eInvoicingDocument.updateMany({
        where: { id: doc.id, hotelId },
        data: { response: { step: "STATUS", statusResp, at: nowIso() }, ...(derived ? { status: derived } : {}) },
      });

      if (derived && doc.invoiceId) {
        await updateInvoiceEinvoiceStatus({
          hotelId,
          invoiceId: doc.invoiceId,
          docType: String(doc.docType),
          status: derived,
          consecutive: doc.consecutive,
          key: doc.key,
        });
      }
    } catch (err: any) {
      return res.status(502).json({ message: err?.message || "Hacienda status call failed" });
    }
    const fresh = await prisma.eInvoicingDocument.findFirst({ where: { id: doc.id, hotelId } });
    return res.json(fresh);
  }

  await prisma.eInvoicingAcknowledgement.create({
    data: {
      hotelId,
      documentId: doc.id,
      type: "HACIENDA_STATUS",
      status: "ACCEPTED",
      message: "Sandbox refresh: ACCEPTED",
      payload: { sandboxSimulated: true, status: "ACCEPTED", at: nowIso() },
    },
  });

  await prisma.eInvoicingDocument.updateMany({
    where: { id: doc.id, hotelId },
    data: {
      status: "ACCEPTED",
      response: {
        sandboxSimulated: true,
        step: "ACCEPTED",
        provider: cfg.provider,
        environment: cfg.environment,
        at: nowIso(),
      },
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

  const fresh = await prisma.eInvoicingDocument.findFirst({ where: { id: doc.id, hotelId } });
  return res.json(fresh);
}

export async function cancelEInvoicingDocument(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const id = String((req.params as any)?.id || "").trim();
  if (!id) return res.status(400).json({ message: "id requerido" });

  await ensureEinvoicingEnabled(hotelId);

  const doc = await prisma.eInvoicingDocument.findFirst({
    where: { id, hotelId },
    select: {
      id: true,
      invoiceId: true,
      restaurantOrderId: true,
      docType: true,
      status: true,
      consecutive: true,
      key: true,
      createdAt: true,
    },
  });
  if (!doc) return res.status(404).json({ message: "Documento no encontrado" });
  if (doc.status === "CANCELED") return res.json(doc);

  if (doc.restaurantOrderId) {
    const lastClose = await prisma.restaurantClose.findFirst({
      where: { hotelId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const order = await prisma.restaurantOrder.findFirst({
      where: { id: doc.restaurantOrderId, hotelId },
      select: { updatedAt: true },
    });
    const orderPaidAt = order?.updatedAt || doc.createdAt;
    if (lastClose?.createdAt && orderPaidAt <= lastClose.createdAt) {
      return res.status(403).json({ message: "No se puede anular un documento de restaurante despu?s del cierre Z" });
    }
  }

  await prisma.eInvoicingAcknowledgement.create({
    data: {
      hotelId,
      documentId: doc.id,
      type: "OTHER",
      status: "RECEIVED",
      message: "Canceled manually (sandbox)",
      payload: { sandboxSimulated: true, at: nowIso() },
    },
  });

  await prisma.eInvoicingDocument.updateMany({
    where: { id: doc.id, hotelId },
    data: { status: "CANCELED", response: { sandboxSimulated: true, step: "CANCELED", at: nowIso() } },
  });

  if (doc.invoiceId) {
    await updateInvoiceEinvoiceStatus({
      hotelId,
      invoiceId: doc.invoiceId,
      docType: String(doc.docType),
      status: "CANCELED",
      consecutive: doc.consecutive,
      key: doc.key,
    });
  }

  const fresh = await prisma.eInvoicingDocument.findFirst({ where: { id: doc.id, hotelId } });
  return res.json(fresh);
}
