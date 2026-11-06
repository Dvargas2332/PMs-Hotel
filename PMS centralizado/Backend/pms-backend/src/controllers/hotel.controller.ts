function sanitize(r:any){if(!r)return r;const{hotelId:_h,...s}=r;return s;}
// hotel.controller.ts


import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import { allowedModulesForMembership, normalizeMembershipTier } from "../config/membership.js";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

// GET /api/hotel
export async function getHotel(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    include: {
      saasClient: {
        select: { id: true, name: true, companyId: true, email: true, phone1: true, phone2: true, ownerName: true, managerName: true, managerId: true },
      },
    },
  });
  if (!hotel) return res.status(404).json({ message: "Hotel no encontrado" });
  res.json({
    id: hotel.id,
    name: hotel.name,
    currency: hotel.currency,
    membership: (hotel as any).membership,
    allowedModules: allowedModulesForMembership((hotel as any).membership),
    phone1: hotel.phone1 || "",
    phone2: hotel.phone2 || "",
    ownerName: hotel.ownerName || "",
    managerName: hotel.managerName || "",
    companyId: hotel.companyId || "",
    managerId: hotel.managerId || "",
    createdAt: hotel.createdAt,
    company: hotel.saasClient ?? null,
  });
}

// PUT /api/hotel
export async function updateHotel(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const body = (req.body || {}) as any;
  const data: any = {};
  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ message: "El nombre del hotel es requerido." });
    data.name = name;
  }
  if (body.currency !== undefined) data.currency = String(body.currency || "").trim() || undefined;
  if (body.membership !== undefined) data.membership = body.membership ? normalizeMembershipTier(body.membership) : undefined;
  for (const key of ["phone1", "phone2", "ownerName", "managerName", "companyId", "managerId"] as const) {
    if (body[key] !== undefined) {
      const value = String(body[key] ?? "").trim();
      data[key] = value || null;
    }
  }

  const hotel = await prisma.hotel.update({
    where: { id: hotelId },
    data,
    include: { saasClient: { select: { id: true, name: true } } },
  });
  res.json({
    id: hotel.id,
    name: hotel.name,
    currency: hotel.currency,
    membership: (hotel as any).membership,
    allowedModules: allowedModulesForMembership((hotel as any).membership),
    phone1: hotel.phone1 || "",
    phone2: hotel.phone2 || "",
    ownerName: hotel.ownerName || "",
    managerName: hotel.managerName || "",
    companyId: hotel.companyId || "",
    managerId: hotel.managerId || "",
    createdAt: hotel.createdAt,
    company: hotel.saasClient ?? null,
  });
}

// GET /api/hotel/company — datos de la empresa (SaasClient) asociada al hotel
export async function getHotelCompany(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { clientId: true, saasClient: true },
  });
  if (!hotel?.saasClient) {
    return res.status(404).json({ message: "El hotel no tiene una empresa asociada." });
  }
  res.json(hotel.saasClient);
}

// PUT /api/hotel/company — la empresa es compartida por todos sus hoteles
export async function updateHotelCompany(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { clientId: true } });
  if (!hotel?.clientId) {
    return res.status(404).json({ message: "El hotel no tiene una empresa asociada." });
  }

  const body = (req.body || {}) as any;
  const data: any = {};
  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ message: "El nombre de la empresa es requerido." });
    data.name = name;
  }
  if (body.companyId !== undefined) data.companyId = String(body.companyId || "").trim() || null;
  if (body.email !== undefined) data.email = String(body.email || "").trim() || null;
  for (const key of ["phone1", "phone2", "ownerName", "managerName", "managerId"] as const) {
    if (body[key] !== undefined) {
      const value = String(body[key] ?? "").trim();
      data[key] = value || null;
    }
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "Nada que actualizar." });
  }

  const company = await prisma.saasClient.update({ where: { id: hotel.clientId }, data });
  res.json(company);
}

// GET /api/hotel/currency
export async function getCurrency(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { currency: true, fxBuy: true, fxSell: true },
  });
  if (!hotel) return res.status(404).json({ message: "Hotel no encontrado" });
  res.json({
    base: hotel.currency,
    buy: Number(hotel.fxBuy || 0),
    sell: Number(hotel.fxSell || 0),
  });
}

// PUT /api/hotel/currency
export async function updateCurrency(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { base, buy, sell } = req.body as { base?: string; buy?: number; sell?: number };

  const hotel = await prisma.hotel.update({
    where: { id: hotelId },
    data: {
      currency: base ?? undefined,
      fxBuy: buy ?? undefined,
      fxSell: sell ?? undefined,
    },
    select: { currency: true, fxBuy: true, fxSell: true },
  });

  res.json({
    base: hotel.currency,
    buy: Number(hotel.fxBuy || 0),
    sell: Number(hotel.fxSell || 0),
  });
}

export async function listRooms(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const rooms = await prisma.room.findMany({ where: { hotelId }, orderBy: { number: "asc" } });
  res.json(sanitize(rooms));
}

export async function listGuests(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const guests = await prisma.guest.findMany({
    where: { hotelId },
    orderBy: { createdAt: "desc" },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  });
  res.json(guests);
}
