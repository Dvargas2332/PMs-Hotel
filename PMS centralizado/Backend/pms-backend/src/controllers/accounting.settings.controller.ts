import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { seedChartOfAccounts } from "./accounting.seed.js";

// GET /accounting/settings
export async function getAccountingSettings(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  try {
    let settings = await prisma.accountingSettings.findUnique({ where: { hotelId } });
    if (!settings) {
      const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { currency: true } });
      settings = await prisma.accountingSettings.create({
        data: {
          hotelId,
          country: "CR",
          autoPost: false,
          fiscalPeriods: false,
          integrations: {},
          updatedAt: new Date(),
        },
      });
    }
    res.json(settings);
  } catch (e) {
    res.status(500).json({ message: "Error al obtener configuración contable" });
  }
}

// PUT /accounting/settings
export async function updateAccountingSettings(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { autoPost, fiscalPeriods, integrations, country } = req.body;
  try {
    const settings = await prisma.accountingSettings.upsert({
      where: { hotelId },
      create: {
        hotelId,
        country: country ?? "CR",
        autoPost: autoPost ?? false,
        fiscalPeriods: fiscalPeriods ?? false,
        integrations: integrations ?? {},
        updatedAt: new Date(),
      },
      update: {
        ...(country !== undefined && { country }),
        ...(autoPost !== undefined && { autoPost }),
        ...(fiscalPeriods !== undefined && { fiscalPeriods }),
        ...(integrations !== undefined && { integrations }),
        updatedAt: new Date(),
      },
    });
    res.json(settings);
  } catch (e) {
    res.status(500).json({ message: "Error al guardar configuración contable" });
  }
}

// POST /accounting/initialize — aplica plan de cuentas CR si no existe
export async function initializeAccounting(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  try {
    const count = await seedChartOfAccounts(prisma, hotelId);
    if (count === 0) {
      return res.json({ message: "El plan de cuentas ya estaba inicializado", seeded: 0 });
    }
    res.json({ message: `Plan de cuentas CR aplicado: ${count} cuentas creadas`, seeded: count });
  } catch (e) {
    res.status(500).json({ message: "Error al inicializar plan de cuentas" });
  }
}
