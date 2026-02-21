// src/controllers/discounts.controller.ts
import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

const clampPercent = (value: unknown) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
};

export async function listDiscounts(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const list = await prisma.discount.findMany({
    where: { hotelId },
    orderBy: { createdAt: "desc" },
  });

  res.json(list);
}

export async function createDiscount(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const rawId = String(req.body?.id || "").trim();
  const name = String(req.body?.name || "").trim();
  if (!rawId || !name) return res.status(400).json({ message: "id y name requeridos" });

  const value = clampPercent(req.body?.value ?? req.body?.percent);
  const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
  const requiresPin = Boolean(req.body?.requiresPin);
  const active = req.body?.active !== false;

  const created = await prisma.discount.create({
    data: {
      hotelId,
      id: rawId,
      name,
      type: "percent",
      value,
      requiresPin,
      active,
      expiresAt,
    },
  });

  res.status(201).json(created);
}

export async function updateDiscount(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const rawId = String(req.params?.id || "").trim();
  if (!rawId) return res.status(400).json({ message: "id requerido" });

  const name = String(req.body?.name || "").trim();
  const value = clampPercent(req.body?.value ?? req.body?.percent);
  const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
  const requiresPin = Boolean(req.body?.requiresPin);
  const active = req.body?.active !== false;

  const updated = await prisma.discount.update({
    where: { hotelId_id: { hotelId, id: rawId } },
    data: {
      name: name || rawId,
      type: "percent",
      value,
      requiresPin,
      active,
      expiresAt,
    },
  });

  res.json(updated);
}

export async function deleteDiscount(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const rawId = String(req.params?.id || "").trim();
  if (!rawId) return res.status(400).json({ message: "id requerido" });

  await prisma.discount.deleteMany({ where: { hotelId, id: rawId } });
  res.json({ ok: true });
}
