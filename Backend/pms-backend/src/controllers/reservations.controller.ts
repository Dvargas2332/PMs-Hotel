// reservations.controller.ts

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { randomUUID } from "crypto";
import { ReservationStatus } from "@prisma/client";

export async function createReservation(req: Request, res: Response) {
  const { roomId, guestId, checkIn, checkOut, adults, children } = req.body;
  const reservation = await prisma.reservation.create({
    data: {
      code: `RSV-${randomUUID().slice(0, 8).toUpperCase()}`,
      roomId,
      guestId,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      adults,
      children,
      auditTrail: { createdBy: "api", reason: "create" } as any,
    },
  });
  res.status(201).json(reservation);
}

export async function listReservations(_req: Request, res: Response) {
  const data = await prisma.reservation.findMany({
    orderBy: { createdAt: "desc" },
    include: { room: true, guest: true },
  });
  res.json(data);
}

export async function checkIn(req: Request, res: Response) {
  const { id } = req.params;
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
  const r = await prisma.reservation.update({
    where: { id },
    data: { status: ReservationStatus.CHECKED_OUT },
  });
  await prisma.room.update({ where: { id: r.roomId }, data: { status: "CLEANING" } });
  res.json(r);
}

export async function cancelReservation(req: Request, res: Response) {
  const { id } = req.params;
  const r = await prisma.reservation.update({ where: { id }, data: { status: ReservationStatus.CANCELED } });
  const resv = await prisma.reservation.findUnique({ where: { id }, include: { room: true } });
  if (resv) await prisma.room.update({ where: { id: resv.roomId }, data: { status: "AVAILABLE" } });
  res.json(r);
}
