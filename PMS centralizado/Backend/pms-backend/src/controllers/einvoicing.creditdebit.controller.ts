/**
 * Controlador para emisión de Notas de Crédito (NC, tipo 03) y Notas de Débito (ND, tipo 02)
 * Hacienda CR v4.4 — referencia obligatoria al documento electrónico original (FE/TE).
 *
 * NC: Anula total o parcialmente una FE/TE aceptada (descuento posterior, devolución, error).
 * ND: Cargo adicional sobre una FE/TE aceptada (ajuste de precio, intereses).
 */

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
  type CrReference,
} from "../services/einvoicing.xml.builder.js";

type NoteDocType = "NC" | "ND";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

function padLeft(s: string, len: number, char = "0") {
  const str = String(s ?? "");
  if (str.length >= len) return str.slice(-len);
  return char.repeat(len - str.length) + str;
}

function typeCode(docType: NoteDocType) {
  return docType === "ND" ? "02" : "03";
}

// Formato DDMMAAAA (8 dígitos) requerido por Hacienda CR
function dateDDMMAAAA(d: Date = new Date()) {
  const yyyy = String(d.getFullYear());
  const mm = padLeft(String(d.getMonth() + 1), 2);
  const dd = padLeft(String(d.getDate()), 2);
  return `${dd}${mm}${yyyy}`;
}

function randomSecurityCode() {
  return padLeft(String(randomInt(0, 100_000_000)), 8);
}

async function nextConsecutive(
  hotelId: string,
  docType: NoteDocType,
  branch: string,
  terminal: string
) {
  const b = padLeft(branch || "001", 3);
  const t = padLeft(terminal || "00001", 5);
  // Cast necesario hasta que el cliente Prisma se regenere con los nuevos enum values NC/ND
  const docTypeAny = docType as any;

  const seq = await prisma.$transaction(async (tx) => {
    const existing = await (tx as any).eInvoicingSequence.findUnique({
      where: { hotelId_docType_branch_terminal: { hotelId, docType: docTypeAny, branch: b, terminal: t } },
      select: { id: true, nextNumber: true },
    });
    if (!existing) {
      await (tx as any).eInvoicingSequence.create({
        data: { hotelId, docType: docTypeAny, branch: b, terminal: t, nextNumber: 2 },
      });
      return 1;
    }
    await (tx as any).eInvoicingSequence.update({
      where: { id: existing.id },
      data: { nextNumber: { increment: 1 } },
    });
    return existing.nextNumber;
  });

  const n = padLeft(String(seq), 10);
  return `${typeCode(docType)}${b}${t}${n}`;
}

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

// Códigos de razón para NC/ND según catálogo Hacienda:
// 01 = Anula documento de referencia
// 02 = Corrige texto de documento de referencia
// 03 = Corrige monto
// 04 = Referencia a otro documento
// 05 = Sustituye comprobante provisional por contingencia

/**
 * POST /einvoicing/notes/issue
 * Body: { referenceDocId, docType: "NC"|"ND", reason, reasonCode, items?, receiver? }
 *
 * referenceDocId: ID del EInvoicingDocument original (FE o TE) que se anula/ajusta.
 * reason: descripción del motivo (texto libre).
 * reasonCode: código Hacienda (01..05), default "01" para anulación total.
 * items: líneas a incluir en la nota. Si omite, replica las líneas del original.
 */
export async function issueNote(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { referenceDocId, docType, reason, reasonCode, items: bodyItems, receiver } = (req.body || {}) as {
    referenceDocId?: string;
    docType?: NoteDocType;
    reason?: string;
    reasonCode?: string;
    items?: any[];
    receiver?: any;
  };

  if (!referenceDocId) return res.status(400).json({ message: "referenceDocId requerido" });
  if (docType !== "NC" && docType !== "ND") return res.status(400).json({ message: "docType debe ser NC o ND" });
  if (!reason?.trim()) return res.status(400).json({ message: "reason requerido" });

  // Verificar que el doc original existe y está aceptado
  const refDoc = await prisma.eInvoicingDocument.findFirst({
    where: { id: referenceDocId, hotelId },
  });
  if (!refDoc) return res.status(404).json({ message: "Documento de referencia no encontrado" });
  if (!["ACCEPTED", "SENT"].includes(refDoc.status)) {
    return res.status(400).json({
      message: `El documento de referencia debe estar ACCEPTED o SENT para emitir ${docType}. Estado actual: ${refDoc.status}`,
    });
  }
  if (!refDoc.key) return res.status(400).json({ message: "El documento de referencia no tiene clave numérica" });

  const cfg = await prisma.eInvoicingConfig.findUnique({
    where: { hotelId },
    select: { enabled: true, settings: true },
  });
  if (!cfg?.enabled) return res.status(400).json({ message: "Facturación electrónica no está habilitada" });

  const settings = (cfg.settings || {}) as any;
  const issuer = (settings.issuer || {}) as any;
  const issuerIdNumber = String(issuer.idNumber || "").trim();
  if (!issuerIdNumber) {
    return res.status(400).json({ message: "Configure el emisor antes de emitir NC/ND" });
  }

  const countryCode = String(issuer.countryCode || "506");
  const situation = "1";

  // Módulo: usar la misma sucursal/terminal del doc original
  const branch  = String(refDoc.branch || "001");
  const terminal = String(refDoc.terminal || "00001");

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

  // Líneas: usar las del body o replicar del documento original
  const refPayload = (refDoc.payload || {}) as any;
  const sourceItems = bodyItems?.length
    ? bodyItems
    : (refPayload?.items || refPayload?.order?.items || []);

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

  const receiverData = receiver || (refDoc.receiver as any);
  const crReceiver: CrReceiver | undefined = receiverData?.idNumber ? {
    name: String(receiverData.name || receiverData.legalName || ""),
    idType: String(receiverData.idType || receiverData.idTypeCode || "01"),
    idNumber: String(receiverData.idNumber || receiverData.identification || ""),
    commercialName: receiverData.commercialName || undefined,
    phone: receiverData.phone || undefined,
    email: receiverData.email || undefined,
  } : undefined;

  const crLines = buildLinesFromPmsItems(
    sourceItems.map((item: any) => ({
      name: item.name || item.description || "Servicio",
      price: parseFloat(String(item.price ?? item.unitPrice ?? 0)),
      qty: item.qty ?? item.quantity ?? 1,
      cabysCode: item.cabysCode || undefined,
      taxRate: item.taxRate ?? 13,
      taxExempt: item.taxExempt ?? false,
    }))
  );

  const summary = buildSummaryFromLines(crLines);

  // Para NC el pago es "99" (otros), para ND igual
  const crPayments: CrPayment[] = [
    { method: "99", amount: summary.totalAmount },
  ];

  // Referencia al documento original — OBLIGATORIO para NC/ND
  const refDocTypeStr = String(refDoc.docType);
  const refDocTypeCode = refDocTypeStr === "FE" ? "01" : refDocTypeStr === "ND" ? "02" : refDocTypeStr === "NC" ? "03" : "04";
  const reference: CrReference = {
    docType: refDocTypeCode,
    key: refDoc.key,
    date: refDoc.createdAt.toISOString(),
    reason: String(reasonCode || "01"),
  };

  const xmlUnsigned = buildCrXml({
    docType,
    key,
    consecutive,
    issueDate: now,
    issuer: crIssuer,
    receiver: crReceiver,
    currency: "CRC",
    items: crLines,
    payments: crPayments,
    summary,
    condition: "01",
    references: [reference],
    notes: reason,
  });

  // @ts-ignore — Los nuevos campos (referenceDocId, NC/ND enum) requieren regenerar el cliente Prisma
  const doc = await (prisma.eInvoicingDocument as any).create({
    data: {
      hotelId,
      invoiceId: refDoc.invoiceId || null,
      restaurantOrderId: refDoc.restaurantOrderId || null,
      referenceDocId: refDoc.id,
      referenceKey: refDoc.key,
      referenceReason: reason,
      docType,
      status: "DRAFT",
      branch: padLeft(branch, 3),
      terminal: padLeft(terminal, 5),
      consecutive,
      key,
      receiver: (receiverData as any) ?? null,
      payload: {
        source: "note",
        docType,
        reasonCode: reasonCode || "01",
        reason,
        referenceDocId: refDoc.id,
        referenceKey: refDoc.key,
        referenceDocType: refDoc.docType,
        items: sourceItems,
        xml: xmlUnsigned,
      },
    },
  });

  return res.json(doc);
}

/**
 * GET /einvoicing/notes/:docId
 * Lista las NC/ND emitidas sobre un documento original.
 */
export async function listNotesForDoc(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const docId = String((req.params as any)?.docId || "");
  if (!docId) return res.status(400).json({ message: "docId requerido" });

  // @ts-ignore
  const notes = await (prisma.eInvoicingDocument as any).findMany({
    where: { hotelId, referenceDocId: docId },
    orderBy: { createdAt: "desc" },
  });
  return res.json(notes);
}
