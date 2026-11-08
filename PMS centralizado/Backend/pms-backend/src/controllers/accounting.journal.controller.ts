import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";

// Genera el correlativo AC-YYYY-NNNNN
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

// Valida que el asiento esté balanceado (débito = crédito)
function assertBalanced(lines: { debit: number; credit: number }[]) {
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Asiento desbalanceado: débito ${totalDebit.toFixed(2)} ≠ crédito ${totalCredit.toFixed(2)}`);
  }
}

async function ensurePeriodBelongsToHotel(hotelId: string, periodId: unknown) {
  if (!periodId) return null;
  const normalizedPeriodId = String(periodId).trim();
  if (!normalizedPeriodId) return null;

  const period = await prisma.accountingPeriod.findFirst({
    where: { id: normalizedPeriodId, hotelId },
    select: { id: true, status: true },
  });
  if (!period) throw new Error("El período indicado no pertenece al hotel actual");
  return period;
}

/** Un período cerrado no admite asientos nuevos, contabilizaciones ni anulaciones. */
function assertPeriodOpen(period: { id: string; status?: string | null } | null) {
  if (period && String(period.status || "").toUpperCase() === "CLOSED") {
    throw new Error("El período está cerrado: no admite asientos nuevos, contabilizaciones ni anulaciones");
  }
}

/**
 * Devuelve el período del asiento: el indicado a mano (validando que sea del
 * hotel y esté abierto) o, si no viene, el período abierto que cubre la fecha.
 */
async function resolvePeriod(hotelId: string, date: Date, explicitPeriodId?: unknown) {
  if (explicitPeriodId) {
    const period = await ensurePeriodBelongsToHotel(hotelId, explicitPeriodId);
    assertPeriodOpen(period);
    return period;
  }
  const covering = await prisma.accountingPeriod.findMany({
    where: { hotelId, startDate: { lte: date }, endDate: { gte: date } },
    select: { id: true, status: true },
    orderBy: { startDate: "desc" },
  });
  if (covering.length === 0) return null;
  const open = covering.find((p) => String(p.status || "").toUpperCase() !== "CLOSED");
  if (!open) {
    throw new Error("El período que cubre esa fecha está cerrado: abrí un período nuevo o cambiá la fecha");
  }
  return open;
}

async function ensureAccountsBelongToHotel(hotelId: string, lines: any[]) {
  const requestedAccountIds = Array.from(
    new Set(
      lines
        .map((line) => String(line?.accountId || "").trim())
        .filter(Boolean)
    )
  );

  if (requestedAccountIds.length !== lines.length) {
    throw new Error("Todas las líneas deben incluir una cuenta válida");
  }

  const accounts = await prisma.accountingAccount.findMany({
    where: { hotelId, id: { in: requestedAccountIds } },
    select: { id: true },
  });
  if (accounts.length !== requestedAccountIds.length) {
    throw new Error("Una o más cuentas no pertenecen al hotel actual");
  }
}

function sanitizeEntry(entry: any, hotelId: string) {
  return {
    ...entry,
    period: entry.period && entry.period.hotelId === hotelId ? entry.period : null,
    lines: Array.isArray(entry.lines)
      ? entry.lines.filter((line: any) => !line.account || line.account.hotelId === hotelId)
      : [],
  };
}

// GET /accounting/entries
export async function listEntries(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { status, source, periodId, from, to, q, limit = "50", offset = "0" } = req.query;
  try {
    const where: any = {
      hotelId,
      ...(status && { status }),
      ...(source && { source }),
      ...(periodId && { periodId }),
      ...(from || to) && {
        date: {
          ...(from && { gte: new Date(from as string) }),
          ...(to && { lte: new Date(to as string) }),
        },
      },
      ...(q && {
        OR: [
          { number: { contains: q as string } },
          { description: { contains: q as string, mode: "insensitive" } },
        ],
      }),
    };
    const [total, entries] = await Promise.all([
      prisma.accountingEntry.count({ where }),
      prisma.accountingEntry.findMany({
        where,
        orderBy: [{ date: "desc" }, { number: "desc" }],
        take: Number(limit),
        skip: Number(offset),
        include: {
          lines: {
            include: { account: { select: { hotelId: true, code: true, name: true, type: true } } },
          },
        },
      }),
    ]);
    res.json({ total, entries: entries.map((entry) => sanitizeEntry(entry, hotelId)) });
  } catch (e) {
    res.status(500).json({ message: "Error al obtener asientos" });
  }
}

// GET /accounting/entries/:id
export async function getEntry(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { id } = req.params;
  try {
    const entry = await prisma.accountingEntry.findFirst({
      where: { id, hotelId },
      include: {
        lines: {
          include: { account: { select: { hotelId: true, id: true, code: true, name: true, type: true } } },
        },
        period: {
          select: {
            id: true,
            hotelId: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
            closedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!entry) return res.status(404).json({ message: "Asiento no encontrado" });
    res.json(sanitizeEntry(entry, hotelId));
  } catch (e) {
    res.status(500).json({ message: "Error al obtener asiento" });
  }
}

// POST /accounting/entries — crear asiento manual
export async function createEntry(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const userId = (req as any).user?.id as string | undefined;
  const { date, description, lines, periodId, currency, source = "MANUAL", sourceRefId } = req.body;

  if (!date || !description || !Array.isArray(lines) || lines.length < 2) {
    return res.status(400).json({ message: "date, description y al menos 2 líneas son requeridos" });
  }
  try {
    assertBalanced(lines);
    const entryDate = new Date(date);
    const period = await resolvePeriod(hotelId, entryDate, periodId);
    const safePeriodId = period?.id ?? null;
    await ensureAccountsBelongToHotel(hotelId, lines);

    const settings = await prisma.accountingSettings.findUnique({ where: { hotelId } });
    const autoPost = settings?.autoPost ?? false;
    const status = autoPost ? "POSTED" : "DRAFT";
    const number = await nextEntryNumber(hotelId);

    const entry = await prisma.accountingEntry.create({
      data: {
        hotelId,
        number,
        date: new Date(date),
        description,
        status,
        source,
        sourceRefId: sourceRefId ?? null,
        periodId: safePeriodId,
        currency: currency ?? "CRC",
        createdBy: userId ?? null,
        ...(autoPost && { approvedBy: userId ?? null, approvedAt: new Date() }),
        updatedAt: new Date(),
        lines: {
          create: lines.map((l: any) => ({
            hotelId,
            accountId: String(l.accountId).trim(),
            debit: Number(l.debit ?? 0),
            credit: Number(l.credit ?? 0),
            description: l.description ?? null,
          })),
        },
      },
      include: { lines: true },
    });
    res.status(201).json(entry);
  } catch (e: any) {
    const message = e.message ?? "Error al crear asiento";
    res.status(message.includes("desbalanceado") || message.includes("pertenece") || message.includes("válida") ? 400 : 500).json({ message });
  }
}

// POST /accounting/entries/:id/post — aprobar y contabilizar
export async function postEntry(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const userId = (req as any).user?.id as string | undefined;
  const { id } = req.params;
  try {
    const entry = await prisma.accountingEntry.findFirst({
      where: { id, hotelId },
      select: { id: true, status: true, period: { select: { id: true, status: true } } },
    });
    if (!entry) return res.status(404).json({ message: "Asiento no encontrado" });
    if (entry.status === "POSTED") return res.status(409).json({ message: "El asiento ya está contabilizado" });
    if (entry.status === "VOIDED") return res.status(409).json({ message: "El asiento está anulado" });
    try {
      assertPeriodOpen(entry.period);
    } catch (e: any) {
      return res.status(409).json({ message: e.message });
    }

    const result = await prisma.accountingEntry.updateMany({
      where: { id, hotelId },
      data: { status: "POSTED", approvedBy: userId ?? null, approvedAt: new Date(), updatedAt: new Date() },
    });
    if (result.count === 0) return res.status(404).json({ message: "Asiento no encontrado" });

    const updated = await prisma.accountingEntry.findFirst({ where: { id, hotelId } });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Error al contabilizar asiento" });
  }
}

// POST /accounting/entries/:id/void — anular asiento
export async function voidEntry(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const userId = (req as any).user?.id as string | undefined;
  const { id } = req.params;
  try {
    const entry = await prisma.accountingEntry.findFirst({
      where: { id, hotelId },
      select: { id: true, status: true, period: { select: { id: true, status: true } } },
    });
    if (!entry) return res.status(404).json({ message: "Asiento no encontrado" });
    if (entry.status === "VOIDED") return res.status(409).json({ message: "El asiento ya está anulado" });
    try {
      assertPeriodOpen(entry.period);
    } catch (e: any) {
      return res.status(409).json({ message: e.message });
    }

    const result = await prisma.accountingEntry.updateMany({
      where: { id, hotelId },
      data: { status: "VOIDED", voidedBy: userId ?? null, voidedAt: new Date(), updatedAt: new Date() },
    });
    if (result.count === 0) return res.status(404).json({ message: "Asiento no encontrado" });

    const updated = await prisma.accountingEntry.findFirst({ where: { id, hotelId } });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Error al anular asiento" });
  }
}

// PUT /accounting/entries/:id — corregir un asiento en borrador
export async function updateEntry(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { id } = req.params;
  const { date, description, lines, periodId } = req.body || {};
  try {
    const entry = await prisma.accountingEntry.findFirst({
      where: { id, hotelId },
      select: { id: true, status: true, period: { select: { id: true, status: true } } },
    });
    if (!entry) return res.status(404).json({ message: "Asiento no encontrado" });
    if (entry.status !== "DRAFT") {
      return res.status(409).json({
        message: "Sólo se puede editar un asiento en borrador. Si ya está contabilizado, anulalo y hacé uno nuevo.",
      });
    }
    assertPeriodOpen(entry.period);

    const nextLines = Array.isArray(lines) ? lines : null;
    if (nextLines && nextLines.length < 2) {
      return res.status(400).json({ message: "Un asiento necesita al menos 2 líneas" });
    }
    if (nextLines) {
      assertBalanced(nextLines);
      await ensureAccountsBelongToHotel(hotelId, nextLines);
    }
    const nextDate = date ? new Date(date) : null;
    const nextPeriod = nextDate ? await resolvePeriod(hotelId, nextDate, periodId) : null;

    await prisma.accountingEntry.updateMany({
      where: { id, hotelId, status: "DRAFT" },
      data: {
        ...(nextDate ? { date: nextDate } : {}),
        ...(typeof description === "string" ? { description } : {}),
        ...(nextPeriod ? { periodId: nextPeriod.id } : {}),
        updatedAt: new Date(),
      },
    });

    if (nextLines) {
      await prisma.accountingEntryLine.deleteMany({ where: { entryId: id, hotelId } });
      await prisma.accountingEntryLine.createMany({
        data: nextLines.map((l: any) => ({
          hotelId,
          entryId: id,
          accountId: String(l.accountId).trim(),
          debit: Number(l.debit ?? 0),
          credit: Number(l.credit ?? 0),
          description: l.description ?? null,
        })),
      });
    }

    const updated = await prisma.accountingEntry.findFirst({
      where: { id, hotelId },
      include: { lines: true, period: true },
    });
    res.json(sanitizeEntry(updated, hotelId));
  } catch (e: any) {
    const message = e.message ?? "No se pudo editar el asiento";
    res.status(message.includes("cerrado") ? 409 : 400).json({ message });
  }
}

// DELETE /accounting/entries/:id — descartar un borrador
export async function deleteEntry(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { id } = req.params;
  try {
    const entry = await prisma.accountingEntry.findFirst({
      where: { id, hotelId },
      select: { id: true, status: true },
    });
    if (!entry) return res.status(404).json({ message: "Asiento no encontrado" });
    if (entry.status !== "DRAFT") {
      return res.status(409).json({
        message: "Sólo se puede eliminar un borrador. Un asiento contabilizado se anula.",
      });
    }
    await prisma.accountingEntryLine.deleteMany({ where: { entryId: id, hotelId } });
    await prisma.accountingEntry.deleteMany({ where: { id, hotelId, status: "DRAFT" } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "No se pudo eliminar el borrador" });
  }
}

// GET /accounting/ledger/:accountId — mayor de una cuenta
export async function getLedger(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { accountId } = req.params;
  const { from, to } = req.query;
  try {
    const account = await prisma.accountingAccount.findFirst({ where: { id: accountId, hotelId } });
    if (!account) return res.status(404).json({ message: "Cuenta no encontrada" });

    const lines = await prisma.accountingEntryLine.findMany({
      where: {
        accountId,
        hotelId,
        entry: {
          status: "POSTED",
          ...(from || to) && {
            date: {
              ...(from && { gte: new Date(from as string) }),
              ...(to && { lte: new Date(to as string) }),
            },
          },
        },
      },
      include: { entry: { select: { number: true, date: true, description: true } } },
      orderBy: { entry: { date: "asc" } },
    });

    let balance = 0;
    const rows = lines.map((l) => {
      balance += Number(l.debit) - Number(l.credit);
      return { ...l, runningBalance: balance };
    });

    res.json({ account, rows, totalDebit: rows.reduce((s, r) => s + Number(r.debit), 0), totalCredit: rows.reduce((s, r) => s + Number(r.credit), 0), balance });
  } catch (e) {
    res.status(500).json({ message: "Error al obtener mayor" });
  }
}
