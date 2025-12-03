// src/controllers/guests.controller.ts
import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js"; // ojo la extensión .js en ESM

export async function listGuests(req: Request, res: Response) {
  const q = (req.query.q as string | undefined)?.trim();

  // Tipamos explícitamente. Si no hay query, dejamos undefined (no {}).
  const where: Prisma.GuestWhereInput | undefined = q
    ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName:  { contains: q, mode: "insensitive" } },
          { email:     { contains: q, mode: "insensitive" } },
          { phone:     { contains: q, mode: "insensitive" } },
        ],
      }
    : undefined;

  const guests = await prisma.guest.findMany({
    ...(where ? { where } : {}),
    orderBy: { createdAt: "desc" },
  });

  res.json(guests);
}

export async function createGuest(req: Request, res: Response) {
  try {
    const { firstName, lastName, email, phone } = req.body;
    const guest = await prisma.guest.create({ data: { firstName, lastName, email, phone } });
    res.status(201).json(guest);
  } catch (err: any) {
    // Maneja duplicado de email (P2002)
    if (err?.code === "P2002" && err?.meta?.target?.includes("Guest_email_key")) {
      return res.status(409).json({ message: "El email ya existe" });
    }
    throw err;
  }
}

export async function updateGuest(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone } = req.body;
    const guest = await prisma.guest.update({
      where: { id },
      data: { firstName, lastName, email, phone },
    });
    res.json(guest);
  } catch (err: any) {
    if (err?.code === "P2002" && err?.meta?.target?.includes("Guest_email_key")) {
      return res.status(409).json({ message: "El email ya existe" });
    }
    throw err;
  }
}
