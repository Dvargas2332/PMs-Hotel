// src/controllers/auth.controller.ts
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";
import { sign } from "../lib/jwt.js";

const ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password } = req.body as { name?: string; email: string; password: string };

    // por si el esquema de validación no corrió
    if (!email || !password) return res.status(400).json({ message: "Email y password son requeridos" });

    // ¿ya existe?
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: "El email ya está registrado" });

    const hash = await bcrypt.hash(password, ROUNDS);
    const user = await prisma.user.create({
      data: {
        name: name ?? "Usuario",
        email,
        password: hash,
        role: "ADMIN", // o lo que quieras por defecto
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    // genera token
    const token = sign({ sub: user.id, email: user.email, role: user.role });

    return res.status(201).json({ user, token });
  } catch (err: any) {
    // Prisma P2002 (único duplicado), por si llega por carrera
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "El email ya está registrado" });
    }
    console.error("[auth.register] error:", err);
    return res.status(500).json({ message: "No se pudo registrar" });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) return res.status(400).json({ message: "Email y password son requeridos" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Credenciales inválidas" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Credenciales inválidas" });

    const token = sign({ sub: user.id, email: user.email, role: user.role });

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
    });
  } catch (err) {
    console.error("[auth.login] error:", err);
    return res.status(500).json({ message: "No se pudo iniciar sesión" });
  }
}
