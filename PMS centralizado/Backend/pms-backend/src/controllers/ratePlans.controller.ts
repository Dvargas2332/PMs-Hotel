import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import { Prisma } from "@prisma/client";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

export async function listRatePlans(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const activeOnly = String((req.query as any)?.active || "").toLowerCase() === "true";
  try {
    const list = await prisma.ratePlan.findMany({
      where: { hotelId, ...(activeOnly ? { active: true } : {}) },
      orderBy: { createdAt: "desc" },
    });
    res.json(list);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return res.json([]);
    }
    console.error("listRatePlans error", err);
    res.status(500).json({ message: "No se pudieron cargar los planes tarifarios." });
  }
}

export async function createRatePlan(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const id = String(body.id || "").trim() || undefined;
  const name = String(body.name || "").trim();
  if (!name) return res.status(400).json({ message: "Nombre requerido" });

  const data = {
    id: id || undefined,
    name,
    currency: String(body.currency || "CRC").trim() || "CRC",
    price: Number(body.price || 0),
    derived: Boolean(body.derived),
    dateFrom: body.dateFrom ? new Date(body.dateFrom) : null,
    dateTo: body.dateTo ? new Date(body.dateTo) : null,
    restrictions: body.restrictions ?? null,
    active: body.active !== undefined ? Boolean(body.active) : true,
    hotelId,
  };

  try {
    const created = await prisma.ratePlan.create({ data });
    res.status(201).json(created);
  } catch (err) {
    console.error("createRatePlan error", err);
    res.status(500).json({ message: "No se pudo crear el plan tarifario." });
  }
}

export async function updateRatePlan(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "ID requerido" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const data: any = {};
  if ("name" in body) data.name = String(body.name || "").trim();
  if ("currency" in body) data.currency = String(body.currency || "CRC").trim() || "CRC";
  if ("price" in body) data.price = Number(body.price || 0);
  if ("derived" in body) data.derived = Boolean(body.derived);
  if ("dateFrom" in body) data.dateFrom = body.dateFrom ? new Date(body.dateFrom) : null;
  if ("dateTo" in body) data.dateTo = body.dateTo ? new Date(body.dateTo) : null;
  if ("restrictions" in body) data.restrictions = body.restrictions ?? null;
  if ("active" in body) data.active = Boolean(body.active);

  try {
    const updated = await prisma.ratePlan.update({
      where: { hotelId_id: { hotelId, id } },
      data,
    });
    res.json(updated);
  } catch (err) {
    console.error("updateRatePlan error", err);
    res.status(500).json({ message: "No se pudo actualizar el plan tarifario." });
  }
}

export async function deleteRatePlan(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "ID requerido" });

  try {
    await prisma.ratePlan.delete({ where: { hotelId_id: { hotelId, id } } });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteRatePlan error", err);
    res.status(500).json({ message: "No se pudo eliminar el plan tarifario." });
  }
}
