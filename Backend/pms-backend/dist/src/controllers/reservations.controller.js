// reservations.controller.ts
import { prisma } from "../lib/prisma";
import { randomUUID } from "crypto";
import { ReservationStatus } from "@prisma/client";
export async function createReservation(req, res) {
    // @ts-ignore
    const user = req.user;
    if (!user?.hotelId)
        return res.status(400).json({ message: "Hotel no definido en token" });
    const { roomId, guestId, checkIn, checkOut, adults, children } = req.body;
    // Validar que la habitacion pertenece al hotel
    const room = await prisma.room.findFirst({ where: { id: roomId, hotelId: user.hotelId } });
    if (!room)
        return res.status(404).json({ message: "Habitacion no encontrada en este hotel" });
    // Validar que el huésped pertenece al mismo hotel
    const guest = await prisma.guest.findFirst({ where: { id: guestId, hotelId: user.hotelId } });
    if (!guest)
        return res.status(404).json({ message: "Huesped no encontrado en este hotel" });
    const reservation = await prisma.reservation.create({
        data: {
            code: `RSV-${randomUUID().slice(0, 8).toUpperCase()}`,
            roomId,
            guestId,
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            adults,
            children,
            hotelId: user.hotelId,
            auditTrail: { createdBy: "api", reason: "create" },
        },
    });
    res.status(201).json(reservation);
}
export async function listReservations(req, res) {
    // @ts-ignore
    const user = req.user;
    if (!user?.hotelId)
        return res.status(400).json({ message: "Hotel no definido en token" });
    const data = await prisma.reservation.findMany({
        where: { hotelId: user.hotelId },
        orderBy: { createdAt: "desc" },
        include: { room: true, guest: true },
    });
    res.json(data);
}
export async function checkIn(req, res) {
    const { id } = req.params;
    // @ts-ignore
    const user = req.user;
    if (!user?.hotelId)
        return res.status(400).json({ message: "Hotel no definido en token" });
    const existing = await prisma.reservation.findFirst({ where: { id, hotelId: user.hotelId } });
    if (!existing)
        return res.status(404).json({ message: "Reserva no encontrada" });
    const r = await prisma.reservation.update({
        where: { id },
        data: { status: ReservationStatus.CHECKED_IN },
        include: { room: true },
    });
    await prisma.room.update({ where: { id: r.roomId }, data: { status: "OCCUPIED" } });
    res.json(r);
}
export async function checkOut(req, res) {
    const { id } = req.params;
    // @ts-ignore
    const user = req.user;
    if (!user?.hotelId)
        return res.status(400).json({ message: "Hotel no definido en token" });
    const existing = await prisma.reservation.findFirst({ where: { id, hotelId: user.hotelId } });
    if (!existing)
        return res.status(404).json({ message: "Reserva no encontrada" });
    const r = await prisma.reservation.update({
        where: { id },
        data: { status: ReservationStatus.CHECKED_OUT },
    });
    await prisma.room.update({ where: { id: r.roomId }, data: { status: "CLEANING" } });
    res.json(r);
}
export async function cancelReservation(req, res) {
    const { id } = req.params;
    // @ts-ignore
    const user = req.user;
    if (!user?.hotelId)
        return res.status(400).json({ message: "Hotel no definido en token" });
    const existing = await prisma.reservation.findFirst({ where: { id, hotelId: user.hotelId }, include: { room: true } });
    if (!existing)
        return res.status(404).json({ message: "Reserva no encontrada" });
    const r = await prisma.reservation.update({ where: { id }, data: { status: ReservationStatus.CANCELED } });
    if (existing.roomId)
        await prisma.room.update({ where: { id: existing.roomId }, data: { status: "AVAILABLE" } });
    res.json(r);
}
