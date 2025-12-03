// hotel.controller.ts


import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";


// GET /api/hotel
export async function getHotel(_req: Request, res: Response) {
  res.json({
    id: "default",
    name: process.env.HOTEL_NAME ?? "Hotel",
    currency: process.env.DEFAULT_CURRENCY ?? "CRC",
  });
}

// PUT /api/hotel  (placeholder hasta que exista un modelo Hotel real)
export async function updateHotel(req: Request, res: Response) {
  const { name, currency } = req.body as { name?: string; currency?: string };
  res.status(202).json({
    id: "default",
    name: name ?? process.env.HOTEL_NAME ?? "Hotel",
    currency: currency ?? process.env.DEFAULT_CURRENCY ?? "CRC",
    note: "Persistencia real requiere un modelo Hotel en Prisma.",
  });
}

export async function listRooms(req: Request, res: Response) {
  const rooms = await prisma.room.findMany({ orderBy: { number: "asc" } });
  res.json(rooms);
}

export async function listGuests(req: Request, res: Response) {
  const guests = await prisma.guest.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  });
  res.json(guests);
}
