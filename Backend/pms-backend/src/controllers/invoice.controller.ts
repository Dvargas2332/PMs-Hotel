import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

// GET /api/invoices?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&number=...&guest=...&room=...&status=...
export async function listInvoices(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { dateFrom, dateTo, number, guest, room, status } = req.query as {
    dateFrom?: string;
    dateTo?: string;
    number?: string;
    guest?: string;
    room?: string;
    status?: string;
  };

  const where: any = { hotelId };
  const and: any[] = [];

  if (status) where.status = status;

  if (number) {
    and.push({
      number: { contains: String(number), mode: "insensitive" },
    });
  }

  if (guest) {
    const g = String(guest).trim();
    and.push({
      OR: [
        { guest: { firstName: { contains: g, mode: "insensitive" } } },
        { guest: { lastName: { contains: g, mode: "insensitive" } } },
        { guest: { email: { contains: g, mode: "insensitive" } } },
      ],
    });
  }

  if (room) {
    const r = String(room).trim();
    and.push({
      reservation: {
        room: {
          OR: [
            { number: { contains: r, mode: "insensitive" } },
            { name: { contains: r, mode: "insensitive" } },
          ],
        },
      },
    });
  }

  if (dateFrom) {
    const d = new Date(dateFrom);
    if (Number.isNaN(d.getTime())) return res.status(400).json({ message: "dateFrom invalida" });
    and.push({ createdAt: { gte: d } });
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (Number.isNaN(d.getTime())) return res.status(400).json({ message: "dateTo invalida" });
    // incluir todo el dia
    d.setHours(23, 59, 59, 999);
    and.push({ createdAt: { lte: d } });
  }

  if (and.length) where.AND = and;

  const list = await prisma.invoice.findMany({
    where,
    include: {
      guest: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      reservation: {
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          room: { select: { id: true, number: true, type: true } },
        },
      },
      payments: true,
      eInvoicingDocuments: {
        select: { id: true, docType: true, status: true, key: true, consecutive: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  res.json(list);
}
