// reservations.controller.ts

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { Prisma, ReservationStatus } from "@prisma/client";
import type { AuthUser } from "../middleware/auth.js";
import { onFrontdeskCheckout } from "../services/accounting.integration.js";

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
  const { roomId, guestId, checkIn, checkOut, adults, children, code, rooming, otaCode, contractId, ratePlanId, mealPlanId } = req.body;

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    return res.status(400).json({ message: "Fechas inválidas" });
  }
  if (checkInDate >= checkOutDate) {
    return res.status(400).json({ message: "La fecha de check-in debe ser antes del check-out" });
  }

  // Validar que la habitación pertenece al hotel
  const room = await prisma.room.findFirst({ where: { id: roomId, hotelId: user.hotelId } });
  if (!room) return res.status(404).json({ message: "Habitacion no encontrada en este hotel" });

  // Validar que el huésped pertenece al mismo hotel
  const guest = await prisma.guest.findFirst({ where: { id: guestId, hotelId: user.hotelId } });
  if (!guest) return res.status(404).json({ message: "Huesped no encontrado en este hotel" });

  if (!contractId) {
    return res.status(400).json({ message: "Contrato requerido" });
  }
  if (!ratePlanId) {
    return res.status(400).json({ message: "Tarifario requerido" });
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, hotelId: user.hotelId, active: true },
  });
  if (!contract) return res.status(404).json({ message: "Contrato no encontrado o inactivo" });
  const rpList = Array.isArray((contract as any).ratePlans) ? (contract as any).ratePlans : [];
  if (!rpList.map(String).includes(String(ratePlanId))) {
    return res.status(400).json({ message: "El tarifario no pertenece al contrato seleccionado" });
  }

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
    contractId: includeExtras ? contractId || null : undefined,
    ratePlanId: includeExtras ? ratePlanId || null : undefined,
    mealPlanId: includeExtras ? mealPlanId || null : undefined,
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
    include: { room: true, guest: true, contract: true, ratePlan: true, mealPlan: true },
  });
  res.json(data);
}

export async function listActiveCheckins(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const data = await prisma.reservation.findMany({
    where: { hotelId: user.hotelId, status: ReservationStatus.CHECKED_IN },
    orderBy: { checkIn: "asc" },
    include: {
      room: true,
      guest: true,
      contract: true,
      ratePlan: true,
      mealPlan: true,
      invoice: { select: { id: true, number: true, total: true, status: true, currency: true, createdAt: true } },
    },
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

  try {
    const r = await prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.updateMany({
        where: { id, hotelId },
        data: { status: ReservationStatus.CHECKED_IN },
      });
      if (updated.count === 0) throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });

      const r = await tx.reservation.findFirst({
        where: { id, hotelId },
        include: { room: true, guest: true },
      });
      if (r?.roomId) {
        await tx.room.updateMany({ where: { id: r.roomId, hotelId }, data: { status: "OCCUPIED" } });
      }
      if (r) {
        const invoiceNumber = `INV-${r.id}`;
        await tx.invoice.upsert({
          where: { reservationId: r.id },
          update: {},
          create: {
            reservationId: r.id,
            guestId: r.guestId,
            number: invoiceNumber,
            status: "DRAFT",
            currency: r.room?.currency || "CRC",
            hotelId,
          },
        });
      }
      return r;
    });
    res.json(r);
  } catch (err: any) {
    if (err?.statusCode === 404) return res.status(404).json({ message: "Reserva no encontrada" });
    console.error("checkIn error", err);
    return res.status(500).json({ message: "No se pudo completar el check-in" });
  }
}

export async function checkOut(req: Request, res: Response) {
  const { id } = req.params;
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const hotelId = user.hotelId;
  const existing = await prisma.reservation.findFirst({ where: { id, hotelId } });
  if (!existing) return res.status(404).json({ message: "Reserva no encontrada" });

  try {
    const r = await prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.updateMany({
        where: { id, hotelId },
        data: { status: ReservationStatus.CHECKED_OUT },
      });
      if (updated.count === 0) throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });

      const r = await tx.reservation.findFirst({ where: { id, hotelId } });
      if (r?.roomId) {
        await tx.room.updateMany({ where: { id: r.roomId, hotelId }, data: { status: "CLEANING" } });
      }
      return r;
    });
    res.json(r);
    onFrontdeskCheckout({
      hotelId,
      reservationId: id,
      reservationCode: (existing as any).code ?? null,
      total: Number((existing as any).total ?? 0),
      currency: "CRC",
      actorId: user?.sub ?? null,
    });
  } catch (err: any) {
    if (err?.statusCode === 404) return res.status(404).json({ message: "Reserva no encontrada" });
    console.error("checkOut error", err);
    return res.status(500).json({ message: "No se pudo completar el check-out" });
  }
}

export async function updateReservation(req: Request, res: Response) {
  const { id } = req.params;
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const hotelId = user.hotelId;

  const existing = await prisma.reservation.findFirst({ where: { id, hotelId } });
  if (!existing) return res.status(404).json({ message: "Reserva no encontrada" });
  if (existing.status === "CANCELED") return res.status(400).json({ message: "No se puede modificar una reserva cancelada" });

  const { roomId, checkIn, checkOut, adults, children, ratePlanId, mealPlanId, contractId } = req.body ?? {};

  const newCheckIn  = checkIn  ? new Date(checkIn)  : existing.checkIn;
  const newCheckOut = checkOut ? new Date(checkOut) : existing.checkOut;

  if (newCheckIn >= newCheckOut) return res.status(400).json({ message: "La fecha de check-in debe ser antes del check-out" });

  const newRoomId = roomId || existing.roomId;

  // Check overbooking (exclude this reservation)
  if (roomId || checkIn || checkOut) {
    const overlapping = await prisma.reservation.findFirst({
      where: {
        hotelId,
        roomId: newRoomId,
        id: { not: id },
        status: { not: "CANCELED" as any },
        checkIn: { lt: newCheckOut },
        checkOut: { gt: newCheckIn },
      },
    });
    if (overlapping) return res.status(400).json({ message: "La habitación ya tiene otra reserva en ese rango de fechas" });
  }

  const data: any = {
    checkIn:  newCheckIn,
    checkOut: newCheckOut,
    adults:   adults   !== undefined ? Number(adults)   : undefined,
    children: children !== undefined ? Number(children) : undefined,
    roomId:   newRoomId,
  };
  if (ratePlanId  !== undefined) data.ratePlanId  = ratePlanId  || null;
  if (mealPlanId  !== undefined) data.mealPlanId  = mealPlanId  || null;
  if (contractId  !== undefined) data.contractId  = contractId  || null;

  // If room changed and guest is checked in, update room statuses
  if (roomId && roomId !== existing.roomId && existing.status === "CHECKED_IN") {
    await prisma.room.updateMany({ where: { id: existing.roomId, hotelId }, data: { status: "AVAILABLE" } });
    await prisma.room.updateMany({ where: { id: newRoomId, hotelId }, data: { status: "OCCUPIED" } });
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data,
    include: { room: true, guest: true, contract: true, ratePlan: true, mealPlan: true },
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: "RESERVATION_MODIFICADA",
        entity: "Reservation",
        entityId: id,
        payload: { before: existing, after: updated } as any,
        hotelId,
      },
    });
  } catch {}

  return res.json(updated);
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
