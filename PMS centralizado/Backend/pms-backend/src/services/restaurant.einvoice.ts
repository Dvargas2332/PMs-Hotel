// src/services/restaurant.einvoice.ts
// Emisión de comprobantes electrónicos (FE/TE) de una venta de restaurante.
//
// Antes existían dos caminos distintos: el cierre creaba un documento DRAFT sin
// XML (imposible de firmar/enviar) y el endpoint manual armaba el XML pero nunca
// se ejecutaba porque el documento ya existía. Este servicio es el único emisor.
//
// Reglas:
// - No se consume consecutivo si el hotel no puede emitir (FE apagada / sin emisor).
// - Los importes del XML salen de los totales guardados de la orden, así que el
//   total del comprobante siempre coincide con la venta cobrada.
// - Los medios de pago se traducen a códigos de Hacienda y conservan moneda y
//   tipo de cambio cuando el cobro fue en moneda extranjera.

import { randomInt } from "node:crypto";
import prisma from "../lib/prisma.js";
import { Prisma } from "@prisma/client";
import { calculateOrderTotals, type TaxInput } from "../lib/restaurantTaxes.js";
import { asNumber as asNumberShared } from "../lib/num.js";
import { resolveHaciendaPaymentCode } from "../lib/restaurantPaymentCodes.js";
import { resolveIssuerIdNumber } from "./einvoice.issuer.js";
import {
  buildCrXml,
  buildSummaryFromLines,
  type CrIssuer,
  type CrLineItem,
  type CrPayment,
  type CrReceiver,
} from "./einvoicing.xml.builder.js";

const padLeft = (input: string, len: number, char = "0") => {
  const s = String(input ?? "");
  if (s.length >= len) return s.slice(-len);
  return char.repeat(len - s.length) + s;
};

const typeCode = (docType: "FE" | "TE") => (docType === "FE" ? "01" : "04");

const asNumber = (value: unknown) => asNumberShared(value);

const round2 = (n: number) => Math.round(n * 100) / 100;

function dateDDMMAAAA(d: Date = new Date()) {
  return `${padLeft(String(d.getDate()), 2)}${padLeft(String(d.getMonth() + 1), 2)}${d.getFullYear()}`;
}

function randomSecurityCode() {
  return padLeft(String(randomInt(0, 100_000_000)), 8);
}

/** Clave numérica: País(3) + DDMMAAAA(8) + Cédula(12) + Consecutivo(20) + Situación(1) + Seguridad(8) */
export function buildOfficialKey(opts: {
  countryCode: string;
  issuerId: string;
  consecutive: string;
  situation: string;
  securityCode: string;
  date?: Date;
}) {
  const country = padLeft(String(opts.countryCode || "506").replace(/\D/g, ""), 3);
  const issuer = padLeft(String(opts.issuerId || "").replace(/\D/g, ""), 12);
  const consecutive = String(opts.consecutive || "").replace(/\D/g, "");
  const situation = padLeft(String(opts.situation || "1").replace(/\D/g, ""), 1);
  const security = padLeft(String(opts.securityCode || "").replace(/\D/g, ""), 8);
  return `${country}${dateDDMMAAAA(opts.date)}${issuer}${consecutive}${situation}${security}`;
}

export async function nextEInvoiceConsecutive(
  hotelId: string,
  docType: "FE" | "TE",
  branch: string,
  terminal: string
) {
  const b = padLeft(branch || "001", 3);
  const t = padLeft(terminal || "00001", 5);

  const seq = await prisma.$transaction(async (tx) => {
    const existing = await tx.eInvoicingSequence.findUnique({
      where: { hotelId_docType_branch_terminal: { hotelId, docType, branch: b, terminal: t } },
      select: { id: true, nextNumber: true },
    });
    if (!existing) {
      await tx.eInvoicingSequence.create({ data: { hotelId, docType, branch: b, terminal: t, nextNumber: 2 } });
      return 1;
    }
    await tx.eInvoicingSequence.update({ where: { id: existing.id, hotelId }, data: { nextNumber: { increment: 1 } } });
    return existing.nextNumber;
  });

  return `${typeCode(docType)}${b}${t}${padLeft(String(seq), 10)}`;
}

export function normalizeReceiver(input: unknown) {
  if (!input || typeof input !== "object") return undefined;
  const data = input as Record<string, unknown>;
  const hasData = ["id", "idNumber", "identification", "name", "legalName", "email", "phone"].some(
    (k) => String(data[k] ?? "").trim().length > 0
  );
  return hasData ? (data as Record<string, any>) : undefined;
}

/** Receptor a partir del cliente guardado en la orden (Guest). Sin cédula no hay FE. */
export function receiverFromGuest(guest: any) {
  if (!guest) return undefined;
  const idNumber = String(guest.idNumber || "").replace(/[^\dA-Za-z]/g, "");
  if (!idNumber) return undefined;
  const name = String(guest.legalName || `${guest.firstName || ""} ${guest.lastName || ""}`).trim();
  if (!name) return undefined;
  return {
    idType: String(guest.idType || "01"),
    idNumber,
    name,
    legalName: guest.legalName || undefined,
    email: guest.email || undefined,
    phone: guest.phone || undefined,
  };
}

export interface ResolvedPayment {
  key: string;
  name: string;
  code: string;
  /** Monto en la moneda de la factura (moneda base del hotel). */
  amount: number;
  /** Moneda original del cobro, cuando fue en moneda extranjera. */
  currency?: string;
  exchangeRate?: number;
  reference?: string;
}

/**
 * Medios de cobro de la venta, con código de Hacienda, moneda y tipo de cambio.
 * Usa el detalle por pago si el POS lo envió; si no, el mapa plano de siempre.
 */
export async function resolveRestaurantPayments(hotelId: string, order: any): Promise<{
  payments: ResolvedPayment[];
  baseCurrency: string;
  total: number;
}> {
  const cfg = await prisma.restaurantConfig.findUnique({ where: { hotelId }, select: { payments: true } });
  const payCfg = (cfg?.payments && typeof cfg.payments === "object" ? cfg.payments : {}) as any;
  const baseCurrency = String(order?.currency || payCfg.monedaBase || "CRC").toUpperCase();
  const methods: any[] = Array.isArray(payCfg.paymentMethods) ? payCfg.paymentMethods : [];

  const findMethod = (key: unknown, name: unknown) => {
    const k = String(key ?? "").trim().toLowerCase();
    const n = String(name ?? "").trim().toLowerCase();
    return methods.find((m) => {
      const mId = String(m?.id ?? "").trim().toLowerCase();
      const mName = String(m?.name ?? "").trim().toLowerCase();
      return (k && (mId === k || mName === k)) || (n && (mId === n || mName === n));
    });
  };

  const details: any[] = Array.isArray(order?.paymentDetails) ? order.paymentDetails : [];
  const payments: ResolvedPayment[] = [];

  if (details.length > 0) {
    for (const d of details) {
      const amountBase = asNumber(d?.amountBase ?? d?.amount);
      if (!(amountBase > 0)) continue;
      const method = findMethod(d?.key, d?.name);
      const currency = String(d?.currency || "").toUpperCase() || undefined;
      const rate = asNumber(d?.exchangeRate);
      payments.push({
        key: String(d?.key || method?.id || d?.name || "otro"),
        name: String(d?.name || method?.name || d?.key || "Otro"),
        code: resolveHaciendaPaymentCode({
          key: d?.key ?? method?.id,
          name: d?.name ?? method?.name,
          explicitCode: d?.code ?? method?.haciendaCode,
        }),
        amount: round2(amountBase),
        currency: currency && currency !== baseCurrency ? currency : undefined,
        exchangeRate: currency && currency !== baseCurrency && rate > 0 ? rate : undefined,
        reference: d?.reference ? String(d.reference) : undefined,
      });
    }
  } else {
    const breakdown = (order?.paymentBreakdown && typeof order.paymentBreakdown === "object"
      ? order.paymentBreakdown
      : {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(breakdown)) {
      const amount = asNumber(value);
      if (!(amount > 0)) continue;
      const method = findMethod(key, key);
      payments.push({
        key,
        name: String(method?.name || key),
        code: resolveHaciendaPaymentCode({ key, name: method?.name, explicitCode: method?.haciendaCode }),
        amount: round2(amount),
      });
    }
  }

  return { payments, baseCurrency, total: round2(asNumber(order?.total)) };
}

interface IssueOptions {
  hotelId: string;
  order: any;
  docType: "FE" | "TE";
  receiver?: unknown;
  situation?: string;
  actorId?: string | null;
}

export interface IssueResult {
  doc: any | null;
  created: boolean;
  skipped?: "FE_DISABLED" | "NO_ISSUER" | "RECEIVER_REQUIRED";
}

/**
 * Crea (o devuelve) el comprobante electrónico de la venta, con XML listo para
 * firmar y enviar desde el módulo de Facturación Electrónica.
 */
export async function issueRestaurantDoc(opts: IssueOptions): Promise<IssueResult> {
  const { hotelId, order, actorId } = opts;
  if (!order?.id) return { doc: null, created: false, skipped: "FE_DISABLED" };

  const cfg = await prisma.eInvoicingConfig.findUnique({
    where: { hotelId },
    select: { enabled: true, settings: true },
  });
  const settings = (cfg?.settings || {}) as any;
  const connections = (settings.moduleConnections || {}) as any;
  const issuer = (settings.issuer || {}) as any;
  const rs = (settings.restaurant || {}) as any;

  // "000000000" y parecidos son marcadores de posición, no cédulas.
  const hotelRow = await prisma.hotel.findFirst({
    where: { id: hotelId },
    select: { name: true, companyId: true },
  });
  const issuerIdNumber = resolveIssuerIdNumber(issuer.idNumber, hotelRow?.companyId);
  const issuerName = String(issuer.name || issuer.legalName || hotelRow?.name || "").trim();

  const feReady = Boolean(cfg?.enabled) && connections.restaurant !== false;
  if (!feReady) return { doc: null, created: false, skipped: "FE_DISABLED" };
  if (!issuerIdNumber) return { doc: null, created: false, skipped: "NO_ISSUER" };

  // Receptor: el que venga explícito (reemisión manual) o el cliente de la mesa.
  // Sin datos del cliente el comprobante es tiquete electrónico (TE), que no los pide.
  let guestReceiver: Record<string, any> | undefined;
  if (order.guestId && !opts.receiver) {
    const guest = await prisma.guest.findFirst({
      where: { id: String(order.guestId), hotelId },
      select: { firstName: true, lastName: true, legalName: true, idType: true, idNumber: true, email: true, phone: true },
    });
    guestReceiver = receiverFromGuest(guest);
  }
  const normalizedReceiver = normalizeReceiver(opts.receiver ?? guestReceiver);
  const effectiveDocType: "FE" | "TE" = normalizedReceiver?.idNumber ? opts.docType : "TE";

  const existing = await prisma.eInvoicingDocument.findFirst({
    where: { hotelId, restaurantOrderId: String(order.id), docType: effectiveDocType },
    select: { id: true, consecutive: true, key: true, status: true },
  });
  if (existing) return { doc: existing, created: false };

  const branch = String(rs.branch || "001");
  const terminal = String(rs.terminal || "00001");
  const situation = String(opts.situation || rs.situation || "1");
  const isContingency = ["3", "4", "5"].includes(situation);

  // ── Líneas fiscales a partir de los precios y totales guardados ──────────────
  const globals = await getGlobals(hotelId);
  const itemIds: string[] = Array.from(new Set((order.items || []).map((it: any) => String(it.itemId)).filter(Boolean)));
  const catalog = itemIds.length
    ? await prisma.restaurantItem.findMany({
        where: { hotelId, id: { in: itemIds } },
        select: {
          id: true,
          cabys: true,
          priceIncludesTaxesAndService: true,
          taxes: { select: { tax: { select: { percent: true, kind: true, active: true } } } },
        },
      })
    : [];
  const catalogById = new Map(catalog.map((c: any) => [String(c.id), c]));

  const perItem = (order.items || []).map((item: any) => {
    const rule: any = catalogById.get(String(item.itemId));
    const taxInputs: TaxInput[] = (rule?.taxes || [])
      .filter((t: any) => t.tax?.active !== false)
      .map((t: any) => ({ percent: asNumber(t.tax?.percent), kind: String(t.tax?.kind || "OTHER") }));
    const computed = calculateOrderTotals(
      [
        {
          price: asNumber(item.price),
          qty: asNumber(item.qty),
          discountPercent: asNumber(item.discountPercent),
          priceIncludesTaxesAndService:
            item.priceIncludesTaxesAndService ?? rule?.priceIncludesTaxesAndService ?? true,
          taxes: taxInputs.length ? taxInputs : null,
        },
      ],
      globals,
      0
    );
    const ivaPercent = taxInputs.filter((t) => String(t.kind).toUpperCase() !== "SERVICE").reduce((a, t) => a + asNumber(t.percent), 0);
    return {
      item,
      net: computed.subtotal,
      tax: computed.tax,
      taxRate: ivaPercent > 0 ? ivaPercent : asNumber(globals.iva),
      cabys: rule?.cabys || undefined,
      commercialCode: item.itemId || item.id || undefined,
    };
  });

  const computedSubtotal = perItem.reduce((a: number, l: any) => a + l.net, 0);
  const factor = computedSubtotal > 0 ? asNumber(order.subtotal) / computedSubtotal : 1;

  const lines: CrLineItem[] = perItem.map((l: any, idx: number) => {
    const net = round2(l.net * factor);
    const taxAmount = round2(l.tax * factor);
    return {
      lineNumber: idx + 1,
      cabysCode: l.cabys,
      commercialCode: l.commercialCode,
      qty: asNumber(l.item.qty) || 1,
      unitCode: "Sp",
      description: String(l.item.name || "Producto"),
      unitPrice: round2(net / (asNumber(l.item.qty) || 1)),
      discount: 0,
      subtotal: net,
      taxCode: taxAmount > 0 ? "01" : undefined,
      taxRate: taxAmount > 0 ? l.taxRate : undefined,
      taxBase: taxAmount > 0 ? net : undefined,
      taxAmount: taxAmount > 0 ? taxAmount : undefined,
      total: round2(net + taxAmount),
    };
  });

  // El 10% de servicio se emite como línea propia; se ajusta al total guardado
  // para que el comprobante cuadre al centavo con la venta.
  const linesTotal = lines.reduce((a, l) => a + l.total, 0);
  const serviceAmount = round2(asNumber(order.total) - linesTotal);
  if (serviceAmount > 0.005) {
    lines.push({
      lineNumber: lines.length + 1,
      description: "10% Servicio",
      unitCode: "Sp",
      qty: 1,
      unitPrice: serviceAmount,
      discount: 0,
      subtotal: serviceAmount,
      total: serviceAmount,
    });
  }

  const { payments, baseCurrency } = await resolveRestaurantPayments(hotelId, order);
  const crPayments: CrPayment[] =
    payments.length > 0
      ? payments.map((p) => ({
          method: p.code,
          amount: p.amount,
          currency: p.currency,
          exchangeRate: p.exchangeRate,
          reference: p.reference,
        }))
      : [{ method: "01", amount: asNumber(order.total) }];

  const summary = buildSummaryFromLines(lines);
  const consecutive = await nextEInvoiceConsecutive(hotelId, effectiveDocType, branch, terminal);
  const key = buildOfficialKey({
    countryCode: String(issuer.countryCode || "506"),
    issuerId: issuerIdNumber,
    consecutive,
    situation,
    securityCode: randomSecurityCode(),
  });

  const crIssuer: CrIssuer = {
    name: issuerName,
    idType: String(issuer.idType || issuer.idTypeCode || "02"),
    idNumber: issuerIdNumber,
    commercialName: issuer.commercialName || undefined,
    province: issuer.province || undefined,
    canton: issuer.canton || undefined,
    district: issuer.district || undefined,
    address: issuer.address || undefined,
    phone: issuer.phone || undefined,
    email: issuer.email || undefined,
    economicActivity: issuer.economicActivity || "563001",
  };

  const crReceiver: CrReceiver | undefined = normalizedReceiver?.idNumber
    ? {
        name: String(normalizedReceiver.name || normalizedReceiver.legalName || ""),
        idType: String(normalizedReceiver.idType || normalizedReceiver.idTypeCode || "01"),
        idNumber: String(normalizedReceiver.idNumber || normalizedReceiver.identification || ""),
        commercialName: normalizedReceiver.commercialName || undefined,
        phone: normalizedReceiver.phone || undefined,
        email: normalizedReceiver.email || undefined,
      }
    : undefined;

  const xmlUnsigned = buildCrXml({
    docType: effectiveDocType,
    key,
    consecutive,
    issueDate: new Date(),
    issuer: crIssuer,
    receiver: crReceiver,
    currency: baseCurrency,
    items: lines,
    payments: crPayments,
    summary,
    condition: "01",
  });

  const payload = {
    source: "restaurant",
    issuer: {
      countryCode: String(issuer.countryCode || "506"),
      idNumber: issuerIdNumber,
      branch: padLeft(branch, 3),
      terminal: padLeft(terminal, 5),
      situation,
    },
    currency: baseCurrency,
    order: {
      id: order.id,
      saleNumber: order.saleNumber ?? null,
      sectionId: order.sectionId ? fromInternalId(hotelId, order.sectionId) : null,
      tableId: fromInternalId(hotelId, order.tableId),
      status: order.status,
      serviceType: order.serviceType,
      roomId: order.roomId,
      guestId: order.guestId ?? null,
      total: order.total,
      subtotal: order.subtotal,
      tax: order.tax,
      tip10: order.tip10,
      paymentBreakdown: order.paymentBreakdown,
      paymentDetails: order.paymentDetails ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: (order.items || []).map((it: any) => {
        const { hotelId: _h, orderId: _o, ...safe } = it;
        return safe;
      }),
    },
    payments,
    xml: xmlUnsigned,
  } as unknown as Prisma.InputJsonValue;

  const doc = await prisma.eInvoicingDocument.create({
    data: {
      hotelId,
      restaurantOrderId: String(order.id),
      docType: effectiveDocType,
      status: isContingency ? "CONTINGENCY" : "DRAFT",
      branch: padLeft(branch, 3),
      terminal: padLeft(terminal, 5),
      consecutive,
      key,
      receiver: normalizedReceiver ? (normalizedReceiver as Prisma.InputJsonValue) : undefined,
      payload: payload as Prisma.InputJsonValue,
    },
  });

  await prisma.restaurantOrderEvent.create({
    data: {
      hotelId,
      orderId: String(order.id),
      eventType: "EINVOICE_ISSUED",
      actorId: actorId ?? null,
      payload: { docId: doc.id, docType: effectiveDocType, consecutive, key } as Prisma.InputJsonValue,
    },
  });

  return { doc, created: true };
}

let cachedGlobals: { hotelId: string; iva: number; servicio: number; at: number } | null = null;

async function getGlobals(hotelId: string) {
  if (cachedGlobals && cachedGlobals.hotelId === hotelId && Date.now() - cachedGlobals.at < 30_000) {
    return { iva: cachedGlobals.iva, servicio: cachedGlobals.servicio };
  }
  const cfg = await prisma.restaurantConfig.findUnique({ where: { hotelId }, select: { taxes: true } });
  const taxes = (cfg?.taxes && typeof cfg.taxes === "object" ? cfg.taxes : {}) as any;
  const iva = asNumber(taxes?.iva ?? 13);
  const servicio = asNumber(taxes?.servicio ?? 10);
  cachedGlobals = { hotelId, iva, servicio, at: Date.now() };
  return { iva, servicio };
}

function fromInternalId(hotelId: string, id: unknown) {
  const raw = String(id ?? "");
  const prefix = `${hotelId}:`;
  return raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
}
