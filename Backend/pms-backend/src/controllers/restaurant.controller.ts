import type { Request, Response } from "express";
import type { Prisma, RestaurantOrderStatus, RestaurantStaffRole } from "@prisma/client";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import { nextHotelSequence, padNumber } from "../lib/sequences.js";
import { canConvert, convertQty, isSupportedUnit, normalizeUnit } from "../lib/units.js";
import { parseCrEInvoiceXml } from "../services/einvoicing.xml.js";
import { applyInventoryInvoice, buildInventoryLinesFromXml } from "../services/inventory.integration.js";

const asNumber = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
};

const clampPercent = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
};

const ORDER_STATUS_ALIASES: Record<string, RestaurantOrderStatus> = {
  ENVIADO: "OPEN",
  ENVIADA: "OPEN",
  ABIERTO: "OPEN",
  CERRADO: "CLOSED",
  PAGADO: "PAID",
};

const VALID_ORDER_STATUSES = new Set<RestaurantOrderStatus>(["OPEN", "CLOSED", "PAID"]);

const OPEN_ORDER_STATUSES: RestaurantOrderStatus[] = ["OPEN"];

function normalizeOrderStatus(value: unknown): RestaurantOrderStatus | undefined {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return undefined;
  const alias = ORDER_STATUS_ALIASES[raw];
  if (alias) return alias;
  if (VALID_ORDER_STATUSES.has(raw as RestaurantOrderStatus)) return raw as RestaurantOrderStatus;
  return undefined;
}

const toInternalId = (hotelId: string, externalId: string) => `${hotelId}:${externalId}`;
const fromInternalId = (hotelId: string, internalId: string) => {
  const prefix = `${hotelId}:`;
  return internalId.startsWith(prefix) ? internalId.slice(prefix.length) : internalId;
};

const padLeft = (input: string, len: number, char = "0") => {
  const s = String(input ?? "");
  if (s.length >= len) return s.slice(-len);
  return char.repeat(len - s.length) + s;
};

const typeCode = (docType: "FE" | "TE") => (docType === "FE" ? "01" : "04");

const todayDDMMYY = () => {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = padLeft(String(d.getMonth() + 1), 2);
  const dd = padLeft(String(d.getDate()), 2);
  return `${dd}${mm}${yy}`;
};

const randomSecurityCode = () => padLeft(String(Math.floor(Math.random() * 100_000_000)), 8);

const crOfficialKey = (opts: { countryCode: string; issuerId: string; consecutive: string; situation: string; securityCode: string }) => {
  const country = padLeft(String(opts.countryCode || "506").replace(/\D/g, ""), 3);
  const issuer = padLeft(String(opts.issuerId || "").replace(/\D/g, ""), 12);
  const consecutive = String(opts.consecutive || "").replace(/\D/g, "");
  const situation = padLeft(String(opts.situation || "1").replace(/\D/g, ""), 1);
  const security = padLeft(String(opts.securityCode || "").replace(/\D/g, ""), 8);
  return `${country}${todayDDMMYY()}${issuer}${consecutive}${situation}${security}`;
};

const normalizeReceiver = (input: unknown) => {
  if (!input || typeof input !== "object") return undefined;
  const data = input as Record<string, unknown>;
  const hasData = ["id", "idNumber", "identification", "name", "legalName", "email", "phone"].some(
    (k) => String(data[k] ?? "").trim().length > 0
  );
  return hasData ? (data as Prisma.InputJsonValue) : undefined;
};

const resolveBillingDocType = (raw: unknown): "FE" | "TE" | null => {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value === "factura" || value === "fe") return "FE";
  if (value === "tiquete" || value === "ticket" || value === "te") return "TE";
  return null;
};

async function nextEInvoiceConsecutive(hotelId: string, docType: "FE" | "TE", branch: string, terminal: string) {
  const b = padLeft(branch || "001", 3);
  const t = padLeft(terminal || "00001", 5);

  const seq = await prisma.$transaction(async (tx) => {
    const existing = await tx.eInvoicingSequence.findUnique({
      where: { hotelId_docType_branch_terminal: { hotelId, docType, branch: b, terminal: t } },
      select: { id: true, nextNumber: true },
    });
    if (!existing) {
      await tx.eInvoicingSequence.create({
        data: { hotelId, docType, branch: b, terminal: t, nextNumber: 2 },
      });
      return 1;
    }
    await tx.eInvoicingSequence.update({
      where: { id: existing.id },
      data: { nextNumber: { increment: 1 } },
    });
    return existing.nextNumber;
  });

  const n = padLeft(String(seq), 10);
  return `${typeCode(docType)}${b}${t}${n}`;
}

async function issueRestaurantDocForOrder(opts: {
  hotelId: string;
  order: any;
  docType: "FE" | "TE";
  receiver?: unknown;
  allowLocal?: boolean;
}) {
  const { hotelId, order, docType, receiver, allowLocal } = opts;
  if (!order?.id) return null;

  const cfg = await prisma.eInvoicingConfig.findUnique({
    where: { hotelId },
    select: { enabled: true, settings: true },
  });

  const settings = (cfg?.settings || {}) as any;
  const connections = (settings.moduleConnections || {}) as any;

  const issuer = (settings.issuer || {}) as any;
  const rs = (settings.restaurant || {}) as any;
  const countryCode = String(issuer.countryCode || "506");
  const issuerIdNumber = String(issuer.idNumber || "");
  const branch = String(rs.branch || "001");
  const terminal = String(rs.terminal || "00001");
  const situation = String(rs.situation || "1");
  const canIssue = Boolean(cfg?.enabled) && connections.restaurant !== false && issuerIdNumber.trim().length > 0;
  if (!canIssue && !allowLocal) return null;

  const normalizedReceiver = normalizeReceiver(receiver);
  const effectiveDocType: "FE" | "TE" = normalizedReceiver ? docType : "TE";
  const finalDocType: "FE" | "TE" = canIssue ? effectiveDocType : "TE";

  const existing = await prisma.eInvoicingDocument.findFirst({
    where: { hotelId, restaurantOrderId: String(order.id), docType: finalDocType },
  });
  if (existing) return existing;

  const consecutive = await nextEInvoiceConsecutive(hotelId, finalDocType, branch, terminal);
  const key = canIssue
    ? crOfficialKey({
        countryCode,
        issuerId: issuerIdNumber,
        consecutive,
        situation,
        securityCode: randomSecurityCode(),
      })
    : null;

  const payload = {
    source: "restaurant",
    issuer: {
      countryCode,
      idNumber: issuerIdNumber,
      branch: padLeft(branch, 3),
      terminal: padLeft(terminal, 5),
      situation,
    },
    order: {
      id: order.id,
      sectionId: order.sectionId,
      tableId: order.tableId,
      status: order.status,
      serviceType: order.serviceType,
      roomId: order.roomId,
      total: order.total,
      tip10: order.tip10,
      paymentBreakdown: order.paymentBreakdown,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items || [],
    },
  };

  const doc = await prisma.eInvoicingDocument.create({
    data: {
      hotelId,
      restaurantOrderId: String(order.id),
      docType: finalDocType,
      status: "DRAFT",
      branch: padLeft(branch, 3),
      terminal: padLeft(terminal, 5),
      consecutive,
      key,
      receiver: normalizedReceiver,
      payload,
    },
  });

  return doc;
}

const deriveMenuCategoryFromItem = (item: any) =>
  String(item?.subSubFamily?.name || item?.subFamily?.name || item?.family?.name || item?.category || "General");

const normalizeItemSizes = (raw: any) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      const label = String(s?.label ?? s?.name ?? "").trim();
      if (!label) return null;
      return {
        id: s?.id != null ? String(s.id) : undefined,
        label,
        price: asNumber(s?.price ?? s?.value ?? 0),
        isDefault: Boolean(s?.isDefault),
      };
    })
    .filter(Boolean);
};

const normalizeItemDetails = (raw: any) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => {
      const label = String(d?.label ?? d?.name ?? "").trim();
      if (!label) return null;
      return {
        id: d?.id != null ? String(d.id) : undefined,
        label,
        priceDelta: asNumber(d?.priceDelta ?? d?.price ?? 0),
      };
    })
    .filter(Boolean);
};

async function verifyHotelAdminCode(hotelId: string, code: string) {
  const pin = String(code || "").trim();
  if (!pin) return false;

  const launcherAdmins = await prisma.launcherAccount.findMany({
    where: { hotelId, roleId: "ADMIN" },
    select: { password: true },
  });
  for (const acc of launcherAdmins) {
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(pin, acc.password)) return true;
  }

  // Fallback: management users with role ADMIN (if used in this hotel).
  const mgmtAdmins = await prisma.user.findMany({
    where: { hotelId, role: "ADMIN" },
    select: { password: true },
    take: 10,
  });
  for (const u of mgmtAdmins) {
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(pin, u.password)) return true;
  }

  return false;
}

async function requireAdminOrAdminCode(user: AuthUser, hotelId: string, adminCode: unknown) {
  const role = String(user?.role || "").toUpperCase();
  if (role === "ADMIN") return true;
  const code = String(adminCode || "").trim();
  if (!code) return false;
  return verifyHotelAdminCode(hotelId, code);
}

async function getOrCreateRestaurantConfig(hotelId: string) {
  return prisma.restaurantConfig.upsert({
    where: { hotelId },
    update: {},
    create: { hotelId, kitchenPrinter: "", barPrinter: "" },
  });
}

async function getRestaurantTaxesForHotel(hotelId: string) {
  const cfg = await getOrCreateRestaurantConfig(hotelId);
  const taxes = (cfg.taxes && typeof cfg.taxes === "object" ? cfg.taxes : null) as any;
  const iva = asNumber(taxes?.iva ?? 13);
  const servicio = asNumber(taxes?.servicio ?? 10);
  return { iva, servicio };
}

async function ensureFamilyCode(hotelId: string, familyId: string) {
  const existing = await prisma.restaurantFamily.findFirst({
    where: { id: familyId, hotelId },
    select: { id: true, code: true },
  });
  if (!existing) throw new Error("Familia no encontrada");
  if (existing.code) return existing.code;
  for (let attempt = 0; attempt < 8; attempt++) {
    const seq = await nextHotelSequence(hotelId, "restaurant_family_code");
    const code = padNumber(seq, 3);
    try {
      const written = await prisma.restaurantFamily.updateMany({
        where: { id: existing.id, hotelId, code: null },
        data: { code },
      });
      if (written.count === 0) {
        const fresh = await prisma.restaurantFamily.findFirst({ where: { id: existing.id, hotelId }, select: { code: true } });
        if (fresh?.code) return fresh.code;
      } else {
        return code;
      }
    } catch (err: any) {
      if (err?.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("No se pudo asignar el c?digo de familia");
}

async function ensureSubFamilyCode(hotelId: string, subFamilyId: string) {
  const existing = await prisma.restaurantSubFamily.findFirst({
    where: { id: subFamilyId, hotelId },
    select: { id: true, familyId: true, code: true },
  });
  if (!existing) throw new Error("Subfamilia no encontrada");
  if (existing.code) return existing.code;
  for (let attempt = 0; attempt < 8; attempt++) {
    const seq = await nextHotelSequence(hotelId, `restaurant_subfamily_code:${existing.familyId}`);
    const code = padNumber(seq, 2);
    try {
      const written = await prisma.restaurantSubFamily.updateMany({
        where: { id: existing.id, hotelId, code: null },
        data: { code },
      });
      if (written.count === 0) {
        const fresh = await prisma.restaurantSubFamily.findFirst({ where: { id: existing.id, hotelId }, select: { code: true } });
        if (fresh?.code) return fresh.code;
      } else {
        return code;
      }
    } catch (err: any) {
      if (err?.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("No se pudo asignar el c?digo de subfamilia");
}

async function ensureSubSubFamilyCode(hotelId: string, subSubFamilyId: string) {
  const existing = await prisma.restaurantSubSubFamily.findFirst({
    where: { id: subSubFamilyId, hotelId },
    select: { id: true, subFamilyId: true, code: true },
  });
  if (!existing) throw new Error("SubSubfamilia no encontrada");
  if (existing.code) return existing.code;
  for (let attempt = 0; attempt < 8; attempt++) {
    const seq = await nextHotelSequence(hotelId, `restaurant_subsubfamily_code:${existing.subFamilyId}`);
    const code = padNumber(seq, 2);
    try {
      const written = await prisma.restaurantSubSubFamily.updateMany({
        where: { id: existing.id, hotelId, code: null },
        data: { code },
      });
      if (written.count === 0) {
        const fresh = await prisma.restaurantSubSubFamily.findFirst({ where: { id: existing.id, hotelId }, select: { code: true } });
        if (fresh?.code) return fresh.code;
      } else {
        return code;
      }
    } catch (err: any) {
      if (err?.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("No se pudo asignar el c?digo de subsubfamilia");
}

function buildItemPrefix(familyCode: string, subFamilyCode?: string | null, subSubFamilyCode?: string | null) {
  return [familyCode, subFamilyCode || null, subSubFamilyCode || null].filter(Boolean).join(".");
}

async function nextRestaurantItemCode(hotelId: string, prefix: string) {
  const seq = await nextHotelSequence(hotelId, `restaurant_item_code:${prefix}`);
  return `${prefix}-${padNumber(seq, 4)}`;
}

async function sumTaxPercentForHotel(hotelId: string, taxIds: string[]) {
  if (!Array.isArray(taxIds) || taxIds.length === 0) return 0;
  const taxes = await prisma.tax.findMany({
    where: { hotelId, id: { in: taxIds }, active: true },
    select: { percent: true },
  });
  return taxes.reduce((acc, t) => acc + Number(t.percent || 0), 0);
}

export async function listSections(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const sections = await prisma.restaurantSection.findMany({
    where: { hotelId: user.hotelId },
    include: { tables: true, objects: true },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const isActiveInWindow = (startTime?: string | null, endTime?: string | null) => {
    const parse = (t?: string | null) => {
      if (!t) return null;
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim());
      if (!m) return null;
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
      return hh * 60 + mm;
    };
    const start = parse(startTime);
    const end = parse(endTime);
    if (start == null && end == null) return true;
    if (start != null && end == null) return minutesNow >= start;
    if (start == null && end != null) return minutesNow < end;
    if (start == null || end == null) return true;
    if (start === end) return true;
    if (start < end) return minutesNow >= start && minutesNow < end;
    return minutesNow >= start || minutesNow < end;
  };

  const assignments = await prisma.restaurantMenuAssignment.findMany({
    where: { hotelId, active: true, sectionId: { in: sections.map((s) => s.id) } },
    include: { menu: { select: { id: true, name: true, active: true } } },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  const assignmentsBySection = new Map<string, any[]>();
  assignments.forEach((a) => {
    const list = assignmentsBySection.get(a.sectionId) || [];
    list.push(a);
    assignmentsBySection.set(a.sectionId, list);
  });

  const mapped = sections.map((s) => ({
    ...s,
    id: fromInternalId(hotelId, s.id),
    activeMenu: (() => {
      const list = assignmentsBySection.get(s.id) || [];
      const activeAssignment = list.find((a) => {
        const dayOk = (Number(a.daysMask || 0) & (1 << day)) !== 0;
        if (!dayOk) return false;
        return isActiveInWindow(a.startTime, a.endTime);
      });
      if (!activeAssignment?.menu || activeAssignment.menu.active === false) return null;
      return { id: activeAssignment.menu.id, name: activeAssignment.menu.name };
    })(),
    tables: (s.tables || []).map((t) => ({
      ...t,
      id: fromInternalId(hotelId, t.id),
      sectionId: fromInternalId(hotelId, t.sectionId),
    })),
    objects: (s.objects || []).map((o) => ({
      ...o,
      sectionId: fromInternalId(hotelId, o.sectionId),
    })),
  }));
  return res.json(mapped);
}

export async function listSectionObjects(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;
  const { sectionId } = req.params as { sectionId?: string };
  if (!sectionId) return res.status(400).json({ message: "sectionId requerido" });

  const internalSectionId = toInternalId(hotelId, sectionId);
  const section = await prisma.restaurantSection.findFirst({
    where: { hotelId, OR: [{ id: internalSectionId }, { id: sectionId }] },
    select: { id: true },
  });
  if (!section) return res.status(404).json({ message: "Secci?n no encontrada" });

  const list = await prisma.restaurantSectionObject.findMany({
    where: { hotelId, sectionId: section.id },
    orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }],
  });
  res.json(list.map((o) => ({ ...o, sectionId })));
}

export async function createSectionObject(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;
  const { sectionId } = req.params as { sectionId?: string };
  if (!sectionId) return res.status(400).json({ message: "sectionId requerido" });

  const internalSectionId = toInternalId(hotelId, sectionId);
  const section = await prisma.restaurantSection.findFirst({
    where: { hotelId, OR: [{ id: internalSectionId }, { id: sectionId }] },
    select: { id: true },
  });
  if (!section) return res.status(404).json({ message: "Secci?n no encontrada" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const kind = String(body.kind || "OTHER").toUpperCase();
  const maxZ = await prisma.restaurantSectionObject.aggregate({
    where: { hotelId, sectionId: section.id },
    _max: { zIndex: true },
  });
  const nextZ = (maxZ._max.zIndex ?? 0) + 1;
  const obj = await prisma.restaurantSectionObject.create({
    data: {
      hotelId,
      sectionId: section.id,
      kind,
      label: body.label ? String(body.label) : null,
      x: typeof body.x === "number" ? body.x : 50,
      y: typeof body.y === "number" ? body.y : 50,
      w: typeof body.w === "number" ? body.w : 18,
      h: typeof body.h === "number" ? body.h : 10,
      zIndex: typeof body.zIndex === "number" ? body.zIndex : nextZ,
      rotation: typeof body.rotation === "number" ? body.rotation : 0,
      color: body.color ? String(body.color) : null,
      meta: body.meta && typeof body.meta === "object" ? body.meta : undefined,
    },
  });
  res.json({ ...obj, sectionId });
}

export async function updateSectionObject(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;
  const { sectionId, objectId } = req.params as { sectionId?: string; objectId?: string };
  if (!sectionId || !objectId) return res.status(400).json({ message: "sectionId y objectId requeridos" });

  const internalSectionId = toInternalId(hotelId, sectionId);
  const section = await prisma.restaurantSection.findFirst({
    where: { hotelId, OR: [{ id: internalSectionId }, { id: sectionId }] },
    select: { id: true },
  });
  if (!section) return res.status(404).json({ message: "Secci?n no encontrada" });

  const existing = await prisma.restaurantSectionObject.findFirst({
    where: { id: String(objectId), hotelId, sectionId: section.id },
  });
  if (!existing) return res.status(404).json({ message: "Objeto no encontrado" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const data: any = {};
  if (body.kind) data.kind = String(body.kind).toUpperCase();
  if ("label" in body) data.label = body.label ? String(body.label) : null;
  if (typeof body.x === "number") data.x = body.x;
  if (typeof body.y === "number") data.y = body.y;
  if (typeof body.w === "number") data.w = body.w;
  if (typeof body.h === "number") data.h = body.h;
  if (typeof body.zIndex === "number") data.zIndex = Math.trunc(body.zIndex);
  if (typeof body.rotation === "number") data.rotation = body.rotation;
  if ("color" in body) data.color = body.color ? String(body.color) : null;
  if ("meta" in body) data.meta = body.meta && typeof body.meta === "object" ? body.meta : null;

  const updated = await prisma.restaurantSectionObject.update({
    where: { id: existing.id },
    data,
  });
  res.json({ ...updated, sectionId });
}

export async function deleteSectionObject(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;
  const { sectionId, objectId } = req.params as { sectionId?: string; objectId?: string };
  if (!sectionId || !objectId) return res.status(400).json({ message: "sectionId y objectId requeridos" });

  const internalSectionId = toInternalId(hotelId, sectionId);
  const section = await prisma.restaurantSection.findFirst({
    where: { hotelId, OR: [{ id: internalSectionId }, { id: sectionId }] },
    select: { id: true },
  });
  if (!section) return res.status(404).json({ message: "Secci?n no encontrada" });

  await prisma.restaurantSectionObject.deleteMany({
    where: { id: String(objectId), hotelId, sectionId: section.id },
  });
  res.json({ ok: true });
}

export async function updateTablePosition(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;
  const { sectionId, tableId } = req.params as { sectionId?: string; tableId?: string };
  if (!sectionId || !tableId) return res.status(400).json({ message: "sectionId y tableId requeridos" });

  const internalSectionId = toInternalId(hotelId, sectionId);
  const section = await prisma.restaurantSection.findFirst({
    where: { hotelId, OR: [{ id: internalSectionId }, { id: sectionId }] },
    select: { id: true },
  });
  if (!section) return res.status(404).json({ message: "Secci?n no encontrada" });

  const internalTableId = toInternalId(hotelId, tableId);
  const table = await prisma.restaurantTable.findFirst({
    where: { hotelId, sectionId: section.id, OR: [{ id: internalTableId }, { id: tableId }] },
  });
  if (!table) return res.status(404).json({ message: "Mesa no encontrada" });

  const { x, y } = req.body || {};
  const nx = typeof x === "number" ? x : typeof x === "string" ? Number(x) : undefined;
  const ny = typeof y === "number" ? y : typeof y === "string" ? Number(y) : undefined;
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return res.status(400).json({ message: "x e y requeridos" });

  await prisma.restaurantTable.updateMany({
    where: { id: table.id, hotelId },
    data: { x: nx, y: ny },
  });

  const updated = await prisma.restaurantTable.findFirst({
    where: { id: table.id, hotelId },
  });
  if (!updated) return res.status(404).json({ message: "Mesa no encontrada" });
  res.json({ ...updated, id: fromInternalId(hotelId, updated.id), sectionId });
}

export async function updateTableStyle(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;
  const { sectionId, tableId } = req.params as { sectionId?: string; tableId?: string };
  if (!sectionId || !tableId) return res.status(400).json({ message: "sectionId y tableId requeridos" });

  const internalSectionId = toInternalId(hotelId, sectionId);
  const section = await prisma.restaurantSection.findFirst({
    where: { hotelId, OR: [{ id: internalSectionId }, { id: sectionId }] },
    select: { id: true },
  });
  if (!section) return res.status(404).json({ message: "Secci?n no encontrada" });

  const internalTableId = toInternalId(hotelId, tableId);
  const table = await prisma.restaurantTable.findFirst({
    where: { hotelId, sectionId: section.id, OR: [{ id: internalTableId }, { id: tableId }] },
  });
  if (!table) return res.status(404).json({ message: "Mesa no encontrada" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const data: any = {};

  if ("name" in body) data.name = body.name ? String(body.name) : null;
  if ("kind" in body) data.kind = body.kind ? String(body.kind) : null;
  if ("color" in body) data.color = body.color ? String(body.color) : null;

  const toNum = (v: any) => (typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN);
  if ("size" in body) {
    const n = toNum(body.size);
    if (Number.isFinite(n)) data.size = n;
  }
  if ("rotation" in body) {
    const n = toNum(body.rotation);
    if (Number.isFinite(n)) data.rotation = n;
  }
  if ("seats" in body) {
    const n = toNum(body.seats);
    if (Number.isFinite(n)) data.seats = Math.trunc(n);
  }
  if ("x" in body) {
    const n = toNum(body.x);
    if (Number.isFinite(n)) data.x = n;
  }
  if ("y" in body) {
    const n = toNum(body.y);
    if (Number.isFinite(n)) data.y = n;
  }

  if (Object.keys(data).length === 0) return res.status(400).json({ message: "No hay campos para actualizar" });

  await prisma.restaurantTable.updateMany({
    where: { id: table.id, hotelId },
    data,
  });

  const updated = await prisma.restaurantTable.findFirst({
    where: { id: table.id, hotelId },
  });
  if (!updated) return res.status(404).json({ message: "Mesa no encontrada" });
  res.json({ ...updated, id: fromInternalId(hotelId, updated.id), sectionId });
}

export async function saveSectionLayout(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const { sectionId } = req.params as { sectionId?: string };
  if (!sectionId) return res.status(400).json({ message: "sectionId requerido" });

  const internalSectionId = toInternalId(hotelId, sectionId);
  const section = await prisma.restaurantSection.findFirst({
    where: { hotelId, OR: [{ id: internalSectionId }, { id: sectionId }] },
  });
  if (!section) return res.status(404).json({ message: "Secci?n no encontrada" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const tables = Array.isArray(body.tables) ? body.tables : [];
  const objects = Array.isArray(body.objects) ? body.objects : [];

  const num = (v: any) => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };

  await prisma.$transaction(async (tx) => {
    for (const t of tables) {
      const id = String(t?.id || "").trim();
      if (!id) continue;
      const x = num(t?.x);
      const y = num(t?.y);
      if (x == null || y == null) continue;

      const internalTableId = toInternalId(hotelId, id);
      const table = await tx.restaurantTable.findFirst({
        where: { hotelId, sectionId: section.id, OR: [{ id: internalTableId }, { id }] },
        select: { id: true },
      });
      if (!table) continue;

      await tx.restaurantTable.updateMany({
        where: { id: table.id, hotelId },
        data: { x, y },
      });
    }

    for (const o of objects) {
      const id = String(o?.id || "").trim();
      if (!id) continue;
      const existing = await tx.restaurantSectionObject.findFirst({
        where: { id, hotelId, sectionId: section.id },
        select: { id: true },
      });
      if (!existing) continue;

      const data: any = {};
      const x = num(o?.x);
      const y = num(o?.y);
      const w = num(o?.w);
      const h = num(o?.h);
      const rotation = num(o?.rotation);
      const zIndex = num(o?.zIndex);
      if (x != null) data.x = x;
      if (y != null) data.y = y;
      if (w != null) data.w = w;
      if (h != null) data.h = h;
      if (rotation != null) data.rotation = rotation;
      if (zIndex != null) data.zIndex = Math.trunc(zIndex);
      if ("kind" in o) data.kind = String(o.kind || "OTHER");
      if ("label" in o) data.label = o.label ? String(o.label) : null;
      if ("color" in o) data.color = o.color ? String(o.color) : null;
      if ("meta" in o) data.meta = o.meta ?? null;

      if (Object.keys(data).length) {
        await tx.restaurantSectionObject.update({
          where: { id: existing.id },
          data,
        });
      }
    }
  });

  res.json({ ok: true });
}

export async function getSectionLayout(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const { sectionId } = req.params as { sectionId?: string };
  if (!sectionId) return res.status(400).json({ message: "sectionId requerido" });

  const internalSectionId = toInternalId(hotelId, sectionId);
  const section = await prisma.restaurantSection.findFirst({
    where: { hotelId, OR: [{ id: internalSectionId }, { id: sectionId }] },
    select: { id: true },
  });
  if (!section) return res.status(404).json({ message: "Sección no encontrada" });

  const tables = await prisma.restaurantTable.findMany({
    where: { hotelId, sectionId: section.id },
  });
  res.json({
    tables: tables.map((t) => ({
      ...t,
      id: fromInternalId(hotelId, t.id),
      sectionId: fromInternalId(hotelId, t.sectionId),
    })),
  });
}

export async function createSection(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { id, name, imageUrl, quickCashEnabled } = req.body || {};
  if (!id || !name) return res.status(400).json({ message: "id y name requeridos" });

  const externalId = String(id);
  const hotelId = user.hotelId;
  const internalId = toInternalId(hotelId, externalId);
  const section = await prisma.restaurantSection.upsert({
    where: { hotelId_id: { hotelId, id: internalId } },
    update: {
      name,
      imageUrl: imageUrl ? String(imageUrl) : null,
      quickCashEnabled: Boolean(quickCashEnabled),
    },
    create: {
      id: internalId,
      name,
      hotelId,
      imageUrl: imageUrl ? String(imageUrl) : null,
      quickCashEnabled: Boolean(quickCashEnabled),
    },
  });
  res.json({ ...section, id: externalId });
}

export async function updateSection(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const { sectionId } = req.params as { sectionId?: string };
  if (!sectionId) return res.status(400).json({ message: "sectionId requerido" });

  const internalId = toInternalId(hotelId, sectionId);
  const existing = await prisma.restaurantSection.findFirst({
    where: { hotelId, OR: [{ id: internalId }, { id: sectionId }] },
  });
  if (!existing) return res.status(404).json({ message: "Sección no encontrada" });

  const { name, imageUrl, quickCashEnabled } = req.body || {};
  const data: any = {};
  if (typeof name === "string") data.name = name.trim();
  if ("imageUrl" in (req.body || {})) data.imageUrl = imageUrl ? String(imageUrl) : null;
  if ("quickCashEnabled" in (req.body || {})) data.quickCashEnabled = Boolean(quickCashEnabled);

  const written = await prisma.restaurantSection.updateMany({
    where: { id: existing.id, hotelId },
    data,
  });
  if (written.count === 0) return res.status(404).json({ message: "Sección no encontrada" });
  const updated = await prisma.restaurantSection.findFirst({
    where: { id: existing.id, hotelId },
  });
  if (!updated) return res.status(404).json({ message: "Sección no encontrada" });
  res.json({ ...updated, id: fromInternalId(hotelId, updated.id) });
}
export async function deleteSection(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { sectionId } = req.params as { sectionId?: string };
  if (!sectionId) return res.status(400).json({ message: "sectionId requerido" });

  const internalId = toInternalId(user.hotelId, sectionId);
  const exists = await prisma.restaurantSection.findFirst({
    where: { hotelId: user.hotelId, OR: [{ id: internalId }, { id: sectionId }] },
  });
  if (!exists) return res.status(404).json({ message: "Secci?n no encontrada" });

  await prisma.restaurantSection.deleteMany({
    where: { hotelId: user.hotelId, OR: [{ id: internalId }, { id: sectionId }] },
  });
  res.json({ ok: true });
}

export async function addTableToSection(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const { sectionId } = req.params as { sectionId?: string };
  const { id, name, seats, x, y } = req.body || {};
  if (!sectionId || !id || !name) return res.status(400).json({ message: "sectionId, id y name requeridos" });

  const internalSectionId = toInternalId(hotelId, sectionId);
  const internalTableId = toInternalId(hotelId, String(id));
  const section = await prisma.restaurantSection.findFirst({
    where: { hotelId, OR: [{ id: internalSectionId }, { id: sectionId }] },
  });
  if (!section) return res.status(404).json({ message: "Secci?n no encontrada" });

  const patch = {
    name,
    seats: Number(seats || 0) || 2,
    x: typeof x === "number" ? x : typeof x === "string" ? Number(x) : undefined,
    y: typeof y === "number" ? y : typeof y === "string" ? Number(y) : undefined,
    sectionId: section.id,
  };

  const updated = await prisma.restaurantTable.updateMany({
    where: { id: internalTableId, hotelId },
    data: patch,
  });

  if (updated.count === 0) {
    await prisma.restaurantTable.create({
      data: {
        id: internalTableId,
        hotelId,
        ...patch,
      },
    });
  }

  const tables = await prisma.restaurantTable.findMany({
    where: { hotelId, sectionId: section.id, section: { hotelId } },
    orderBy: { name: "asc" },
  });
  res.json(tables.map((t) => ({ ...t, id: fromInternalId(hotelId, t.id), sectionId })));
}

export async function deleteTableFromSection(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { sectionId, tableId } = req.params as { sectionId?: string; tableId?: string };
  if (!sectionId || !tableId) return res.status(400).json({ message: "sectionId y tableId requeridos" });

  const internalSectionId = toInternalId(user.hotelId, sectionId);
  const internalTableId = toInternalId(user.hotelId, tableId);
  const section = await prisma.restaurantSection.findFirst({
    where: { hotelId: user.hotelId, OR: [{ id: internalSectionId }, { id: sectionId }] },
  });
  if (!section) return res.status(404).json({ message: "Secci?n no encontrada" });

  const table = await prisma.restaurantTable.findFirst({
    where: {
      hotelId: user.hotelId,
      sectionId: section.id,
      section: { hotelId: user.hotelId },
      OR: [{ id: internalTableId }, { id: tableId }],
    },
  });
  if (!table) return res.status(404).json({ message: "Mesa no encontrada" });

  await prisma.restaurantTable.deleteMany({ where: { id: table.id, hotelId: user.hotelId } });
  res.json({ ok: true });
}

export async function listMenu(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const sectionId = (req.query.section as string | undefined) || undefined;
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  const isActiveInWindow = (startTime?: string | null, endTime?: string | null) => {
    const parse = (t?: string | null) => {
      if (!t) return null;
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim());
      if (!m) return null;
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
      return hh * 60 + mm;
    };
    const start = parse(startTime);
    const end = parse(endTime);
    if (start == null && end == null) return true;
    if (start != null && end == null) return minutesNow >= start;
    if (start == null && end != null) return minutesNow < end;
    if (start == null || end == null) return true;
    if (start === end) return true;
    // ventana que cruza medianoche
    if (start < end) return minutesNow >= start && minutesNow < end;
    return minutesNow >= start || minutesNow < end;
  };

  if (sectionId) {
    const internalSectionId = toInternalId(user.hotelId, sectionId);
    const assignments = await prisma.restaurantMenuAssignment.findMany({
      where: {
        hotelId: user.hotelId,
        active: true,
        sectionId: { in: [internalSectionId, sectionId] },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    const activeAssignment = assignments.find((a) => {
      const dayOk = (Number(a.daysMask || 0) & (1 << day)) !== 0;
      if (!dayOk) return false;
      return isActiveInWindow(a.startTime, a.endTime);
    });

    if (activeAssignment) {
      const entries = await prisma.restaurantMenuEntry.findMany({
        where: { hotelId: user.hotelId, menuId: activeAssignment.menuId, active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          item: {
            include: {
              family: { select: { id: true, name: true } },
              subFamily: { select: { id: true, name: true } },
              subSubFamily: { select: { id: true, name: true } },
            },
          },
        },
      });
      const mapped = entries
        .filter((e) => e.item?.active !== false)
        .map((e) => ({
          id: e.itemId,
          itemId: e.itemId,
          name: e.item?.name,
          code: e.item?.code,
          color: (e.item as any)?.color || "",
          imageUrl: (e.item as any)?.imageUrl || "",
          sizes: Array.isArray((e.item as any)?.sizes) ? (e.item as any)?.sizes : [],
          details: Array.isArray((e.item as any)?.details) ? (e.item as any)?.details : [],
          priceIncludesTaxesAndService: (e.item as any)?.priceIncludesTaxesAndService !== false,
          category: e.category || deriveMenuCategoryFromItem(e.item),
          price: e.price ?? e.item?.price ?? 0,
          tax: e.item?.tax ?? 0,
          menuEntryId: e.id,
          menuId: e.menuId,
        }));
      return res.json(mapped);
    }

    // Fallback compat: items antiguos por sectionId
    const legacyItems = await prisma.restaurantMenuItem.findMany({
      where: { hotelId: user.hotelId, sectionId: { in: [internalSectionId, sectionId] }, active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return res.json(legacyItems);
  }

  // Sin section: lista todo (para management/debug)
  const items = await prisma.restaurantMenuItem.findMany({
    where: { hotelId: user.hotelId },
    orderBy: [{ sectionId: "asc" }, { menuId: "asc" }, { category: "asc" }, { name: "asc" }],
  });
  return res.json(items);
}

export async function addMenuItem(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { sectionId } = req.params as { sectionId?: string };
  const { id, name, price, category } = req.body || {};
  if (!sectionId || !name) return res.status(400).json({ message: "sectionId y name requeridos" });

  const internalSectionId = toInternalId(user.hotelId, sectionId);
  const section = await prisma.restaurantSection.findFirst({
    where: { hotelId: user.hotelId, OR: [{ id: internalSectionId }, { id: sectionId }] },
  });
  if (!section) return res.status(404).json({ message: "Secci?n no encontrada" });

  const item = await prisma.restaurantMenuItem.create({
    data: {
      id: id || undefined,
      hotelId: user.hotelId,
      sectionId: section.id,
      name,
      category: category || "",
      price: Number(price || 0),
    },
  });
  res.json(item);
}

// ====== Men?s (nuevo) ======

export async function listMenus(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const list = await prisma.restaurantMenu.findMany({
    where: { hotelId: user.hotelId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  res.json(list);
}

export async function createMenu(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const { name, active, sectionIds } = req.body || {};
  const nm = String(name || "").trim();
  if (!nm) return res.status(400).json({ message: "name requerido" });

  const created = await prisma.restaurantMenu.create({
    data: { hotelId, name: nm, active: active !== false },
  });

  // Optional: immediately make this menu visible in selected sections (always active schedule).
  const rawSectionIds = Array.isArray(sectionIds) ? sectionIds : [];
  const sectionIdList = rawSectionIds.map((x: any) => String(x || "").trim()).filter(Boolean);
  if (sectionIdList.length) {
    const sections = await Promise.all(
      sectionIdList.map(async (sid: string) => {
        const internalSectionId = toInternalId(hotelId, sid);
        return prisma.restaurantSection.findFirst({
          where: { hotelId, OR: [{ id: internalSectionId }, { id: sid }] },
          select: { id: true },
        });
      })
    );
    const sectionInternalIds = sections.filter(Boolean).map((s: any) => s.id);
    if (!sectionInternalIds.length) return res.json(created);
    await prisma.restaurantMenuAssignment.createMany({
      data: sectionInternalIds.map((internalId: string) => ({
        hotelId,
        sectionId: internalId,
        menuId: created.id,
        daysMask: 127,
        startTime: null,
        endTime: null,
        timezone: "America/Costa_Rica",
        priority: 0,
        active: true,
      })),
      skipDuplicates: true,
    });
  }

  res.json(created);
}

export async function updateMenu(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { menuId } = req.params as { menuId?: string };
  if (!menuId) return res.status(400).json({ message: "menuId requerido" });

  const existing = await prisma.restaurantMenu.findFirst({ where: { id: menuId, hotelId: user.hotelId } });
  if (!existing) return res.status(404).json({ message: "Men? no encontrado" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const data: any = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("active" in body) data.active = body.active !== false;

  const updated = await prisma.restaurantMenu.update({ where: { id: existing.id }, data });
  res.json(updated);
}

export async function deleteMenu(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { menuId } = req.params as { menuId?: string };
  if (!menuId) return res.status(400).json({ message: "menuId requerido" });

  const existing = await prisma.restaurantMenu.findFirst({ where: { id: menuId, hotelId: user.hotelId } });
  if (!existing) return res.status(404).json({ message: "Men? no encontrado" });

  await prisma.restaurantMenu.deleteMany({ where: { id: existing.id, hotelId: user.hotelId } });
  res.json({ ok: true });
}

export async function listMenuItems(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { menuId } = req.params as { menuId?: string };
  if (!menuId) return res.status(400).json({ message: "menuId requerido" });

  const menu = await prisma.restaurantMenu.findFirst({ where: { id: menuId, hotelId: user.hotelId } });
  if (!menu) return res.status(404).json({ message: "Men? no encontrado" });

  const items = await prisma.restaurantMenuItem.findMany({
    where: { hotelId: user.hotelId, menuId: menu.id },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  res.json(items);
}

export async function addMenuItemToMenu(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { menuId } = req.params as { menuId?: string };
  const { id, name, price, category, active } = req.body || {};
  if (!menuId || !name) return res.status(400).json({ message: "menuId y name requeridos" });

  const menu = await prisma.restaurantMenu.findFirst({ where: { id: menuId, hotelId: user.hotelId } });
  if (!menu) return res.status(404).json({ message: "Men? no encontrado" });

  const item = await prisma.restaurantMenuItem.create({
    data: {
      id: id || undefined,
      hotelId: user.hotelId,
      menuId: menu.id,
      name: String(name).trim(),
      category: String(category || "").trim(),
      price: Number(price || 0),
      active: active !== false,
    },
  });
  res.json(item);
}

export async function deleteMenuItemFromMenu(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { menuId, itemId } = req.params as { menuId?: string; itemId?: string };
  if (!menuId || !itemId) return res.status(400).json({ message: "menuId y itemId requeridos" });

  const item = await prisma.restaurantMenuItem.findFirst({
    where: { id: itemId, hotelId: user.hotelId, menuId },
  });
  if (!item) return res.status(404).json({ message: "?tem no encontrado" });

  await prisma.restaurantMenuItem.deleteMany({ where: { id: item.id, hotelId: user.hotelId } });
  res.json({ ok: true });
}

// ====== Men? (nuevo) -> Art?culos (entries) ======

export async function listMenuEntries(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const { menuId } = req.params as { menuId?: string };
  if (!menuId) return res.status(400).json({ message: "menuId requerido" });

  const menu = await prisma.restaurantMenu.findFirst({ where: { id: menuId, hotelId: user.hotelId } });
  if (!menu) return res.status(404).json({ message: "Men? no encontrado" });

  const entries = await prisma.restaurantMenuEntry.findMany({
    where: { hotelId: user.hotelId, menuId: menu.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      item: {
        include: {
          family: { select: { id: true, name: true } },
          subFamily: { select: { id: true, name: true } },
          subSubFamily: { select: { id: true, name: true } },
        },
      },
    },
  });

  const mapped = entries.map((e) => ({
    id: e.id,
    menuId: e.menuId,
    itemId: e.itemId,
    active: e.active,
    sortOrder: e.sortOrder,
    category: e.category || deriveMenuCategoryFromItem(e.item),
    price: e.price ?? e.item?.price ?? 0,
    item: e.item
      ? {
          id: e.item.id,
          code: e.item.code,
          name: e.item.name,
          price: e.item.price,
          tax: e.item.tax,
          active: e.item.active,
          color: (e.item as any).color || "",
          imageUrl: (e.item as any).imageUrl || "",
          priceIncludesTaxesAndService: (e.item as any).priceIncludesTaxesAndService !== false,
          familyId: e.item.familyId,
          subFamilyId: e.item.subFamilyId,
          subSubFamilyId: e.item.subSubFamilyId,
          familyName: e.item.family?.name,
          subFamilyName: e.item.subFamily?.name,
          subSubFamilyName: e.item.subSubFamily?.name,
        }
      : null,
  }));
  res.json(mapped);
}

export async function addMenuEntries(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const { menuId } = req.params as { menuId?: string };
  if (!menuId) return res.status(400).json({ message: "menuId requerido" });

  const menu = await prisma.restaurantMenu.findFirst({ where: { id: menuId, hotelId: user.hotelId } });
  if (!menu) return res.status(404).json({ message: "Men? no encontrado" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const itemIdsRaw = Array.isArray(body.itemIds) ? body.itemIds : body.itemId ? [body.itemId] : [];
  const itemIds = itemIdsRaw.map((x: any) => String(x || "").trim()).filter(Boolean);
  if (itemIds.length === 0) return res.status(400).json({ message: "itemId(s) requeridos" });

  // Validar items pertenecen al hotel
  const items = await prisma.restaurantItem.findMany({
    where: { hotelId: user.hotelId, id: { in: itemIds } },
    select: { id: true },
  });
  const okSet = new Set(items.map((i) => i.id));
  const invalid = itemIds.filter((id: string) => !okSet.has(id));
  if (invalid.length) return res.status(400).json({ message: `?tems inv?lidos: ${invalid.join(", ")}` });

  const baseOrder = Number.isFinite(Number(body.sortOrderBase)) ? Number(body.sortOrderBase) : 0;
  await prisma.restaurantMenuEntry.createMany({
    data: itemIds.map((id: string, idx: number) => ({
      hotelId: user.hotelId,
      menuId: menu.id,
      itemId: id,
      active: body.active !== false,
      sortOrder: baseOrder + idx * 10,
      category: body.category ? String(body.category).trim() : undefined,
      price: body.price != null && body.price !== "" ? Number(body.price) : undefined,
    })),
    skipDuplicates: true,
  });

  // devuelve lista actualizada
  const entries = await prisma.restaurantMenuEntry.findMany({
    where: { hotelId: user.hotelId, menuId: menu.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json(entries);
}

export async function deleteMenuEntry(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const { menuId, entryId } = req.params as { menuId?: string; entryId?: string };
  if (!menuId || !entryId) return res.status(400).json({ message: "menuId y entryId requeridos" });

  const menu = await prisma.restaurantMenu.findFirst({ where: { id: menuId, hotelId: user.hotelId } });
  if (!menu) return res.status(404).json({ message: "Men? no encontrado" });

  await prisma.restaurantMenuEntry.deleteMany({ where: { id: entryId, hotelId: user.hotelId, menuId: menu.id } });
  res.json({ ok: true });
}

export async function listSectionMenuAssignments(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const { sectionId } = req.params as { sectionId?: string };
  if (!sectionId) return res.status(400).json({ message: "sectionId requerido" });

  const internalSectionId = toInternalId(user.hotelId, sectionId);
  const section = await prisma.restaurantSection.findFirst({
    where: { hotelId: user.hotelId, OR: [{ id: internalSectionId }, { id: sectionId }] },
  });
  if (!section) return res.status(404).json({ message: "Secci?n no encontrada" });

  const list = await prisma.restaurantMenuAssignment.findMany({
    where: { hotelId: user.hotelId, sectionId: section.id },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: { menu: { select: { id: true, name: true, active: true } } },
  });
  res.json(list);
}

export async function createSectionMenuAssignment(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const { sectionId } = req.params as { sectionId?: string };
  const { menuId, daysMask, startTime, endTime, timezone, priority, active } = req.body || {};
  if (!sectionId || !menuId) return res.status(400).json({ message: "sectionId y menuId requeridos" });

  const internalSectionId = toInternalId(user.hotelId, sectionId);
  const section = await prisma.restaurantSection.findFirst({
    where: { hotelId: user.hotelId, OR: [{ id: internalSectionId }, { id: sectionId }] },
  });
  if (!section) return res.status(404).json({ message: "Secci?n no encontrada" });

  const menu = await prisma.restaurantMenu.findFirst({ where: { id: menuId, hotelId: user.hotelId } });
  if (!menu) return res.status(404).json({ message: "Men? no encontrado" });

  const created = await prisma.restaurantMenuAssignment.create({
    data: {
      hotelId: user.hotelId,
      sectionId: section.id,
      menuId: menu.id,
      daysMask: Number.isFinite(Number(daysMask)) ? Number(daysMask) : 127,
      startTime: startTime ? String(startTime).trim() : null,
      endTime: endTime ? String(endTime).trim() : null,
      timezone: timezone ? String(timezone).trim() : "America/Costa_Rica",
      priority: Number.isFinite(Number(priority)) ? Number(priority) : 0,
      active: active !== false,
    },
    include: { menu: { select: { id: true, name: true, active: true } } },
  });
  res.json(created);
}

export async function updateSectionMenuAssignment(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const { sectionId, assignmentId } = req.params as { sectionId?: string; assignmentId?: string };
  if (!sectionId || !assignmentId) return res.status(400).json({ message: "sectionId y assignmentId requeridos" });

  const internalSectionId = toInternalId(user.hotelId, sectionId);
  const section = await prisma.restaurantSection.findFirst({
    where: { hotelId: user.hotelId, OR: [{ id: internalSectionId }, { id: sectionId }] },
  });
  if (!section) return res.status(404).json({ message: "Secci?n no encontrada" });

  const existing = await prisma.restaurantMenuAssignment.findFirst({
    where: { id: assignmentId, hotelId: user.hotelId, sectionId: section.id },
  });
  if (!existing) return res.status(404).json({ message: "Asignaci?n no encontrada" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const data: any = {};
  if ("daysMask" in body && Number.isFinite(Number(body.daysMask))) data.daysMask = Number(body.daysMask);
  if ("startTime" in body) data.startTime = body.startTime ? String(body.startTime).trim() : null;
  if ("endTime" in body) data.endTime = body.endTime ? String(body.endTime).trim() : null;
  if ("timezone" in body && String(body.timezone).trim()) data.timezone = String(body.timezone).trim();
  if ("priority" in body && Number.isFinite(Number(body.priority))) data.priority = Number(body.priority);
  if ("active" in body) data.active = body.active !== false;
  if ("menuId" in body && String(body.menuId).trim()) {
    const menu = await prisma.restaurantMenu.findFirst({ where: { id: String(body.menuId), hotelId: user.hotelId } });
    if (!menu) return res.status(404).json({ message: "Men? no encontrado" });
    data.menuId = menu.id;
  }

  const updated = await prisma.restaurantMenuAssignment.update({
    where: { id: existing.id },
    data,
    include: { menu: { select: { id: true, name: true, active: true } } },
  });
  res.json(updated);
}

export async function deleteSectionMenuAssignment(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const { sectionId, assignmentId } = req.params as { sectionId?: string; assignmentId?: string };
  if (!sectionId || !assignmentId) return res.status(400).json({ message: "sectionId y assignmentId requeridos" });

  const internalSectionId = toInternalId(user.hotelId, sectionId);
  const section = await prisma.restaurantSection.findFirst({
    where: { hotelId: user.hotelId, OR: [{ id: internalSectionId }, { id: sectionId }] },
  });
  if (!section) return res.status(404).json({ message: "Secci?n no encontrada" });

  await prisma.restaurantMenuAssignment.deleteMany({
    where: { id: assignmentId, hotelId: user.hotelId, sectionId: section.id },
  });
  res.json({ ok: true });
}

export async function deleteMenuItem(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { sectionId, itemId } = req.params as { sectionId?: string; itemId?: string };
  if (!sectionId || !itemId) return res.status(400).json({ message: "sectionId y itemId requeridos" });

  const item = await prisma.restaurantMenuItem.findFirst({ where: { id: itemId, hotelId: user.hotelId } });
  if (!item) return res.status(404).json({ message: "?tem no encontrado" });

  await prisma.restaurantMenuItem.deleteMany({ where: { id: itemId, hotelId: user.hotelId } });
  res.json({ ok: true });
}

export async function listFamilies(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const families = await prisma.restaurantFamily.findMany({
    where: { hotelId: user.hotelId },
    orderBy: [{ name: "asc" }],
  });
  res.json(families);
}

export async function createFamily(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { name, active, cabys, code } = req.body || {};
  if (!name) return res.status(400).json({ message: "name requerido" });

  const cabysCode = cabys ? String(cabys).trim() : "";
  const providedCode = code ? String(code).trim() : "";
  const finalCode = providedCode || padNumber(await nextHotelSequence(user.hotelId, "restaurant_family_code"), 3);

  const created = await prisma.restaurantFamily.create({
    data: {
      hotelId: user.hotelId,
      code: finalCode,
      name: String(name).trim(),
      active: active !== false,
      cabys: cabysCode || null,
    },
  });
  res.json(created);
}

export async function updateFamily(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { id } = req.params as { id?: string };
  if (!id) return res.status(400).json({ message: "id requerido" });

  const family = await prisma.restaurantFamily.findFirst({ where: { id: String(id), hotelId: user.hotelId } });
  if (!family) return res.status(404).json({ message: "Familia no encontrada" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const data: any = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("active" in body) data.active = body.active !== false;
  if (typeof body.code === "string") {
    const c = body.code.trim();
    if (c) data.code = c;
  }

  if ("cabys" in body) {
    const cabysCode = body.cabys ? String(body.cabys).trim() : "";
    data.cabys = cabysCode || null;
  }

  const updated = await prisma.restaurantFamily.update({ where: { id: family.id }, data });

  if ("cabys" in data) {
    await prisma.restaurantItem.updateMany({
      where: { hotelId: user.hotelId, familyId: family.id },
      data: { cabys: data.cabys },
    });
  }

  res.json(updated);
}

export async function deleteFamily(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { id } = req.params as { id?: string };
  if (!id) return res.status(400).json({ message: "id requerido" });

  const family = await prisma.restaurantFamily.findFirst({ where: { id, hotelId: user.hotelId } });
  if (!family) return res.status(404).json({ message: "Familia no encontrada" });

  try {
  await prisma.restaurantFamily.deleteMany({ where: { id: family.id, hotelId: user.hotelId } });
    res.json({ ok: true });
  } catch {
    res.status(409).json({ message: "No se puede eliminar: hay art?culos asociados" });
  }
}

export async function listSubFamilies(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const familyId = (req.query.familyId as string | undefined) || undefined;

  const list = await prisma.restaurantSubFamily.findMany({
    where: { hotelId: user.hotelId, ...(familyId ? { familyId } : {}) },
    orderBy: [{ name: "asc" }],
  });
  res.json(list);
}

export async function createSubFamily(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { familyId, name, active, code } = req.body || {};
  if (!familyId || !name) return res.status(400).json({ message: "familyId y name requeridos" });

  const family = await prisma.restaurantFamily.findFirst({ where: { id: String(familyId), hotelId: user.hotelId } });
  if (!family) return res.status(404).json({ message: "Familia no encontrada" });

  const providedCode = code ? String(code).trim() : "";
  const finalCode = providedCode || padNumber(await nextHotelSequence(user.hotelId, `restaurant_subfamily_code:${family.id}`), 2);
  const created = await prisma.restaurantSubFamily.create({
    data: { hotelId: user.hotelId, familyId: family.id, code: finalCode, name: String(name).trim(), active: active !== false },
  });
  res.json(created);
}

export async function deleteSubFamily(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { id } = req.params as { id?: string };
  if (!id) return res.status(400).json({ message: "id requerido" });

  const sf = await prisma.restaurantSubFamily.findFirst({ where: { id, hotelId: user.hotelId } });
  if (!sf) return res.status(404).json({ message: "Subfamilia no encontrada" });

  try {
    await prisma.restaurantSubFamily.deleteMany({ where: { id: sf.id, hotelId: user.hotelId } });
    res.json({ ok: true });
  } catch {
    res.status(409).json({ message: "No se puede eliminar: hay art?culos asociados" });
  }
}

export async function listSubSubFamilies(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const subFamilyId = (req.query.subFamilyId as string | undefined) || undefined;

  const list = await prisma.restaurantSubSubFamily.findMany({
    where: { hotelId: user.hotelId, ...(subFamilyId ? { subFamilyId } : {}) },
    orderBy: [{ name: "asc" }],
  });
  res.json(list);
}

export async function createSubSubFamily(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { subFamilyId, name, active, code } = req.body || {};
  if (!subFamilyId || !name) return res.status(400).json({ message: "subFamilyId y name requeridos" });

  const sf = await prisma.restaurantSubFamily.findFirst({ where: { id: String(subFamilyId), hotelId: user.hotelId } });
  if (!sf) return res.status(404).json({ message: "Subfamilia no encontrada" });

  const providedCode = code ? String(code).trim() : "";
  const finalCode = providedCode || padNumber(await nextHotelSequence(user.hotelId, `restaurant_subsubfamily_code:${sf.id}`), 2);
  const created = await prisma.restaurantSubSubFamily.create({
    data: { hotelId: user.hotelId, subFamilyId: sf.id, code: finalCode, name: String(name).trim(), active: active !== false },
  });
  res.json(created);
}

export async function deleteSubSubFamily(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { id } = req.params as { id?: string };
  if (!id) return res.status(400).json({ message: "id requerido" });

  const ssf = await prisma.restaurantSubSubFamily.findFirst({ where: { id, hotelId: user.hotelId } });
  if (!ssf) return res.status(404).json({ message: "SubSubfamilia no encontrada" });

  try {
    await prisma.restaurantSubSubFamily.deleteMany({ where: { id: ssf.id, hotelId: user.hotelId } });
    res.json({ ok: true });
  } catch {
    res.status(409).json({ message: "No se puede eliminar: hay art?culos asociados" });
  }
}

export async function listItems(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const items = await prisma.restaurantItem.findMany({
    where: { hotelId: user.hotelId },
    include: { family: true, subFamily: true, subSubFamily: true, taxes: { include: { tax: true } } },
    orderBy: [{ name: "asc" }],
    take: 1000,
  });
  res.json(
    items.map((i) => ({
      id: i.id,
      hotelId: i.hotelId,
      code: i.code,
      name: i.name,
      cabys: i.cabys,
      color: (i as any).color || "",
      imageUrl: (i as any).imageUrl || "",
      sizes: Array.isArray((i as any).sizes) ? (i as any).sizes : [],
      details: Array.isArray((i as any).details) ? (i as any).details : [],
      priceIncludesTaxesAndService: (i as any).priceIncludesTaxesAndService !== false,
      price: i.price,
      tax: i.tax,
      taxIds: (i.taxes || []).map((t) => t.taxId),
      taxes: (i.taxes || []).map((t) => ({
        id: t.tax?.id,
        code: t.tax?.code,
        name: t.tax?.name,
        percent: t.tax?.percent,
        scope: t.tax?.scope,
      })),
      notes: i.notes,
      active: i.active,
      familyId: i.familyId,
      subFamilyId: i.subFamilyId,
      subSubFamilyId: i.subSubFamilyId,
      family: i.family?.name || "",
      subFamily: i.subFamily?.name || "",
      subSubFamily: i.subSubFamily?.name || "",
    }))
  );
}

export async function createItems(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const payload = req.body?.items ?? req.body;
  const list = Array.isArray(payload) ? payload : [payload];
  if (!list.length) return res.status(400).json({ message: "items requeridos" });

  const created: any[] = [];
  for (const raw of list) {
    const name = String(raw?.name || "").trim();
    const familyId = String(raw?.familyId || "").trim();
    const subFamilyId = raw?.subFamilyId ? String(raw.subFamilyId).trim() : null;
    const subSubFamilyId = raw?.subSubFamilyId ? String(raw.subSubFamilyId).trim() : null;
    const taxIds = Array.isArray(raw?.taxIds) ? raw.taxIds.map((x: any) => String(x)) : [];
    const priceIncludesTaxesAndService = raw?.priceIncludesTaxesAndService !== false;
    const sizes = normalizeItemSizes(raw?.sizes);
    const details = normalizeItemDetails(raw?.details);

    if (!name || !familyId) {
    return res.status(400).json({ message: "name y familyId requeridos" });
    }

    const family = await prisma.restaurantFamily.findFirst({ where: { id: familyId, hotelId: user.hotelId } });
    if (!family) return res.status(404).json({ message: `Familia no encontrada (${familyId})` });
    if (!family.cabys) return res.status(400).json({ message: "La familia seleccionada no tiene CABYS configurado" });

    let sf: any = null;
    if (subFamilyId) {
      sf = await prisma.restaurantSubFamily.findFirst({ where: { id: subFamilyId, hotelId: user.hotelId } });
      if (!sf) return res.status(404).json({ message: `Subfamilia no encontrada (${subFamilyId})` });
      if (sf.familyId !== family.id) return res.status(400).json({ message: "La subfamilia no pertenece a la familia seleccionada" });
    }

    let ssf: any = null;
    if (subSubFamilyId) {
      ssf = await prisma.restaurantSubSubFamily.findFirst({ where: { id: subSubFamilyId, hotelId: user.hotelId } });
      if (!ssf) return res.status(404).json({ message: `SubSubfamilia no encontrada (${subSubFamilyId})` });
      if (!sf || ssf.subFamilyId !== sf.id) return res.status(400).json({ message: "La subsubfamilia no pertenece a la subfamilia seleccionada" });
    }

    const number = await nextHotelSequence(user.hotelId, "restaurant_item");
    const familyCode = family.code || (await ensureFamilyCode(user.hotelId, family.id));
    const subFamilyCode = sf?.id ? sf.code || (await ensureSubFamilyCode(user.hotelId, sf.id)) : null;
    const subSubFamilyCode = ssf?.id ? ssf.code || (await ensureSubSubFamilyCode(user.hotelId, ssf.id)) : null;
    const prefix = buildItemPrefix(familyCode, subFamilyCode, subSubFamilyCode);
    const code = await nextRestaurantItemCode(user.hotelId, prefix);
    const taxPercent = await sumTaxPercentForHotel(user.hotelId, taxIds);

    const item = await prisma.restaurantItem.create({
      data: {
        hotelId: user.hotelId,
        number,
        code,
        name,
        cabys: family.cabys,
        color: raw?.color ? String(raw.color).trim() : null,
        imageUrl: raw?.imageUrl ? String(raw.imageUrl).trim() : null,
        priceIncludesTaxesAndService,
        sizes,
        details,
        price: Number(raw?.price || 0),
        tax: taxPercent,
        notes: raw?.notes ? String(raw.notes) : null,
        active: raw?.active !== false,
        familyId: family.id,
        subFamilyId: sf?.id || null,
        subSubFamilyId: ssf?.id || null,
        taxes: taxIds.length
          ? {
              create: taxIds.map((taxId: string) => ({ hotelId: user.hotelId, taxId })),
            }
          : undefined,
      },
      include: { family: true, subFamily: true, subSubFamily: true, taxes: { include: { tax: true } } },
    });

    created.push({
      id: item.id,
      hotelId: item.hotelId,
      code: item.code,
      name: item.name,
      cabys: item.cabys,
      color: (item as any).color || "",
      imageUrl: (item as any).imageUrl || "",
      sizes: Array.isArray((item as any).sizes) ? (item as any).sizes : sizes,
      details: Array.isArray((item as any).details) ? (item as any).details : details,
      priceIncludesTaxesAndService: (item as any).priceIncludesTaxesAndService !== false,
      price: item.price,
      tax: item.tax,
      taxIds: (item.taxes || []).map((t) => t.taxId),
      taxes: (item.taxes || []).map((t) => ({
        id: t.tax?.id,
        code: t.tax?.code,
        name: t.tax?.name,
        percent: t.tax?.percent,
        scope: t.tax?.scope,
      })),
      notes: item.notes,
      active: item.active,
      familyId: item.familyId,
      subFamilyId: item.subFamilyId,
      subSubFamilyId: item.subSubFamilyId,
      family: item.family?.name || "",
      subFamily: item.subFamily?.name || "",
      subSubFamily: item.subSubFamily?.name || "",
    });
  }

  res.json(created.length === 1 ? created[0] : created);
}

export async function updateItem(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  try {
    const { id } = req.params as { id?: string };
    if (!id) return res.status(400).json({ message: "id requerido" });

    const existing = await prisma.restaurantItem.findFirst({
      where: { id, hotelId: user.hotelId },
      include: { family: true, subFamily: true, subSubFamily: true, taxes: true },
    });
    if (!existing) return res.status(404).json({ message: "Art?culo no encontrado" });

    const body = req.body && typeof req.body === "object" ? (req.body as any) : {};

    const nextFamilyId =
      typeof body.familyId === "string" && body.familyId.trim() ? body.familyId.trim() : existing.familyId;
    const nextSubFamilyId =
      body.subFamilyId === null
        ? null
        : typeof body.subFamilyId === "string" && body.subFamilyId.trim()
          ? body.subFamilyId.trim()
          : existing.subFamilyId;
    const nextSubSubFamilyId =
      body.subSubFamilyId === null
        ? null
        : typeof body.subSubFamilyId === "string" && body.subSubFamilyId.trim()
          ? body.subSubFamilyId.trim()
          : existing.subSubFamilyId;

    const family = await prisma.restaurantFamily.findFirst({ where: { id: nextFamilyId, hotelId: user.hotelId } });
    if (!family) return res.status(404).json({ message: "Familia no encontrada" });
    if (!family.cabys) return res.status(400).json({ message: "La familia seleccionada no tiene CABYS configurado" });

    let sf: any = null;
    if (nextSubFamilyId) {
      sf = await prisma.restaurantSubFamily.findFirst({ where: { id: nextSubFamilyId, hotelId: user.hotelId } });
      if (!sf) return res.status(404).json({ message: "Subfamilia no encontrada" });
      if (sf.familyId !== family.id)
        return res.status(400).json({ message: "La subfamilia no pertenece a la familia seleccionada" });
    }

    let ssf: any = null;
    if (nextSubSubFamilyId) {
      ssf = await prisma.restaurantSubSubFamily.findFirst({ where: { id: nextSubSubFamilyId, hotelId: user.hotelId } });
      if (!ssf) return res.status(404).json({ message: "SubSubfamilia no encontrada" });
      if (!sf || ssf.subFamilyId !== sf.id)
        return res.status(400).json({ message: "La subsubfamilia no pertenece a la subfamilia seleccionada" });
    }

    const nextTaxIds = Array.isArray(body.taxIds) ? body.taxIds.map((x: any) => String(x)) : null;

    const oldPrefix = buildItemPrefix(
      existing.family?.code || (await ensureFamilyCode(user.hotelId, existing.familyId)),
      existing.subFamilyId
        ? existing.subFamily?.code || (await ensureSubFamilyCode(user.hotelId, existing.subFamilyId))
        : null,
      existing.subSubFamilyId
        ? existing.subSubFamily?.code || (await ensureSubSubFamilyCode(user.hotelId, existing.subSubFamilyId))
        : null
    );
    const newPrefix = buildItemPrefix(
      family.code || (await ensureFamilyCode(user.hotelId, family.id)),
      sf?.id ? sf.code || (await ensureSubFamilyCode(user.hotelId, sf.id)) : null,
      ssf?.id ? ssf.code || (await ensureSubSubFamilyCode(user.hotelId, ssf.id)) : null
    );

    let updated: any = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const data: any = {};
      if (typeof body.name === "string") data.name = body.name.trim();
      if ("price" in body) data.price = Number(body.price || 0);
      if ("notes" in body) data.notes = body.notes ? String(body.notes) : null;
      if ("active" in body) data.active = body.active !== false;
      if ("color" in body) data.color = body.color ? String(body.color).trim() : null;
      if ("imageUrl" in body) data.imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
      if ("priceIncludesTaxesAndService" in body) data.priceIncludesTaxesAndService = body.priceIncludesTaxesAndService !== false;
      if ("sizes" in body) data.sizes = normalizeItemSizes(body.sizes);
      if ("details" in body) data.details = normalizeItemDetails(body.details);

      data.familyId = family.id;
      data.subFamilyId = sf?.id || null;
      data.subSubFamilyId = ssf?.id || null;
      data.cabys = family.cabys;

      if (oldPrefix !== newPrefix) {
        data.code = await nextRestaurantItemCode(user.hotelId, newPrefix);
      }

      if (nextTaxIds) {
        data.tax = await sumTaxPercentForHotel(user.hotelId, nextTaxIds);
      }

      try {
          updated = await prisma.$transaction(async (tx) => {
            if (nextTaxIds) {
              await tx.restaurantItemTax.deleteMany({ where: { hotelId: user.hotelId, itemId: existing.id } });
              if (nextTaxIds.length) {
                await tx.restaurantItemTax.createMany({
                  data: nextTaxIds.map((taxId: string) => ({ hotelId: user.hotelId, itemId: existing.id, taxId })),
                  skipDuplicates: true,
                });
              }
            }
            const { count } = await tx.restaurantItem.updateMany({
              where: { id: existing.id, hotelId: user.hotelId },
              data,
            });
            if (!count) return null;
            return tx.restaurantItem.findFirst({
              where: { id: existing.id, hotelId: user.hotelId },
              include: { family: true, subFamily: true, subSubFamily: true, taxes: { include: { tax: true } } },
            });
          });
          if (!updated) return res.status(404).json({ message: "Art?culo no encontrado" });
          break;
        } catch (err: any) {
          if (err?.code === "P2002" && attempt < 5) continue;
          throw err;
        }
    }

    res.json({
      id: updated.id,
      hotelId: updated.hotelId,
      code: updated.code,
      name: updated.name,
      cabys: updated.cabys,
      color: (updated as any).color || "",
      imageUrl: (updated as any).imageUrl || "",
      sizes: Array.isArray((updated as any).sizes) ? (updated as any).sizes : [],
      details: Array.isArray((updated as any).details) ? (updated as any).details : [],
      priceIncludesTaxesAndService: (updated as any).priceIncludesTaxesAndService !== false,
      price: updated.price,
      tax: updated.tax,
      taxIds: (updated.taxes || []).map((t: any) => t.taxId),
      taxes: (updated.taxes || []).map((t: any) => ({
        id: t.tax?.id,
        code: t.tax?.code,
        name: t.tax?.name,
        percent: t.tax?.percent,
        scope: t.tax?.scope,
      })),
      notes: updated.notes,
      active: updated.active,
      familyId: updated.familyId,
      subFamilyId: updated.subFamilyId,
      subSubFamilyId: updated.subSubFamilyId,
      family: updated.family?.name || "",
      subFamily: updated.subFamily?.name || "",
      subSubFamily: updated.subSubFamily?.name || "",
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "Conflicto: c?digo duplicado. Reintenta guardar." });
    }
    return res.status(500).json({ message: err?.message || "Error interno al actualizar art?culo" });
  }
}

export async function deleteItem(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { id } = req.params as { id?: string };
  if (!id) return res.status(400).json({ message: "id requerido" });

  const it = await prisma.restaurantItem.findFirst({ where: { id, hotelId: user.hotelId } });
  if (!it) return res.status(404).json({ message: "Art?culo no encontrado" });

  await prisma.restaurantItem.deleteMany({ where: { id: it.id, hotelId: user.hotelId } });
  res.json({ ok: true });
}

export async function listOrders(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const status = (req.query.status as string | undefined) || "OPEN";
  const statusList = String(status || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const normalizedStatusList = statusList
    .map(normalizeOrderStatus)
    .filter((s): s is RestaurantOrderStatus => Boolean(s));
  const whereStatus =
    normalizedStatusList.length === 0
      ? undefined
      : normalizedStatusList.includes("OPEN")
        ? { in: Array.from(new Set([...OPEN_ORDER_STATUSES, ...normalizedStatusList])) }
        : { in: normalizedStatusList };
  const sectionId = (req.query.section as string | undefined) || undefined;
  const internalSectionId = sectionId ? toInternalId(hotelId, sectionId) : undefined;

  const orders = await prisma.restaurantOrder.findMany({
    where: {
      hotelId,
      ...(whereStatus ? { status: whereStatus as any } : {}),
      ...(internalSectionId ? { sectionId: internalSectionId } : {}),
    },
    include: { items: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  res.json(
    orders.map((o) => ({
      ...o,
      sectionId: o.sectionId ? fromInternalId(hotelId, o.sectionId) : null,
      tableId: fromInternalId(hotelId, o.tableId),
    }))
  );
}

export async function getOrderHistory(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;
  const orderId = String((req.params as any)?.orderId || "").trim();
  if (!orderId) return res.status(400).json({ message: "orderId requerido" });

  const dateFromRaw = String((req.query as any)?.dateFrom || "").trim();
  const dateToRaw = String((req.query as any)?.dateTo || "").trim();
  const dateFrom = dateFromRaw ? new Date(dateFromRaw) : null;
  const dateTo = dateToRaw ? new Date(dateToRaw) : null;
  if (dateTo) dateTo.setHours(23, 59, 59, 999);

  const order = await prisma.restaurantOrder.findFirst({
    where: { id: orderId, hotelId },
    include: { items: true, discount: true },
  });
  if (!order) return res.status(404).json({ message: "Orden no encontrada" });

  const eventWhere: Prisma.RestaurantOrderEventWhereInput = { hotelId, orderId };
  if (dateFrom || dateTo) {
    eventWhere.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  const [events, documents, closes] = await prisma.$transaction([
    prisma.restaurantOrderEvent.findMany({
      where: eventWhere,
      orderBy: { createdAt: "asc" },
    }),
    prisma.eInvoicingDocument.findMany({
      where: { hotelId, restaurantOrderId: orderId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.restaurantClose.findMany({
      where: { hotelId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  res.json({
    order: {
      ...order,
      sectionId: order.sectionId ? fromInternalId(hotelId, order.sectionId) : null,
      tableId: fromInternalId(hotelId, order.tableId),
    },
    events,
    documents,
    closes,
  });
}

export async function createOrUpdateOrder(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const { sectionId, tableId, items, note, covers, serviceType, roomId, orderId, restaurantOrderId, createNew, forceNew, status, waiterId, discountId, discountPercent } = req.body as {
    sectionId?: string;
    tableId: string;
    items: { id?: string; itemId?: string; variantKey?: string; detailNote?: string; name: string; category?: string; price: number; qty: number; discountId?: string; discountPercent?: number }[];
    note?: string;
    covers?: number;
    serviceType?: string;
    roomId?: string;
    orderId?: string;
    restaurantOrderId?: string;
    createNew?: boolean;
    forceNew?: boolean;
    status?: string;
    waiterId?: string;
    discountId?: string;
    discountPercent?: number;
  };
  if (!tableId || !Array.isArray(items)) return res.status(400).json({ message: "tableId e items requeridos" });

  const internalTableId = toInternalId(hotelId, String(tableId));
  const internalSectionId = sectionId ? toInternalId(hotelId, String(sectionId)) : undefined;

  const incomingOrderId = String(orderId || restaurantOrderId || "").trim();
  const shouldCreateNew = Boolean(createNew || forceNew);
  let existing = null as any;
  if (incomingOrderId) {
    existing = await prisma.restaurantOrder.findFirst({
      where: { id: incomingOrderId, hotelId, status: "OPEN" },
      include: { items: true },
    });
    if (!existing) return res.status(404).json({ message: "Orden no encontrada" });
  }
  if (!existing && !shouldCreateNew) {
    existing = await prisma.restaurantOrder.findFirst({
      where: { hotelId, status: "OPEN", tableId: { in: [internalTableId, String(tableId)] } },
      orderBy: { updatedAt: "desc" },
      include: { items: true },
    });
  }

  let resolvedWaiterId = "";
  if (waiterId) {
    const requestedWaiter = String(waiterId || "").trim();
    if (requestedWaiter) {
      const shouldValidate = !existing || existing.waiterId !== requestedWaiter;
      if (shouldValidate) {
        const staff = await prisma.restaurantStaff.findFirst({
          where: { id: requestedWaiter, hotelId, role: "WAITER", active: true },
          select: { id: true },
        });
        if (!staff) return res.status(403).json({ message: "Mesero no autorizado" });
      }
      resolvedWaiterId = requestedWaiter;
    }
  }

  const taxes = await getRestaurantTaxesForHotel(hotelId);
  const serviceRate = Number(taxes.servicio || 0) / 100;
  const taxRate = Number(taxes.iva || 0) / 100;

  const itemIds = items.map((i) => String(i.itemId || i.id));
  const itemRules = await prisma.restaurantItem.findMany({
    where: { hotelId, id: { in: itemIds } },
    select: { id: true, priceIncludesTaxesAndService: true },
  });
  const includesById = new Map(itemRules.map((r) => [r.id, r.priceIncludesTaxesAndService !== false]));

  const sums = items.reduce(
    (acc, i) => {
      const qty = Number(i.qty || 0);
      const price = Number(i.price || 0);
      const itemId = String(i.itemId || i.id);
      const gross = price * qty;
      const itemDiscountRate = clampPercent(i.discountPercent) / 100;
      const discountedGross = gross * (1 - itemDiscountRate);
      acc.discountItems += gross - discountedGross;
      const includes = includesById.get(itemId) ?? true;
      if (includes) {
        const denom = 1 + serviceRate + taxRate;
        const net = denom > 0 ? discountedGross / denom : discountedGross;
        acc.subtotal += net;
        acc.service += net * serviceRate;
        acc.tax += net * taxRate;
        acc.total += discountedGross;
      } else {
        const net = discountedGross;
        acc.subtotal += net;
        acc.service += net * serviceRate;
        acc.tax += net * taxRate;
        acc.total += net + net * serviceRate + net * taxRate;
      }
      return acc;
    },
    { subtotal: 0, service: 0, tax: 0, total: 0, discountItems: 0 }
  );

  const normalizedDiscountPercent = clampPercent(discountPercent);
  const orderDiscountRate = normalizedDiscountPercent / 100;
  const preTotal = sums.total;
  const orderDiscountAmount = preTotal * orderDiscountRate;
  const factor = preTotal > 0 ? (preTotal - orderDiscountAmount) / preTotal : 1;
  const total = preTotal * factor;
  const service = sums.service * factor;
  const subtotal = sums.subtotal * factor;
  const tax = sums.tax * factor;
  const discountAmount = orderDiscountAmount + sums.discountItems;
  const discountIdToSave = String(discountId || "").trim() || null;
  const inferredServiceType = String(serviceType || existing?.serviceType || "DINE_IN");

  const resolvedSectionId = internalSectionId
    ? (await prisma.restaurantSection.findFirst({
        where: { hotelId, OR: [{ id: internalSectionId }, { id: String(sectionId) }] },
        select: { id: true },
      }))?.id
      ? internalSectionId
      : undefined
    : undefined;

  const nextStatus: RestaurantOrderStatus = "OPEN";

  const order = existing
    ? await prisma.$transaction(async (tx) => {
        const waiterIdToSave = resolvedWaiterId || existing.waiterId || null;
        await tx.restaurantOrder.updateMany({
          where: { id: existing.id, hotelId },
          data: {
            sectionId: resolvedSectionId || existing.sectionId,
            tableId: internalTableId,
            waiterId: waiterIdToSave,
            note: note ?? existing.note,
            covers: covers ?? existing.covers,
            serviceType: inferredServiceType,
            roomId: roomId ?? existing.roomId,
            discountId: discountIdToSave,
            discountPercent: normalizedDiscountPercent,
            discountAmount,
            total,
            tip10: service,
            status: nextStatus,
          },
        });

        const toKey = (itemId: string, variantKey: string) => `${itemId}::${variantKey || ""}`;
        const existingItems = await tx.restaurantOrderItem.findMany({
          where: { hotelId, orderId: existing.id },
          select: { itemId: true, variantKey: true, area: true, status: true },
        });
        const existingMap = new Map(existingItems.map((i) => [toKey(i.itemId, i.variantKey || ""), i]));
        const incomingKeys = items.map((i) => ({
          itemId: String(i.itemId || i.id),
          variantKey: String(i.variantKey || ""),
        }));

        await tx.restaurantOrderItem.deleteMany({
          where: {
            hotelId,
            orderId: existing.id,
            NOT: { OR: incomingKeys },
          },
        });

        for (const i of items) {
          const itemId = String(i.itemId || i.id);
          const variantKey = String(i.variantKey || "");
          const prev = existingMap.get(`${itemId}::${variantKey}`);
          const cat = (i.category || "").toLowerCase();
          const isBar = cat.includes("bebida") || cat.includes("bar");
              const includes = includesById.get(String(itemId)) ?? true;
              const itemDiscountPercent = clampPercent(i.discountPercent);
              const itemDiscountId = String(i.discountId || "").trim() || null;
              await tx.restaurantOrderItem.upsert({
                where: { hotelId_orderId_itemId_variantKey: { hotelId, orderId: existing.id, itemId, variantKey } },
                update: {
                  name: i.name,
                  category: i.category || "",
                  price: i.price,
                  qty: i.qty,
                  detailNote: i.detailNote ? String(i.detailNote) : null,
                  priceIncludesTaxesAndService: includes,
                  discountId: itemDiscountId,
                  discountPercent: itemDiscountPercent,
                  area: prev?.area ?? (isBar ? "BAR" : "KITCHEN"),
                  status: prev?.status ?? "NEW",
                },
                create: {
                  hotelId,
                  orderId: existing.id,
                  itemId,
                  variantKey,
                  name: i.name,
                  category: i.category || "",
                  price: i.price,
                  qty: i.qty,
                  detailNote: i.detailNote ? String(i.detailNote) : null,
                  priceIncludesTaxesAndService: includes,
                  discountId: itemDiscountId,
                  discountPercent: itemDiscountPercent,
                  area: isBar ? "BAR" : "KITCHEN",
                  status: "NEW",
                },
              });
            }

        await recordOrderEvent(tx, {
          hotelId,
          orderId: existing.id,
          eventType: "ORDER_UPDATED",
          actorId: user.sub,
          payload: {
            tableId: fromInternalId(hotelId, internalTableId),
            sectionId: resolvedSectionId ? fromInternalId(hotelId, resolvedSectionId) : null,
            totals: { subtotal, service, tax, total, discountAmount },
            itemsCount: items.length,
            note: note ?? existing.note ?? "",
          } as any,
        });

        return tx.restaurantOrder.findFirst({ where: { id: existing.id, hotelId }, include: { items: true } });
      })
    : await prisma.$transaction(async (tx) => {
        const created = await tx.restaurantOrder.create({
          data: {
            hotelId,
            sectionId: resolvedSectionId || null,
            tableId: internalTableId,
            waiterId: resolvedWaiterId || null,
            status: nextStatus,
            note: note || "",
            covers: covers || 0,
            serviceType: inferredServiceType,
            roomId: roomId || null,
            discountId: discountIdToSave,
            discountPercent: normalizedDiscountPercent,
            discountAmount,
            total,
            tip10: service,
            items: {
              create: items.map((i) => {
                const itemId = String(i.itemId || i.id);
                const variantKey = String(i.variantKey || "");
                const cat = (i.category || "").toLowerCase();
                const isBar = cat.includes("bebida") || cat.includes("bar");
                const includes = includesById.get(String(itemId)) ?? true;
                const itemDiscountPercent = clampPercent(i.discountPercent);
                const itemDiscountId = String(i.discountId || "").trim() || null;
                return {
                  hotelId,
                  itemId,
                  variantKey,
                  name: i.name,
                  category: i.category || "",
                  price: i.price,
                  qty: i.qty,
                  detailNote: i.detailNote ? String(i.detailNote) : null,
                  priceIncludesTaxesAndService: includes,
                  discountId: itemDiscountId,
                  discountPercent: itemDiscountPercent,
                  area: isBar ? "BAR" : "KITCHEN",
                  status: "NEW",
                };
              }),
            },
          },
          include: { items: true },
        });

        await recordOrderEvent(tx, {
          hotelId,
          orderId: created.id,
          eventType: "ORDER_CREATED",
          actorId: user.sub,
          payload: {
            tableId: fromInternalId(hotelId, internalTableId),
            sectionId: resolvedSectionId ? fromInternalId(hotelId, resolvedSectionId) : null,
            totals: { subtotal, service, tax, total, discountAmount },
            itemsCount: items.length,
            note: note || "",
          } as any,
        });

        return created;
      });

  if (!order) return res.status(500).json({ message: "No se pudo crear/actualizar la orden" });
  res.json({
    ...order,
    sectionId: order.sectionId ? fromInternalId(hotelId, order.sectionId) : null,
    tableId: fromInternalId(hotelId, order.tableId),
  });
}

export async function closeOrder(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;
  const activeStatuses = OPEN_ORDER_STATUSES;

  const { tableId, payments, totals, note, serviceType, roomId, orderId, restaurantOrderId, cashierId } = req.body || {};
  const incomingOrderId = String(orderId || restaurantOrderId || "").trim();
  if (!tableId && !incomingOrderId) return res.status(400).json({ message: "tableId requerido" });

  const order = incomingOrderId
    ? await prisma.restaurantOrder.findFirst({
        where: { id: incomingOrderId, hotelId, status: { in: activeStatuses } },
        include: { items: true },
      })
    : await prisma.restaurantOrder.findFirst({
        where: {
          hotelId,
          status: { in: activeStatuses },
          tableId: { in: [toInternalId(hotelId, String(tableId)), String(tableId)] },
        },
        include: { items: true },
      });
  if (!order) return res.status(404).json({ message: "Orden no encontrada" });

  let resolvedCashierId = "";
  if (cashierId) {
    const requestedCashier = String(cashierId || "").trim();
    if (requestedCashier) {
      const staff = await prisma.restaurantStaff.findFirst({
        where: { id: requestedCashier, hotelId, role: "CASHIER", active: true },
        select: { id: true },
      });
      if (!staff) return res.status(403).json({ message: "Cajero no autorizado" });
      resolvedCashierId = requestedCashier;
    }
  }

  const totalToSave = asNumber(totals?.total ?? totals?.reported) || asNumber(order.total);
  const serviceToSave = asNumber(totals?.service) || asNumber(order.tip10);
  const paidAt = new Date();

  // Cargo a habitaci?n (FrontDesk): creamos un InvoiceItem en la factura del hospedaje.
  const roomAmount = asNumber(payments?.room);
  const roomTarget = String(roomId || order.roomId || payments?.roomId || payments?.roomNumber || "");
  if (roomAmount > 0 && roomTarget) {
    const room = await prisma.room.findFirst({
      where: { hotelId, number: roomTarget },
      select: { id: true },
    });
    if (!room) return res.status(400).json({ message: "Habitaci?n no encontrada para cargo" });

    const stay = await prisma.reservation.findFirst({
      where: {
        hotelId,
        roomId: room.id,
        status: "CHECKED_IN",
        checkIn: { lte: new Date() },
        checkOut: { gt: new Date() },
      },
      include: { invoice: { select: { id: true } } },
    });
    if (!stay) return res.status(400).json({ message: "No hay estancia activa para esa habitaci?n" });

    const inv =
      stay.invoice ??
      (await prisma.invoice.create({
        data: {
          reservationId: stay.id,
          guestId: stay.guestId,
          number: `INV-${new Date().toISOString().slice(0, 10)}-${stay.id.slice(0, 6)}`,
          status: "DRAFT",
          hotelId,
        },
        select: { id: true },
      }));

    const concept = `Restaurante - Orden ${order.id} - Mesa ${fromInternalId(hotelId, order.tableId)}`;
    const exists = await prisma.invoiceItem.findFirst({
      where: { invoiceId: inv.id, description: concept },
      select: { id: true },
    });
    if (!exists) {
      await prisma.invoiceItem.create({
        data: { invoiceId: inv.id, description: concept, unitPrice: roomAmount, total: roomAmount, quantity: 1, hotelId },
      });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
      const cashierIdToSave = resolvedCashierId || order.cashierId || null;
      const written = await tx.restaurantOrder.updateMany({
        where: { id: order.id, hotelId },
        data: {
          status: "PAID",
          paymentBreakdown: payments || {},
          total: totalToSave,
          tip10: serviceToSave,
          note: note ?? order.note,
          serviceType: String(serviceType || order.serviceType || "DINE_IN"),
          roomId: roomTarget || order.roomId,
          cashierId: cashierIdToSave,
          updatedAt: paidAt,
        },
      });
    if (written.count === 0) return null;

    const updatedOrder = await tx.restaurantOrder.findFirst({
      where: { id: order.id, hotelId },
      include: { items: true },
    });
    if (!updatedOrder) return null;

    await recordOrderEvent(tx, {
      hotelId,
      orderId: updatedOrder.id,
      eventType: "ORDER_PAID",
      actorId: user.sub,
      payload: {
        tableId: fromInternalId(hotelId, updatedOrder.tableId),
        sectionId: updatedOrder.sectionId ? fromInternalId(hotelId, updatedOrder.sectionId) : null,
        totals: totals || { total: totalToSave, service: serviceToSave },
        payments: payments || {},
        note: note ?? updatedOrder.note ?? "",
        serviceType: String(serviceType || updatedOrder.serviceType || "DINE_IN"),
        roomId: roomTarget || updatedOrder.roomId || null,
        cashierId: cashierIdToSave,
      } as any,
    });

    // Consume inventory based on recipes (per sold item qty) when inventory is enabled.
    const cfg = await getOrCreateRestaurantConfig(hotelId);
    const inventoryEnabled =
      cfg?.general && typeof cfg.general === "object" ? (cfg.general as any).inventoryEnabled !== false : true;
    if (inventoryEnabled) {
      // Recipe lines are stored in inventory unit; if a recipe line cannot be applied, we fail the close.
      const itemIds = Array.from(new Set((updatedOrder.items || []).map((i) => String(i.itemId))));
      if (itemIds.length) {
        const recipes = await tx.restaurantRecipeLine.findMany({
          where: { hotelId, restaurantItemId: { in: itemIds } },
          include: { inventoryItem: { select: { id: true, unit: true, sku: true, desc: true, stock: true } } },
        });
        const byItem = new Map<string, typeof recipes>();
        for (const r of recipes) {
          const k = r.restaurantItemId;
          const arr = byItem.get(k) || [];
          arr.push(r);
          byItem.set(k, arr);
        }

        for (const oi of updatedOrder.items) {
          const soldQty = Number(oi.qty || 0);
          if (!soldQty) continue;
          const lines = byItem.get(String(oi.itemId)) || [];
          for (const line of lines) {
            const inv = line.inventoryItem;
            const consumption = Number(line.qty) * soldQty;
            if (!Number.isFinite(consumption) || consumption <= 0) continue;

            // Ensure stock is enough (avoid negative/inconsistencies).
            const updatedInv = await tx.restaurantInventoryItem.updateMany({
              where: { id: inv.id, hotelId, stock: { gte: consumption } },
              data: { stock: { decrement: consumption } },
            });
            if (updatedInv.count === 0) {
              throw new Error(
                `Stock insuficiente para ${inv.sku || inv.desc || inv.id}: requiere ${consumption} ${inv.unit}`
              );
            }
            await tx.restaurantInventoryMovement.create({
              data: {
                hotelId,
                itemId: inv.id,
                qtyDelta: -consumption,
                reason: `Recipe consumption for order ${updatedOrder.id}`,
                refType: "RESTAURANT_ORDER",
                refId: updatedOrder.id,
                createdBy: user.sub,
              },
            });
          }
        }
      }
    }

    return updatedOrder;
  });
  if (!updated) return res.status(404).json({ message: "Orden no encontrada" });

  try {
    const cfg = await getOrCreateRestaurantConfig(hotelId);
    const billing = cfg.billing && typeof cfg.billing === "object" ? (cfg.billing as any) : {};
    const autoFactura = billing?.autoFactura !== false;
    const desiredDocType = resolveBillingDocType(billing?.ticketComprobante ?? billing?.comprobante) || "TE";
    const docTypeToIssue: "TE" = "TE";
    if (autoFactura && desiredDocType) {
      await issueRestaurantDocForOrder({
        hotelId,
        order: updated,
        docType: docTypeToIssue,
        receiver: (req.body as any)?.receiver,
        allowLocal: true,
      });
    }
  } catch (err) {
    console.warn("[restaurant.closeOrder] auto-doc failed:", err);
  }
  res.json({
    ok: true,
    order: {
      ...updated,
      sectionId: updated.sectionId ? fromInternalId(hotelId, updated.sectionId) : null,
      tableId: fromInternalId(hotelId, updated.tableId),
    },
  });
}

// === Inventory ===

export async function listInventory(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const list = await prisma.restaurantInventoryItem.findMany({
    where: { hotelId: user.hotelId },
    orderBy: [{ number: "asc" }],
    take: 2000,
  });
  return res.json(
    list.map((i) => ({
      id: i.id,
      number: i.number,
      sku: i.sku,
      desc: i.desc,
      unidad: i.unit,
      unit: i.unit,
      stock: Number(i.stock || 0),
      minimo: Number(i.min || 0),
      min: Number(i.min || 0),
      costo: Number(i.cost || 0),
      cost: Number(i.cost || 0),
      taxRate: i.taxRate ? Number(i.taxRate) : null,
      proveedor: i.supplierName || null,
      supplierName: i.supplierName || null,
      active: i.active !== false,
    }))
  );
}

export async function createInventoryItem(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const skuIn = String(req.body?.sku || "").trim();
  const desc = String(req.body?.desc || "").trim();
  const unit = normalizeUnit(req.body?.unidad || req.body?.unit);
  const stock = Number(req.body?.stock || 0);
  const min = Number(req.body?.minimo || req.body?.min || 0);
  const cost = Number(req.body?.costo || req.body?.cost || 0);
  const taxRateRaw = req.body?.taxRate ?? req.body?.iva;
  const taxRate = Number.isFinite(Number(taxRateRaw)) ? Number(taxRateRaw) : null;
  const supplierName = String(req.body?.supplierName || req.body?.proveedor || "").trim() || null;
  const active = req.body?.active !== false;

  if (!desc) return res.status(400).json({ message: "desc requerido" });
  if (!unit) return res.status(400).json({ message: "unidad requerida" });
  if (!isSupportedUnit(unit)) return res.status(400).json({ message: "unidad inv?lida" });

  const number = await nextHotelSequence(user.hotelId, "restaurant_inventory");
  const sku = skuIn || `SKU-${padNumber(number, 6)}`;

  const created = await prisma.restaurantInventoryItem.create({
    data: {
      hotelId: user.hotelId,
      number,
      sku,
      desc,
      unit,
      stock,
      min,
      cost,
      taxRate,
      supplierName,
      active,
    },
  });

  if (stock) {
    await prisma.restaurantInventoryMovement.create({
      data: {
        hotelId: user.hotelId,
        itemId: created.id,
        qtyDelta: stock,
        reason: "Initial stock",
        refType: "INVENTORY_CREATE",
        refId: created.id,
        createdBy: user.sub,
      },
    });
  }

  return res.status(201).json({
    id: created.id,
    number: created.number,
    sku: created.sku,
    desc: created.desc,
    unidad: created.unit,
    stock: Number(created.stock || 0),
    minimo: Number(created.min || 0),
    costo: Number(created.cost || 0),
    taxRate: created.taxRate ? Number(created.taxRate) : null,
    proveedor: created.supplierName || null,
    active: created.active !== false,
  });
}

export async function deleteInventoryItem(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const { id } = req.params as any;
  if (!id) return res.status(400).json({ message: "id requerido" });

  await prisma.restaurantInventoryItem.deleteMany({ where: { id: String(id), hotelId: user.hotelId } });
  return res.json({ ok: true });
}

export async function listInventoryInvoices(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const list = await prisma.restaurantInventoryInvoice.findMany({
    where: { hotelId: user.hotelId },
    include: {
      lines: {
        include: {
          inventoryItem: { select: { id: true, sku: true, desc: true, unit: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });

  res.json(
    list.map((inv) => ({
      id: inv.id,
      supplierName: inv.supplierName,
      proveedor: inv.supplierName,
      docNumber: inv.docNumber,
      docType: inv.docType,
      source: inv.source,
      issueDate: inv.issueDate,
      total: inv.total ? Number(inv.total) : 0,
      taxTotal: inv.taxTotal ? Number(inv.taxTotal) : 0,
      createdAt: inv.createdAt,
      lines: (inv.lines || []).map((l) => ({
        id: l.id,
        name: l.name,
        qty: Number(l.qty || 0),
        unit: l.unit,
        cost: Number(l.cost || 0),
        taxRate: l.taxRate ? Number(l.taxRate) : null,
        taxAmount: l.taxAmount ? Number(l.taxAmount) : null,
        lineTotal: l.lineTotal ? Number(l.lineTotal) : null,
        inventoryItemId: l.inventoryItemId,
        sku: l.inventoryItem?.sku || null,
        desc: l.inventoryItem?.desc || null,
      })),
    }))
  );
}

export async function createInventoryInvoice(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const supplierName = String(body.supplierName || body.proveedor || "").trim();
  const docNumber = String(body.docNumber || body.numero || "").trim() || undefined;
  const docType = String(body.docType || body.tipo || "MANUAL").trim() || undefined;
  const issueDate = body.issueDate || body.fecha || null;
  const lines = Array.isArray(body.lines) ? body.lines : [];

  if (!supplierName) return res.status(400).json({ message: "Proveedor requerido" });
  if (!Array.isArray(lines) || lines.length === 0) return res.status(400).json({ message: "Lineas requeridas" });

  try {
    const invoice = await applyInventoryInvoice({
      hotelId: user.hotelId,
      supplierName,
      docNumber,
      docType,
      source: "MANUAL",
      issueDate,
      lines,
      createdBy: user.sub || null,
    });
    return res.status(201).json({ id: invoice.id });
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "No se pudo guardar la factura" });
  }
}

export async function importInventoryInvoiceXml(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const xml = String((req.body as any)?.xml || "").trim();
  if (!xml) return res.status(400).json({ message: "xml requerido" });

  let parsed: ReturnType<typeof parseCrEInvoiceXml>;
  try {
    parsed = parseCrEInvoiceXml(xml);
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "XML invalido" });
  }

  if (!parsed.root) return res.status(400).json({ message: "XML invalido: no root" });

  if (parsed.key) {
    const existing = await prisma.restaurantInventoryInvoice.findFirst({
      where: { hotelId: user.hotelId, externalKey: parsed.key },
      select: { id: true },
    });
    if (existing) return res.json({ id: existing.id, reused: true });
  }

  const supplierName = String(parsed.emitter?.name || parsed.emitter?.id || "Proveedor XML").trim();
  const lines = buildInventoryLinesFromXml(parsed.lines);
  if (lines.length === 0) return res.status(400).json({ message: "XML sin lineas" });

  try {
    const invoice = await applyInventoryInvoice({
      hotelId: user.hotelId,
      supplierName,
      docNumber: parsed.consecutive || parsed.key,
      docType: parsed.docType,
      source: "XML",
      issueDate: parsed.issueDate || null,
      externalKey: parsed.key,
      lines,
      createdBy: user.sub || null,
    });
    return res.status(201).json({ id: invoice.id, reused: false });
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "No se pudo importar la factura" });
  }
}

// === Recipes ===

export async function listRecipes(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const list = await prisma.restaurantRecipeLine.findMany({
    where: { hotelId: user.hotelId },
    include: {
      restaurantItem: { select: { id: true, code: true, name: true } },
      inventoryItem: { select: { id: true, sku: true, desc: true, unit: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  return res.json(
    list.map((r) => ({
      id: r.id,
      restaurantItemId: r.restaurantItemId,
      restaurantItemCode: r.restaurantItem?.code || null,
      restaurantItemName: r.restaurantItem?.name || null,
      inventoryItemId: r.inventoryItemId,
      inventorySku: r.inventoryItem?.sku || null,
      inventoryDesc: r.inventoryItem?.desc || null,
      qty: Number(r.qty || 0),
      unit: r.inventoryItem?.unit || "",
      note: r.note || "",
      codigo: r.restaurantItem?.code || r.restaurantItemId,
      ingrediente: r.inventoryItem?.sku || r.inventoryItemId,
      cantidad: Number(r.qty || 0),
      unidad: r.inventoryItem?.unit || "",
    }))
  );
}

export async function createRecipeLine(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const codigo = String(req.body?.codigo || "").trim();
  const ingrediente = String(req.body?.ingrediente || "").trim();
  const cantidad = Number(req.body?.cantidad || 0);
  const unidad = normalizeUnit(req.body?.unidad || "");

  if (!codigo || !ingrediente) return res.status(400).json({ message: "c?digo e ingrediente requeridos" });
  if (!Number.isFinite(cantidad) || cantidad <= 0) return res.status(400).json({ message: "cantidad inv?lida" });
  if (unidad && !isSupportedUnit(unidad)) return res.status(400).json({ message: "unidad inv?lida" });

  const restaurantItem = await prisma.restaurantItem.findFirst({
    where: {
      hotelId: user.hotelId,
      OR: [{ id: codigo }, { code: codigo }],
    },
    select: { id: true, code: true, name: true },
  });
  if (!restaurantItem) return res.status(404).json({ message: "Art?culo de venta no encontrado (c?digo)" });

  const maybeNumber = Number.parseInt(ingrediente, 10);
  const inventoryItem = await prisma.restaurantInventoryItem.findFirst({
    where: {
      hotelId: user.hotelId,
      OR: [
        { id: ingrediente },
        { sku: ingrediente },
        ...(Number.isFinite(maybeNumber) ? [{ number: maybeNumber }] : []),
      ],
    },
    select: { id: true, sku: true, desc: true, unit: true },
  });
  if (!inventoryItem) return res.status(404).json({ message: "Ingrediente/inventario no encontrado" });

  // Convert incoming qty/unit to inventory unit (store normalized).
  const fromUnit = unidad || inventoryItem.unit;
  const toUnit = inventoryItem.unit;
  if (!canConvert(fromUnit, toUnit)) {
    return res.status(400).json({
      message: `Unidades incompatibles: receta ${fromUnit} vs inventario ${toUnit}`,
    });
  }
  const qtyInInvUnit = convertQty(cantidad, fromUnit, toUnit);

  const created = await prisma.restaurantRecipeLine.create({
    data: {
      hotelId: user.hotelId,
      restaurantItemId: restaurantItem.id,
      inventoryItemId: inventoryItem.id,
      qty: qtyInInvUnit,
    },
  });

  return res.status(201).json({
    id: created.id,
    restaurantItemId: restaurantItem.id,
    restaurantItemCode: restaurantItem.code,
    restaurantItemName: restaurantItem.name,
    inventoryItemId: inventoryItem.id,
    inventorySku: inventoryItem.sku,
    inventoryDesc: inventoryItem.desc,
    qty: Number(qtyInInvUnit),
    unit: inventoryItem.unit,
    codigo: restaurantItem.code,
    ingrediente: inventoryItem.sku,
    cantidad: Number(qtyInInvUnit),
    unidad: inventoryItem.unit,
  });
}

export async function deleteRecipeLine(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const { id } = req.params as any;
  if (!id) return res.status(400).json({ message: "id requerido" });

  await prisma.restaurantRecipeLine.deleteMany({ where: { id: String(id), hotelId: user.hotelId } });
  return res.json({ ok: true });
}

export async function cancelRestaurantOrder(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const { orderId, restaurantOrderId, tableId, reason, adminCode } = req.body || {};
  const incomingOrderId = String(orderId || restaurantOrderId || "").trim();
  if (!incomingOrderId && !tableId) return res.status(400).json({ message: "orderId o tableId requerido" });

  const allowed = await requireAdminOrAdminCode(user, hotelId, adminCode);
  if (!allowed) return res.status(401).json({ message: "Admin PIN requerido" });

  const where: any = { hotelId, status: { in: OPEN_ORDER_STATUSES } };
  if (incomingOrderId) where.id = String(incomingOrderId);
  if (tableId) where.tableId = { in: [toInternalId(hotelId, String(tableId)), String(tableId)] };

  const order = await prisma.restaurantOrder.findFirst({
    where,
    orderBy: { updatedAt: "desc" },
    select: { id: true, note: true, updatedAt: true },
  });
  if (!order) return res.status(404).json({ message: "Orden abierta no encontrada" });

  const lastClose = await prisma.restaurantClose.findFirst({
    where: { hotelId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (lastClose?.createdAt && order.updatedAt <= lastClose.createdAt) {
    return res.status(403).json({ message: "No se puede anular una orden despu?s del cierre Z" });
  }

  const cancelReason = String(reason || "").trim();
  const nextNote = cancelReason ? `${order.note || ""}\n[CANCELED] ${cancelReason}`.trim() : order.note || "";

  await prisma.$transaction(async (tx) => {
    await tx.restaurantOrder.updateMany({
      where: { id: order.id, hotelId, status: { in: OPEN_ORDER_STATUSES } },
      data: { status: "CLOSED", note: nextNote },
    });
    await recordOrderEvent(tx, {
      hotelId,
      orderId: order.id,
      eventType: "ORDER_VOID",
      actorId: user.sub,
      payload: { reason: cancelReason, note: nextNote } as any,
    });
  });

  return res.json({ ok: true, id: order.id });
}

export async function moveOrderTable(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { fromTableId, toTableId, orderId, restaurantOrderId } = req.body || {};
  if (!fromTableId || !toTableId) return res.status(400).json({ message: "fromTableId y toTableId requeridos" });

  const hotelId = user.hotelId;
  const fromInternal = toInternalId(hotelId, String(fromTableId));
  const toInternal = toInternalId(hotelId, String(toTableId));

  if (fromInternal === toInternal) return res.json({ ok: true, moved: false });

  const role = String(user.role || "").toUpperCase();
  if (!["ADMIN", "MANAGER"].includes(role)) {
    return res.status(403).json({ message: "Solo ADMIN/MANAGER pueden cambiar mesa" });
  }

  const incomingOrderId = String(orderId || restaurantOrderId || "").trim();
  const order = incomingOrderId
    ? await prisma.restaurantOrder.findFirst({
        where: { hotelId, status: { in: OPEN_ORDER_STATUSES }, id: incomingOrderId },
        include: { items: true },
      })
    : await prisma.restaurantOrder.findFirst({
        where: {
          hotelId,
          status: { in: OPEN_ORDER_STATUSES },
          tableId: { in: [fromInternal, String(fromTableId)] },
        },
        include: { items: true },
      });
  if (!order) return res.status(404).json({ message: "Orden abierta no encontrada para esa mesa" });

  const target = await prisma.restaurantTable.findFirst({
    where: { hotelId, id: { in: [toInternal, String(toTableId)] } },
    select: { id: true, sectionId: true },
  });
  if (!target) return res.status(404).json({ message: "Mesa destino no encontrada" });

  // Multiple open orders per table are allowed, so we don't block moves.

  await prisma.restaurantOrder.updateMany({
    where: { id: order.id, hotelId },
    data: { tableId: target.id, sectionId: target.sectionId },
  });

  const updated = await prisma.restaurantOrder.findFirst({
    where: { id: order.id, hotelId },
    include: { items: true },
  });
  if (!updated) return res.status(404).json({ message: "Orden no encontrada" });

  res.json({
    ok: true,
    moved: true,
    order: {
      ...updated,
      sectionId: updated.sectionId ? fromInternalId(hotelId, updated.sectionId) : null,
      tableId: fromInternalId(hotelId, updated.tableId),
    },
  });
}

export async function reprintOrder(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const { orderId, restaurantOrderId, tableId } = req.body || {};
  const incomingOrderId = String(orderId || restaurantOrderId || "").trim();
  if (!incomingOrderId && !tableId) return res.status(400).json({ message: "orderId o tableId requerido" });

  const where: any = { hotelId };
  if (incomingOrderId) where.id = String(incomingOrderId);
  if (tableId) where.tableId = { in: [toInternalId(hotelId, String(tableId)), String(tableId)] };

  const order = await prisma.restaurantOrder.findFirst({
    where,
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  if (!order) return res.status(404).json({ message: "Orden no encontrada" });

  const cfg = await prisma.restaurantConfig.findUnique({ where: { hotelId } });
  const items = (order.items || []).map((i) => ({
    id: i.itemId,
    itemId: i.itemId,
    name: i.name,
    category: i.category || "",
    qty: i.qty,
    price: i.price,
    area: i.area,
  }));

  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.restaurantPrintJob.create({
      data: {
        hotelId,
        sectionId: order.sectionId,
        tableId: order.tableId,
        items,
        note: order.note || "",
        covers: order.covers || 0,
        kitchenPrinter: cfg?.kitchenPrinter || null,
        barPrinter: cfg?.barPrinter || null,
        userId: user.sub,
      },
    });
    await recordOrderEvent(tx, {
      hotelId,
      orderId: order.id,
      eventType: "ORDER_REPRINT",
      actorId: user.sub,
      payload: {
        tableId: fromInternalId(hotelId, order.tableId),
        sectionId: order.sectionId ? fromInternalId(hotelId, order.sectionId) : null,
        printJobId: created.id,
      } as any,
    });
    return created;
  });

  const responseJob = {
    ...job,
    sectionId: job.sectionId ? fromInternalId(user.hotelId, job.sectionId) : null,
    tableId: fromInternalId(user.hotelId, job.tableId),
  };

  res.json({ ok: true, job: responseJob });
}

export async function voidRestaurantInvoice(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const { restaurantOrderId, tableId, docType, reason, adminCode } = req.body || {};
  if (!restaurantOrderId && !tableId) return res.status(400).json({ message: "restaurantOrderId o tableId requerido" });

  const allowed = await requireAdminOrAdminCode(user, hotelId, adminCode);
  if (!allowed) return res.status(401).json({ message: "Admin PIN requerido" });

  let orderId = restaurantOrderId ? String(restaurantOrderId) : "";
  if (!orderId && tableId) {
    const order = await prisma.restaurantOrder.findFirst({
      where: { hotelId, status: "PAID", tableId: { in: [toInternalId(hotelId, String(tableId)), String(tableId)] } },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!order) return res.status(404).json({ message: "No hay orden pagada para esa mesa" });
    orderId = order.id;
  }

  const type = docType ? String(docType).toUpperCase() : "";
  if (type && !["FE", "TE"].includes(type)) return res.status(400).json({ message: "docType inv?lido" });

  const doc = await prisma.eInvoicingDocument.findFirst({
    where: {
      hotelId,
      restaurantOrderId: orderId,
      ...(type ? { docType: type as any } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  if (!doc) return res.status(404).json({ message: "No hay documento electr?nico para anular" });

  const order = await prisma.restaurantOrder.findFirst({
    where: { id: orderId, hotelId },
    select: { updatedAt: true },
  });

  const lastClose = await prisma.restaurantClose.findFirst({
    where: { hotelId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const orderPaidAt = order?.updatedAt || doc.createdAt;
  if (lastClose?.createdAt && orderPaidAt <= lastClose.createdAt) {
    return res.status(403).json({ message: "No se puede anular un documento despu?s del cierre Z" });
  }


  if (doc.status !== "CANCELED") {
    await prisma.eInvoicingDocument.updateMany({
      where: { id: doc.id, hotelId },
      data: {
        status: "CANCELED",
        response: {
          ...(doc.response && typeof doc.response === "object" ? (doc.response as any) : {}),
          canceledAt: new Date().toISOString(),
          canceledBy: user.sub,
          reason: String(reason || ""),
        } as any,
      },
    });

    await prisma.eInvoicingAcknowledgement.create({
      data: {
        hotelId,
        documentId: doc.id,
        type: "OTHER",
        status: "RECEIVED",
        message: String(reason || "Anulado desde el POS de Restaurante"),
        payload: { canceledAt: new Date().toISOString(), canceledBy: user.sub } as any,
      },
    });
  }

  const updated = await prisma.eInvoicingDocument.findFirst({
    where: { id: doc.id, hotelId },
  });

  res.json({ ok: true, document: updated || doc });
}

export async function getRestaurantConfig(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const cfg = await prisma.restaurantConfig.findUnique({ where: { hotelId: user.hotelId } });
  res.json(
    cfg || {
      kitchenPrinter: "",
      barPrinter: "",
      cashierPrinter: "",
      printing: {
        paperType: "80mm",
        defaultDocType: "TE",
        types: {
          comanda: { enabled: true, printerId: "", copies: 1 },
          ticket: { enabled: true, printerId: "", copies: 1 },
          electronicInvoice: { enabled: true, printerId: "", copies: 1 },
          closes: { enabled: true, printerId: "", copies: 1 },
          document: { enabled: true, printerId: "", copies: 1 },
        },
      },
    }
  );
}

export async function updateRestaurantConfig(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const payload: any = {};
  if ("kitchenPrinter" in body) payload.kitchenPrinter = body.kitchenPrinter ? String(body.kitchenPrinter).trim() : "";
  if ("barPrinter" in body) payload.barPrinter = body.barPrinter ? String(body.barPrinter).trim() : "";
  if ("cashierPrinter" in body) payload.cashierPrinter = body.cashierPrinter ? String(body.cashierPrinter).trim() : "";
  if ("printing" in body) payload.printing = body.printing ?? null;

  const cfg = await prisma.restaurantConfig.upsert({
    where: { hotelId: user.hotelId },
    update: payload,
    create: {
      hotelId: user.hotelId,
      kitchenPrinter: payload.kitchenPrinter ?? "",
      barPrinter: payload.barPrinter ?? "",
      cashierPrinter: payload.cashierPrinter ?? "",
      printing: payload.printing ?? null,
    },
  });
  res.json(cfg);
}

export async function getRestaurantTaxes(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const cfg = await getOrCreateRestaurantConfig(user.hotelId);
  res.json(cfg.taxes || { iva: 13, servicio: 10, descuentoMax: 15, permitirDescuentos: true, impuestoIncluido: true });
}

export async function updateRestaurantTaxes(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const next = {
    iva: asNumber((body as any).iva ?? 13),
    servicio: asNumber((body as any).servicio ?? 10),
    descuentoMax: asNumber((body as any).descuentoMax ?? 15),
    permitirDescuentos: Boolean((body as any).permitirDescuentos ?? true),
    impuestoIncluido: Boolean((body as any).impuestoIncluido ?? true),
  };

  const cfg = await prisma.restaurantConfig.upsert({
    where: { hotelId: user.hotelId },
    update: { taxes: next as any },
    create: { hotelId: user.hotelId, kitchenPrinter: "", barPrinter: "", taxes: next as any },
  });
  res.json(cfg.taxes);
}

export async function getRestaurantPayments(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const cfg = await getOrCreateRestaurantConfig(user.hotelId);
  const stored = (cfg.payments && typeof cfg.payments === "object" ? cfg.payments : {}) as any;
  const cobros = Array.isArray(stored.cobros)
    ? stored.cobros
    : typeof stored.cobros === "string"
      ? String(stored.cobros)
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : ["Efectivo", "Tarjeta"];
  const resolved = {
    monedaBase: String(stored.monedaBase || "CRC"),
    monedaSec: String(stored.monedaSec || "USD"),
    tipoCambio: asNumber(stored.tipoCambio || 530),
    cobros,
    cargoHabitacion: typeof stored.cargoHabitacion === "boolean" ? stored.cargoHabitacion : true,
  };
  res.json(resolved);
}

export async function updateRestaurantPayments(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const monedaBaseRaw = String((body as any).monedaBase || "").trim();
  const next = {
    monedaBase: monedaBaseRaw || "CRC",
    monedaSec: String((body as any).monedaSec || "USD"),
    tipoCambio: asNumber((body as any).tipoCambio || 530),
    cobros: Array.isArray((body as any).cobros)
      ? (body as any).cobros
      : typeof (body as any).cobros === "string"
        ? String((body as any).cobros).split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    cargoHabitacion: Boolean((body as any).cargoHabitacion ?? true),
  };

  const cfg = await prisma.restaurantConfig.upsert({
    where: { hotelId: user.hotelId },
    update: { payments: next as any },
    create: { hotelId: user.hotelId, kitchenPrinter: "", barPrinter: "", payments: next as any },
  });
  res.json(cfg.payments);
}

export async function getRestaurantGeneral(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const cfg = await getOrCreateRestaurantConfig(user.hotelId);
  res.json(cfg.general || {});
}

export async function updateRestaurantGeneral(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const cfg = await prisma.restaurantConfig.upsert({
    where: { hotelId: user.hotelId },
    update: { general: body as any },
    create: { hotelId: user.hotelId, kitchenPrinter: "", barPrinter: "", general: body as any },
  });
  res.json(cfg.general || {});
}

export async function getRestaurantBilling(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const cfg = await getOrCreateRestaurantConfig(user.hotelId);
  res.json(cfg.billing || {});
}

export async function updateRestaurantBilling(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const cfg = await prisma.restaurantConfig.upsert({
    where: { hotelId: user.hotelId },
    update: { billing: body as any },
    create: { hotelId: user.hotelId, kitchenPrinter: "", barPrinter: "", billing: body as any },
  });
  res.json(cfg.billing || {});
}

export async function listRestaurantPrinters(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const cfg = await prisma.restaurantConfig.findUnique({ where: { hotelId: user.hotelId } });
  const list = [
    cfg?.kitchenPrinter ? { id: cfg.kitchenPrinter, name: "Cocina" } : null,
    cfg?.barPrinter ? { id: cfg.barPrinter, name: "Bar" } : null,
    cfg?.cashierPrinter ? { id: cfg.cashierPrinter, name: "Caja" } : null,
  ].filter(Boolean);
  res.json(list);
}

export async function printRestaurantOrder(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const { sectionId, tableId, items, note, covers, printers, fromTableId, type } = req.body || {};

  if (!tableId || !Array.isArray(items)) {
    return res.status(400).json({ message: "tableId e items requeridos" });
  }

  if (fromTableId && fromTableId !== tableId) {
    const role = (user.role || "").toUpperCase();
    if (!["ADMIN", "MANAGER"].includes(role)) {
      return res.status(403).json({ message: "No puedes reasignar productos a otra mesa" });
    }
  }

  const cfg = await prisma.restaurantConfig.findUnique({ where: { hotelId: user.hotelId } });
  const normalizePrinterId = (value: unknown) => String(value ?? "").trim();
  const requestedKitchen = normalizePrinterId(printers?.kitchenPrinter);
  const requestedBar = normalizePrinterId(printers?.barPrinter);
  const requestedCashier = normalizePrinterId(printers?.cashierPrinter);
  const cfgKitchen = normalizePrinterId(cfg?.kitchenPrinter);
  const cfgBar = normalizePrinterId(cfg?.barPrinter);
  const cfgCashier = normalizePrinterId(cfg?.cashierPrinter);
  const printerOverrides =
    (requestedKitchen && requestedKitchen !== cfgKitchen) ||
    (requestedBar && requestedBar !== cfgBar) ||
    (requestedCashier && requestedCashier !== cfgCashier);
  if (printerOverrides) {
    const role = (user.role || "").toUpperCase();
    if (!["ADMIN", "MANAGER"].includes(role)) {
      return res.status(403).json({ message: "Solo perfiles autorizados pueden cambiar impresoras" });
    }
  }
  const printing: any = cfg?.printing && typeof cfg.printing === "object" ? (cfg.printing as any) : {};
  const paperType =
    (printers && printers.paperType) ||
    printing?.paperType ||
    null;

  const rawType = type ? String(type).trim().toUpperCase() : "KITCHEN_BAR";
  const normalizedType = rawType === "COMANDA" ? "KITCHEN_BAR" : rawType;
  const isComandaType = rawType === "COMANDA" || normalizedType === "KITCHEN_BAR";
  const printingTypeKey =
    isComandaType
      ? "comanda"
      : normalizedType === "TICKET"
        ? "ticket"
        : normalizedType === "ELECTRONIC_INVOICE"
          ? "electronicInvoice"
          : normalizedType === "CLOSES"
            ? "closes"
            : normalizedType === "DOCUMENT"
              ? "document"
              : null;

  const typeCfg = printingTypeKey ? printing?.types?.[printingTypeKey] : null;
  if (printingTypeKey && typeCfg && typeCfg.enabled === false) {
    return res.status(403).json({ message: "Tipo de impresion deshabilitado por configuracion" });
  }

  const defaultPrinterForType = () => {
    const pId = printingTypeKey ? printing?.types?.[printingTypeKey]?.printerId : null;
    return pId || cfg?.cashierPrinter || null;
  };

  const internalTableId = toInternalId(user.hotelId, String(tableId));
  let internalSectionId = sectionId ? toInternalId(user.hotelId, String(sectionId)) : null;
  if (!internalSectionId) {
    const table = await prisma.restaurantTable.findFirst({
      where: { hotelId: user.hotelId, id: { in: [internalTableId, String(tableId)] } },
      select: { sectionId: true },
    });
    internalSectionId = table?.sectionId || null;
  }

  const job = await prisma.restaurantPrintJob.create({
    data: {
      hotelId: user.hotelId,
      sectionId: internalSectionId,
      tableId: internalTableId,
      type: normalizedType,
      items,
      note: note || "",
      covers: covers || 0,
      kitchenPrinter: normalizedType === "KITCHEN_BAR" ? requestedKitchen || cfg?.kitchenPrinter || null : null,
      barPrinter: normalizedType === "KITCHEN_BAR" ? requestedBar || cfg?.barPrinter || null : null,
      cashierPrinter:
        normalizedType !== "KITCHEN_BAR"
          ? requestedCashier || defaultPrinterForType()
          : requestedCashier || cfg?.cashierPrinter || null,
      paperType: paperType ? String(paperType) : null,
      userId: user.sub,
    },
  });

  const responseJob = {
    ...job,
    sectionId: job.sectionId ? fromInternalId(user.hotelId, job.sectionId) : null,
    tableId: fromInternalId(user.hotelId, job.tableId),
  };

  res.json({ ok: true, job: responseJob });
}

export async function getRestaurantStats(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const lastClose = await prisma.restaurantClose.findFirst({
    where: { hotelId: user.hotelId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const openOrders = await prisma.restaurantOrder.findMany({
    where: { hotelId: user.hotelId, status: "OPEN" },
    select: { total: true },
  });
  const openOrderValue = openOrders.reduce((acc, o) => acc + asNumber(o.total), 0);

  const paidWhere: any = { hotelId: user.hotelId, status: "PAID" };
  if (lastClose?.createdAt) paidWhere.updatedAt = { gte: lastClose.createdAt };

  const paidOrders = await prisma.restaurantOrder.findMany({
    where: paidWhere,
    select: { total: true, paymentBreakdown: true },
  });

  const systemTotal = paidOrders.reduce((acc, o) => acc + asNumber(o.total), 0);
  const byMethod: Record<string, number> = {};
  for (const o of paidOrders) {
    const pb = (o.paymentBreakdown && typeof o.paymentBreakdown === "object" ? o.paymentBreakdown : {}) as any;
    for (const k of Object.keys(pb || {})) {
      byMethod[k] = (byMethod[k] || 0) + asNumber(pb[k]);
    }
  }

  res.json({
    systemTotal,
    openOrders: openOrders.length,
    salesCount: paidOrders.length,
    openOrderValue,
    lastCloseAt: lastClose?.createdAt || null,
    byMethod,
  });
}

export async function listKds(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });
  const hotelId = user.hotelId;

  const area = String((req.query.area as string | undefined) || "KITCHEN").toUpperCase();
  if (!["KITCHEN", "BAR"].includes(area)) return res.status(400).json({ message: "area inv?lida" });

  const items = await prisma.restaurantOrderItem.findMany({
    where: {
      area: area as any,
      status: { not: "SERVED" },
      order: { hotelId, status: "OPEN" },
    },
    include: { order: true },
    orderBy: [{ order: { updatedAt: "asc" } } as any],
    take: 500,
  });

  res.json(
    items.map((it) => ({
      id: it.id,
      status: it.status,
      area: it.area,
      itemId: it.itemId,
      name: it.name,
      category: it.category,
      price: it.price,
      qty: it.qty,
      order: {
        id: it.orderId,
        tableId: fromInternalId(hotelId, it.order.tableId),
        sectionId: it.order.sectionId ? fromInternalId(hotelId, it.order.sectionId) : null,
        note: it.order.note,
        covers: it.order.covers,
        updatedAt: it.order.updatedAt,
      },
    }))
  );
}

export async function updateKdsItem(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const { orderItemId } = req.params as { orderItemId?: string };
  if (!orderItemId) return res.status(400).json({ message: "orderItemId requerido" });

  const nextStatus = String(req.body?.status || "").toUpperCase();
  if (!["NEW", "IN_KITCHEN", "READY", "SERVED"].includes(nextStatus)) {
    return res.status(400).json({ message: "status inv?lido" });
  }

  const item = await prisma.restaurantOrderItem.findFirst({
    where: { id: orderItemId, hotelId: user.hotelId, order: { hotelId: user.hotelId } },
    select: { id: true },
  });
  if (!item) return res.status(404).json({ message: "?tem no encontrado" });

  const written = await prisma.restaurantOrderItem.updateMany({
    where: { id: orderItemId, hotelId: user.hotelId },
    data: { status: nextStatus as any },
  });
  if (written.count === 0) return res.status(404).json({ message: "?tem no encontrado" });
  const updated = await prisma.restaurantOrderItem.findFirst({ where: { id: orderItemId, hotelId: user.hotelId } });

  res.json({ ok: true, item: updated });
}

export async function listCloses(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const rawLimit = req.query.limit as string | undefined;
  const limit = rawLimit ? Math.max(0, Math.min(1000, asNumber(rawLimit))) : 0;

  const closes = await prisma.restaurantClose.findMany({
    where: { hotelId: user.hotelId },
    orderBy: { createdAt: "desc" },
    ...(limit > 0 ? { take: limit } : {}),
  });
  res.json(closes);
}

const buildShiftPayload = (shift: any) => ({
  id: shift.id,
  openedAt: shift.openedAt,
  closedAt: shift.closedAt ?? null,
  openingAmount: asNumber((shift?.totals as any)?.openingAmount ?? (shift?.details as any)?.openingAmount),
  note: shift?.note || "",
});

export async function getRestaurantShift(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const shift = await prisma.cashAudit.findFirst({
    where: { hotelId: user.hotelId, module: "RESTAURANT", closedAt: null },
    orderBy: { openedAt: "desc" },
  });

  if (!shift) return res.json({ open: false });
  res.json({ open: true, shift: buildShiftPayload(shift) });
}

export async function openRestaurantShift(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const existing = await prisma.cashAudit.findFirst({
    where: { hotelId: user.hotelId, module: "RESTAURANT", closedAt: null },
    orderBy: { openedAt: "desc" },
  });
  if (existing) return res.json({ open: true, shift: buildShiftPayload(existing) });

  const openingAmount = asNumber(req.body?.openingAmount ?? req.body?.amount ?? req.body?.monto);
  if (!Number.isFinite(openingAmount) || openingAmount <= 0) {
    return res.status(400).json({ message: "Debes ingresar un monto de apertura mayor a 0" });
  }

  const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";

  const created = await prisma.cashAudit.create({
    data: {
      hotelId: user.hotelId,
      module: "RESTAURANT",
      openedAt: new Date(),
      closedAt: null,
      totals: { openingAmount } as any,
      details: undefined,
      note: note || null,
      createdById: user.sub,
    },
  });

  res.status(201).json({ open: true, shift: buildShiftPayload(created) });
}

export async function closeShift(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  try {
    const closeTypeRaw = String(req.body?.type || "Z").trim().toUpperCase();
    if (!["X", "Z"].includes(closeTypeRaw)) {
      return res.status(400).json({ message: "Tipo de cierre invalido" });
    }

    const role = (user.role || "").toUpperCase();
    if (!["ADMIN", "MANAGER"].includes(role)) {
      const required = closeTypeRaw === "Z" ? "restaurant.shift.closeZ" : "restaurant.shift.closeX";
      const legacy = "restaurant.shift.close";
      const granted = await prisma.rolePermission.findFirst({
        where: { hotelId: user.hotelId, roleId: user.role, permissionId: { in: [required, legacy] } },
        select: { permissionId: true },
      });
      if (!granted) {
        return res
          .status(403)
          .json({ message: closeTypeRaw === "Z" ? "No tienes permiso para cierre Z" : "No tienes permiso para cierre X" });
      }
    }

    const openShift = await prisma.cashAudit.findFirst({
      where: { hotelId: user.hotelId, module: "RESTAURANT", closedAt: null },
      orderBy: { openedAt: "desc" },
    });
    if (!openShift) {
      return res.status(400).json({ message: "No hay turno abierto" });
    }

    const { totals, payments, note, breakdown } = req.body || {};

    const openOrders = await prisma.restaurantOrder.count({
      where: { hotelId: user.hotelId, status: { in: OPEN_ORDER_STATUSES } },
    });
    if (openOrders > 0) {
      return res.status(400).json({ message: "No se puede cerrar turno con ?rdenes abiertas" });
    }

    const totalsObj = totals && typeof totals === "object" ? (totals as any) : null;
    const paymentsObj = payments && typeof payments === "object" ? (payments as Record<string, unknown>) : null;
    const hasTotalsDeclared =
      totalsObj &&
      (Object.prototype.hasOwnProperty.call(totalsObj, "reported") ||
        Object.prototype.hasOwnProperty.call(totalsObj, "system"));
    const hasPaymentsDeclared = paymentsObj && Object.keys(paymentsObj).length > 0;
    if (!hasTotalsDeclared && !hasPaymentsDeclared) {
      return res.status(400).json({ message: "Debes declarar un monto (>= 0)" });
    }

    const lastClose = await prisma.restaurantClose.findFirst({
      where: { hotelId: user.hotelId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const paidWhere: any = { hotelId: user.hotelId, status: "PAID" };
    if (lastClose?.createdAt) paidWhere.updatedAt = { gte: lastClose.createdAt };
    const paidOrders = await prisma.restaurantOrder.findMany({
      where: paidWhere,
      select: { total: true },
    });
    const system = paidOrders.reduce((acc, o) => acc + asNumber(o.total), 0);

    const reportedFromTotals =
      totalsObj && Object.prototype.hasOwnProperty.call(totalsObj, "reported")
        ? asNumber(totalsObj.reported)
        : undefined;
    const systemFromTotals =
      totalsObj && Object.prototype.hasOwnProperty.call(totalsObj, "system")
        ? asNumber(totalsObj.system)
        : undefined;
    const reportedFromPayments = paymentsObj
      ? Object.values(paymentsObj).reduce<number>((acc, v) => acc + asNumber(v), 0)
      : 0;

    const reported =
      reportedFromTotals !== undefined
        ? reportedFromTotals
        : systemFromTotals !== undefined
          ? systemFromTotals
          : reportedFromPayments;

    if (reported < 0) {
      return res.status(400).json({ message: "El monto declarado no puede ser negativo" });
    }

    const safeTotals = { system, reported, diff: reported - system };

    const closedAt = new Date();
    const openingAmount = asNumber((openShift?.totals as any)?.openingAmount ?? (openShift?.details as any)?.openingAmount);
    const close = await prisma.$transaction(async (tx) => {
      const createdClose = await tx.restaurantClose.create({
        data: {
          hotel: { connect: { id: user.hotelId } },
          turno: `T-${Date.now()}`,
          stage: closeTypeRaw,
          totals: safeTotals as any,
          payments: (payments || {}) as any,
          breakdown: breakdown || {},
          note: note || "",
          userId: user.sub,
        },
      });

      if (closeTypeRaw === "Z") {
        await tx.cashAudit.updateMany({
          where: { id: openShift.id, hotelId: user.hotelId },
          data: {
            closedAt,
            totals: { openingAmount, ...safeTotals } as any,
            details: { payments: payments || {}, breakdown: breakdown || {}, closeId: createdClose.id } as any,
            note: (note || openShift.note || "").trim() || null,
          },
        });
      } else {
        await tx.cashAudit.updateMany({
          where: { id: openShift.id, hotelId: user.hotelId },
          data: {
            details: {
              ...((openShift?.details as any) || {}),
              lastCloseX: {
                totals: safeTotals,
                payments: payments || {},
                breakdown: breakdown || {},
                closeId: createdClose.id,
                createdAt: closedAt,
              },
            } as any,
          },
        });
      }

      await recordOrderEvent(tx, {
        hotelId: user.hotelId || "",
        orderId: null,
        eventType: closeTypeRaw === "Z" ? "SHIFT_CLOSE_Z" : "SHIFT_CLOSE_X",
        actorId: user.sub,
        payload: {
          shiftId: openShift.id,
          closeId: createdClose.id,
          stage: closeTypeRaw,
          totals: safeTotals,
          payments: payments || {},
          breakdown: breakdown || {},
          openingAmount,
          openedAt: openShift.openedAt ?? null,
          closedAt,
        } as any,
      });

      return createdClose;
    });

    res.json({ ok: true, close });
  } catch (err) {
    console.error("[restaurant.closeShift] failed:", err);
    const detail =
      process.env.NODE_ENV === "production"
        ? undefined
        : err instanceof Error
          ? err.message
          : String(err);
    res.status(500).json({ message: "No se pudo cerrar turno", detail });
  }
}

const STAFF_ROLES = new Set<RestaurantStaffRole>(["CASHIER", "WAITER"]);
const normalizeStaffRole = (value: unknown): RestaurantStaffRole | undefined => {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "CAJERO") return "CASHIER";
  if (raw === "MESERO") return "WAITER";
  if (STAFF_ROLES.has(raw as RestaurantStaffRole)) return raw as RestaurantStaffRole;
  return undefined;
};

const normalizeStaffUsername = (value: unknown) => String(value ?? "").trim().toLowerCase();

const recordOrderEvent = async (
  tx: { restaurantOrderEvent: { create: (args: Prisma.RestaurantOrderEventCreateArgs) => Promise<unknown> } },
  opts: { hotelId: string; orderId?: string | null; eventType: string; actorId?: string | null; payload?: Prisma.InputJsonValue | null }
) => {
  await tx.restaurantOrderEvent.create({
    data: {
      hotelId: opts.hotelId,
      orderId: opts.orderId || null,
      eventType: opts.eventType,
      actorId: opts.actorId || null,
      payload: opts.payload ?? undefined,
    },
  });
};

const sanitizeStaff = (staff: any) => ({
  id: staff.id,
  name: staff.name,
  username: staff.username,
  role: staff.role,
  accessRoleId: staff.accessRoleId || null,
  accessRoleName: staff.accessRole?.name || null,
  active: staff.active,
  createdAt: staff.createdAt,
  updatedAt: staff.updatedAt,
});

export async function listRestaurantStaff(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId || !user?.sub) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;
  const role = normalizeStaffRole((req.query.role as string | undefined) || "");

  const list = await prisma.restaurantStaff.findMany({
    where: {
      hotelId,
      ...(role ? { role } : {}),
    },
    include: { accessRole: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: "desc" }],
  });
  res.json(list.map(sanitizeStaff));
}

export async function listRestaurantStaffRoles(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const roles = await prisma.appRole.findMany({
    where: { hotelId: user.hotelId },
    orderBy: { id: "asc" },
  });
  res.json(roles.map((r) => ({ id: r.id, name: r.name })));
}

export async function createRestaurantStaff(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId || !user?.sub) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const name = String(body.name || "").trim();
  const username = normalizeStaffUsername(body.username || body.user || body.code);
  const password = String(body.password || "").trim();
  const role = normalizeStaffRole(body.role);
  const accessRoleId = String(body.accessRoleId || body.roleId || "").trim();
  const active = body.active !== false;

  if (!name) return res.status(400).json({ message: "Nombre requerido" });
  if (!username) return res.status(400).json({ message: "Usuario requerido" });
  if (!password || password.length < 4) return res.status(400).json({ message: "Password minimo 4" });
  if (!role) return res.status(400).json({ message: "Rol invalido" });

  const existing = await prisma.restaurantStaff.findFirst({ where: { hotelId, username } });
  if (existing) return res.status(409).json({ message: "Usuario ya existe" });

  if (accessRoleId) {
    const roleExists = await prisma.appRole.findFirst({ where: { hotelId, id: accessRoleId } });
    if (!roleExists) return res.status(400).json({ message: "Perfil de permisos inválido" });
  }

  const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
  const passwordHash = await bcrypt.hash(password, rounds);
  const created = await prisma.restaurantStaff.create({
    data: {
      hotelId,
      launcherId: null,
      name,
      username,
      role,
      active,
      passwordHash,
      accessRoleId: accessRoleId || null,
    } as any,
    include: { accessRole: { select: { id: true, name: true } } },
  });

  res.status(201).json(sanitizeStaff(created));
}

export async function updateRestaurantStaff(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId || !user?.sub) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;
  const { id } = req.params as { id?: string };
  if (!id) return res.status(400).json({ message: "id requerido" });

  const existing = await prisma.restaurantStaff.findFirst({
    where: { id: String(id), hotelId },
  });
  if (!existing) return res.status(404).json({ message: "Personal no encontrado" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const data: any = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("active" in body) data.active = body.active !== false;

  if (body.role) {
    const role = normalizeStaffRole(body.role);
    if (!role) return res.status(400).json({ message: "Rol invalido" });
    data.role = role;
  }
  if ("accessRoleId" in body || "roleId" in body) {
    const nextRoleId = String(body.accessRoleId || body.roleId || "").trim();
    if (nextRoleId) {
      const roleExists = await prisma.appRole.findFirst({ where: { hotelId, id: nextRoleId } });
      if (!roleExists) return res.status(400).json({ message: "Perfil de permisos inválido" });
      data.accessRoleId = nextRoleId;
    } else {
      data.accessRoleId = null;
    }
  }

  if (body.username || body.user || body.code) {
    const username = normalizeStaffUsername(body.username || body.user || body.code);
    if (!username) return res.status(400).json({ message: "Usuario invalido" });
    if (username !== existing.username) {
      const dup = await prisma.restaurantStaff.findFirst({ where: { hotelId, username } });
      if (dup) return res.status(409).json({ message: "Usuario ya existe" });
    }
    data.username = username;
  }

  if (body.password) {
    const password = String(body.password || "").trim();
    if (password.length < 4) return res.status(400).json({ message: "Password minimo 4" });
    const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
    data.passwordHash = await bcrypt.hash(password, rounds);
  }

  if (Object.keys(data).length === 0) return res.status(400).json({ message: "No hay cambios" });

  const updated = await prisma.restaurantStaff.update({
    where: { id: existing.id },
    data,
    include: { accessRole: { select: { id: true, name: true } } },
  });
  res.json(sanitizeStaff(updated));
}

export async function deleteRestaurantStaff(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId || !user?.sub) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;
  const { id } = req.params as { id?: string };
  if (!id) return res.status(400).json({ message: "id requerido" });

  await prisma.restaurantStaff.deleteMany({ where: { id: String(id), hotelId } });
  res.json({ ok: true });
}

export async function loginRestaurantStaff(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId || !user?.sub) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const username = normalizeStaffUsername(body.username || body.user || body.code);
  const password = String(body.password || "").trim();
  if (!username || !password) return res.status(400).json({ message: "Usuario y password requeridos" });

  const staff = await prisma.restaurantStaff.findFirst({
    where: { hotelId, username },
    include: { accessRole: { select: { id: true, name: true } } },
  });
  if (!staff) return res.status(401).json({ message: "Credenciales invalidas" });
  if (!STAFF_ROLES.has(staff.role)) return res.status(403).json({ message: "Rol no autorizado" });
  if (!staff.active) return res.status(403).json({ message: "Usuario inactivo" });

  const ok = await bcrypt.compare(password, staff.passwordHash);
  if (!ok) return res.status(401).json({ message: "Credenciales invalidas" });

  res.json(sanitizeStaff(staff));
}

