import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

function padLeft(input: string, len: number, char = "0") {
  const s = String(input ?? "");
  if (s.length >= len) return s.slice(-len);
  return char.repeat(len - s.length) + s;
}

function typeCode(docType: "FE" | "TE") {
  // Costa Rica: 01 = Factura electrónica, 04 = Tiquete electrónico
  return docType === "FE" ? "01" : "04";
}

function todayYYMMDD() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = padLeft(String(d.getMonth() + 1), 2);
  const dd = padLeft(String(d.getDate()), 2);
  return `${yy}${mm}${dd}`;
}

function todayDDMMYY() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = padLeft(String(d.getMonth() + 1), 2);
  const dd = padLeft(String(d.getDate()), 2);
  return `${dd}${mm}${yy}`;
}

async function nextConsecutive(hotelId: string, docType: "FE" | "TE", branch: string, terminal: string) {
  // Consecutivo (20 dígitos): TT + SSS + TTTTT + NNNNNNNNNN (10)
  const b = padLeft(branch || "001", 3);
  const t = padLeft(terminal || "00001", 5);

  const seq = await prisma.$transaction(async (tx) => {
    const existing = await tx.eInvoicingSequence.findUnique({
      where: { hotelId_docType_branch_terminal: { hotelId, docType, branch: b, terminal: t } },
      select: { id: true, nextNumber: true },
    });
    if (!existing) {
      await tx.eInvoicingSequence.create({
        data: { hotelId, docType, branch: b, terminal: t, nextNumber: 2 },
      });
      return 1;
    }
    await tx.eInvoicingSequence.update({
      where: { id: existing.id },
      data: { nextNumber: { increment: 1 } },
    });
    return existing.nextNumber;
  });

  const n = padLeft(String(seq), 10);
  return `${typeCode(docType)}${b}${t}${n}`;
}

function pseudoKey(consecutive: string) {
  // Placeholder key until we implement official CR key generation (requires issuer ID).
  const rnd = padLeft(String(Math.floor(Math.random() * 1_000_000)), 6);
  return `CR-PENDING-${todayYYMMDD()}-${consecutive}-${rnd}`;
}

function crOfficialKey(opts: {
  countryCode: string; // 3 digits, e.g. 506
  issuerId: string; // numeric, 12 digits padded
  consecutive: string; // 20 digits
  situation: string; // 1 digit
  securityCode: string; // 8 digits
}) {
  const country = padLeft(String(opts.countryCode || "506").replace(/\D/g, ""), 3);
  const issuer = padLeft(String(opts.issuerId || "").replace(/\D/g, ""), 12);
  const consecutive = String(opts.consecutive || "").replace(/\D/g, "");
  const situation = padLeft(String(opts.situation || "1").replace(/\D/g, ""), 1);
  const security = padLeft(String(opts.securityCode || "").replace(/\D/g, ""), 8);

  return `${country}${todayDDMMYY()}${issuer}${consecutive}${situation}${security}`;
}

function randomSecurityCode() {
  return padLeft(String(Math.floor(Math.random() * 100_000_000)), 8);
}

export async function issueFrontdeskElectronicDoc(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { invoiceId, docType, receiver } = (req.body || {}) as {
    invoiceId?: string;
    docType?: "FE" | "TE";
    receiver?: any;
  };
  if (!invoiceId) return res.status(400).json({ message: "invoiceId requerido" });
  if (docType !== "FE" && docType !== "TE") return res.status(400).json({ message: "docType invalido (FE/TE)" });

  const cfg = await prisma.eInvoicingConfig.findUnique({
    where: { hotelId },
    select: { enabled: true, settings: true },
  });
  if (!cfg?.enabled) return res.status(400).json({ message: "Facturación electrónica no está habilitada" });

  const settings = (cfg.settings || {}) as any;
  const connections = (settings.moduleConnections || {}) as any;
  if (connections.frontdesk === false) {
    return res.status(400).json({ message: "Frontdesk no está habilitado para facturación electrónica" });
  }
  const issuer = (settings.issuer || {}) as any;
  const fd = (settings.frontdesk || {}) as any;
  const branch = String(fd.branch || "001");
  const terminal = String(fd.terminal || "00001");
  const countryCode = String(issuer.countryCode || "506");
  const issuerIdNumber = String(issuer.idNumber || "");
  const situation = String(fd.situation || "1");

  if (!issuerIdNumber.trim()) {
    return res.status(400).json({
      message: "Configure el emisor en Facturación Electrónica (Issuer ID number) antes de emitir FE/TE.",
    });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, hotelId },
    include: {
      guest: { select: { id: true, firstName: true, lastName: true, email: true } },
      reservation: { select: { id: true, checkIn: true, checkOut: true, room: { select: { number: true, type: true } } } },
      items: true,
      payments: true,
    },
  });
  if (!invoice) return res.status(404).json({ message: "Invoice no encontrada para este hotel" });

  const existing = await prisma.eInvoicingDocument.findFirst({
    where: { hotelId, invoiceId, docType },
  });
  if (existing) return res.json(existing);

  const consecutive = await nextConsecutive(hotelId, docType, branch, terminal);
  const key = crOfficialKey({
    countryCode,
    issuerId: issuerIdNumber,
    consecutive,
    situation,
    securityCode: randomSecurityCode(),
  });

  const payload = {
    source: "frontdesk",
    issuer: {
      countryCode,
      idNumber: issuerIdNumber,
      branch: padLeft(branch, 3),
      terminal: padLeft(terminal, 5),
      situation,
    },
    invoice: {
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      total: invoice.total,
      currency: invoice.currency,
      createdAt: invoice.createdAt,
    },
    guest: invoice.guest,
    reservation: invoice.reservation,
    items: invoice.items,
    payments: invoice.payments,
  };

  const doc = await prisma.eInvoicingDocument.create({
    data: {
      hotelId,
      invoiceId,
      docType,
      status: "DRAFT",
      branch: padLeft(branch, 3),
      terminal: padLeft(terminal, 5),
      consecutive,
      key,
      receiver: receiver ?? null,
      payload,
    },
  });

  const currentEinvoice = (invoice.eInvoice || {}) as any;
  const docs = { ...(currentEinvoice.docs || {}) };
  docs[docType] = {
    id: doc.id,
    status: doc.status,
    consecutive: doc.consecutive,
    key: doc.key,
    updatedAt: doc.updatedAt,
  };

  await prisma.invoice.updateMany({
    where: { id: invoiceId, hotelId },
    data: {
      eInvoice: {
        ...(currentEinvoice || {}),
        docs,
        lastIssuedType: docType,
        lastUpdatedAt: new Date().toISOString(),
      },
    },
  });

  return res.json(doc);
}

export async function listFrontdeskElectronicDocs(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const invoiceId = String((req.params as any)?.invoiceId || "");
  if (!invoiceId) return res.status(400).json({ message: "invoiceId requerido" });

  const list = await prisma.eInvoicingDocument.findMany({
    where: { hotelId, invoiceId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return res.json(list);
}
