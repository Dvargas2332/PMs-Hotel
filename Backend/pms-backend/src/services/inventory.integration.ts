import type { Prisma, RestaurantInventoryItem } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { convertQty, isSupportedUnit, normalizeUnit, canConvert } from "../lib/units.js";
import { padNumber } from "../lib/sequences.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

type InventoryInvoiceLineInput = {
  name?: string;
  desc?: string;
  detalle?: string;
  sku?: string;
  code?: string;
  qty?: number | string;
  cantidad?: number | string;
  unit?: string;
  unidad?: string;
  cost?: number | string;
  costo?: number | string;
  taxRate?: number | string;
  iva?: number | string;
};

type InventoryInvoiceInput = {
  hotelId: string;
  supplierName: string;
  docNumber?: string;
  docType?: string;
  source?: string;
  issueDate?: string | Date | null;
  currency?: string;
  externalKey?: string;
  lines: InventoryInvoiceLineInput[];
  createdBy?: string | null;
};

const normalizeTaxRate = (value: unknown) => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return 0;
  if (Math.abs(n - 1) < 0.5) return 1;
  if (Math.abs(n - 13) < 0.5) return 13;
  return n;
};

const toNumber = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};

const pickLineValue = (line: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = line?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
};

const normalizeLine = (line: InventoryInvoiceLineInput) => {
  const name = String(line.name || line.desc || line.detalle || "").trim();
  const sku = String(line.sku || line.code || "").trim();
  const qty = toNumber(line.qty ?? line.cantidad);
  const unit = normalizeUnit(line.unit || line.unidad);
  const cost = toNumber(line.cost ?? line.costo);
  const taxRate = normalizeTaxRate(line.taxRate ?? line.iva);
  return { name, sku, qty, unit, cost, taxRate };
};

const nextInventoryNumber = async (tx: DbClient, hotelId: string) => {
  const existing = await tx.hotelSequence.findFirst({
    where: { hotelId, key: "restaurant_inventory" },
    select: { id: true, nextNumber: true },
  });
  if (!existing) {
    const created = await tx.hotelSequence.create({
      data: { hotelId, key: "restaurant_inventory", nextNumber: 2 },
      select: { nextNumber: true },
    });
    return Number(created.nextNumber) - 1;
  }
  await tx.hotelSequence.updateMany({
    where: { id: existing.id, hotelId },
    data: { nextNumber: { increment: 1 } },
  });
  return Number(existing.nextNumber);
};

const resolveInventoryItem = async (
  tx: DbClient,
  hotelId: string,
  supplierName: string,
  line: ReturnType<typeof normalizeLine>
) => {
  const sku = line.sku || "";
  const desc = line.name;
  const unit = line.unit || "un";

  let item: RestaurantInventoryItem | null = null;
  if (sku) {
    item = await tx.restaurantInventoryItem.findFirst({ where: { hotelId, sku } });
  }
  if (!item && desc) {
    item = await tx.restaurantInventoryItem.findFirst({ where: { hotelId, desc } });
  }

  if (!item) {
    if (!isSupportedUnit(unit)) {
      throw new Error(`Unidad inválida para nuevo item: ${unit || "-"}`);
    }
    const number = await nextInventoryNumber(tx, hotelId);
    const generatedSku = sku || `SKU-${padNumber(number, 6)}`;
    item = await tx.restaurantInventoryItem.create({
      data: {
        hotelId,
        number,
        sku: generatedSku,
        desc,
        unit,
        stock: 0,
        min: 0,
        cost: line.cost || 0,
        taxRate: line.taxRate ?? null,
        supplierName: supplierName || null,
        active: true,
      },
    });
  }

  return item;
};

const computeCostPerInventoryUnit = (lineCost: number, qty: number, qtyInItemUnit: number) => {
  if (!qtyInItemUnit || !qty) return lineCost;
  const factor = qty / qtyInItemUnit;
  return lineCost * factor;
};

export async function applyInventoryInvoice(input: InventoryInvoiceInput) {
  if (!input.hotelId) throw new Error("hotelId requerido");
  const supplierName = String(input.supplierName || "").trim();
  if (!supplierName) throw new Error("Proveedor requerido");
  if (!Array.isArray(input.lines) || input.lines.length === 0) throw new Error("Líneas requeridas");

  const issueDate =
    input.issueDate instanceof Date
      ? input.issueDate
      : input.issueDate
        ? new Date(input.issueDate)
        : null;

  return prisma.$transaction(async (tx) => {
    const db = tx as DbClient;
    const invoice = await db.restaurantInventoryInvoice.create({
      data: {
        hotelId: input.hotelId,
        supplierName,
        docNumber: input.docNumber || null,
        docType: input.docType || null,
        source: input.source || "MANUAL",
        issueDate: issueDate && !Number.isNaN(issueDate.getTime()) ? issueDate : null,
        currency: input.currency || null,
        externalKey: input.externalKey || null,
        total: 0,
        taxTotal: 0,
      },
    });

    let total = 0;
    let taxTotal = 0;

    for (const raw of input.lines) {
      const line = normalizeLine(raw);
      if (!line.name) {
        throw new Error("Nombre/descripcion requerido en línea");
      }
      if (!Number.isFinite(line.qty) || line.qty <= 0) {
        throw new Error(`Cantidad inválida para ${line.name}`);
      }
      if (!Number.isFinite(line.cost) || line.cost < 0) {
        throw new Error(`Costo inválido para ${line.name}`);
      }

      const item = await resolveInventoryItem(db, input.hotelId, supplierName, line);
      const lineUnit = line.unit || item.unit;
      const itemUnit = item.unit;

      if (!lineUnit) {
        throw new Error(`Unidad requerida para ${line.name}`);
      }
      if (!isSupportedUnit(lineUnit) || !isSupportedUnit(itemUnit)) {
        throw new Error(`Unidad inválida: ${lineUnit || "-"} / ${itemUnit || "-"}`);
      }
      if (!canConvert(lineUnit, itemUnit)) {
        throw new Error(`Unidades incompatibles: ${lineUnit} -> ${itemUnit}`);
      }

      const qtyInItemUnit = convertQty(line.qty, lineUnit, itemUnit);
      const costPerItemUnit = computeCostPerInventoryUnit(line.cost, line.qty, qtyInItemUnit);

      await db.restaurantInventoryItem.updateMany({
        where: { id: item.id, hotelId: input.hotelId },
        data: {
          stock: { increment: qtyInItemUnit },
          cost: costPerItemUnit,
          taxRate: line.taxRate ?? item.taxRate ?? null,
          supplierName: supplierName || item.supplierName || null,
        },
      });

      await db.restaurantInventoryMovement.create({
        data: {
          hotelId: input.hotelId,
          itemId: item.id,
          qtyDelta: qtyInItemUnit,
          reason: `Invoice ${input.docNumber || ""}`.trim(),
          refType: "INVENTORY_INVOICE",
          refId: invoice.id,
          createdBy: input.createdBy || null,
        },
      });

      const lineSubtotal = line.cost * line.qty;
      const lineTax = line.taxRate ? lineSubtotal * (Number(line.taxRate) / 100) : 0;
      const lineTotal = lineSubtotal + lineTax;
      total += lineTotal;
      taxTotal += lineTax;

      await db.restaurantInventoryInvoiceLine.create({
        data: {
          hotelId: input.hotelId,
          invoiceId: invoice.id,
          inventoryItemId: item.id,
          name: line.name,
          qty: line.qty,
          unit: lineUnit,
          cost: line.cost,
          taxRate: line.taxRate ?? null,
          taxAmount: lineTax || null,
          lineTotal: lineTotal || null,
        },
      });
    }

    await db.restaurantInventoryInvoice.updateMany({
      where: { id: invoice.id, hotelId: input.hotelId },
      data: {
        total,
        taxTotal,
      },
    });

    return invoice;
  });
}

export function buildInventoryLinesFromXml(lines?: Array<Record<string, any>>): InventoryInvoiceLineInput[] {
  if (!Array.isArray(lines)) return [];
  return lines.map((line) => {
    const name =
      pickLineValue(line, ["Detalle", "detalle", "Descripcion", "descripcion", "Naturaleza", "naturaleza"]) || "";
    const code =
      pickLineValue(line, ["Codigo", "codigo"]) ||
      pickLineValue(line, ["CodigoComercial", "codigoComercial"]) ||
      pickLineValue(line?.CodigoComercial?.[0] || {}, ["Codigo", "codigo"]) ||
      (typeof line?.Codigo === "object" ? pickLineValue(line.Codigo, ["Codigo", "codigo"]) : undefined);
    const qtyRaw = pickLineValue(line, ["Cantidad", "cantidad"]);
    const unit = pickLineValue(line, ["UnidadMedida", "unidadMedida", "Unidad", "unidad"]);
    const totalRaw = pickLineValue(line, ["MontoTotal", "montoTotal"]);
    const costRaw =
      pickLineValue(line, ["PrecioUnitario", "precioUnitario"]) ||
      pickLineValue(line, ["Precio", "precio"]) ||
      undefined;
    const qtyNumber = toNumber(qtyRaw);
    const totalNumber = toNumber(totalRaw);
    const cost =
      costRaw !== undefined && costRaw !== null
        ? costRaw
        : qtyNumber > 0 && totalNumber > 0
          ? totalNumber / qtyNumber
          : totalRaw;
    const taxRate =
      pickLineValue(line, ["Tarifa", "tarifa"]) ||
      pickLineValue(line?.Impuesto?.[0] || line?.Impuesto || {}, ["Tarifa", "tarifa"]);

    return {
      name: String(name || "").trim(),
      sku: code ? String(code).trim() : "",
      qty: qtyRaw,
      unit,
      cost,
      taxRate,
    };
  });
}

export async function onEInvoicingXmlImported(input: {
  hotelId: string;
  docType: "FE" | "TE";
  key?: string;
  consecutive?: string;
  totals?: Record<string, any>;
  lines?: Array<Record<string, any>>;
  emitterName?: string;
  emitterId?: string;
  issueDate?: string;
}): Promise<void> {
  const supplierName = String(input.emitterName || input.emitterId || "Proveedor XML").trim();
  const lines = buildInventoryLinesFromXml(input.lines);
  if (!lines.length) return;

  await applyInventoryInvoice({
    hotelId: input.hotelId,
    supplierName,
    docNumber: input.consecutive || input.key,
    docType: input.docType,
    source: "XML",
    issueDate: input.issueDate || null,
    externalKey: input.key,
    lines,
  });
}
