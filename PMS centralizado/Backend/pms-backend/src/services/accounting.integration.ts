/**
 * Accounting integration service.
 * Called fire-and-forget from restaurant, einvoicing, and frontdesk controllers
 * after a billable event occurs. Never throws — errors are logged only so the
 * originating transaction always succeeds.
 */
import type { PrismaClient } from "@prisma/client";
import prisma from "../lib/prisma.js";

// ─── types ─────────────────────────────────────────────────────────────────────

export interface RestaurantSaleEvent {
  hotelId: string;
  orderId: string;
  saleNumber?: string | null;
  total: number;
  tax?: number;
  service?: number;
  currency?: string;
  paidAt?: Date;
  actorId?: string | null;
}

export interface EInvoicingDocumentEvent {
  hotelId: string;
  documentId: string;
  docType: string;         // FE, TE, NC, ND …
  total?: number;          // optional — service will look up from invoice/order if omitted
  tax?: number;
  currency?: string;
  isVoid?: boolean;
  actorId?: string | null;
}

export interface FrontdeskCheckoutEvent {
  hotelId: string;
  reservationId: string;
  reservationCode?: string | null;
  total: number;
  tax?: number;
  currency?: string;
  actorId?: string | null;
}

// ─── helpers ───────────────────────────────────────────────────────────────────

async function getSettings(hotelId: string) {
  return prisma.accountingSettings.findUnique({ where: { hotelId } });
}

async function nextEntryNumber(hotelId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AC-${year}-`;
  const last = await prisma.accountingEntry.findFirst({
    where: { hotelId, number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = last ? parseInt(last.number.split("-")[2] ?? "0", 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(5, "0")}`;
}

/** Find the first active account matching a code prefix (e.g. "4.1" → first income account) */
async function findAccount(hotelId: string, codePrefix: string) {
  return prisma.accountingAccount.findFirst({
    where: { hotelId, code: { startsWith: codePrefix }, isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

/** Find account by exact code */
async function findAccountExact(hotelId: string, code: string) {
  return prisma.accountingAccount.findUnique({
    where: { hotelId_code: { hotelId, code } },
    select: { id: true, code: true, name: true, isActive: true },
  });
}

async function resolveAccount(hotelId: string, exactCode: string, fallbackPrefix: string) {
  const exact = await findAccountExact(hotelId, exactCode);
  if (exact?.isActive) return exact;
  return findAccount(hotelId, fallbackPrefix);
}

async function createEntry(params: {
  hotelId: string;
  description: string;
  source: "RESTAURANT" | "EINVOICING" | "FRONTDESK";
  sourceRefId?: string | null;
  currency?: string;
  autoPost: boolean;
  actorId?: string | null;
  lines: { accountId: string; debit: number; credit: number; description?: string | null }[];
}) {
  const { hotelId, description, source, sourceRefId, currency, autoPost, actorId, lines } = params;
  const status = autoPost ? "POSTED" : "DRAFT";
  const number = await nextEntryNumber(hotelId);
  return prisma.accountingEntry.create({
    data: {
      hotelId,
      number,
      date: new Date(),
      description,
      status,
      source,
      sourceRefId: sourceRefId ?? null,
      currency: currency ?? "CRC",
      createdBy: actorId ?? null,
      ...(autoPost && { approvedBy: actorId ?? null, approvedAt: new Date() }),
      updatedAt: new Date(),
      lines: {
        create: lines.map((l) => ({
          hotelId,
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          description: l.description ?? null,
        })),
      },
    },
  });
}

// ─── Restaurant integration ────────────────────────────────────────────────────

/**
 * Called after a restaurant order is marked PAID.
 * DR Caja/Banco  |  CR Ingresos por ventas
 * DR Impuestos   |  (if tax present)
 */
export async function onRestaurantSale(event: RestaurantSaleEvent): Promise<void> {
  try {
    const settings = await getSettings(event.hotelId);
    if (!settings) return;
    if (!settings.integrations || !(settings.integrations as any).restaurant) return;

    const hotelId = event.hotelId;
    const gross = Number(event.total ?? 0);
    if (gross <= 0) return;

    // Accounts: try standard CR NIIF codes, fall back to prefix
    const cashAccount = await resolveAccount(hotelId, "1.1.01.01", "1.1.01");   // Caja / Efectivo
    const incomeAccount = await resolveAccount(hotelId, "4.1.01.01", "4.1");    // Ventas Restaurante
    const taxLiabilityAccount = await resolveAccount(hotelId, "2.1.04.01", "2.1.04"); // IVA por Pagar

    if (!cashAccount || !incomeAccount) {
      console.warn(`[accounting] restaurant: missing accounts for hotel ${hotelId}`);
      return;
    }

    const taxAmount = Number(event.tax ?? 0);
    const netIncome = gross - taxAmount;

    const lines: { accountId: string; debit: number; credit: number; description?: string }[] = [];

    // DR Caja — total cobrado
    lines.push({ accountId: cashAccount.id, debit: gross, credit: 0, description: "Cobro venta restaurante" });

    // CR Ingresos netos
    lines.push({ accountId: incomeAccount.id, debit: 0, credit: netIncome > 0 ? netIncome : gross, description: "Ingreso por ventas" });

    // CR IVA por pagar (if tax and account found)
    if (taxAmount > 0 && taxLiabilityAccount) {
      lines.push({ accountId: taxLiabilityAccount.id, debit: 0, credit: taxAmount, description: "IVA por pagar" });
    }

    await createEntry({
      hotelId,
      description: `Venta restaurante${event.saleNumber ? ` ${event.saleNumber}` : ""}`,
      source: "RESTAURANT",
      sourceRefId: event.orderId,
      currency: event.currency ?? "CRC",
      autoPost: settings.autoPost,
      actorId: event.actorId,
      lines,
    });
  } catch (err) {
    console.error("[accounting] onRestaurantSale error:", err);
  }
}

// ─── E-Invoicing integration ───────────────────────────────────────────────────

/**
 * Called after an e-invoicing document is accepted by Hacienda (status = ACEPTADO)
 * or voided (isVoid = true).
 *
 * Accepted: DR CxC / CR Ingresos + IVA
 * Voided:   reversal entry (DR Ingresos + IVA / CR CxC)
 */
export async function onEInvoicingDocument(event: EInvoicingDocumentEvent): Promise<void> {
  try {
    const settings = await getSettings(event.hotelId);
    if (!settings) return;
    if (!settings.integrations || !(settings.integrations as any).einvoicing) return;

    const hotelId = event.hotelId;

    // Resolve total from related invoice or restaurant order if not provided
    let resolvedTotal = Number(event.total ?? 0);
    if (resolvedTotal <= 0) {
      const doc = await prisma.eInvoicingDocument.findFirst({
        where: { id: event.documentId, hotelId },
        include: {
          invoice: { select: { total: true } },
          restaurantOrder: { select: { total: true } },
        },
      });
      resolvedTotal = Number(doc?.invoice?.total ?? doc?.restaurantOrder?.total ?? 0);
    }

    const gross = resolvedTotal;
    if (gross <= 0) return;

    const receivableAccount = await resolveAccount(hotelId, "1.1.02.01", "1.1.02"); // Cuentas por Cobrar
    const incomeAccount = await resolveAccount(hotelId, "4.1.01.01", "4.1");         // Ingresos por ventas
    const taxLiabilityAccount = await resolveAccount(hotelId, "2.1.04.01", "2.1.04"); // IVA por Pagar

    if (!receivableAccount || !incomeAccount) {
      console.warn(`[accounting] einvoicing: missing accounts for hotel ${hotelId}`);
      return;
    }

    const taxAmount = Number(event.tax ?? 0);
    const netIncome = gross - taxAmount;
    const isVoid = event.isVoid ?? false;
    const label = `Doc. electrónico ${event.docType}${event.documentId ? ` #${event.documentId.slice(0, 8)}` : ""}`;

    const lines: { accountId: string; debit: number; credit: number; description?: string }[] = [];

    if (!isVoid) {
      // DR CxC  |  CR Ingresos + IVA
      lines.push({ accountId: receivableAccount.id, debit: gross, credit: 0, description: "Documento electrónico emitido" });
      lines.push({ accountId: incomeAccount.id, debit: 0, credit: netIncome > 0 ? netIncome : gross, description: "Ingreso facturado" });
      if (taxAmount > 0 && taxLiabilityAccount) {
        lines.push({ accountId: taxLiabilityAccount.id, debit: 0, credit: taxAmount, description: "IVA por pagar" });
      }
    } else {
      // Reversal: DR Ingresos + IVA  |  CR CxC
      lines.push({ accountId: incomeAccount.id, debit: netIncome > 0 ? netIncome : gross, credit: 0, description: "Anulación doc. electrónico" });
      if (taxAmount > 0 && taxLiabilityAccount) {
        lines.push({ accountId: taxLiabilityAccount.id, debit: taxAmount, credit: 0, description: "Reversión IVA" });
      }
      lines.push({ accountId: receivableAccount.id, debit: 0, credit: gross, description: "Anulación CxC" });
    }

    await createEntry({
      hotelId,
      description: isVoid ? `Anulación ${label}` : `Emisión ${label}`,
      source: "EINVOICING",
      sourceRefId: event.documentId,
      currency: event.currency ?? "CRC",
      autoPost: settings.autoPost,
      actorId: event.actorId,
      lines,
    });
  } catch (err) {
    console.error("[accounting] onEInvoicingDocument error:", err);
  }
}

// ─── Frontdesk integration ─────────────────────────────────────────────────────

/**
 * Called after a reservation check-out is completed and total is known.
 * DR CxC Hospedaje  |  CR Ingresos por Hospedaje + IVA
 */
export async function onFrontdeskCheckout(event: FrontdeskCheckoutEvent): Promise<void> {
  try {
    const settings = await getSettings(event.hotelId);
    if (!settings) return;
    if (!settings.integrations || !(settings.integrations as any).frontdesk) return;

    const hotelId = event.hotelId;
    const gross = Number(event.total ?? 0);
    if (gross <= 0) return;

    const receivableAccount = await resolveAccount(hotelId, "1.1.02.01", "1.1.02"); // CxC
    const incomeAccount = await resolveAccount(hotelId, "4.1.02.01", "4.1.02");      // Ingresos Hospedaje (fallback 4.1)
    const taxLiabilityAccount = await resolveAccount(hotelId, "2.1.04.01", "2.1.04");

    if (!receivableAccount || !incomeAccount) {
      console.warn(`[accounting] frontdesk: missing accounts for hotel ${hotelId}`);
      return;
    }

    const taxAmount = Number(event.tax ?? 0);
    const netIncome = gross - taxAmount;
    const label = event.reservationCode ?? event.reservationId.slice(0, 8);

    const lines: { accountId: string; debit: number; credit: number; description?: string }[] = [];
    lines.push({ accountId: receivableAccount.id, debit: gross, credit: 0, description: `Cargo hospedaje ${label}` });
    lines.push({ accountId: incomeAccount.id, debit: 0, credit: netIncome > 0 ? netIncome : gross, description: "Ingreso por hospedaje" });
    if (taxAmount > 0 && taxLiabilityAccount) {
      lines.push({ accountId: taxLiabilityAccount.id, debit: 0, credit: taxAmount, description: "IVA por pagar" });
    }

    await createEntry({
      hotelId,
      description: `Check-out reserva ${label}`,
      source: "FRONTDESK",
      sourceRefId: event.reservationId,
      currency: event.currency ?? "CRC",
      autoPost: settings.autoPost,
      actorId: event.actorId,
      lines,
    });
  } catch (err) {
    console.error("[accounting] onFrontdeskCheckout error:", err);
  }
}
