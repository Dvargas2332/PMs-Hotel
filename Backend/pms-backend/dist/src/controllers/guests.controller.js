import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js"; // ojo la extensión .js en ESM
export async function listGuests(req, res) {
    // @ts-ignore
    const user = req.user;
    if (!user?.hotelId)
        return res.status(400).json({ message: "Hotel no definido en token" });
    const q = req.query.q?.trim();
    // Tipamos explícitamente. Si no hay query, dejamos undefined (no {}).
    const where = q
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
export async function createGuest(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        if (!user?.hotelId)
            return res.status(400).json({ message: "Hotel no definido en token" });
        const { firstName, lastName, email, phone } = req.body;
        const guest = await prisma.guest.create({ data: { firstName, lastName, email, phone, hotelId: user.hotelId } });
        res.status(201).json(guest);
    }
    catch (err) {
        if (err?.code === "P2002") {
            return res.status(409).json({ message: "El email ya existe" });
        }
        throw err;
    }
}
export async function updateGuest(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        if (!user?.hotelId)
            return res.status(400).json({ message: "Hotel no definido en token" });
        const { id } = req.params;
        const { firstName, lastName, email, phone } = req.body;
        const existing = await prisma.guest.findFirst({ where: { id, hotelId: user.hotelId } });
        if (!existing)
            return res.status(404).json({ message: "Huésped no encontrado" });
        const guest = await prisma.guest.update({
            where: { id },
            data: { firstName, lastName, email, phone },
        });
        res.json(guest);
    }
    catch (err) {
        if (err?.code === "P2002") {
            return res.status(409).json({ message: "El email ya existe" });
        }
        throw err;
    }
}
