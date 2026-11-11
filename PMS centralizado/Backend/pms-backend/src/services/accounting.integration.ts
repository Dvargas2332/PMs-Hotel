/**
 * Accounting integration service.
 * Called fire-and-forget from restaurant, einvoicing, and frontdesk controllers
 * after a billable event occurs. Never throws — errors are logged only so the
 * originating transaction always succeeds.
 */
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
  /** Desglose por medio de cobro, para debitar la cuenta de cada uno. */
  payments?: { name?: string | null; key?: string | null; amount: number }[];
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

/**
 * Códigos por defecto del plan CR. La pantalla de Contabilidad puede cambiar a
 * qué cuenta va cada concepto; esto es sólo el punto de partida.
 */
const DEFAULT_ACCOUNT_CODES = {
  cash: "1.1.01.01",       // Caja General
  card: "1.1.01.06",       // Tarjetas y SINPE por cobrar
  sinpe: "1.1.01.06",      // Tarjetas y SINPE por cobrar
  transfer: "1.1.01.04",   // Banco — cuenta corriente moneda local
  receivable: "1.1.02.01", // Clientes — Hospedaje
  restaurantSales: "4.1.01.01",
  roomRevenue: "4.1.02.01",
  vat: "2.1.04.01",
  advance: "2.1.03.01",
} as const;

type AccountMap = Partial<Record<keyof typeof DEFAULT_ACCOUNT_CODES, string>>;

function getAccountMap(settings: any): AccountMap {
  const integrations = settings?.integrations && typeof settings.integrations === "object" ? settings.integrations : {};
  const accounts = (integrations as any)?.accounts;
  return accounts && typeof accounts === "object" ? (accounts as AccountMap) : {};
}

/**
 * Cuenta del concepto: primero la que eligió el contador (id guardado), después
 * el código estándar y, si no existe, la primera cuenta con ese prefijo.
 */
async function resolveMappedAccount(
  hotelId: string,
  map: AccountMap,
  key: keyof typeof DEFAULT_ACCOUNT_CODES
) {
  const mappedId = map?.[key];
  if (mappedId) {
    const mapped = await prisma.accountingAccount.findFirst({
      where: { id: String(mappedId), hotelId, isActive: true },
      select: { id: true, code: true, name: true },
    });
    if (mapped) return mapped;
  }
  const code = DEFAULT_ACCOUNT_CODES[key];
  return resolveAccount(hotelId, code, code.split(".").slice(0, -1).join("."));
}

/** Cuenta configurada para una forma de cobro del restaurante, si la hay. */
async function resolvePaymentMethodAccount(hotelId: string, methodName?: string | null, methodKey?: string | null) {
  const target = String(methodName || methodKey || "").trim();
  if (!target) return null;
  const cfg = await prisma.restaurantConfig.findUnique({ where: { hotelId }, select: { payments: true } });
  const payments = (cfg?.payments && typeof cfg.payments === "object" ? cfg.payments : {}) as any;
  const methods = Array.isArray(payments.paymentMethods) ? payments.paymentMethods : [];
  const match = methods.find(
    (m: any) =>
      String(m?.id || "").toLowerCase() === target.toLowerCase() ||
      String(m?.name || "").toLowerCase() === target.toLowerCase()
  );
  const accountId = String(match?.account || "").trim();
  if (!accountId) return null;
  return prisma.accountingAccount.findFirst({
    where: { id: accountId, hotelId, isActive: true },
    select: { id: true, code: true, name: true },
  });
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
 * Reparte el cobro entre las cuentas ligadas a cada forma de pago. Lo que no
 * venga desglosado (o el redondeo) cae a la cuenta de efectivo del mapa.
 */
async function paymentAllocations(
  hotelId: string,
  map: AccountMap,
  payments: RestaurantSaleEvent["payments"],
  gross: number
): Promise<{ accountId: string; amount: number; label: string }[] | null> {
  const cash = await resolveMappedAccount(hotelId, map, "cash");
  const list = (payments ?? []).filter((p) => Number(p.amount ?? 0) > 0);

  if (!list.length) {
    if (!cash) return null;
    return [{ accountId: cash.id, amount: gross, label: "Cobro venta restaurante" }];
  }

  const out: { accountId: string; amount: number; label: string }[] = [];
  for (const p of list) {
    const amount = Number(p.amount ?? 0);
    const account =
      (await resolvePaymentMethodAccount(hotelId, p.name, p.key)) ?? cash;
    if (!account) continue;
    out.push({ accountId: account.id, amount, label: `Cobro ${p.name || p.key || "venta"}` });
  }
  if (!out.length) return null;

  const sum = out.reduce((s, l) => s + l.amount, 0);
  const rest = Math.round((gross - sum) * 100) / 100;
  if (rest > 0.01) {
    if (cash) out.push({ accountId: cash.id, amount: rest, label: "Cobro venta restaurante" });
  } else if (rest < -0.01) {
    // El desglose no puede exceder el total cobrado: se ajusta a prorrata.
    const factor = gross / sum;
    for (const line of out) line.amount = Math.round(line.amount * factor * 100) / 100;
  }
  return out;
}

/**
 * Called after a restaurant order is marked PAID.
 * DR Caja/Banco (o la cuenta de cada forma de cobro)  |  CR Ingresos + IVA
 */
export async function onRestaurantSale(event: RestaurantSaleEvent): Promise<void> {
  try {
    const settings = await getSettings(event.hotelId);
    if (!settings) return;
    if (!settings.integrations || !(settings.integrations as any).restaurant) return;

    const hotelId = event.hotelId;
    const gross = Number(event.total ?? 0);
    if (gross <= 0) return;

    const map = getAccountMap(settings);
    const incomeAccount = await resolveMappedAccount(hotelId, map, "restaurantSales");
    const taxLiabilityAccount = await resolveMappedAccount(hotelId, map, "vat");
    const charges = await paymentAllocations(hotelId, map, event.payments, gross);

    if (!charges || !incomeAccount) {
      console.warn(`[accounting] restaurant: missing accounts for hotel ${hotelId}`);
      return;
    }

    const taxAmount = Number(event.tax ?? 0);
    const netIncome = gross - taxAmount;

    const lines: { accountId: string; debit: number; credit: number; description?: string }[] = [];

    for (const charge of charges) {
      lines.push({ accountId: charge.accountId, debit: charge.amount, credit: 0, description: charge.label });
    }

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

/**
 * Reversa de una venta de restaurante anulada (devolución).
 * Es el espejo de `onRestaurantSale`: DR Ingresos + DR IVA / CR Caja.
 */
export async function onRestaurantSaleVoid(event: RestaurantSaleEvent): Promise<void> {
  try {
    const settings = await getSettings(event.hotelId);
    if (!settings) return;
    if (!settings.integrations || !(settings.integrations as any).restaurant) return;

    const hotelId = event.hotelId;
    const gross = Number(event.total ?? 0);
    if (gross <= 0) return;

    const map = getAccountMap(settings);
    const incomeAccount = await resolveMappedAccount(hotelId, map, "restaurantSales");
    const taxLiabilityAccount = await resolveMappedAccount(hotelId, map, "vat");
    const refunds = await paymentAllocations(hotelId, map, event.payments, gross);
    if (!refunds || !incomeAccount) {
      console.warn(`[accounting] restaurant void: missing accounts for hotel ${hotelId}`);
      return;
    }

    const taxAmount = Number(event.tax ?? 0);
    const netIncome = gross - taxAmount;

    const lines: { accountId: string; debit: number; credit: number; description?: string }[] = [
      { accountId: incomeAccount.id, debit: netIncome > 0 ? netIncome : gross, credit: 0, description: "Anulación venta restaurante" },
    ];
    if (taxAmount > 0 && taxLiabilityAccount) {
      lines.push({ accountId: taxLiabilityAccount.id, debit: taxAmount, credit: 0, description: "Reversión IVA" });
    }
    for (const refund of refunds) {
      lines.push({
        accountId: refund.accountId,
        debit: 0,
        credit: refund.amount,
        description: refund.label.replace("Cobro", "Devolución"),
      });
    }

    await createEntry({
      hotelId,
      description: `Anulación venta restaurante${event.saleNumber ? ` ${event.saleNumber}` : ""}`,
      source: "RESTAURANT",
      sourceRefId: event.orderId,
      currency: event.currency ?? "CRC",
      autoPost: settings.autoPost,
      actorId: event.actorId,
      lines,
    });
  } catch (err) {
    console.error("[accounting] onRestaurantSaleVoid error:", err);
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

    const map = getAccountMap(settings);
    const receivableAccount = await resolveMappedAccount(hotelId, map, "receivable"); // Cuentas por Cobrar
    const incomeAccount = await resolveMappedAccount(hotelId, map, "restaurantSales"); // Ingresos por ventas
    const taxLiabilityAccount = await resolveMappedAccount(hotelId, map, "vat");       // IVA por Pagar

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

    const map = getAccountMap(settings);
    const receivableAccount = await resolveMappedAccount(hotelId, map, "receivable"); // CxC
    const incomeAccount = await resolveMappedAccount(hotelId, map, "roomRevenue");    // Ingresos Hospedaje
    const taxLiabilityAccount = await resolveMappedAccount(hotelId, map, "vat");      // IVA por Pagar

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
