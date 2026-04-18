import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

export async function listEInvoicingAcknowledgements(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const q = String((req.query as any)?.q || "").trim();
  const docId = String((req.query as any)?.docId || "").trim();
  const docType = String((req.query as any)?.docType || "").trim().toUpperCase();
  const status = String((req.query as any)?.status || "").trim().toUpperCase();
  const type = String((req.query as any)?.type || "").trim().toUpperCase();
  const dateFrom = String((req.query as any)?.dateFrom || "").trim();
  const dateTo = String((req.query as any)?.dateTo || "").trim();

  const where: any = { hotelId };
  if (docId) where.documentId = docId;
  if (status) where.status = status;
  if (type) where.type = type;

  const and: any[] = [];
  if (docType) {
    and.push({ document: { docType } });
  }
  if (dateFrom) {
    const d = new Date(dateFrom);
    if (Number.isNaN(d.getTime())) return res.status(400).json({ message: "dateFrom invalida" });
    and.push({ createdAt: { gte: d } });
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (Number.isNaN(d.getTime())) return res.status(400).json({ message: "dateTo invalida" });
    d.setHours(23, 59, 59, 999);
    and.push({ createdAt: { lte: d } });
  }

  if (q) {
    and.push({
      OR: [
        { message: { contains: q, mode: "insensitive" } },
        { document: { key: { contains: q, mode: "insensitive" } } },
        { document: { consecutive: { contains: q, mode: "insensitive" } } },
        { document: { invoice: { number: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (and.length) where.AND = and;

  const list = await prisma.eInvoicingAcknowledgement.findMany({
    where,
    include: {
      document: {
        select: {
          id: true,
          docType: true,
          status: true,
          key: true,
          consecutive: true,
          invoice: { select: { id: true, number: true, total: true, currency: true } },
          restaurantOrder: { select: { id: true, saleNumber: true, tableId: true, sectionId: true, total: true, serviceType: true } },
          payload: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return res.json(
    list.map((a) => ({
      id: a.id,
      documentId: a.documentId,
      type: a.type,
      status: a.status,
      message: a.message,
      createdAt: a.createdAt,
      hasPayload: a.payload != null,
      doc: {
        id: a.document.id,
        docType: a.document.docType,
        status: a.document.status,
        key: a.document.key,
        consecutive: a.document.consecutive,
        source: (a.document.payload as any)?.source || null,
        invoice: a.document.invoice,
        restaurantOrder: a.document.restaurantOrder,
      },
    }))
  );
}

export async function getEInvoicingAcknowledgement(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const id = String((req.params as any)?.id || "").trim();
  if (!id) return res.status(400).json({ message: "id requerido" });

  const ack = await prisma.eInvoicingAcknowledgement.findFirst({
    where: { id, hotelId },
    include: {
      document: {
        select: {
          id: true,
          docType: true,
          status: true,
          key: true,
          consecutive: true,
          branch: true,
          terminal: true,
          invoice: { select: { id: true, number: true, total: true, currency: true } },
          restaurantOrder: { select: { id: true, saleNumber: true, tableId: true, sectionId: true, total: true, serviceType: true } },
          payload: true,
        },
      },
    },
  });
  if (!ack) return res.status(404).json({ message: "Acuse no encontrado" });

  return res.json({
    id: ack.id,
    documentId: ack.documentId,
    type: ack.type,
    status: ack.status,
    message: ack.message,
    payload: ack.payload,
    createdAt: ack.createdAt,
    doc: {
      id: ack.document.id,
      docType: ack.document.docType,
      status: ack.document.status,
      key: ack.document.key,
      consecutive: ack.document.consecutive,
      branch: ack.document.branch,
      terminal: ack.document.terminal,
      source: (ack.document.payload as any)?.source || null,
      invoice: ack.document.invoice,
      restaurantOrder: ack.document.restaurantOrder,
    },
  });
}

export async function createEInvoicingAcknowledgement(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { documentId, type, status, message, payload } = (req.body || {}) as any;
  if (!documentId) return res.status(400).json({ message: "documentId requerido" });
  if (!type) return res.status(400).json({ message: "type requerido" });

  const doc = await prisma.eInvoicingDocument.findFirst({
    where: { id: String(documentId), hotelId },
    select: { id: true },
  });
  if (!doc) return res.status(404).json({ message: "Documento no encontrado para este hotel" });

  const created = await prisma.eInvoicingAcknowledgement.create({
    data: {
      hotelId,
      documentId: String(documentId),
      type,
      status: status || "RECEIVED",
      message: message || null,
      payload: payload ?? null,
    },
  });

  return res.json(created);
}
