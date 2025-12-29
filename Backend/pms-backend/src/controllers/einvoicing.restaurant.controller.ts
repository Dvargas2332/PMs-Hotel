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
  return docType === "FE" ? "01" : "04";
}

function todayDDMMYY() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = padLeft(String(d.getMonth() + 1), 2);
  const dd = padLeft(String(d.getDate()), 2);
  return `${dd}${mm}${yy}`;
}

async function nextConsecutive(hotelId: string, docType: "FE" | "TE", branch: string, terminal: string) {
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

function randomSecurityCode() {
  return padLeft(String(Math.floor(Math.random() * 100_000_000)), 8);
}

function crOfficialKey(opts: {
  countryCode: string;
  issuerId: string;
  consecutive: string;
  situation: string;
  securityCode: string;
}) {
  const country = padLeft(String(opts.countryCode || "506").replace(/\D/g, ""), 3);
  const issuer = padLeft(String(opts.issuerId || "").replace(/\D/g, ""), 12);
  const consecutive = String(opts.consecutive || "").replace(/\D/g, "");
  const situation = padLeft(String(opts.situation || "1").replace(/\D/g, ""), 1);
  const security = padLeft(String(opts.securityCode || "").replace(/\D/g, ""), 8);
  return `${country}${todayDDMMYY()}${issuer}${consecutive}${situation}${security}`;
}

export async function issueRestaurantElectronicDoc(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { restaurantOrderId, docType, receiver } = (req.body || {}) as {
    restaurantOrderId?: string;
    docType?: "FE" | "TE";
    receiver?: any;
  };
  if (!restaurantOrderId) return res.status(400).json({ message: "restaurantOrderId requerido" });
  if (docType !== "FE" && docType !== "TE") return res.status(400).json({ message: "docType inválido (FE/TE)" });

  const cfg = await prisma.eInvoicingConfig.findUnique({
    where: { hotelId },
    select: { enabled: true, settings: true },
  });
  if (!cfg?.enabled) return res.status(400).json({ message: "Facturación electrónica no está habilitada" });

  const settings = (cfg.settings || {}) as any;
  const connections = (settings.moduleConnections || {}) as any;
  if (connections.restaurant === false) {
    return res.status(400).json({ message: "Restaurante no está habilitado para facturación electrónica" });
  }

  const issuer = (settings.issuer || {}) as any;
  const rs = (settings.restaurant || {}) as any;
  const countryCode = String(issuer.countryCode || "506");
  const issuerIdNumber = String(issuer.idNumber || "");
  const branch = String(rs.branch || "001");
  const terminal = String(rs.terminal || "00001");
  const situation = String(rs.situation || "1");
  if (!issuerIdNumber.trim()) {
    return res.status(400).json({
      message: "Configure el emisor en Facturación Electrónica (número de identificación del emisor) antes de emitir FE/TE.",
    });
  }

  const order = await prisma.restaurantOrder.findFirst({
    where: { id: String(restaurantOrderId), hotelId },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ message: "Orden no encontrada para este hotel" });
  if (order.status !== "PAID") {
    return res.status(400).json({ message: "La orden debe estar pagada antes de emitir FE/TE" });
  }

  const existing = await prisma.eInvoicingDocument.findFirst({
    where: { hotelId, restaurantOrderId: String(restaurantOrderId), docType },
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
    source: "restaurant",
    issuer: {
      countryCode,
      idNumber: issuerIdNumber,
      branch: padLeft(branch, 3),
      terminal: padLeft(terminal, 5),
      situation,
    },
    order: {
      id: order.id,
      sectionId: order.sectionId,
      tableId: order.tableId,
      status: order.status,
      serviceType: order.serviceType,
      roomId: order.roomId,
      total: order.total,
      tip10: order.tip10,
      paymentBreakdown: order.paymentBreakdown,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items,
    },
  };

  const doc = await prisma.eInvoicingDocument.create({
    data: {
      hotelId,
      restaurantOrderId: String(restaurantOrderId),
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

  return res.json(doc);
}
