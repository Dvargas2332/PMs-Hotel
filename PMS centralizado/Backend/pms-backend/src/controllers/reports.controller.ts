import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

function hid(req: Request): string | undefined {
  // @ts-ignore
  return (req.user as AuthUser | undefined)?.hotelId;
}

// GET /reports/daily?date=YYYY-MM-DD
// Flash diario: llegadas, salidas, en casa, ingresos
export async function dailyFlash(req: Request, res: Response) {
  const hotelId = hid(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const dayStart = new Date(dateStr + "T00:00:00.000Z");
  const dayEnd   = new Date(dateStr + "T23:59:59.999Z");

  const [arrivals, departures, inHouse, invoices, rooms] = await Promise.all([
    prisma.reservation.count({
      where: { hotelId, checkIn: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELED" } },
    }),
    prisma.reservation.count({
      where: { hotelId, checkOut: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELED" } },
    }),
    prisma.reservation.count({
      where: { hotelId, status: "CHECKED_IN" },
    }),
    prisma.invoice.findMany({
      where: { hotelId, createdAt: { gte: dayStart, lte: dayEnd } },
      select: { total: true, currency: true, status: true },
    }),
    prisma.room.count({ where: { hotelId, archived: false } }),
  ]);

  const revenue = invoices.reduce((s, i) => s + Number(i.total), 0);
  const currency = invoices[0]?.currency ?? "CRC";

  res.json({
    date: dateStr,
    arrivals,
    departures,
    inHouse,
    totalRooms: rooms,
    occupancyPct: rooms > 0 ? Math.round((inHouse / rooms) * 100) : 0,
    revenue,
    currency,
    invoiceCount: invoices.length,
  });
}

// GET /reports/occupancy?from=YYYY-MM-DD&to=YYYY-MM-DD
// Ocupación diaria en un rango
export async function occupancyRange(req: Request, res: Response) {
  const hotelId = hid(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const from = (req.query.from as string) || new Date().toISOString().slice(0, 7) + "-01";
  const to   = (req.query.to   as string) || new Date().toISOString().slice(0, 10);

  const fromDate = new Date(from + "T00:00:00Z");
  const toDate   = new Date(to   + "T23:59:59Z");

  const [reservations, totalRooms] = await Promise.all([
    prisma.reservation.findMany({
      where: { hotelId, status: { not: "CANCELED" }, checkIn: { lte: toDate }, checkOut: { gte: fromDate } },
      select: { checkIn: true, checkOut: true },
    }),
    prisma.room.count({ where: { hotelId, archived: false } }),
  ]);

  // Build day-by-day map
  const days: Record<string, number> = {};
  const cur = new Date(fromDate);
  while (cur <= toDate) {
    const key = cur.toISOString().slice(0, 10);
    days[key] = 0;
    cur.setDate(cur.getDate() + 1);
  }

  reservations.forEach((r) => {
    const s = new Date(r.checkIn);
    const e = new Date(r.checkOut);
    const c = new Date(Math.max(s.getTime(), fromDate.getTime()));
    while (c < e && c <= toDate) {
      const k = c.toISOString().slice(0, 10);
      if (k in days) days[k]++;
      c.setDate(c.getDate() + 1);
    }
  });

  const result = Object.entries(days).map(([date, occupied]) => ({
    date,
    occupied,
    totalRooms,
    occupancyPct: totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0,
  }));

  res.json(result);
}

// GET /reports/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD
// Ingresos diarios agrupados
export async function revenueRange(req: Request, res: Response) {
  const hotelId = hid(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const from = (req.query.from as string) || new Date().toISOString().slice(0, 7) + "-01";
  const to   = (req.query.to   as string) || new Date().toISOString().slice(0, 10);

  const fromDate = new Date(from + "T00:00:00Z");
  const toDate   = new Date(to   + "T23:59:59Z");

  const invoices = await prisma.invoice.findMany({
    where: { hotelId, createdAt: { gte: fromDate, lte: toDate } },
    select: { total: true, currency: true, status: true, createdAt: true },
  });

  const byDay: Record<string, { revenue: number; invoices: number; currency: string }> = {};
  invoices.forEach((inv) => {
    const key = inv.createdAt.toISOString().slice(0, 10);
    if (!byDay[key]) byDay[key] = { revenue: 0, invoices: 0, currency: inv.currency };
    byDay[key].revenue  += Number(inv.total);
    byDay[key].invoices += 1;
  });

  const result = Object.entries(byDay)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalRevenue = invoices.reduce((s, i) => s + Number(i.total), 0);
  const currency     = invoices[0]?.currency ?? "CRC";

  res.json({ totalRevenue, currency, days: result });
}

// GET /reports/arrivals-departures?date=YYYY-MM-DD
// Lista detallada de llegadas y salidas del día
export async function arrivalsDepartures(req: Request, res: Response) {
  const hotelId = hid(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const dayStart = new Date(dateStr + "T00:00:00.000Z");
  const dayEnd   = new Date(dateStr + "T23:59:59.999Z");

  const INCLUDE = {
    room:     { select: { number: true, type: true } },
    guest:    { select: { firstName: true, lastName: true, email: true } },
    ratePlan: { select: { name: true, currency: true } },
    mealPlan: { select: { name: true } },
  };

  const [arrivals, departures] = await Promise.all([
    prisma.reservation.findMany({
      where: { hotelId, checkIn: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELED" } },
      include: INCLUDE,
      orderBy: { checkIn: "asc" },
    }),
    prisma.reservation.findMany({
      where: { hotelId, checkOut: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELED" } },
      include: INCLUDE,
      orderBy: { checkOut: "asc" },
    }),
  ]);

  res.json({ date: dateStr, arrivals, departures });
}

// GET /reports/housekeeping
// Estado de habitaciones para housekeeping
export async function housekeepingReport(req: Request, res: Response) {
  const hotelId = hid(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const rooms = await prisma.room.findMany({
    where: { hotelId, archived: false },
    orderBy: { number: "asc" },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const activeRes = await prisma.reservation.findMany({
    where: { hotelId, status: "CHECKED_IN" },
    select: { roomId: true, checkOut: true, guest: { select: { firstName: true, lastName: true } } },
  });
  const resMap = Object.fromEntries(activeRes.map((r) => [r.roomId, r]));

  const result = rooms.map((room) => ({
    ...room,
    currentGuest: resMap[room.id] ?? null,
    checkoutToday: resMap[room.id]
      ? new Date(resMap[room.id].checkOut) <= tomorrow
      : false,
  }));

  res.json(result);
}
