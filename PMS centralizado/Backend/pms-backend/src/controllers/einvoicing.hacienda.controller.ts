import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import {
  resolveMicrofacturaConfig,
  validateHaciendaConfig,
} from "../services/microfacturaConfig.js";
import {
  microfacturaStatus,
  microfacturaToken,
} from "../services/microfacturaCr.js";
import {
  createCreditDebitNote,
  NoteCreationError,
} from "../services/einvoicing.notes.js";
import {
  submitDocumentToHacienda,
  SubmitDocumentError,
} from "../services/einvoicing.submit.js";
import { onEInvoicingDocument } from "../services/accounting.integration.js";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

function nowIso() {
  return new Date().toISOString();
}

function deriveStatusFromResponse(resp: any) {
  const body = resp && typeof resp === "object" && "body" in resp ? (resp as any).body : resp;
  const text = String(
    body?.estado ||
      body?.status ||
      body?.ind_estado ||
      body?.["ind-estado"] ||
      body?.state ||
      ""
  ).toLowerCase();
  if (text.includes("acept")) return "ACCEPTED";
  if (text.includes("rech")) return "REJECTED";
  return null;
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

  try {
    const fresh = await submitDocumentToHacienda({
      hotelId,
      documentId: id,
      // @ts-ignore
      actorId: req.user?.sub,
    });
    res.json(fresh);

    if (fresh) {
      onEInvoicingDocument({
        hotelId,
        documentId: fresh.id,
        docType: String(fresh.docType),
        // @ts-ignore
        actorId: (req as any)?.user?.sub ?? null,
      });
    }
    return;
  } catch (err) {
    if (err instanceof SubmitDocumentError) {
      return res.status(err.statusCode).json({ message: err.message, detail: err.detail });
    }
    console.error("[submitEInvoicingDocument] error inesperado:", err);
    return res.status(502).json({ message: err instanceof Error ? err.message : "Error al enviar documento" });
  }
}

export async function refreshEInvoicingDocumentStatus(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const id = String((req.params as any)?.id || "").trim();
  if (!id) return res.status(400).json({ message: "id requerido" });

  const cfg = await ensureEinvoicingEnabled(hotelId);
  const settings = (cfg.settings || {}) as any;
  const atvMode = String(settings?.atv?.mode || "manual").toLowerCase();
  const provider = "microfacturacr";

  const doc = await prisma.eInvoicingDocument.findFirst({
    where: { id, hotelId },
    select: { id: true, invoiceId: true, docType: true, status: true, consecutive: true, key: true },
  });
  if (!doc) return res.status(404).json({ message: "Documento no encontrado" });

  if (doc.status === "ACCEPTED" || doc.status === "REJECTED" || doc.status === "CANCELED") {
    return res.json(doc);
  }

  if (atvMode === "api" && provider === "microfacturacr") {
    const creds =
      ((await prisma.eInvoicingConfig.findUnique({ where: { hotelId }, select: { credentials: true } }))?.credentials || {}) as any;
    const apiCfg = resolveMicrofacturaConfig(cfg, settings, creds);
    const issues = validateHaciendaConfig(apiCfg);
    if (issues.length) return res.status(400).json({ message: "Microfactura no configurado", issues });
    if (!doc.key) return res.status(400).json({ message: "Documento sin clave (key)" });

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
      return res.status(502).json({ message: err?.message || "Microfactura status call failed" });
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

  const cfg = await ensureEinvoicingEnabled(hotelId);
  const settings = (cfg.settings || {}) as any;
  const atvMode = String(settings?.atv?.mode || "manual").toLowerCase();

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
      return res.status(403).json({ message: "No se puede anular un documento de restaurante después del cierre Z" });
    }
  }

  // Documentos ACCEPTED en modo API: cancelación real mediante NC (Nota de Crédito)
  // Hacienda no permite "borrar" documentos aceptados; la forma legal es emitir NC con reasonCode=01
  if (atvMode === "api" && doc.status === "ACCEPTED" && (doc.docType === "FE" || doc.docType === "TE")) {
    const reason = String((req.body as any)?.reason || "Anulación del comprobante");
    const reasonCode = String((req.body as any)?.reasonCode || "01");

    // Emitir NC automáticamente mediante el servicio puro de notas
    let ncDoc: any = null;
    try {
      ncDoc = await createCreditDebitNote({
        hotelId,
        // @ts-ignore
        actorId: req.user?.sub,
        referenceDocId: doc.id,
        docType: "NC",
        reason,
        reasonCode,
      });
    } catch (err) {
      if (err instanceof NoteCreationError) {
        return res.status(err.statusCode).json({
          message: "No se pudo emitir la Nota de Crédito de anulación",
          detail: err.message,
        });
      }
      return res.status(502).json({
        message: "No se pudo emitir la Nota de Crédito de anulación",
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    // Enviar la NC a Hacienda automáticamente
    try {
      await submitDocumentToHacienda({
        hotelId,
        // @ts-ignore
        actorId: req.user?.sub,
        documentId: ncDoc.id,
      });
    } catch (submitErr) {
      console.warn("[cancelEInvoicingDocument] NC creada pero no se pudo enviar a Hacienda:", submitErr);
      // Continuamos para marcar el original como cancelado; la NC queda en DRAFT/SIGNED para reenvío manual.
    }

    // Registrar ack de cancelación y marcar el original como CANCELED
    await prisma.eInvoicingAcknowledgement.create({
      data: {
        hotelId,
        documentId: doc.id,
        type: "OTHER",
        status: "RECEIVED",
        message: `Cancelado mediante NC ${ncDoc.consecutive || ""}`,
        payload: { ncDocId: ncDoc.id, ncKey: ncDoc.key, reason, at: nowIso() },
      },
    });

    await prisma.eInvoicingDocument.updateMany({
      where: { id: doc.id, hotelId },
      data: {
        status: "CANCELED",
        response: { step: "CANCELED_VIA_NC", ncDocId: ncDoc.id, at: nowIso() },
      },
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
    return res.json({ canceled: fresh, creditNote: ncDoc });
  }

  // Modo sandbox o documentos DRAFT/SIGNED/SENT: cancelar localmente
  await prisma.eInvoicingAcknowledgement.create({
    data: {
      hotelId,
      documentId: doc.id,
      type: "OTHER",
      status: "RECEIVED",
      message: "Cancelado localmente",
      payload: { sandboxSimulated: atvMode !== "api", at: nowIso() },
    },
  });

  await prisma.eInvoicingDocument.updateMany({
    where: { id: doc.id, hotelId },
    data: { status: "CANCELED", response: { step: "CANCELED", at: nowIso() } },
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
  res.json(fresh);

  onEInvoicingDocument({
    hotelId,
    documentId: doc.id,
    docType: String(doc.docType),
    isVoid: true,
    // @ts-ignore
    actorId: (req as any)?.user?.sub ?? null,
  });
  return;
}
