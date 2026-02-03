import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import {
  getSandboxStatus,
  getSandboxToken,
  sendSandboxDocument,
  validateHaciendaSandboxConfig,
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
    const err: any = new Error("Facturación electrónica no está habilitada");
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

  // "Directo con Hacienda" (placeholder integration) - only sandbox for now.
  if (env === "sandbox" && atvMode === "api" && provider === "hacienda-cr") {
    const atv = (settings?.atv || {}) as any;
    const endpoints = (atv.endpoints || {}) as any;
    const creds = ((await prisma.eInvoicingConfig.findUnique({ where: { hotelId }, select: { credentials: true } }))?.credentials ||
      {}) as any;
    const atvCreds = (creds.atv || {}) as any;

    const apiCfg: HaciendaApiConfig = {
      env: "sandbox",
      endpoints: {
        tokenUrl: endpoints.tokenUrl || "https://example.com/ATV_TOKEN_URL_PLACEHOLDER",
        sendUrl: endpoints.sendUrl || "https://example.com/HACIENDA_SEND_URL_PLACEHOLDER",
        statusUrl: endpoints.statusUrl || "https://example.com/HACIENDA_STATUS_URL_PLACEHOLDER?key={{key}}",
      },
      atv: {
        username: String(atv.username || ""),
        password: String(atvCreds.password || ""),
        clientId: atv.clientId ? String(atv.clientId) : undefined,
        clientSecret: String(atvCreds.clientSecret || ""),
      },
    };

    const issues = validateHaciendaSandboxConfig(apiCfg);
    if (issues.length) {
      return res.status(400).json({
        message:
          "Hacienda sandbox API no está configurada (placeholders). Completa ATV username/password/clientId/clientSecret y endpoints token/send/status en /e-invoicing.",
        issues,
      });
    }

    const doc = await prisma.eInvoicingDocument.findFirst({ where: { id, hotelId } });
    if (!doc) return res.status(404).json({ message: "Documento no encontrado" });
    if (!doc.key) return res.status(400).json({ message: "Documento sin clave (key)" });

    const xmlSigned = doc.xmlSigned || buildSandboxXml(doc);

    // mark SIGNED locally (placeholder signing)
    await prisma.eInvoicingDocument.updateMany({
      where: { id: doc.id, hotelId },
      data: { status: "SIGNED", xmlSigned, response: { placeholder: true, step: "SIGNED", at: nowIso() } },
    });

    try {
      const token = await getSandboxToken(apiCfg);
      const sendResp = await sendSandboxDocument(apiCfg, token, xmlSigned, doc.key);
      await prisma.eInvoicingDocument.updateMany({
        where: { id: doc.id, hotelId },
        data: { status: "SENT", response: { placeholder: true, step: "SENT", sendResp, at: nowIso() } },
      });

      await prisma.eInvoicingAcknowledgement.create({
        data: {
          hotelId,
          documentId: doc.id,
          type: "HACIENDA_RECEIPT",
          status: "RECEIVED",
          message: "Sent to Hacienda (sandbox placeholder).",
          payload: { placeholder: true, sendResp, at: nowIso() },
        },
      });

      // optional immediate status call (placeholder)
      const statusResp = await getSandboxStatus(apiCfg, token, doc.key);
      await prisma.eInvoicingAcknowledgement.create({
        data: {
          hotelId,
          documentId: doc.id,
          type: "HACIENDA_STATUS",
          status: "RECEIVED",
          message: "Status retrieved (sandbox placeholder).",
          payload: { placeholder: true, statusResp, at: nowIso() },
        },
      });

      await prisma.eInvoicingDocument.updateMany({
        where: { id: doc.id, hotelId },
        data: { response: { placeholder: true, step: "STATUS", statusResp, at: nowIso() } },
      });
    } catch (err: any) {
      return res.status(502).json({ message: err?.message || "Hacienda sandbox API call failed" });
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

  if (env === "sandbox" && atvMode === "api" && provider === "hacienda-cr") {
    const atv = (settings?.atv || {}) as any;
    const endpoints = (atv.endpoints || {}) as any;
    const creds = ((await prisma.eInvoicingConfig.findUnique({ where: { hotelId }, select: { credentials: true } }))?.credentials ||
      {}) as any;
    const atvCreds = (creds.atv || {}) as any;

    const apiCfg: HaciendaApiConfig = {
      env: "sandbox",
      endpoints: {
        tokenUrl: endpoints.tokenUrl || "https://example.com/ATV_TOKEN_URL_PLACEHOLDER",
        sendUrl: endpoints.sendUrl || "https://example.com/HACIENDA_SEND_URL_PLACEHOLDER",
        statusUrl: endpoints.statusUrl || "https://example.com/HACIENDA_STATUS_URL_PLACEHOLDER?key={{key}}",
      },
      atv: {
        username: String(atv.username || ""),
        password: String(atvCreds.password || ""),
        clientId: atv.clientId ? String(atv.clientId) : undefined,
        clientSecret: String(atvCreds.clientSecret || ""),
      },
    };
    const issues = validateHaciendaSandboxConfig(apiCfg);
    if (issues.length) return res.status(400).json({ message: "Hacienda sandbox API no configurada", issues });
    if (!doc.key) return res.status(400).json({ message: "Documento sin clave (key)" });

    try {
      const token = await getSandboxToken(apiCfg);
      const statusResp = await getSandboxStatus(apiCfg, token, doc.key);
      await prisma.eInvoicingAcknowledgement.create({
        data: {
          hotelId,
          documentId: doc.id,
          type: "HACIENDA_STATUS",
          status: "RECEIVED",
          message: "Status retrieved (sandbox placeholder).",
          payload: { placeholder: true, statusResp, at: nowIso() },
        },
      });
      await prisma.eInvoicingDocument.updateMany({
        where: { id: doc.id, hotelId },
        data: { response: { placeholder: true, step: "STATUS", statusResp, at: nowIso() } },
      });
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
    if (lastClose?.createdAt && doc.createdAt <= lastClose.createdAt) {
      return res.status(403).json({ message: "No se puede anular un documento de restaurante despuÃ©s del cierre Z" });
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
