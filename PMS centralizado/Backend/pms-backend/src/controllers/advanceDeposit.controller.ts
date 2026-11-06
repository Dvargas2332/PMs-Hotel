// src/controllers/advanceDeposit.controller.ts
import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

function sanitizeDeposit(d: any): any {
  if (!d) return d;
  const { hotelId: _h, ...safe } = d;
  return safe;
}

async function findAccountExact(hotelId: string, code: string) {
  return prisma.accountingAccount.findUnique({
    where: { hotelId_code: { hotelId, code } },
    select: { id: true, code: true, name: true, isActive: true },
  });
}

async function findAccountByPrefix(hotelId: string, codePrefix: string) {
  return prisma.accountingAccount.findFirst({
    where: { hotelId, code: { startsWith: codePrefix }, isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

async function resolveAccount(hotelId: string, exactCode: string, fallbackPrefix: string) {
  const exact = await findAccountExact(hotelId, exactCode);
  if (exact?.isActive) return exact;
  return findAccountByPrefix(hotelId, fallbackPrefix);
}

async function nextEntryNumber(hotelId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AC-${year}-`;
  const last = await prisma.accountingEntry.findFirst({
    where: { hotelId, number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = last ? parseInt(last.number.split("-")[2] ?? "0", 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(5, "0")}`;
}

async function createAccountingEntry(params: {
  hotelId: string;
  description: string;
  sourceRefId?: string | null;
  currency?: string;
  autoPost: boolean;
  actorId?: string | null;
  lines: { accountId: string; debit: number; credit: number; description?: string | null }[];
}) {
  const { hotelId, description, sourceRefId, currency, autoPost, actorId, lines } = params;
  const status = autoPost ? "POSTED" : "DRAFT";
  const number = await nextEntryNumber(hotelId);
  return prisma.accountingEntry.create({
    data: {
      hotelId,
      number,
      date: new Date(),
      description,
      status,
      source: "FRONTDESK",
      sourceRefId: sourceRefId ?? null,
      currency: currency ?? "CRC",
      createdBy: actorId ?? null,
      ...(autoPost && { approvedBy: actorId ?? null, approvedAt: new Date() }),
      updatedAt: new Date(),
      lines: {
        create: lines.map((l) => ({
          hotelId,
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          description: l.description ?? null,
        })),
      },
    },
  });
}

// GET /api/reservations/deposits — listar depósitos
export async function listDeposits(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const reservationId = String(req.query.reservationId || "").trim();
  const where: any = { hotelId: user.hotelId };
  if (reservationId) where.reservationId = reservationId;

  const deposits = await prisma.advanceDeposit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(deposits.map(sanitizeDeposit));
}

// POST /api/reservations/deposits — registrar pre-pago con contabilidad
export async function createDeposit(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido" });
  const hotelId = user.hotelId;

  const { reservationId, guestId, voucher, description, amount, currency, paymentMethod, note } = req.body || {};
  if (!description || !String(description).trim()) return res.status(400).json({ message: "description es requerido" });
  if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "amount debe ser mayor a 0" });

  const reservation = reservationId
    ? await prisma.reservation.findFirst({ where: { id: reservationId, hotelId }, select: { id: true } })
    : null;
  if (reservationId && !reservation) return res.status(404).json({ message: "Reservación no encontrada" });

  const deposit = await prisma.advanceDeposit.create({
    data: {
      hotelId,
      reservationId: reservationId || null,
      guestId: guestId || null,
      voucher: voucher || null,
      description: description || null,
      amount: Number(amount),
      currency: currency || "CRC",
      paymentMethod: paymentMethod || null,
      note: note || null,
    },
  });

  // Si hay factura asociada, reflejar el depósito como pago
  if (reservationId) {
    const invoice = await prisma.invoice.findFirst({
      where: { reservationId, hotelId },
      select: { id: true, status: true },
    });
    if (invoice && invoice.status !== "CANCELED") {
      await prisma.payment.create({
        data: {
          hotelId,
          invoiceId: invoice.id,
          method: paymentMethod || "AdvanceDeposit",
          amount: Number(amount),
        },
      });
    }
  }

  // Contabilidad: registrar el pre-pago como DR Banco/Caja, CR Anticipos de clientes
  try {
    const settings = await prisma.accountingSettings.findUnique({ where: { hotelId } });
    if (settings?.integrations && (settings.integrations as any).frontdesk) {
      const cashAccount = await resolveAccount(hotelId, "1.1.01.01", "1.1.01");
      const advanceAccount = await resolveAccount(hotelId, "2.1.03.01", "2.1.03"); // Anticipos de clientes
      if (cashAccount && advanceAccount) {
        await createAccountingEntry({
          hotelId,
          description: `Pre-pago ${voucher || ""} — ${description || reservation?.id?.slice(0, 8) || ""}`,
          sourceRefId: deposit.id,
          currency: currency || "CRC",
          autoPost: settings.autoPost,
          actorId: user.sub,
          lines: [
            { accountId: cashAccount.id, debit: Number(amount), credit: 0, description: paymentMethod || "Pre-pago" },
            { accountId: advanceAccount.id, debit: 0, credit: Number(amount), description: "Anticipo de cliente" },
          ],
        });
      }
    }
  } catch (acctErr) {
    console.error("[advanceDeposit] accounting entry failed:", acctErr);
  }

  res.status(201).json(sanitizeDeposit(deposit));
}

// DELETE /api/reservations/deposits/:id
export async function deleteDeposit(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido" });
  const { id } = req.params;
  const deposit = await prisma.advanceDeposit.findFirst({ where: { id, hotelId: user.hotelId } });
  if (!deposit) return res.status(404).json({ message: "Depósito no encontrado" });
  await prisma.advanceDeposit.deleteMany({ where: { id, hotelId: user.hotelId } });
  res.json({ ok: true });
}

// GET /api/frontdesk/payment-methods — métodos de pago desde config
export async function listPaymentMethods(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  // Obtener métodos desde la config de restaurante (cobros) + métodos estándar
  const cfg = await prisma.restaurantConfig.findUnique({
    where: { hotelId: user.hotelId },
    select: { payments: true },
  });

  const stored = (cfg?.payments && typeof cfg.payments === "object" ? cfg.payments : {}) as any;
  const cobros: string[] = Array.isArray(stored.cobros)
    ? stored.cobros
    : typeof stored.cobros === "string"
      ? String(stored.cobros).split(",").map((s: string) => s.trim()).filter(Boolean)
      : ["Efectivo", "Tarjeta", "Transferencia", "Sinpe Móvil", "Cheque"];

  res.json(cobros);
}
