// reservations.controller.ts

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { Prisma, ReservationStatus } from "@prisma/client";
import type { AuthUser } from "../middleware/auth.js";

async function nextReservationCode(hotelId: string): Promise<string> {
  const seq = await prisma.reservationSequence.upsert({
    where: { hotelId },
    update: { nextNumber: { increment: 1 } },
    create: { hotelId, nextNumber: 1 },
  });
  const n = seq.nextNumber;
  return `RES-${String(n).padStart(6, "0")}`;
}

export async function createReservation(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const { roomId, guestId, checkIn, checkOut, adults, children, code, rooming, otaCode } = req.body;

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  // Validar que la habitación pertenece al hotel
  const room = await prisma.room.findFirst({ where: { id: roomId, hotelId: user.hotelId } });
  if (!room) return res.status(404).json({ message: "Habitacion no encontrada en este hotel" });

  // Validar que el huésped pertenece al mismo hotel
  const guest = await prisma.guest.findFirst({ where: { id: guestId, hotelId: user.hotelId } });
  if (!guest) return res.status(404).json({ message: "Huesped no encontrado en este hotel" });

  // Evitar sobreventa: misma habitación, mismo hotel y rango de fechas solapado.
  // Intervalos [checkIn, checkOut) permiten reservas back‑to‑back.
  const overlapping = await prisma.reservation.findFirst({
    where: {
      hotelId: user.hotelId,
      roomId,
      status: { not: ReservationStatus.CANCELED },
      checkIn: { lt: checkOutDate },
      checkOut: { gt: checkInDate },
    },
  });

  if (overlapping) {
    return res.status(400).json({
      message: "La habitacion ya tiene otra reserva en ese rango de fechas.",
    });
  }

  const buildData = (finalCode: string, includeExtras = true) => ({
    code: finalCode,
    rooming: includeExtras ? rooming || null : undefined,
    otaCode: includeExtras ? otaCode || null : undefined,
    roomId,
    guestId,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    adults: adults ?? 2,
    children: children ?? 0,
    hotelId: user.hotelId!,
    auditTrail: { createdBy: "api", reason: "create" } as any,
  });

  let finalCode = code || (await nextReservationCode(user.hotelId!));
  try {
    const reservation = await prisma.reservation.create({ data: buildData(finalCode) });
    return res.status(201).json(reservation);
  } catch (err) {
    // Código duplicado: pedimos un nuevo consecutivo de la secuencia
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      try {
        finalCode = await nextReservationCode(user.hotelId!);
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
    return res
      .status(500)
      .json({ message: err instanceof Error ? err.message : "No se pudo crear la reserva" });
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
  const hotelId = user.hotelId;
  const existing = await prisma.reservation.findFirst({ where: { id, hotelId } });
  if (!existing) return res.status(404).json({ message: "Reserva no encontrada" });
  const updated = await prisma.reservation.updateMany({
    where: { id, hotelId },
    data: { status: ReservationStatus.CHECKED_IN },
  });
  if (updated.count === 0) return res.status(404).json({ message: "Reserva no encontrada" });
  const r = await prisma.reservation.findFirst({
    where: { id, hotelId },
    include: { room: true, guest: true },
  });
  if (r?.roomId) {
    await prisma.room.updateMany({ where: { id: r.roomId, hotelId }, data: { status: "OCCUPIED" } });
  }
  res.json(r);
}

export async function checkOut(req: Request, res: Response) {
  const { id } = req.params;
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const hotelId = user.hotelId;
  const existing = await prisma.reservation.findFirst({ where: { id, hotelId } });
  if (!existing) return res.status(404).json({ message: "Reserva no encontrada" });
  const updated = await prisma.reservation.updateMany({
    where: { id, hotelId },
    data: { status: ReservationStatus.CHECKED_OUT },
  });
  if (updated.count === 0) return res.status(404).json({ message: "Reserva no encontrada" });
  const r = await prisma.reservation.findFirst({ where: { id, hotelId } });
  if (r?.roomId) {
    await prisma.room.updateMany({ where: { id: r.roomId, hotelId }, data: { status: "CLEANING" } });
  }
  res.json(r);
}

export async function cancelReservation(req: Request, res: Response) {
  const { id } = req.params;
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const hotelId = user.hotelId;
  const existing = await prisma.reservation.findFirst({
    where: { id, hotelId },
    include: { room: true, guest: true },
  });
  if (!existing) return res.status(404).json({ message: "Reserva no encontrada" });

  const reason = (req.body as any)?.reason as string | undefined;

  // Guardar registro de auditoría con la reserva completa y motivo de anulación
  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: "RESERVATION_ANULADA",
        entity: "Reservation",
        entityId: existing.id,
        reason: reason || null,
        payload: existing as any,
        hotelId,
      },
    });
  } catch (err) {
    console.error("No se pudo registrar auditoria de anulacion de reserva", err);
  }

  // Liberar habitación (si aplica) y eliminar la reserva
  if (existing.roomId) {
    await prisma.room.updateMany({ where: { id: existing.roomId, hotelId }, data: { status: "AVAILABLE" } });
  }

  await prisma.reservation.deleteMany({ where: { id, hotelId } });
  res.json({ ok: true });
}
