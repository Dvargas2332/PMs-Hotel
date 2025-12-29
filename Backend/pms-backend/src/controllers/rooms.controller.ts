// src/controllers/rooms.controller.ts
import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

export async function listRooms(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const rooms = await prisma.room.findMany({
    where: { hotelId: user.hotelId, archived: false },
    orderBy: { number: "asc" },
  });
  res.json(rooms);
}

export async function upsertRoom(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { number, type, status, notes, baseRate, currency } = req.body;
  if (!number) return res.status(400).json({ message: "Falta el numero de habitacion" });

  const patch: any = {
    type: type || "STD",
    status: status || "AVAILABLE",
    notes: notes || null,
  };

  if (baseRate !== undefined && baseRate !== null && !Number.isNaN(Number(baseRate))) {
    patch.baseRate = new Prisma.Decimal(baseRate);
  }
  if (currency) patch.currency = currency;

  const room = await prisma.room.upsert({
    where: { hotelId_number: { hotelId: user.hotelId, number } },
    update: patch,
    create: { hotelId: user.hotelId, number, ...patch, archived: false },
  });
  res.status(201).json(room);
}

export async function archiveRoom(req: Request, res: Response) {
  const { id } = req.params;
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const hotelId = user.hotelId;
  const exists = await prisma.room.findFirst({ where: { id, hotelId } });
  if (!exists) return res.status(404).json({ message: "Habitacion no encontrada" });

  const updated = await prisma.room.updateMany({
    where: { id, hotelId },
    data: { archived: true, status: "BLOCKED" },
  });
  if (updated.count === 0) return res.status(404).json({ message: "Habitacion no encontrada" });
  const room = await prisma.room.findFirst({ where: { id, hotelId } });
  res.json(room);
}
