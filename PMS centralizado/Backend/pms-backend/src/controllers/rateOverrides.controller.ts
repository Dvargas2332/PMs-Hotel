import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

function hotelId(req: Request): string | undefined {
  // @ts-ignore
  return (req.user as AuthUser | undefined)?.hotelId;
}

// GET /rateOverrides?ratePlanId=&month=YYYY-MM
export async function listRateOverrides(req: Request, res: Response) {
  const hid = hotelId(req);
  if (!hid) return res.status(400).json({ message: "Hotel no definido" });

  const { ratePlanId, month } = req.query as Record<string, string>;
  if (!ratePlanId) return res.status(400).json({ message: "ratePlanId requerido" });

  const where: any = { hotelId: hid, ratePlanId };
  if (month) {
    const [y, m] = month.split("-").map(Number);
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0); // last day of month
    where.date = { gte: from, lte: to };
  }

  try {
    const rows = await prisma.rateOverride.findMany({ where, orderBy: { date: "asc" } });
    res.json(rows);
  } catch (err) {
    console.error("listRateOverrides", err);
    res.status(500).json({ message: "Error al cargar overrides" });
  }
}

// PUT /rateOverrides  — upsert one cell
export async function upsertRateOverride(req: Request, res: Response) {
  const hid = hotelId(req);
  if (!hid) return res.status(400).json({ message: "Hotel no definido" });

  const { ratePlanId, roomTypeId, date, price, closed, minStay } = req.body ?? {};
  if (!ratePlanId || !roomTypeId || !date)
    return res.status(400).json({ message: "ratePlanId, roomTypeId y date son requeridos" });

  const dateVal = new Date(date);

  try {
    const row = await prisma.rateOverride.upsert({
      where: { hotelId_ratePlanId_roomTypeId_date: { hotelId: hid, ratePlanId, roomTypeId, date: dateVal } },
      create: {
        hotelId: hid, ratePlanId, roomTypeId, date: dateVal,
        price: Number(price ?? 0),
        closed: Boolean(closed),
        minStay: minStay != null ? Number(minStay) : null,
      },
      update: {
        price: price !== undefined ? Number(price) : undefined,
        closed: closed !== undefined ? Boolean(closed) : undefined,
        minStay: minStay !== undefined ? (minStay != null ? Number(minStay) : null) : undefined,
      },
    });
    res.json(row);
  } catch (err) {
    console.error("upsertRateOverride", err);
    res.status(500).json({ message: "Error al guardar override" });
  }
}

// PUT /rateOverrides/bulk — upsert multiple cells at once
export async function bulkUpsertRateOverrides(req: Request, res: Response) {
  const hid = hotelId(req);
  if (!hid) return res.status(400).json({ message: "Hotel no definido" });

  const { ratePlanId, roomTypeId, dateFrom, dateTo, price, closed, minStay } = req.body ?? {};
  if (!ratePlanId || !roomTypeId || !dateFrom || !dateTo || price === undefined)
    return res.status(400).json({ message: "Faltan campos requeridos" });

  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  if (from > to) return res.status(400).json({ message: "dateFrom debe ser <= dateTo" });

  const days: Date[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  try {
    const ops = days.map((date) =>
      prisma.rateOverride.upsert({
        where: { hotelId_ratePlanId_roomTypeId_date: { hotelId: hid, ratePlanId, roomTypeId, date } },
        create: {
          hotelId: hid, ratePlanId, roomTypeId, date,
          price: Number(price),
          closed: Boolean(closed),
          minStay: minStay != null ? Number(minStay) : null,
        },
        update: {
          price: Number(price),
          closed: Boolean(closed),
          minStay: minStay != null ? Number(minStay) : null,
        },
      })
    );
    const results = await prisma.$transaction(ops);
    res.json(results);
  } catch (err) {
    console.error("bulkUpsertRateOverrides", err);
    res.status(500).json({ message: "Error al guardar overrides en bulk" });
  }
}

// DELETE /rateOverrides/:id
export async function deleteRateOverride(req: Request, res: Response) {
  const hid = hotelId(req);
  if (!hid) return res.status(400).json({ message: "Hotel no definido" });
  const { id } = req.params;
  try {
    await prisma.rateOverride.deleteMany({ where: { id, hotelId: hid } });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteRateOverride", err);
    res.status(500).json({ message: "Error al eliminar override" });
  }
}
