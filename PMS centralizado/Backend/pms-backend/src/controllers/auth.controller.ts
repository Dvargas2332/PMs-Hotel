// src/controllers/auth.controller.ts
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { timingSafeEqual } from "crypto";
import prisma from "../lib/prisma.js";
import { sign, signRefresh, verifyRefresh, getAccessCookieOpts, getRefreshCookieOpts } from "../lib/jwt.js";
import { hashInviteToken } from "../lib/userInvites.js";
import { ALL_PERMISSIONS } from "../config/permissions.js";
import { allowedModulesForMembership } from "../config/membership.js";
import type { AuthUser } from "../middleware/auth.js";

const ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const isProduction = process.env.NODE_ENV === "production";

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const accessOpts = getAccessCookieOpts(isProduction);
  const refreshOpts = getRefreshCookieOpts(isProduction);
  res.cookie("access_token", accessToken, accessOpts);
  res.cookie("refresh_token", refreshToken, refreshOpts);
}

function clearAuthCookies(res: Response) {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/api/auth" });
}

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password, hotelName } = req.body as {
      name?: string;
      email: string;
      password: string;
      hotelName?: string;
    };

    if (!email || !password) return res.status(400).json({ message: "Email y password son requeridos" });
    if (String(password).length < 8) return res.status(400).json({ message: "La contraseña debe tener al menos 8 caracteres" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: "El email ya está registrado" });

    const hotel = await prisma.hotel.create({
      data: { name: hotelName || "Hotel Demo", currency: "CRC" },
      select: { id: true, number: true, name: true, membership: true },
    });

    await prisma.permission.createMany({ data: ALL_PERMISSIONS.map((p) => ({ id: p, description: p })), skipDuplicates: true });
    await prisma.appRole.upsert({
      where: { hotelId_id: { hotelId: hotel.id, id: "ADMIN" } },
      update: { name: "ADMIN", description: "Administrador" },
      create: { id: "ADMIN", name: "ADMIN", description: "Administrador", hotelId: hotel.id },
    });
    await prisma.rolePermission.deleteMany({ where: { hotelId: hotel.id, roleId: "ADMIN" } });
    await prisma.rolePermission.createMany({
      data: ALL_PERMISSIONS.map((p) => ({ roleId: "ADMIN", permissionId: p, hotelId: hotel.id })),
      skipDuplicates: true,
    });

    const hash = await bcrypt.hash(password, ROUNDS);
    const user = await prisma.user.create({
      data: {
        name: name ?? "Usuario",
        email,
        password: hash,
        role: "ADMIN",
        hotelId: hotel.id,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true, hotelId: true },
    });

    const tokenPayload = { sub: user.id, email: user.email, role: user.role, hotelId: user.hotelId };
    const accessToken = sign(tokenPayload);
    const refreshToken = signRefresh(tokenPayload);
    setAuthCookies(res, accessToken, refreshToken);

    return res.status(201).json({
      user,
      token: accessToken, // backward compat
      hotel: { ...hotel, allowedModules: allowedModulesForMembership(hotel.membership) },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "El email ya está registrado" });
    }
    console.error("[auth.register] error:", err);
    return res.status(500).json({ message: "No se pudo registrar" });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, username, password } = req.body as { email?: string; username?: string; password?: string };
    const identifier = (email || username || "").trim();
    if (!identifier || !password) {
      return res.status(400).json({ message: "Email/usuario y password son requeridos" });
    }

    // Gestor SaaS login
    const gestorEmail = String(process.env.GESTOR_EMAIL || "").trim().toLowerCase();
    const gestorPassword = String(process.env.GESTOR_PASSWORD || "").trim();
    const gestorPasswordBuf = Buffer.from(gestorPassword);
    const inputPasswordBuf = Buffer.from(password);
    const gestorPasswordMatch =
      gestorEmail &&
      gestorPassword &&
      identifier.toLowerCase() === gestorEmail &&
      gestorPasswordBuf.length === inputPasswordBuf.length &&
      timingSafeEqual(gestorPasswordBuf, inputPasswordBuf);
    if (gestorPasswordMatch) {
      const tokenPayload = { sub: "gestor", email: gestorEmail, role: "ADMIN" as const, hotelId: "saas-gestor", isGestor: true };
      const accessToken = sign(tokenPayload);
      const refreshToken = signRefresh(tokenPayload);
      setAuthCookies(res, accessToken, refreshToken);

      return res.json({
        token: accessToken,
        user: {
          id: "gestor",
          name: process.env.GESTOR_NAME || "Gestor SaaS",
          email: gestorEmail,
          role: "ADMIN",
          createdAt: new Date(),
          hotelId: "saas-gestor",
          isGestor: true,
        },
        hotel: {
          id: "saas-gestor",
          name: process.env.GESTOR_SYSTEM_HOTEL_NAME || "Gestor SaaS",
          membership: "PLATINUM",
          allowedModules: allowedModulesForMembership("PLATINUM"),
          isGestor: true,
        },
      });
    }

    const user = await prisma.user.findUnique({ where: { email: identifier } });
    if (!user) return res.status(401).json({ message: "Credenciales inválidas" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Credenciales inválidas" });

    // Un hotel suspendido desde el gestor no permite iniciar sesión.
    const hotelRow = await prisma.hotel.findUnique({
      where: { id: user.hotelId },
      select: { id: true, name: true, membership: true, active: true },
    });
    if (hotelRow && hotelRow.active === false) {
      return res.status(403).json({
        code: "HOTEL_SUSPENDED",
        message: "El hotel está suspendido. Contacte al proveedor del sistema.",
      });
    }

    const tokenPayload = { sub: user.id, email: user.email, role: user.role, hotelId: user.hotelId };
    const accessToken = sign(tokenPayload);
    const refreshToken = signRefresh(tokenPayload);
    setAuthCookies(res, accessToken, refreshToken);

    const hotel = hotelRow;
    return res.json({
      token: accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt, hotelId: user.hotelId },
      hotel: hotel
        ? { ...hotel, allowedModules: allowedModulesForMembership(hotel.membership) }
        : { id: user.hotelId, name: "Hotel", membership: "PLATINUM", allowedModules: allowedModulesForMembership("PLATINUM") },
    });
  } catch (err) {
    console.error("[auth.login] error:", err);
    return res.status(500).json({ message: "No se pudo iniciar sesión" });
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const refreshToken = (req as any).cookies?.refresh_token || req.body?.refreshToken || null;
    if (!refreshToken) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "No refresh token" });
    }

    let payload: AuthUser;
    try {
      payload = verifyRefresh<AuthUser>(refreshToken);
    } catch {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Refresh token inválido o expirado" });
    }

    // Verificar que el usuario siga existiendo y activo
    if (!payload.isGestor && payload.sub) {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, hotelId: true },
      });
      if (!user) {
        clearAuthCookies(res);
        return res.status(401).json({ message: "Usuario no encontrado" });
      }
      const hotel = await prisma.hotel.findUnique({
        where: { id: user.hotelId },
        select: { active: true },
      });
      if (hotel && hotel.active === false) {
        clearAuthCookies(res);
        return res.status(403).json({
          code: "HOTEL_SUSPENDED",
          message: "El hotel está suspendido. Contacte al proveedor del sistema.",
        });
      }
      payload = {
        sub: user.id,
        email: user.email,
        role: user.role as AuthUser["role"],
        hotelId: user.hotelId,
      };
    }

    const newAccessToken = sign({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      hotelId: payload.hotelId,
      isGestor: payload.isGestor,
      isLauncher: payload.isLauncher,
    });
    const newRefreshToken = signRefresh({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      hotelId: payload.hotelId,
      isGestor: payload.isGestor,
      isLauncher: payload.isLauncher,
    });
    setAuthCookies(res, newAccessToken, newRefreshToken);

    return res.json({ token: newAccessToken });
  } catch (err) {
    console.error("[auth.refresh] error:", err);
    return res.status(500).json({ message: "No se pudo refrescar el token" });
  }
}

export async function logout(_req: Request, res: Response) {
  clearAuthCookies(res);
  return res.json({ ok: true });
}

// ── Invitaciones del usuario principal ────────────────────────────────────────

async function findInvitedUser(token: string) {
  const clean = String(token || "").trim();
  if (!clean) return null;
  return prisma.user.findFirst({
    where: {
      inviteTokenHash: hashInviteToken(clean),
      inviteExpiresAt: { gt: new Date() },
    },
    select: { id: true, name: true, email: true, role: true, hotelId: true },
  });
}

/** Datos mínimos para mostrar la pantalla de "crear contraseña". */
export async function getInvite(req: Request, res: Response) {
  try {
    const user = await findInvitedUser(String(req.params.token || ""));
    if (!user) {
      return res.status(404).json({ message: "La invitación es inválida o venció. Pedí una nueva al gestor." });
    }
    const hotel = await prisma.hotel.findUnique({ where: { id: user.hotelId }, select: { name: true } });
    return res.json({ email: user.email, name: user.name, hotelName: hotel?.name || "Kazehana PMS" });
  } catch (err) {
    console.error("[auth.getInvite] error:", err);
    return res.status(500).json({ message: "No se pudo validar la invitación" });
  }
}

/** Define la contraseña del usuario invitado y lo deja logueado. */
export async function acceptInvite(req: Request, res: Response) {
  try {
    const token = String(req.body?.token || req.params.token || "");
    const password = String(req.body?.password || "");
    if (password.length < 8) {
      return res.status(400).json({ message: "La contraseña debe tener al menos 8 caracteres" });
    }

    const user = await findInvitedUser(token);
    if (!user) {
      return res.status(404).json({ message: "La invitación es inválida o venció. Pedí una nueva al gestor." });
    }

    const hash = await bcrypt.hash(password, ROUNDS);
    const updated = await prisma.user.updateMany({
      where: { id: user.id, hotelId: user.hotelId, inviteTokenHash: hashInviteToken(token) },
      data: { password: hash, inviteTokenHash: null, inviteExpiresAt: null },
    });
    if (updated.count === 0) {
      return res.status(409).json({ message: "La invitación ya fue usada. Iniciá sesión con tu contraseña." });
    }

    const payload = { sub: user.id, email: user.email, role: user.role as AuthUser["role"], hotelId: user.hotelId };
    const accessToken = sign(payload);
    const refreshToken = signRefresh(payload);
    setAuthCookies(res, accessToken, refreshToken);

    const hotel = await prisma.hotel.findUnique({
      where: { id: user.hotelId },
      select: { id: true, name: true, membership: true },
    });
    return res.json({
      token: accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, hotelId: user.hotelId },
      hotel: hotel
        ? { ...hotel, allowedModules: allowedModulesForMembership(hotel.membership) }
        : { id: user.hotelId, name: "Hotel", membership: "PLATINUM", allowedModules: allowedModulesForMembership("PLATINUM") },
    });
  } catch (err) {
    console.error("[auth.acceptInvite] error:", err);
    return res.status(500).json({ message: "No se pudo activar la cuenta" });
  }
}
