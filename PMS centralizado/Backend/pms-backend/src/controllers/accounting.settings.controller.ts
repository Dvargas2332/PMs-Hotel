import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { seedChartOfAccounts } from "./accounting.seed.js";

function sanitizeSettings(s: any): any {
  if (!s) return s;
  const { hotelId: _h, ...safe } = s;
  const integrations = (safe.integrations && typeof safe.integrations === "object" ? safe.integrations : {}) as any;
  // El mapa de cuentas vive dentro de `integrations` para no agregar columnas:
  // { ..., accounts: { cash: "<accountId>", vat: "<accountId>" } }
  const { accounts, ...rest } = integrations;
  return { ...safe, integrations: rest, accountMap: accounts && typeof accounts === "object" ? accounts : {} };
}

// GET /accounting/settings
export async function getAccountingSettings(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  try {
    let settings = await prisma.accountingSettings.findUnique({ where: { hotelId } });
    if (!settings) {
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
    res.json(sanitizeSettings(settings));
  } catch (e) {
    res.status(500).json({ message: "Error al obtener configuración contable" });
  }
}

// PUT /accounting/settings
export async function updateAccountingSettings(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { autoPost, fiscalPeriods, integrations, country, accountMap } = req.body;
  try {
    const current = await prisma.accountingSettings.findUnique({ where: { hotelId } });
    const currentIntegrations =
      current?.integrations && typeof current.integrations === "object" ? (current.integrations as any) : {};
    const nextIntegrations = {
      ...currentIntegrations,
      ...(integrations && typeof integrations === "object" ? integrations : {}),
      ...(accountMap && typeof accountMap === "object" ? { accounts: accountMap } : {}),
    };

    const settings = await prisma.accountingSettings.upsert({
      where: { hotelId },
      create: {
        hotelId,
        country: country ?? "CR",
        autoPost: autoPost ?? false,
        fiscalPeriods: fiscalPeriods ?? false,
        integrations: nextIntegrations,
        updatedAt: new Date(),
      },
      update: {
        ...(country !== undefined && { country }),
        ...(autoPost !== undefined && { autoPost }),
        ...(fiscalPeriods !== undefined && { fiscalPeriods }),
        integrations: nextIntegrations,
        updatedAt: new Date(),
      },
    });
    res.json(sanitizeSettings(settings));
  } catch (e) {
    res.status(500).json({ message: "Error al guardar configuración contable" });
  }
}

// POST /accounting/initialize — aplica/completa el plan de cuentas CR
export async function initializeAccounting(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  try {
    const count = await seedChartOfAccounts(prisma, hotelId);
    if (count === 0) {
      return res.json({ message: "El plan de cuentas ya está completo", seeded: 0 });
    }
    res.json({ message: `Plan de cuentas aplicado: ${count} cuentas creadas`, seeded: count });
  } catch (e) {
    console.error("[accounting.initialize] error:", e);
    res.status(500).json({ message: "Error al inicializar plan de cuentas" });
  }
}
