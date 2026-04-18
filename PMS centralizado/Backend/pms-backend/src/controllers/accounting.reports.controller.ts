import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";

// GET /accounting/reports/trial-balance — Balance de comprobación
export async function getTrialBalance(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { from, to } = req.query;
  try {
    const lines = await prisma.accountingEntryLine.findMany({
      where: {
        hotelId,
        entry: {
          status: "POSTED",
          ...(from || to) && {
            date: {
              ...(from && { gte: new Date(from as string) }),
              ...(to && { lte: new Date(to as string) }),
            },
          },
        },
      },
      include: { account: { select: { id: true, code: true, name: true, type: true } } },
    });

    const map = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();
    for (const l of lines) {
      const key = l.accountId;
      const existing = map.get(key) ?? { code: l.account.code, name: l.account.name, type: l.account.type, debit: 0, credit: 0 };
      existing.debit += Number(l.debit);
      existing.credit += Number(l.credit);
      map.set(key, existing);
    }

    const rows = Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

    res.json({ rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 });
  } catch (e) {
    res.status(500).json({ message: "Error al generar balance de comprobación" });
  }
}

// GET /accounting/reports/income-statement — Estado de Resultados
export async function getIncomeStatement(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { from, to } = req.query;
  try {
    const lines = await prisma.accountingEntryLine.findMany({
      where: {
        hotelId,
        entry: {
          status: "POSTED",
          ...(from || to) && {
            date: {
              ...(from && { gte: new Date(from as string) }),
              ...(to && { lte: new Date(to as string) }),
            },
          },
        },
        account: { type: { in: ["INCOME", "EXPENSE", "COST"] } },
      },
      include: { account: { select: { code: true, name: true, type: true } } },
    });

    const map = new Map<string, { code: string; name: string; type: string; net: number }>();
    for (const l of lines) {
      const key = `${l.account.type}__${l.account.code}`;
      const existing = map.get(key) ?? { code: l.account.code, name: l.account.name, type: l.account.type, net: 0 };
      // Para ingresos: crédito suma, débito resta. Para gastos/costos: débito suma, crédito resta.
      if (l.account.type === "INCOME") {
        existing.net += Number(l.credit) - Number(l.debit);
      } else {
        existing.net += Number(l.debit) - Number(l.credit);
      }
      map.set(key, existing);
    }

    const rows = Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
    const totalIncome = rows.filter((r) => r.type === "INCOME").reduce((s, r) => s + r.net, 0);
    const totalCost = rows.filter((r) => r.type === "COST").reduce((s, r) => s + r.net, 0);
    const totalExpense = rows.filter((r) => r.type === "EXPENSE").reduce((s, r) => s + r.net, 0);
    const grossProfit = totalIncome - totalCost;
    const netProfit = grossProfit - totalExpense;

    res.json({ rows, totalIncome, totalCost, totalExpense, grossProfit, netProfit });
  } catch (e) {
    res.status(500).json({ message: "Error al generar estado de resultados" });
  }
}

// GET /accounting/reports/balance-sheet — Balance General (simplificado)
export async function getBalanceSheet(req: Request, res: Response) {
  const hotelId = (req as any).hotelId as string;
  const { asOf } = req.query;
  try {
    const lines = await prisma.accountingEntryLine.findMany({
      where: {
        hotelId,
        entry: {
          status: "POSTED",
          ...(asOf && { date: { lte: new Date(asOf as string) } }),
        },
        account: { type: { in: ["ASSET", "LIABILITY", "EQUITY"] } },
      },
      include: { account: { select: { code: true, name: true, type: true } } },
    });

    const map = new Map<string, { code: string; name: string; type: string; balance: number }>();
    for (const l of lines) {
      const key = `${l.account.type}__${l.account.code}`;
      const existing = map.get(key) ?? { code: l.account.code, name: l.account.name, type: l.account.type, balance: 0 };
      // Activos: débito aumenta. Pasivos/Patrimonio: crédito aumenta.
      if (l.account.type === "ASSET") {
        existing.balance += Number(l.debit) - Number(l.credit);
      } else {
        existing.balance += Number(l.credit) - Number(l.debit);
      }
      map.set(key, existing);
    }

    const rows = Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
    const totalAssets = rows.filter((r) => r.type === "ASSET").reduce((s, r) => s + r.balance, 0);
    const totalLiabilities = rows.filter((r) => r.type === "LIABILITY").reduce((s, r) => s + r.balance, 0);
    const totalEquity = rows.filter((r) => r.type === "EQUITY").reduce((s, r) => s + r.balance, 0);

    res.json({ rows, totalAssets, totalLiabilities, totalEquity, balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 });
  } catch (e) {
    res.status(500).json({ message: "Error al generar balance general" });
  }
}
