import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

// GET /api/reports?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&category=...
export async function listReports(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { startDate, endDate, category } = req.query as {
    startDate?: string;
    endDate?: string;
    category?: string;
  };

  const start = startDate ? new Date(startDate as string) : undefined;
  const end = endDate ? new Date(endDate as string) : undefined;

  if (start && Number.isNaN(start.getTime())) return res.status(400).json({ message: "startDate inválida" });
  if (end && Number.isNaN(end.getTime())) return res.status(400).json({ message: "endDate inválida" });

  const where: any = { hotelId };
  if (category) where.category = category;

  const and: any[] = [];
  if (start) {
    and.push({
      OR: [
        { periodStart: { gte: start } },
        { createdAt: { gte: start } },
      ],
    });
  }
  if (end) {
    and.push({
      OR: [
        { periodEnd: { lte: end } },
        { createdAt: { lte: end } },
      ],
    });
  }
  if (and.length) where.AND = and;

  const list = await prisma.report.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  res.json(list);
}

// POST /api/reports
export async function createReport(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { title, category, type, periodStart, periodEnd, filters, payload } = req.body as {
    title?: string;
    category?: string;
    type?: string;
    periodStart?: string;
    periodEnd?: string;
    filters?: unknown;
    payload?: unknown;
  };

  const data: any = {
    hotelId,
    title,
    category,
    type,
    filters: filters as any,
    payload: payload as any,
  };
  if (periodStart) data.periodStart = new Date(periodStart);
  if (periodEnd) data.periodEnd = new Date(periodEnd);

  const report = await prisma.report.create({ data });
  res.status(201).json(report);
}

// GET /api/reports/:id
export async function getReport(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { id } = req.params;
  const report = await prisma.report.findFirst({ where: { id, hotelId } });
  if (!report) return res.status(404).json({ message: "Reporte no encontrado" });
  res.json(report);
}
