import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";


export async function listGuests(req: Request, res: Response) {
const q = String(req.query.q||"").trim();
const where = q ? {
OR: [
{ firstName: { contains: q, mode: "insensitive" } },
{ lastName: { contains: q, mode: "insensitive" } },
{ email: { contains: q, mode: "insensitive" } },
{ phone: { contains: q, mode: "insensitive" } }
]
} : {};
const guests = await prisma.guest.findMany({ where, orderBy: { createdAt: "desc" } });
res.json(guests);
}


export async function createGuest(req: Request, res: Response) {
const { firstName, lastName, email, phone } = req.body;
const guest = await prisma.guest.create({ data: { firstName, lastName, email, phone } });
res.status(201).json(guest);
}


export async function updateGuest(req: Request, res: Response) {
const { id } = req.params;
const { firstName, lastName, email, phone } = req.body;
const guest = await prisma.guest.update({ where: { id }, data: { firstName, lastName, email, phone } });
res.json(guest);
}