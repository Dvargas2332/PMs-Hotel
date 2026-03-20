// src/controllers/users.controller.ts

import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

const ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

export async function resetUserPassword(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { id } = req.params;
  const { password } = req.body as { password: string };

  const target = await prisma.user.findFirst({
    where: { id, hotelId: user.hotelId },
  });
  if (!target) return res.status(404).json({ message: "Usuario no encontrado" });

  const hash = await bcrypt.hash(password, ROUNDS);

  const updated = await prisma.user.updateMany({
    where: { id: target.id, hotelId: user.hotelId },
    data: { password: hash },
  });
  if (updated.count === 0) return res.status(404).json({ message: "Usuario no encontrado" });

  return res.json({ ok: true });
}
