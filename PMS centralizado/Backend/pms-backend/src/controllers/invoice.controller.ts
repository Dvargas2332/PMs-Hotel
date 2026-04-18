import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

const INVOICE_INCLUDE = {
  guest: { select: { id: true, firstName: true, lastName: true, email: true, idNumber: true } },
  reservation: {
    select: {
      id: true, code: true, checkIn: true, checkOut: true, adults: true, children: true,
      ratePlan: { select: { id: true, name: true, currency: true, price: true } },
      mealPlan: { select: { id: true, name: true } },
      room: { select: { id: true, number: true, type: true, currency: true } },
    },
  },
  items: { orderBy: { createdAt: "asc" as const } },
  payments: { orderBy: { createdAt: "asc" as const } },
  eInvoicingDocuments: {
    select: { id: true, docType: true, status: true, key: true, consecutive: true, createdAt: true },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

// ─── GET /invoices ───────────────────────────────────────────────────────────
export async function listInvoices(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { dateFrom, dateTo, number, guest, room, status } = req.query as Record<string, string | undefined>;
  const where: any = { hotelId };
  const and: any[] = [];

  if (status) where.status = status;
  if (number) and.push({ number: { contains: number, mode: "insensitive" } });
  if (guest) {
    const g = guest.trim();
    and.push({ OR: [
      { guest: { firstName: { contains: g, mode: "insensitive" } } },
      { guest: { lastName:  { contains: g, mode: "insensitive" } } },
      { guest: { email:     { contains: g, mode: "insensitive" } } },
    ]});
  }
  if (room) {
    const r = room.trim();
    and.push({ reservation: { room: { OR: [
      { number: { contains: r, mode: "insensitive" } },
    ]}}});
  }
  if (dateFrom) {
    const d = new Date(dateFrom);
    if (isNaN(d.getTime())) return res.status(400).json({ message: "dateFrom invalida" });
    and.push({ createdAt: { gte: d } });
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (isNaN(d.getTime())) return res.status(400).json({ message: "dateTo invalida" });
    d.setHours(23, 59, 59, 999);
    and.push({ createdAt: { lte: d } });
  }
  if (and.length) where.AND = and;

  const list = await prisma.invoice.findMany({
    where,
    include: INVOICE_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  res.json(list);
}

// ─── GET /invoices/:id ───────────────────────────────────────────────────────
export async function getInvoice(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { id } = req.params;
  const inv = await prisma.invoice.findFirst({ where: { id, hotelId }, include: INVOICE_INCLUDE });
  if (!inv) return res.status(404).json({ message: "Factura no encontrada" });
  res.json(inv);
}

// ─── POST /invoices/:id/items ────────────────────────────────────────────────
export async function addInvoiceItem(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { id } = req.params;
  const { description, quantity, unitPrice } = req.body ?? {};
  if (!description || unitPrice === undefined)
    return res.status(400).json({ message: "description y unitPrice requeridos" });

  const inv = await prisma.invoice.findFirst({ where: { id, hotelId } });
  if (!inv) return res.status(404).json({ message: "Factura no encontrada" });
  if (inv.status === "CANCELED") return res.status(400).json({ message: "No se puede editar una factura cancelada" });

  const qty = Number(quantity ?? 1);
  const price = Number(unitPrice);
  const total = qty * price;

  const [item] = await prisma.$transaction([
    prisma.invoiceItem.create({
      data: { invoiceId: id, hotelId, description, quantity: qty, unitPrice: price, total },
    }),
    prisma.invoice.update({
      where: { id },
      data: { total: { increment: total } },
    }),
  ]);

  const updated = await prisma.invoice.findFirst({ where: { id, hotelId }, include: INVOICE_INCLUDE });
  res.status(201).json(updated);
}

// ─── DELETE /invoices/:id/items/:itemId ──────────────────────────────────────
export async function removeInvoiceItem(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { id, itemId } = req.params;

  const inv = await prisma.invoice.findFirst({ where: { id, hotelId } });
  if (!inv) return res.status(404).json({ message: "Factura no encontrada" });
  if (inv.status === "CANCELED") return res.status(400).json({ message: "No se puede editar una factura cancelada" });

  const item = await prisma.invoiceItem.findFirst({ where: { id: itemId, invoiceId: id, hotelId } });
  if (!item) return res.status(404).json({ message: "Cargo no encontrado" });

  await prisma.$transaction([
    prisma.invoiceItem.delete({ where: { id: itemId } }),
    prisma.invoice.update({ where: { id }, data: { total: { decrement: Number(item.total) } } }),
  ]);

  const updated = await prisma.invoice.findFirst({ where: { id, hotelId }, include: INVOICE_INCLUDE });
  res.json(updated);
}

// ─── POST /invoices/:id/payments ─────────────────────────────────────────────
export async function recordPayment(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { id } = req.params;
  const { method, amount } = req.body ?? {};
  if (!method || amount === undefined)
    return res.status(400).json({ message: "method y amount requeridos" });

  const inv = await prisma.invoice.findFirst({ where: { id, hotelId }, include: { payments: true } });
  if (!inv) return res.status(404).json({ message: "Factura no encontrada" });
  if (inv.status === "CANCELED") return res.status(400).json({ message: "No se puede pagar una factura cancelada" });

  const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Number(inv.total) - paid;

  await prisma.payment.create({ data: { invoiceId: id, hotelId, method, amount: Number(amount) } });

  // Mark ISSUED when fully paid
  const newPaid = paid + Number(amount);
  if (newPaid >= Number(inv.total)) {
    await prisma.invoice.update({ where: { id }, data: { status: "ISSUED" } });
  }

  const updated = await prisma.invoice.findFirst({ where: { id, hotelId }, include: INVOICE_INCLUDE });
  res.status(201).json(updated);
}

// ─── DELETE /invoices/:id/payments/:paymentId ────────────────────────────────
export async function removePayment(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { id, paymentId } = req.params;

  const pmt = await prisma.payment.findFirst({ where: { id: paymentId, invoiceId: id, hotelId } });
  if (!pmt) return res.status(404).json({ message: "Pago no encontrado" });

  await prisma.payment.delete({ where: { id: paymentId } });

  // If status was ISSUED, revert to DRAFT
  const inv = await prisma.invoice.findFirst({ where: { id, hotelId }, include: { payments: true } });
  if (inv && inv.status === "ISSUED") {
    const newPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    if (newPaid < Number(inv.total)) {
      await prisma.invoice.update({ where: { id }, data: { status: "DRAFT" } });
    }
  }

  const updated = await prisma.invoice.findFirst({ where: { id, hotelId }, include: INVOICE_INCLUDE });
  res.json(updated);
}

// ─── PATCH /invoices/:id/status ──────────────────────────────────────────────
export async function updateInvoiceStatus(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { id } = req.params;
  const { status } = req.body ?? {};
  const ALLOWED = ["DRAFT", "ISSUED", "CANCELED", "REFUNDED"];
  if (!ALLOWED.includes(status)) return res.status(400).json({ message: "Estado inválido" });

  const inv = await prisma.invoice.findFirst({ where: { id, hotelId } });
  if (!inv) return res.status(404).json({ message: "Factura no encontrada" });

  const updated = await prisma.invoice.update({ where: { id }, data: { status }, include: INVOICE_INCLUDE });
  res.json(updated);
}
