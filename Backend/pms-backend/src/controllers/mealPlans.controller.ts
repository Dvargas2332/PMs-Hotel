import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import { Prisma } from "@prisma/client";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

export async function listMealPlans(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  try {
    const list = await prisma.mealPlan.findMany({
      where: { hotelId },
      orderBy: { createdAt: "desc" },
    });
    res.json(list);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return res.json([]);
    }
    console.error("listMealPlans error", err);
    res.status(500).json({ message: "No se pudieron cargar los planes de alimentación." });
  }
}

export async function createMealPlan(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const id = String(body.id || "").trim() || undefined;
  const name = String(body.name || "").trim();
  if (!id) return res.status(400).json({ message: "ID requerido" });
  if (!name) return res.status(400).json({ message: "Nombre requerido" });

  try {
    const created = await prisma.mealPlan.create({
      data: { id, name, hotelId },
    });
    res.status(201).json(created);
  } catch (err) {
    console.error("createMealPlan error", err);
    res.status(500).json({ message: "No se pudo crear el plan de alimentación." });
  }
}

export async function updateMealPlan(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "ID requerido" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const data: any = {};
  if ("name" in body) data.name = String(body.name || "").trim();

  try {
    const updated = await prisma.mealPlan.update({
      where: { hotelId_id: { hotelId, id } },
      data,
    });
    res.json(updated);
  } catch (err) {
    console.error("updateMealPlan error", err);
    res.status(500).json({ message: "No se pudo actualizar el plan de alimentación." });
  }
}

export async function deleteMealPlan(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "ID requerido" });

  try {
    await prisma.mealPlan.delete({ where: { hotelId_id: { hotelId, id } } });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteMealPlan error", err);
    res.status(500).json({ message: "No se pudo eliminar el plan de alimentación." });
  }
}
