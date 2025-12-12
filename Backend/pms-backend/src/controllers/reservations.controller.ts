// reservations.controller.ts

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { randomUUID } from "crypto";
import { Prisma, ReservationStatus } from "@prisma/client";
import type { AuthUser } from "../middleware/auth";

export async function createReservation(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { roomId, guestId, checkIn, checkOut, adults, children, code, rooming, otaCode } = req.body;

  // Validar que la habitacion pertenece al hotel
  const room = await prisma.room.findFirst({ where: { id: roomId, hotelId: user.hotelId } });
  if (!room) return res.status(404).json({ message: "Habitacion no encontrada en este hotel" });
  // Validar que el huésped pertenece al mismo hotel
  const guest = await prisma.guest.findFirst({ where: { id: guestId, hotelId: user.hotelId } });
  if (!guest) return res.status(404).json({ message: "Huesped no encontrado en este hotel" });

  const buildData = (finalCode: string, includeExtras = true) => ({
    code: finalCode,
    rooming: includeExtras ? rooming || null : undefined,
    otaCode: includeExtras ? otaCode || null : undefined,
    roomId,
    guestId,
    checkIn: new Date(checkIn),
    checkOut: new Date(checkOut),
    adults: adults ?? 2,
    children: children ?? 0,
    hotelId: user.hotelId!,
    auditTrail: { createdBy: "api", reason: "create" } as any,
  });

  let finalCode = code || `RSV-${randomUUID().slice(0, 8).toUpperCase()}`;
  try {
    const reservation = await prisma.reservation.create({ data: buildData(finalCode) });
    return res.status(201).json(reservation);
  } catch (err) {
    // Código duplicado
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      try {
        finalCode = `RSV-${Date.now().toString(16).toUpperCase()}`;
        const reservation = await prisma.reservation.create({ data: buildData(finalCode) });
        return res.status(201).json(reservation);
      } catch (dupErr) {
        console.error("createReservation duplicate fallback error", dupErr);
        return res.status(500).json({ message: "No se pudo crear la reserva (codigo duplicado)" });
      }
    }
    // Columnas faltantes (si migracion no corrio) => intentar sin rooming/otaCode
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2022" || err.code === "P2023")) {
      try {
        const reservation = await prisma.reservation.create({ data: buildData(finalCode, false) });
        return res.status(201).json(reservation);
      } catch (schemaErr) {
        console.error("createReservation column fallback error", schemaErr);
        return res.status(500).json({ message: "No se pudo crear la reserva (estructura de BD)" });
      }
    }
    console.error("createReservation error", err);
    return res.status(500).json({ message: err instanceof Error ? err.message : "No se pudo crear la reserva" });
  }
}

export async function listReservations(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const data = await prisma.reservation.findMany({
    where: { hotelId: user.hotelId },
    orderBy: { createdAt: "desc" },
    include: { room: true, guest: true },
  });
  res.json(data);
}

export async function checkIn(req: Request, res: Response) {
  const { id } = req.params;
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const existing = await prisma.reservation.findFirst({ where: { id, hotelId: user.hotelId } });
  if (!existing) return res.status(404).json({ message: "Reserva no encontrada" });
  const r = await prisma.reservation.update({
    where: { id },
    data: { status: ReservationStatus.CHECKED_IN },
    include: { room: true },
  });
  await prisma.room.update({ where: { id: r.roomId }, data: { status: "OCCUPIED" } });
  res.json(r);
}

export async function checkOut(req: Request, res: Response) {
  const { id } = req.params;
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const existing = await prisma.reservation.findFirst({ where: { id, hotelId: user.hotelId } });
  if (!existing) return res.status(404).json({ message: "Reserva no encontrada" });
  const r = await prisma.reservation.update({
    where: { id },
    data: { status: ReservationStatus.CHECKED_OUT },
  });
  await prisma.room.update({ where: { id: r.roomId }, data: { status: "CLEANING" } });
  res.json(r);
}

export async function cancelReservation(req: Request, res: Response) {
  const { id } = req.params;
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const existing = await prisma.reservation.findFirst({ where: { id, hotelId: user.hotelId }, include: { room: true } });
  if (!existing) return res.status(404).json({ message: "Reserva no encontrada" });
  const r = await prisma.reservation.update({ where: { id }, data: { status: ReservationStatus.CANCELED } });
  if (existing.roomId) await prisma.room.update({ where: { id: existing.roomId }, data: { status: "AVAILABLE" } });
  res.json(r);
}
