// src/controllers/guests.controller.ts

import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

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

    // Evitar perfiles de huésped duplicados dentro del mismo hotel
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
          OR: or,
        },
      });

      if (duplicate) {
        return res.status(409).json({
          message:
            "Ya existe un perfil de huésped con el mismo correo, nombre completo o teléfono. Para reservas sin perfil guardado, no cree un huésped.",
        });
      }
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

    const existing = await prisma.guest.findFirst({ where: { id, hotelId: user.hotelId } });
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
            "Ya existe otro perfil de huésped con el mismo correo, nombre completo o teléfono. Para reservas sin perfil guardado, no use un huésped guardado.",
        });
      }
    }

    const guest = await prisma.guest.update({
      where: { id },
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
    res.json(guest);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "El email ya existe" });
    }
    throw err;
  }
}

