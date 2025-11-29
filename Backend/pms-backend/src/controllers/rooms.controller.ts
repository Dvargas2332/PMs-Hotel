import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";


export async function listRooms(_req: Request, res: Response) {
const rooms = await prisma.room.findMany({ orderBy: { number: "asc" } });
res.json(rooms);
}
export async function upsertRoom(req: Request, res: Response) {
const { number, type, status, notes } = req.body;
const room = await prisma.room.upsert({
where: { number },
update: { type, status, notes },
create: { number, type, status, notes }
});
res.status(201).json(room);
}