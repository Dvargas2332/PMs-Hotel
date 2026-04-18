import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";

async function resolveParentId(hotelId: string, parentId: unknown, currentAccountId?: string) {
  if (parentId === undefined) return undefined;
  if (parentId === null || parentId === "") return null;

  const normalizedParentId = String(parentId).trim();
  if (!normalizedParentId) return null;
  if (currentAccountId && normalizedParentId === currentAccountId) {
    throw new Error("Una cuenta no puede ser su propia cuenta padre");
  }

  const parent = await prisma.accountingAccount.findFirst({
    where: { id: normalizedParentId, hotelId },
    select: { id: true },
  });
  if (!parent) throw new Error("La cuenta padre no pertenece al hotel actual");
  return parent.id;
}

// GET /accounting/accounts
export async function listAccounts(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { type, active, q } = req.query;
  try {
    const accounts = await prisma.accountingAccount.findMany({
      where: {
        hotelId,
        ...(type && { type: type as any }),
        ...(active !== undefined && { isActive: active === "true" }),
        ...(q && {
          OR: [
            { name: { contains: q as string, mode: "insensitive" } },
            { code: { contains: q as string } },
          ],
        }),
      },
      orderBy: { code: "asc" },
    });
    res.json(accounts);
  } catch (e) {
    res.status(500).json({ message: "Error al obtener plan de cuentas" });
  }
}

// GET /accounting/accounts/:id
export async function getAccount(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { id } = req.params;
  try {
    const account = await prisma.accountingAccount.findFirst({ where: { id, hotelId } });
    if (!account) return res.status(404).json({ message: "Cuenta no encontrada" });

    const children = await prisma.accountingAccount.findMany({
      where: { hotelId, parentId: id },
      orderBy: { code: "asc" },
    });

    res.json({ ...account, children });
  } catch (e) {
    res.status(500).json({ message: "Error al obtener cuenta" });
  }
}

// POST /accounting/accounts
export async function createAccount(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { code, name, type, parentId, description } = req.body;
  if (!code || !name || !type) {
    return res.status(400).json({ message: "code, name y type son requeridos" });
  }
  try {
    const existing = await prisma.accountingAccount.findUnique({ where: { hotelId_code: { hotelId, code } } });
    if (existing) return res.status(409).json({ message: "Ya existe una cuenta con ese código" });

    const safeParentId = await resolveParentId(hotelId, parentId);
    const account = await prisma.accountingAccount.create({
      data: {
        hotelId,
        code,
        name,
        type,
        parentId: safeParentId ?? null,
        description: description ?? null,
        isSystem: false,
        updatedAt: new Date(),
      },
    });
    res.status(201).json(account);
  } catch (e: any) {
    const message = e?.message ?? "Error al crear cuenta";
    res.status(message.includes("cuenta padre") ? 400 : 500).json({ message });
  }
}

// PUT /accounting/accounts/:id
export async function updateAccount(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { id } = req.params;
  const { name, isActive, description, parentId } = req.body;
  try {
    const account = await prisma.accountingAccount.findFirst({ where: { id, hotelId } });
    if (!account) return res.status(404).json({ message: "Cuenta no encontrada" });

    const safeParentId = await resolveParentId(hotelId, parentId, id);
    const result = await prisma.accountingAccount.updateMany({
      where: { id, hotelId },
      data: {
        ...(name !== undefined && { name }),
        ...(isActive !== undefined && { isActive }),
        ...(description !== undefined && { description }),
        ...(parentId !== undefined && { parentId: safeParentId }),
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) return res.status(404).json({ message: "Cuenta no encontrada" });

    const updated = await prisma.accountingAccount.findFirst({ where: { id, hotelId } });
    res.json(updated);
  } catch (e: any) {
    const message = e?.message ?? "Error al actualizar cuenta";
    res.status(message.includes("cuenta padre") ? 400 : 500).json({ message });
  }
}

// DELETE /accounting/accounts/:id
export async function deleteAccount(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { id } = req.params;
  try {
    const account = await prisma.accountingAccount.findFirst({ where: { id, hotelId } });
    if (!account) return res.status(404).json({ message: "Cuenta no encontrada" });
    if (account.isSystem) return res.status(403).json({ message: "Las cuentas del sistema no se pueden eliminar" });

    const hasLines = await prisma.accountingEntryLine.count({ where: { hotelId, accountId: id } });
    if (hasLines > 0) {
      return res.status(409).json({ message: "La cuenta tiene movimientos registrados. Puede desactivarla en lugar de eliminarla." });
    }

    await prisma.accountingAccount.updateMany({ where: { hotelId, parentId: id }, data: { parentId: null } });
    const deleted = await prisma.accountingAccount.deleteMany({ where: { id, hotelId } });
    if (deleted.count === 0) return res.status(404).json({ message: "Cuenta no encontrada" });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Error al eliminar cuenta" });
  }
}
