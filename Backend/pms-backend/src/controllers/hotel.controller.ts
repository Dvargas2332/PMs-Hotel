// hotel.controller.ts


import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

// GET /api/hotel
export async function getHotel(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel) return res.status(404).json({ message: "Hotel no encontrado" });
  res.json(hotel);
}

// PUT /api/hotel
export async function updateHotel(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { name, currency } = req.body as { name?: string; currency?: string };
  const hotel = await prisma.hotel.update({
    where: { id: hotelId },
    data: { name, currency },
  });
  res.json(hotel);
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
  res.json(rooms);
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
