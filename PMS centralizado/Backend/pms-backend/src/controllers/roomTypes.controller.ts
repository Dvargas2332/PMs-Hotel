// src/controllers/roomTypes.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

export async function listRoomTypes(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const types = await prisma.roomType.findMany({
    where: { hotelId: user.hotelId },
    orderBy: { id: "asc" },
  });
  res.json(types);
}

export async function createRoomType(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { id, name, beds } = req.body;
  if (!id || !name) return res.status(400).json({ message: "Faltan id o nombre de tipo de habitación" });

  const type = await prisma.roomType.create({
    data: {
      id: String(id).trim(),
      name: String(name).trim(),
      beds: beds ? String(beds).trim() : null,
      hotelId: user.hotelId,
    },
  });
  res.status(201).json(type);
}

export async function updateRoomType(req: Request, res: Response) {
  const { id } = req.params;
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  if (!id) return res.status(400).json({ message: "Falta id de tipo de habitación" });

  const payload = req.body as { name?: string; beds?: string };

  const existing = await prisma.roomType.findUnique({
    where: { hotelId_id: { hotelId: user.hotelId, id } },
  });
  if (!existing) return res.status(404).json({ message: "Tipo de habitación no encontrado" });

  const updated = await prisma.roomType.update({
    where: { hotelId_id: { hotelId: user.hotelId, id } },
    data: {
      name: payload.name !== undefined ? String(payload.name).trim() : existing.name,
      beds: payload.beds !== undefined ? (payload.beds ? String(payload.beds).trim() : null) : existing.beds,
    },
  });
  res.json(updated);
}

export async function deleteRoomType(req: Request, res: Response) {
  const { id } = req.params;
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  if (!id) return res.status(400).json({ message: "Falta id de tipo de habitación" });

  const roomsUsing = await prisma.room.count({
    where: { hotelId: user.hotelId, type: id },
  });
  if (roomsUsing > 0) {
    return res.status(400).json({
      message: "No se puede eliminar el tipo porque tiene habitaciones asociadas",
    });
  }

  await prisma.roomType.delete({
    where: { hotelId_id: { hotelId: user.hotelId, id } },
  });
  res.status(204).send();
}
