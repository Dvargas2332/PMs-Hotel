// src/controllers/launcher.controller.ts

import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";
import { sign } from "../lib/jwt.js";
import type { AuthUser } from "../middleware/auth.js";
import { ALL_PERMISSIONS, PERMISSION_MODULES } from "../config/permissions.js";

const ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

// Login del launcher (primer login, independiente de User)
export async function launcherLogin(req: Request, res: Response) {
  const { username, password } = req.body as { username: string; password: string };

  if (!username || !password) {
    return res.status(400).json({ message: "Usuario y contrasena son requeridos" });
  }

  const normalizedUsername = username.trim().toLowerCase();

  const account = await prisma.launcherAccount.findFirst({
    where: { username: normalizedUsername },
    include: { hotel: { select: { id: true, name: true } } },
  });

  if (!account) {
    // Ayuda para depurar: usuario de launcher no encontrado
    console.warn("[launcherLogin] account not found for username:", normalizedUsername);
    return res.status(401).json({ message: "Launcher no encontrado" });
  }

  const ok = await bcrypt.compare(password, account.password);
  if (!ok) {
    console.warn("[launcherLogin] invalid password for username:", normalizedUsername);
    return res.status(401).json({ message: "PIN incorrecto" });
  }

  // Cada cuenta de launcher tiene un rol asociado (roleId)
  const roleId = account.roleId || "ADMIN";

  // Permisos del rol para habilitar módulos
  await prisma.permission.createMany({
    data: ALL_PERMISSIONS.map((p) => ({ id: p, description: p })),
    skipDuplicates: true,
  });

  let permissionIds: string[] = [];
  if (roleId === "ADMIN") {
    permissionIds = ALL_PERMISSIONS.slice();
    await prisma.rolePermission.deleteMany({ where: { hotelId: account.hotelId, roleId: "ADMIN" } });
    await prisma.rolePermission.createMany({
      data: permissionIds.map((p) => ({ roleId: "ADMIN", permissionId: p, hotelId: account.hotelId })),
      skipDuplicates: true,
    });
  } else {
    const rolePerms = await prisma.rolePermission.findMany({
      where: { hotelId: account.hotelId, roleId },
      select: { permissionId: true },
    });
    permissionIds = rolePerms.map((p) => p.permissionId);
  }

  const allowedModules = PERMISSION_MODULES.filter((m) =>
    permissionIds.includes(m.access.id)
  ).map((m) => m.id);

  // Emitimos un JWT compatible con AuthUser para que pueda acceder a modulos.
  const token = sign({
    sub: account.id,
    role: roleId,
    hotelId: account.hotelId,
    isLauncher: true,
  });

  return res.json({
    token,
    launcher: {
      id: account.id,
      username: account.username,
      hotelId: account.hotelId,
      hotelName: account.hotel?.name,
      roleId: account.roleId,
      permissions: permissionIds,
      allowedModules,
    },
  });
}

// === Management: CRUD de cuentas de launcher por hotel ===

export async function listLauncherAccounts(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const accounts = await prisma.launcherAccount.findMany({
    where: { hotelId: user.hotelId },
    orderBy: { username: "asc" },
    include: {
      role: {
        include: {
          permissions: { select: { permissionId: true } },
        },
      },
    },
  });

  // Adaptamos el shape a lo que necesita el Management:
  // listado de perfiles (usuarios de launcher) con los permisos de su rol.
  const result = accounts.map((acc) => ({
    id: acc.id,
    userId: acc.username,
    name: acc.name,
    roleId: acc.roleId,
    roleName: acc.role?.name ?? acc.roleId,
    permissions: acc.role?.permissions.map((p) => p.permissionId) ?? [],
    createdAt: acc.createdAt,
  }));

  return res.json(result);
}

export async function createLauncherAccount(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { userId, name, password, roleId } = req.body as { userId: string; name: string; password: string; roleId: string };

  const normalizedUsername = userId.trim().toLowerCase();

  // Verificar que el rol exista y pertenezca al hotel
  const role = await prisma.appRole.findUnique({
    where: { hotelId_id: { hotelId: user.hotelId, id: roleId } },
  });
  if (!role) return res.status(400).json({ message: "Rol no valido para este hotel" });

  const hash = await bcrypt.hash(password, ROUNDS);

  try {
    const account = await prisma.launcherAccount.create({
      data: {
        username: normalizedUsername,
        name,
        password: hash,
        hotelId: user.hotelId,
        roleId: role.id,
      },
    });
    return res.status(201).json(account);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "El usuario de launcher ya existe" });
    }
    throw err;
  }
}

export async function updateLauncherAccount(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { id } = req.params;
  const { userId, name, password, roleId } = req.body as { userId?: string; name?: string; password?: string; roleId?: string };

  const hotelId = user.hotelId;
  const existing = await prisma.launcherAccount.findFirst({
    where: { id, hotelId },
  });
  if (!existing) return res.status(404).json({ message: "Cuenta de launcher no encontrada" });

  const data: { username?: string; name?: string; password?: string; roleId?: string } = {};
  if (userId) data.username = userId.trim().toLowerCase();
  if (name) data.name = name;
  if (password) {
    data.password = await bcrypt.hash(password, ROUNDS);
  }
  if (roleId) {
    const role = await prisma.appRole.findUnique({
      where: { hotelId_id: { hotelId, id: roleId } },
    });
    if (!role) return res.status(400).json({ message: "Rol no valido para este hotel" });
    data.roleId = role.id;
  }

  if (Object.keys(data).length === 0) {
    return res.json(existing);
  }

  const written = await prisma.launcherAccount.updateMany({
    where: { id: existing.id, hotelId },
    data,
  });
  if (written.count === 0) return res.status(404).json({ message: "Cuenta de launcher no encontrada" });
  const updated = await prisma.launcherAccount.findFirst({ where: { id: existing.id, hotelId } });
  return res.json(updated);
}

export async function deleteLauncherAccount(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { id } = req.params;
  const hotelId = user.hotelId;

  const existing = await prisma.launcherAccount.findFirst({
    where: { id, hotelId },
  });
  if (!existing) return res.status(404).json({ message: "Cuenta de launcher no encontrada" });

  await prisma.launcherAccount.deleteMany({ where: { id: existing.id, hotelId } });
  return res.json({ ok: true });
}
