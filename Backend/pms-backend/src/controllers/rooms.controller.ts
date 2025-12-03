// src/controllers/rooms.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";

export async function listRooms(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const rooms = await prisma.room.findMany({ where: { hotelId: user.hotelId }, orderBy: { number: "asc" } });
  res.json(rooms);
}

export async function upsertRoom(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { number, type, status, notes } = req.body;
  const room = await prisma.room.upsert({
    where: { hotelId_number: { hotelId: user.hotelId, number } },
    update: { type, status, notes },
    create: { hotelId: user.hotelId, number, type, status, notes },
  });
  res.status(201).json(room);
}
