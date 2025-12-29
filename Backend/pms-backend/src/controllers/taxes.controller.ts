import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

const asNumber = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
};

export async function listTaxes(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const taxes = await prisma.tax.findMany({
    where: { hotelId: user.hotelId },
    orderBy: [{ name: "asc" }],
  });
  res.json(taxes);
}

export async function createTax(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const code = String(body.code ?? body.id ?? "").trim();
  const name = String(body.name ?? "").trim();
  const percent = asNumber(body.percent);
  const scope = String(body.scope ?? "room").trim() || "room";
  const active = body.active !== false;

  if (!code || !name) return res.status(400).json({ message: "code y name son requeridos" });
  if (percent < 0) return res.status(400).json({ message: "percent no puede ser negativo" });

  const created = await prisma.tax.create({
    data: { hotelId: user.hotelId, code, name, percent, scope, active },
  });
  res.json(created);
}

export async function updateTax(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { id } = req.params as { id?: string };
  if (!id) return res.status(400).json({ message: "id requerido" });

  const existing = await prisma.tax.findFirst({ where: { id, hotelId: user.hotelId } });
  if (!existing) return res.status(404).json({ message: "Impuesto no encontrado" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const data: any = {};
  if (typeof body.code === "string" && body.code.trim()) data.code = body.code.trim();
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("percent" in body) {
    const p = asNumber(body.percent);
    if (p < 0) return res.status(400).json({ message: "percent no puede ser negativo" });
    data.percent = p;
  }
  if (typeof body.scope === "string" && body.scope.trim()) data.scope = body.scope.trim();
  if ("active" in body) data.active = body.active !== false;

  const updated = await prisma.tax.update({ where: { id: existing.id }, data });
  res.json(updated);
}

export async function deleteTax(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { id } = req.params as { id?: string };
  if (!id) return res.status(400).json({ message: "id requerido" });

  const existing = await prisma.tax.findFirst({ where: { id, hotelId: user.hotelId } });
  if (!existing) return res.status(404).json({ message: "Impuesto no encontrado" });

  await prisma.tax.deleteMany({ where: { id: existing.id, hotelId: user.hotelId } });
  res.json({ ok: true });
}

