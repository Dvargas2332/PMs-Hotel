import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";

// GET /accounting/periods
export async function listPeriods(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  try {
    const periods = await prisma.accountingPeriod.findMany({
      where: { hotelId },
      orderBy: { startDate: "desc" },
    });
    res.json(periods);
  } catch (e) {
    res.status(500).json({ message: "Error al obtener períodos" });
  }
}

// POST /accounting/periods
export async function createPeriod(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { name, startDate, endDate } = req.body;
  if (!name || !startDate || !endDate) {
    return res.status(400).json({ message: "name, startDate y endDate son requeridos" });
  }
  try {
    const settings = await prisma.accountingSettings.findUnique({ where: { hotelId } });
    if (!settings?.fiscalPeriods) {
      return res.status(403).json({ message: "Los períodos contables no están habilitados en la configuración" });
    }
    const period = await prisma.accountingPeriod.create({
      data: { hotelId, name, startDate: new Date(startDate), endDate: new Date(endDate), updatedAt: new Date() },
    });
    res.status(201).json(period);
  } catch (e) {
    res.status(500).json({ message: "Error al crear período" });
  }
}

// POST /accounting/periods/:id/close
export async function closePeriod(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { id } = req.params;
  try {
    const period = await prisma.accountingPeriod.findFirst({ where: { id, hotelId } });
    if (!period) return res.status(404).json({ message: "Período no encontrado" });
    if (period.status === "CLOSED") return res.status(409).json({ message: "El período ya está cerrado" });

    const pending = await prisma.accountingEntry.count({
      where: { hotelId, periodId: id, status: { in: ["DRAFT", "PENDING"] } },
    });
    if (pending > 0) {
      return res.status(409).json({ message: `Hay ${pending} asiento(s) sin contabilizar en este período. Apruébelos antes de cerrar.` });
    }

    const result = await prisma.accountingPeriod.updateMany({
      where: { id, hotelId },
      data: { status: "CLOSED", closedAt: new Date(), updatedAt: new Date() },
    });
    if (result.count === 0) return res.status(404).json({ message: "Período no encontrado" });

    const updated = await prisma.accountingPeriod.findFirst({ where: { id, hotelId } });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Error al cerrar período" });
  }
}

// DELETE /accounting/periods/:id — solo si está abierto y sin asientos
export async function deletePeriod(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { id } = req.params;
  try {
    const period = await prisma.accountingPeriod.findFirst({ where: { id, hotelId } });
    if (!period) return res.status(404).json({ message: "Período no encontrado" });
    if (period.status === "CLOSED") return res.status(403).json({ message: "No se puede eliminar un período cerrado" });

    const entries = await prisma.accountingEntry.count({ where: { hotelId, periodId: id } });
    if (entries > 0) return res.status(409).json({ message: "El período tiene asientos asociados" });

    const deleted = await prisma.accountingPeriod.deleteMany({ where: { id, hotelId } });
    if (deleted.count === 0) return res.status(404).json({ message: "Período no encontrado" });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Error al eliminar período" });
  }
}
