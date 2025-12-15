// src/middleware/auth.ts

import type { NextFunction, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { verify } from "../lib/jwt.js";

export interface AuthUser {
  sub: string;
  role: "ADMIN" | "MANAGER" | "RECEPTION" | "ACCOUNTING" | "RESTAURANT";
  hotelId?: string;
  // Marcador para diferenciar logins del launcher de usuarios normales
  isLauncher?: boolean;
}

export function auth(req: Request, res: Response, next: NextFunction) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });
  try {
    const payload = verify<AuthUser>(token);
    // @ts-ignore
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Token invalido" });
  }
}

export function requireRole(...roles: AuthUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const user = req.user as AuthUser | undefined;
    if (!user) return res.status(401).json({ message: "No autenticado" });
    if (!roles.includes(user.role)) return res.status(403).json({ message: "No autorizado" });
    next();
  };
}

// Solo permite acceso a usuarios "normales" (no launcher)
export function requireManagementUser(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (user.isLauncher) return res.status(403).json({ message: "No autorizado para management" });
  next();
}

export function requirePermission(...permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const user = req.user as AuthUser | undefined;
    if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

    try {
      const granted = await prisma.rolePermission.findMany({
        where: { hotelId: user.hotelId, roleId: user.role, permissionId: { in: permissions } },
        select: { permissionId: true },
      });
      if (granted.length === 0) return res.status(403).json({ message: "Permiso insuficiente" });
      next();
    } catch (err) {
      next(err);
    }
  };
}
