import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { ALL_PERMISSIONS } from "../config/permissions.js";
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
  const hotelId = user.hotelId;
  const { id, name, description, permissions } = req.body as { id: string; name: string; description?: string; permissions?: string[] };
  if (!id || !name) return res.status(400).json({ message: "id y name son requeridos" });
  if (id === "ADMIN") return res.status(400).json({ message: "El rol ADMIN ya existe y no se puede recrear" });

  const role = await prisma.appRole.create({
    data: { id, name, description, hotelId },
  });

  if (Array.isArray(permissions) && permissions.length > 0) {
    const validSet = new Set(ALL_PERMISSIONS);
    const filtered = Array.from(new Set(permissions.filter((p) => validSet.has(p))));
    if (filtered.length > 0) {
      await prisma.rolePermission.createMany({
        data: filtered.map((p) => ({ roleId: role.id, permissionId: p, hotelId })),
        skipDuplicates: true,
      });
    }
  }

  res.status(201).json(role);
}

export async function updateRole(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const hotelId = user.hotelId;
  const { id } = req.params;
  const { name, description, permissions } = req.body as { name?: string; description?: string; permissions?: string[] };

  const role = await prisma.appRole.update({
    where: { hotelId_id: { hotelId, id } },
    data: { name, description },
  });

  if (Array.isArray(permissions)) {
    const validSet = new Set(ALL_PERMISSIONS);
    const filtered = id === "ADMIN" ? ALL_PERMISSIONS.slice() : Array.from(new Set(permissions.filter((p) => validSet.has(p))));
    await prisma.rolePermission.deleteMany({ where: { hotelId, roleId: id } });
    if (filtered.length > 0) {
      await prisma.rolePermission.createMany({
        data: filtered.map((p) => ({ roleId: id, permissionId: p, hotelId })),
        skipDuplicates: true,
      });
    }
  }

  res.json(role);
}

export async function deleteRole(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { id } = req.params;
  if (id === "ADMIN") return res.status(400).json({ message: "No se puede eliminar el rol ADMIN" });
  await prisma.rolePermission.deleteMany({ where: { hotelId: user.hotelId, roleId: id } });
  await prisma.appRole.delete({ where: { hotelId_id: { hotelId: user.hotelId, id } } });
  res.json({ ok: true });
}
