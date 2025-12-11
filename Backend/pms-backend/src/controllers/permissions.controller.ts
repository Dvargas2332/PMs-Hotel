import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { ALL_PERMISSIONS, PERMISSION_MODULES } from "../config/permissions.js";
import type { AuthUser } from "../middleware/auth.js";

export async function listPermissions(_req: Request, res: Response) {
  // Aseguramos que todos los permisos del catálogo existan en la tabla
  await prisma.permission.createMany({
    data: ALL_PERMISSIONS.map((p) => ({ id: p, description: p })),
    skipDuplicates: true,
  });
  const perms = await prisma.permission.findMany({ orderBy: { id: "asc" } });
  res.json(perms);
}

export async function listPermissionModules(_req: Request, res: Response) {
  // Devuelve la estructura agrupada por módulos para el management
  res.json(PERMISSION_MODULES);
}

export async function getRolePermissions(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { roleId } = req.params;
  const rp = await prisma.rolePermission.findMany({
    where: { hotelId: user.hotelId, roleId },
    select: { permissionId: true },
  });
  res.json({ roleId, permissions: rp.map((x) => x.permissionId) });
}

export async function setRolePermissions(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const hotelId = user.hotelId;
  const { roleId } = req.params;
  const { permissions } = req.body as { permissions: string[] };
  if (!Array.isArray(permissions)) return res.status(400).json({ message: "permissions debe ser un array" });

  // Verify role belongs to hotel
  const role = await prisma.appRole.findUnique({ where: { hotelId_id: { hotelId, id: roleId } } });
  if (!role) return res.status(404).json({ message: "Rol no encontrado" });

  const validSet = new Set(ALL_PERMISSIONS);
  const filtered = Array.from(new Set(permissions.filter((p) => validSet.has(p))));

  await prisma.rolePermission.deleteMany({ where: { hotelId, roleId } });
  if (filtered.length > 0) {
    await prisma.rolePermission.createMany({
      data: filtered.map((p) => ({ roleId, permissionId: p, hotelId })),
      skipDuplicates: true,
    });
  }
  const rp = await prisma.rolePermission.findMany({
    where: { hotelId, roleId },
    select: { permissionId: true },
  });
  res.json({ roleId, permissions: rp.map((x) => x.permissionId) });
}
