import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import { Prisma } from "@prisma/client";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

export async function listContracts(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  try {
    const list = await prisma.contract.findMany({
      where: { hotelId },
      orderBy: { createdAt: "desc" },
    });
    res.json(list);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return res.json([]);
    }
    console.error("listContracts error", err);
    res.status(500).json({ message: "No se pudieron cargar los contratos." });
  }
}

export async function createContract(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const id = String(body.id || "").trim();
  const channel = String(body.channel || "").trim();
  if (!id) return res.status(400).json({ message: "ID requerido" });
  if (!channel) return res.status(400).json({ message: "Canal requerido" });

  const data = {
    id,
    channel,
    commission: Number(body.commission || 0),
    active: body.active !== undefined ? Boolean(body.active) : true,
    ratePlans: Array.isArray(body.ratePlans) ? body.ratePlans : [],
    mealPlanId: body.mealPlanId ? String(body.mealPlanId) : null,
    hotelId,
  };
  if (!Array.isArray(data.ratePlans) || data.ratePlans.length === 0) {
    return res.status(400).json({ message: "Debe seleccionar al menos un tarifario." });
  }

  try {
    const created = await prisma.contract.create({ data });
    res.status(201).json(created);
  } catch (err) {
    console.error("createContract error", err);
    res.status(500).json({ message: "No se pudo crear el contrato." });
  }
}

export async function updateContract(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "ID requerido" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const data: any = {};
  if ("channel" in body) data.channel = String(body.channel || "").trim();
  if ("commission" in body) data.commission = Number(body.commission || 0);
  if ("active" in body) data.active = Boolean(body.active);
  if ("ratePlans" in body) data.ratePlans = Array.isArray(body.ratePlans) ? body.ratePlans : [];
  if ("ratePlans" in body && Array.isArray(data.ratePlans) && data.ratePlans.length === 0) {
    return res.status(400).json({ message: "Debe seleccionar al menos un tarifario." });
  }
  if ("mealPlanId" in body) data.mealPlanId = body.mealPlanId ? String(body.mealPlanId) : null;

  try {
    const updated = await prisma.contract.update({
      where: { hotelId_id: { hotelId, id } },
      data,
    });
    res.json(updated);
  } catch (err) {
    console.error("updateContract error", err);
    res.status(500).json({ message: "No se pudo actualizar el contrato." });
  }
}

export async function deleteContract(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "ID requerido" });

  try {
    await prisma.contract.delete({ where: { hotelId_id: { hotelId, id } } });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteContract error", err);
    res.status(500).json({ message: "No se pudo eliminar el contrato." });
  }
}
