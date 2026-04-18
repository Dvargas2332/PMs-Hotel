// src/controllers/auth.controller.ts
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { timingSafeEqual } from "crypto";
import prisma from "../lib/prisma.js";
import { sign } from "../lib/jwt.js";
import { ALL_PERMISSIONS } from "../config/permissions.js";
import { allowedModulesForMembership } from "../config/membership.js";

const ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

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

    const token = sign({ sub: user.id, email: user.email, role: user.role, hotelId: user.hotelId });
    return res.status(201).json({
      user,
      token,
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
      const token = sign({ sub: "gestor", email: gestorEmail, role: "ADMIN", hotelId: "saas-gestor", isGestor: true });
      return res.json({
        token,
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

    const token = sign({ sub: user.id, email: user.email, role: user.role, hotelId: user.hotelId });
    const hotel = await prisma.hotel.findUnique({
      where: { id: user.hotelId },
      select: { id: true, name: true, membership: true },
    });
    return res.json({
      token,
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
