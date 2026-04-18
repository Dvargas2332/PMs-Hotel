import { randomInt } from "node:crypto";
import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import {
  buildCrXml,
  buildLinesFromPmsItems,
  buildSummaryFromLines,
  type CrIssuer,
  type CrReceiver,
  type CrPayment,
} from "../services/einvoicing.xml.builder.js";

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

// Formato DDMMAAAA (8 dígitos) requerido por Hacienda CR para la clave de 50 dígitos
function dateDDMMAAAA(d: Date = new Date()) {
  const yyyy = String(d.getFullYear());
  const mm = padLeft(String(d.getMonth() + 1), 2);
  const dd = padLeft(String(d.getDate()), 2);
  return `${dd}${mm}${yyyy}`;
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

// Clave numérica según DGT-R-48-2016 v4.4:
// País(3) + DDMMAAAA(8) + Cédula(12) + Consecutivo(20) + Situación(1) + Seguridad(8) = 52 dígitos
// El XSD de Hacienda acepta este formato extendido desde la versión 4.3+
function crOfficialKey(opts: {
  countryCode: string;
  issuerId: string;
  consecutive: string;
  situation: string;
  securityCode: string;
  date?: Date;
}) {
  const country     = padLeft(String(opts.countryCode || "506").replace(/\D/g, ""), 3);
  const dateStr     = dateDDMMAAAA(opts.date);
  const issuer      = padLeft(String(opts.issuerId || "").replace(/\D/g, ""), 12);
  const consecutive = String(opts.consecutive || "").replace(/\D/g, "");
  const situation   = padLeft(String(opts.situation || "1").replace(/\D/g, ""), 1);
  const security    = padLeft(String(opts.securityCode || "").replace(/\D/g, ""), 8);
  return `${country}${dateStr}${issuer}${consecutive}${situation}${security}`;
}

function randomSecurityCode() {
  return padLeft(String(randomInt(0, 100_000_000)), 8);
}

export async function issueFrontdeskElectronicDoc(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { invoiceId, docType, receiver, situation: bodySituation } = (req.body || {}) as {
    invoiceId?: string;
    docType?: "FE" | "TE";
    receiver?: any;
    situation?: string; // override para contingencia: "1" normal, "3/4/5" contingencia
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
  // Situación: 1=normal, 3=corte eléctrico, 4=corte internet, 5=otros (contingencia)
  const situation = String(bodySituation || fd.situation || "1");
  const isContingency = ["3", "4", "5"].includes(situation);

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

  const now = new Date();
  const consecutive = await nextConsecutive(hotelId, docType, branch, terminal);
  const key = crOfficialKey({
    countryCode,
    issuerId: issuerIdNumber,
    consecutive,
    situation,
    securityCode: randomSecurityCode(),
    date: now,
  });

  // Construir XML CR V4.4
  const crIssuer: CrIssuer = {
    name: String(issuer.name || issuer.legalName || ""),
    idType: String(issuer.idType || issuer.idTypeCode || "02"),
    idNumber: issuerIdNumber,
    commercialName: issuer.commercialName || undefined,
    province: issuer.province || undefined,
    canton: issuer.canton || undefined,
    district: issuer.district || undefined,
    address: issuer.address || undefined,
    phone: issuer.phone || undefined,
    email: issuer.email || undefined,
    economicActivity: issuer.economicActivity || "551001",
  };

  const crReceiver: CrReceiver | undefined = receiver && receiver.idNumber ? {
    name: String(receiver.name || receiver.legalName || ""),
    idType: String(receiver.idType || receiver.idTypeCode || "01"),
    idNumber: String(receiver.idNumber || receiver.identification || ""),
    commercialName: receiver.commercialName || undefined,
    province: receiver.province || undefined,
    canton: receiver.canton || undefined,
    district: receiver.district || undefined,
    address: receiver.address || undefined,
    phone: receiver.phone || undefined,
    email: receiver.email || undefined,
  } : undefined;

  const currency = String((invoice as any).currency || "CRC");

  const crLines = buildLinesFromPmsItems(
    (invoice.items || []).map((item: any) => ({
      name: item.description || item.name || "Servicio",
      price: parseFloat(String(item.unitPrice ?? item.price ?? 0)),
      qty: item.quantity ?? item.qty ?? 1,
      cabysCode: item.cabysCode || undefined,
      commercialCode: item.itemId || item.id || undefined,
      taxRate: item.taxRate ?? 13,
      taxExempt: item.taxExempt ?? false,
    }))
  );

  const crPayments: CrPayment[] = (invoice.payments || []).map((p: any) => ({
    method: String(p.method || p.paymentMethod || "01"),
    amount: parseFloat(String(p.amount ?? 0)),
    currency: p.currency || currency || undefined,
    reference: p.reference || p.transactionId || undefined,
  }));
  if (!crPayments.length) {
    crPayments.push({ method: "01", amount: parseFloat(String(invoice.total ?? 0)) });
  }

  const summary = buildSummaryFromLines(crLines);
  const xmlUnsigned = buildCrXml({
    docType,
    key,
    consecutive,
    issueDate: now,
    issuer: crIssuer,
    receiver: crReceiver,
    currency,
    items: crLines,
    payments: crPayments,
    summary,
    condition: "01",
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
    // XML sin firmar listo para enviar a Microfactura
    xml: xmlUnsigned,
  };

  const doc = await prisma.eInvoicingDocument.create({
    data: {
      hotelId,
      invoiceId,
      docType,
      // En contingencia el documento queda en estado CONTINGENCY hasta que se transmita
      status: isContingency ? "CONTINGENCY" : "DRAFT",
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
