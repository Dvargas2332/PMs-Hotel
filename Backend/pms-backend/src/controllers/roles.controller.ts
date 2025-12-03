import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

export async function listRoles(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const roles = await prisma.appRole.findMany({
    where: { hotelId: user.hotelId },
    orderBy: { id: "asc" },
  });
  res.json(roles);
}

export async function createRole(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { id, name, description } = req.body;
  if (!id || !name) return res.status(400).json({ message: "id y name son requeridos" });
  const role = await prisma.appRole.create({
    data: { id, name, description, hotelId: user.hotelId },
  });
  res.status(201).json(role);
}

export async function updateRole(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { id } = req.params;
  const { name, description } = req.body;
  const role = await prisma.appRole.update({
    where: { hotelId_id: { hotelId: user.hotelId, id } },
    data: { name, description },
  });
  res.json(role);
}

export async function deleteRole(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { id } = req.params;
  await prisma.rolePermission.deleteMany({ where: { hotelId: user.hotelId, roleId: id } });
  await prisma.appRole.delete({ where: { hotelId_id: { hotelId: user.hotelId, id } } });
  res.json({ ok: true });
}
