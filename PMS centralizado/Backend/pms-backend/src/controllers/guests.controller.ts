// src/controllers/guests.controller.ts

import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

/**
 * Identificación sin formato: la misma cédula puede venir "1-1111-1111",
 * "111111111" o "1 1111 1111" y debe tratarse como el mismo cliente.
 */
function normalizeIdNumber(value: unknown) {
  return String(value ?? "")
    .replace(/[^\dA-Za-z]/g, "")
    .toUpperCase();
}

/** Busca un huésped con la misma identificación comparando valores normalizados. */
async function findGuestByIdNumber(hotelId: string, idNumber: unknown, excludeId?: string) {
  const normalized = normalizeIdNumber(idNumber);
  if (!normalized) return null;

  const candidates = await prisma.guest.findMany({
    where: { hotelId, idNumber: { not: null } },
    select: { id: true, idNumber: true },
    orderBy: { createdAt: "desc" },
    take: 20000,
  });
  const match = candidates.find(
    (g) => g.id !== excludeId && normalizeIdNumber(g.idNumber) === normalized
  );
  if (!match) return null;
  return prisma.guest.findFirst({ where: { id: match.id, hotelId } });
}

export async function listGuests(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const q = (req.query.q as string | undefined)?.trim();

  const where: Prisma.GuestWhereInput | undefined = q
    ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      }
    : undefined;

  const guests = await prisma.guest.findMany({
    where: { hotelId: user.hotelId, ...(where ?? {}) },
    orderBy: { createdAt: "desc" },
  });

  res.json(guests);
}

export async function createGuest(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user as AuthUser | undefined;
    if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
    const {
      firstName,
      lastName,
      email,
      phone,
      state,
      idType,
      idNumber,
      legalName,
      managerName,
      economicActivity,
      emailAlt1,
      emailAlt2,
      country,
      city,
      address,
      company,
      notes,
    } = req.body;

    const or: Prisma.GuestWhereInput[] = [];
    if (email) or.push({ email });
    if (phone) or.push({ phone });
    if (firstName && lastName) or.push({ firstName, lastName });

    // Si ya existe un huésped, devolverlo en vez de crear duplicado
    if (or.length > 0) {
      const duplicate = await prisma.guest.findFirst({
        where: { hotelId: user.hotelId, OR: or },
      });
      if (duplicate) {
        return res.json(duplicate);
      }
    }

    // La identificación identifica al cliente: misma cédula con otro formato
    // tampoco debe crear un perfil nuevo.
    if (idNumber) {
      const sameId = await findGuestByIdNumber(user.hotelId, idNumber);
      if (sameId) return res.json(sameId);
    }

    const guest = await prisma.guest.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        state,
        idType,
        idNumber,
        legalName,
        managerName,
        economicActivity,
        emailAlt1,
        emailAlt2,
        country,
        city,
        address,
        company,
        notes,
        hotelId: user.hotelId,
      },
    });
    res.status(201).json(guest);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "El email ya existe" });
    }
    throw err;
  }
}

export async function updateGuest(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user as AuthUser | undefined;
    if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
    const { id } = req.params;
    const {
      firstName,
      lastName,
      email,
      phone,
      state,
      idType,
      idNumber,
      legalName,
      managerName,
      economicActivity,
      emailAlt1,
      emailAlt2,
      country,
      city,
      address,
      company,
      notes,
    } = req.body;

    const hotelId = user.hotelId;
    const existing = await prisma.guest.findFirst({ where: { id, hotelId } });
    if (!existing) return res.status(404).json({ message: "Huésped no encontrado" });

    // Validar que no exista OTRO perfil con mismos email/nombre completo/teléfono
    const or: Prisma.GuestWhereInput[] = [];
    if (email) {
      or.push({ email });
    }
    if (phone) {
      or.push({ phone });
    }
    if (firstName && lastName) {
      or.push({ firstName, lastName });
    }

    if (or.length > 0) {
      const duplicate = await prisma.guest.findFirst({
        where: {
          hotelId: user.hotelId,
          NOT: { id },
          OR: or,
        },
      });

      if (duplicate) {
        return res.status(409).json({
          message:
            "Ya existe otro perfil de huésped con el mismo correo, identificación, nombre completo o teléfono.",
        });
      }
    }

    // Misma identificación con otro formato también es el mismo cliente.
    if (idNumber) {
      const sameId = await findGuestByIdNumber(user.hotelId, idNumber, id);
      if (sameId) {
        return res.status(409).json({
          message: `Ya existe un cliente con esa identificación (${sameId.firstName || ""} ${sameId.lastName || ""}`.trim() + ").",
        });
      }
    }

    const updated = await prisma.guest.updateMany({
      where: { id, hotelId },
      data: {
        firstName,
        lastName,
        email,
        phone,
        state,
        idType,
        idNumber,
        legalName,
        managerName,
        economicActivity,
        emailAlt1,
        emailAlt2,
        country,
        city,
        address,
        company,
        notes,
      },
    });
    if (updated.count === 0) return res.status(404).json({ message: "Huésped no encontrado" });
    const guest = await prisma.guest.findFirst({ where: { id, hotelId } });
    res.json(guest);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "El email ya existe" });
    }
    throw err;
  }
}
