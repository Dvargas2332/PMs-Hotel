import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

function resolveUserId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.sub;
}

function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const str = String(value);
  if (!str) return undefined;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

// POST /api/cash-audits
// Body: { module: "FRONTDESK" | "RESTAURANT", openedAt?, closedAt?, totals?, details?, note? }
export async function createCashAudit(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { module, openedAt, closedAt, totals, details, note } = req.body ?? {};

  if (!module || (module !== "FRONTDESK" && module !== "RESTAURANT")) {
    return res.status(400).json({ message: "Modulo invalido, use FRONTDESK o RESTAURANT" });
  }

  const audit = await prisma.cashAudit.create({
    data: {
      hotelId,
      module,
      openedAt: parseDate(openedAt),
      closedAt: parseDate(closedAt),
      totals: totals ?? null,
      details: details ?? null,
      note: note ?? null,
      createdById: resolveUserId(req),
    },
  });

  res.status(201).json(audit);
}

// GET /api/cash-audits?module=FRONTDESK|RESTAURANT&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
export async function listCashAudits(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { module, dateFrom, dateTo } = req.query as {
    module?: string;
    dateFrom?: string;
    dateTo?: string;
  };

  const where: any = { hotelId };

  if (module && (module === "FRONTDESK" || module === "RESTAURANT")) {
    where.module = module;
  }

  const and: any[] = [];

  if (dateFrom) {
    const d = parseDate(dateFrom);
    if (!d) return res.status(400).json({ message: "dateFrom invalida" });
    and.push({ createdAt: { gte: d } });
  }

  if (dateTo) {
    const d = parseDate(dateTo);
    if (!d) return res.status(400).json({ message: "dateTo invalida" });
    d.setHours(23, 59, 59, 999);
    and.push({ createdAt: { lte: d } });
  }

  if (and.length) where.AND = and;

  const list = await prisma.cashAudit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  res.json(list);
}
