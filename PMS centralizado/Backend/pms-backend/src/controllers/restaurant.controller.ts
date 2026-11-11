import type { Request, Response } from "express";
import { Prisma, type RestaurantOrderStatus, type RestaurantStaffRole } from "@prisma/client";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import { nextHotelSequence, padNumber } from "../lib/sequences.js";
import { canConvert, convertQty, isSupportedUnit, normalizeUnit } from "../lib/units.js";
import { parseCrEInvoiceXml } from "../services/einvoicing.xml.js";
import { fetchBccrExchangeRate } from "../services/bccr.js";
import { applyInventoryInvoice, buildInventoryLinesFromXml } from "../services/inventory.integration.js";
import { onRestaurantSale, onRestaurantSaleVoid } from "../services/accounting.integration.js";
import {
  createCreditDebitNote,
  NoteCreationError,
} from "../services/einvoicing.notes.js";
import {
  submitDocumentToHacienda,
} from "../services/einvoicing.submit.js";
import { calculateOrderTotals } from "../lib/restaurantTaxes.js";
import { isPriceAllowed, resolveAllowedUnitPrices } from "../lib/restaurantPricing.js";
import { isCashPaymentMethod, resolveHaciendaPaymentCode } from "../lib/restaurantPaymentCodes.js";
import { issueRestaurantDoc } from "../services/restaurant.einvoice.js";
import { authorizeStaffAction, issueStaffToken, readStaffSession } from "../lib/restaurantStaffSession.js";
import { DEFAULT_PRINT_FORMS } from "../lib/printForms.js";
import { asNumber as asNumberShared } from "../lib/num.js";

const ROUNDS = 10;

const asNumber = (v: unknown) => asNumberShared(v);

const clampPercent = (v: unknown) => {
  const n = asNumberShared(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
};

const ORDER_STATUS_ALIASES: Record<string, RestaurantOrderStatus> = {
  ENVIADO: "OPEN",
  ENVIADA: "OPEN",
  ABIERTO: "OPEN",
  CERRADO: "CLOSED",
  PAGADO: "PAID",
  CANCELADO: "CANCELED",
  ANULADO: "CANCELED",
};

const VALID_ORDER_STATUSES = new Set<RestaurantOrderStatus>(["OPEN", "CLOSED", "PAID", "CANCELED"]);

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

// ── Helpers de sanitización de respuestas ──
// Eliminan hotelId y transforman IDs compuestos (hotelId:xxx → xxx)
// para no exponer identificadores internos de BD al frontend.

function sanitizeOrderItem(item: any): any {
  if (!item) return item;
  const { hotelId: _h, orderId: _o, discountId: _d, ...safe } = item;
  return safe;
}

function sanitizeOrder(order: any, hotelId: string): any {
  if (!order) return order;
  const items = Array.isArray(order.items) ? order.items.map(sanitizeOrderItem) : order.items;
  const { hotelId: _h, waiterId: _w, cashierId: _c, sentItemsMap: _s, ...safe } = order;
  return {
    ...safe,
    sectionId: order.sectionId ? fromInternalId(hotelId, order.sectionId) : null,
    tableId: fromInternalId(hotelId, order.tableId),
    items,
  };
}

function sanitizeMenuItem(item: any, hotelId: string): any {
  if (!item) return item;
  const { hotelId: _h, sectionId: _s, menuId: _m, ...safe } = item;
  if (item.sectionId) safe.sectionId = fromInternalId(hotelId, item.sectionId);
  return safe;
}

function sanitizeMenu(menu: any): any {
  if (!menu) return menu;
  const { hotelId: _h, ...safe } = menu;
  return safe;
}

function sanitizeFamily(f: any): any {
  if (!f) return f;
  const { hotelId: _h, ...safe } = f;
  return safe;
}

// El id del padre (familyId / subFamilyId) se conserva: la pantalla de artículos
// lo necesita para filtrar la sub-familia y la sub-sub-familia de la elegida.
function sanitizeSubFamily(sf: any): any {
  if (!sf) return sf;
  const { hotelId: _h, ...safe } = sf;
  return safe;
}

function sanitizeSubSubFamily(ssf: any): any {
  if (!ssf) return ssf;
  const { hotelId: _h, ...safe } = ssf;
  return safe;
}

function sanitizeEInvoicingDoc(doc: any): any {
  if (!doc) return doc;
  const { hotelId: _h, ...safe } = doc;
  return safe;
}

function sanitizeRole(role: any): any {
  if (!role) return role;
  const { hotelId: _h, ...safe } = role;
  return safe;
}

function sanitizePrintJob(job: any, hotelId: string): any {
  if (!job) return job;
  const { hotelId: _h, ...safe } = job;
  if (job.sectionId) safe.sectionId = fromInternalId(hotelId, job.sectionId);
  if (job.tableId) safe.tableId = fromInternalId(hotelId, job.tableId);
  return safe;
}

function sanitizeConfig(cfg: any): any {
  if (!cfg) return cfg;
  const { hotelId: _h, ...safe } = cfg;
  return safe;
}

function sanitizeTable(t: any, hotelId: string): any {
  if (!t) return t;
  const { hotelId: _h, ...safe } = t;
  safe.id = fromInternalId(hotelId, t.id);
  safe.sectionId = fromInternalId(hotelId, t.sectionId);
  return safe;
}

function sanitizeSection(s: any, hotelId: string): any {
  if (!s) return s;
  const { hotelId: _h, ...safe } = s;
  safe.id = fromInternalId(hotelId, s.id);
  return safe;
}

function sanitizeSectionObject(obj: any, hotelId: string): any {
  if (!obj) return obj;
  const { hotelId: _h, ...safe } = obj;
  safe.sectionId = fromInternalId(hotelId, obj.sectionId);
  return safe;
}

// ─────────────────────────────────────────

const DEFAULT_RESTAURANT_TIMEZONE = "America/Costa_Rica";
const WEEKDAY_INDEX: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

function parseClockToMinutes(value?: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function normalizeTimeZone(value?: string | null): string {
  const tz = String(value || "").trim() || DEFAULT_RESTAURANT_TIMEZONE;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_RESTAURANT_TIMEZONE;
  }
}

function getZonedClockParts(timezone?: string | null, now = new Date()) {
  const tz = normalizeTimeZone(timezone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekdayShort = String(parts.find((p) => p.type === "weekday")?.value || "Sun").slice(0, 3).toUpperCase();
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  const day = WEEKDAY_INDEX[weekdayShort] ?? 0;
  const prevDay = (day + 6) % 7;

  return {
    day,
    prevDay,
    minutesNow: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0),
  };
}

function isAssignmentActiveNow(input: {
  daysMask?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  timezone?: string | null;
}, now = new Date()) {
  const { day, prevDay, minutesNow } = getZonedClockParts(input.timezone, now);
  const daysMask = Number.isFinite(Number(input.daysMask)) ? Number(input.daysMask) : 127;
  const dayEnabled = (daysMask & (1 << day)) !== 0;
  const prevDayEnabled = (daysMask & (1 << prevDay)) !== 0;

  const start = parseClockToMinutes(input.startTime);
  const end = parseClockToMinutes(input.endTime);

  if (start == null && end == null) return dayEnabled;
  if (start != null && end == null) return dayEnabled && minutesNow >= start;
  if (start == null && end != null) return dayEnabled && minutesNow < end;
  if (start == null || end == null) return dayEnabled;
  if (start === end) return dayEnabled;

  if (start < end) {
    return dayEnabled && minutesNow >= start && minutesNow < end;
  }

  // Ventana que cruza medianoche (ej: 19:00 -> 06:00)
  if (minutesNow >= start) return dayEnabled;
  if (minutesNow < end) return prevDayEnabled;
  return false;
}

const resolveBillingDocType = (raw: unknown): "FE" | "TE" | null => {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value === "factura" || value === "fe") return "FE";
  if (value === "tiquete" || value === "ticket" || value === "te") return "TE";
  return null;
};

async function recordOrderEvent(
  client: any,
  opts: { hotelId: string; orderId?: string | null; eventType: string; actorId?: string | null; payload?: Prisma.InputJsonValue | null }
) {
  const payload = (opts.payload ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  return client.restaurantOrderEvent.create({
    data: {
      hotelId: opts.hotelId,
      orderId: opts.orderId ?? null,
      eventType: String(opts.eventType || "UNKNOWN"),
      actorId: opts.actorId ?? null,
      payload,
    },
  });
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

  const usedOrders = sections.length
    ? await prisma.restaurantOrder.findMany({
        where: { hotelId, sectionId: { in: sections.map((s) => s.id) } },
        select: { sectionId: true },
        distinct: ["sectionId"],
      })
    : [];
  const usedSections = new Set(usedOrders.map((o) => String(o.sectionId)));

  const mapped = sections.map((s) => ({
    ...sanitizeSection(s, hotelId),
    id: fromInternalId(hotelId, s.id),
    // Una sección con ventas registradas queda bloqueada para edición: los
    // reportes y la contabilidad la referencian por su nombre.
    used: usedSections.has(s.id),
    activeMenu: (() => {
      const list = assignmentsBySection.get(s.id) || [];
      const activeAssignment = list.find((a) => isAssignmentActiveNow(a));
      if (!activeAssignment?.menu || activeAssignment.menu.active === false) return null;
      return { id: activeAssignment.menu.id, name: activeAssignment.menu.name };
    })(),
    tables: (s.tables || []).map((t) => sanitizeTable(t, hotelId)),
    objects: (s.objects || []).map((o) => sanitizeSectionObject(o, hotelId)),
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
  res.json(list.map((o) => ({ ...sanitizeSectionObject(o, hotelId), sectionId })));
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
  res.json({ ...sanitizeSectionObject(obj, hotelId), sectionId });
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
  res.json({ ...sanitizeSectionObject(updated, hotelId), sectionId });
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
  res.json({ ...sanitizeSectionObject(updated, hotelId), id: fromInternalId(hotelId, updated.id), sectionId });
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
  res.json({ ...sanitizeSectionObject(updated, hotelId), id: fromInternalId(hotelId, updated.id), sectionId });
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
    tables: tables.map((t) => sanitizeTable(t, hotelId)),
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
  res.json({ ...sanitizeSection(section, hotelId), id: externalId });
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

  // El nombre y la imagen sólo se pueden cambiar mientras la sección no tenga
  // ventas: los reportes y la contabilidad ya la referencian con ese nombre.
  // quickCashEnabled no entra en el candado porque no aparece en reportes.
  const wantsMetaChange = typeof name === "string" || "imageUrl" in (req.body || {});
  if (wantsMetaChange) {
    const orders = await prisma.restaurantOrder.count({
      where: { hotelId, sectionId: existing.id },
    });
    if (orders > 0) {
      return res.status(409).json({
        code: "SECTION_IN_USE",
        message:
          "Esta sección ya tiene ventas registradas y no se puede renombrar ni cambiar de imagen, para no alterar reportes ni contabilidad.",
      });
    }
  }

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
  res.json({ ...sanitizeSection(updated, hotelId), id: fromInternalId(hotelId, updated.id) });
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
  res.json(tables.map((t) => sanitizeTable(t, hotelId)));
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
  const requestedServiceType = normalizeMenuServiceType(req.query.serviceType);

  if (sectionId) {
    const internalSectionId = toInternalId(user.hotelId, sectionId);
    const assignments = await prisma.restaurantMenuAssignment.findMany({
      where: {
        hotelId: user.hotelId,
        active: true,
        sectionId: { in: [internalSectionId, sectionId] },
        // Sin tipo de servicio se aceptan todas; con tipo, la específica gana
        // sobre la que aplica a todos (serviceType null).
        ...(requestedServiceType
          ? { OR: [{ serviceType: null }, { serviceType: requestedServiceType }] }
          : {}),
      },
      orderBy: [
        { serviceType: { sort: "desc", nulls: "last" } },
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    const activeAssignment = assignments.find((a) => isAssignmentActiveNow(a));

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
              taxes: { include: { tax: true } },
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
          barcode: e.item?.barcode || "",
          familyId: e.item?.familyId || "",
          subFamilyId: e.item?.subFamilyId || "",
          subSubFamilyId: e.item?.subSubFamilyId || "",
          familyName: e.item?.family?.name || "",
          subFamilyName: e.item?.subFamily?.name || "",
          subSubFamilyName: e.item?.subSubFamily?.name || "",
          color: (e.item as any)?.color || "",
          imageUrl: (e.item as any)?.imageUrl || "",
          sizes: Array.isArray((e.item as any)?.sizes) ? (e.item as any)?.sizes : [],
          details: Array.isArray((e.item as any)?.details) ? (e.item as any)?.details : [],
          priceIncludesTaxesAndService: (e.item as any)?.priceIncludesTaxesAndService !== false,
          category: e.category || deriveMenuCategoryFromItem(e.item),
          price: e.price ?? e.item?.price ?? 0,
          tax: e.item?.tax ?? 0,
          taxes: Array.isArray((e.item as any)?.taxes)
            ? (e.item as any).taxes
                .filter((rt: any) => rt.tax?.active !== false)
                .map((rt: any) => ({ percent: Number(rt.tax?.percent || 0), kind: String(rt.tax?.kind || "OTHER") }))
            : null,
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
    return res.json(legacyItems.map((i: any) => sanitizeMenuItem(i, user.hotelId!)));
  }

  // Sin section: lista todo (para management/debug)
  const items = await prisma.restaurantMenuItem.findMany({
    where: { hotelId: user.hotelId },
    orderBy: [{ sectionId: "asc" }, { menuId: "asc" }, { category: "asc" }, { name: "asc" }],
  });
  return res.json(items.map((i: any) => sanitizeMenuItem(i, user.hotelId!)));
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
  res.json(sanitizeMenuItem(item, user.hotelId));
}

// ====== Menús (nuevo) ======

export async function listMenus(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const list = await prisma.restaurantMenu.findMany({
    where: { hotelId: user.hotelId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  res.json(list.map(sanitizeMenu));
}

export async function createMenu(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const { name, active, sectionIds, daysMask, startTime, endTime, timezone, priority, assignmentActive, serviceType } = req.body || {};
  const nm = String(name || "").trim();
  if (!nm) return res.status(400).json({ message: "name requerido" });
  const normalizedServiceType = normalizeMenuServiceType(serviceType);
  if (normalizedServiceType === undefined) {
    return res.status(400).json({ message: "serviceType inválido: usa DINE_IN, TAKEOUT, DELIVERY o ROOM." });
  }
  const sectionIdList = Array.from(
    new Set((Array.isArray(sectionIds) ? sectionIds : []).map((x: any) => String(x || "").trim()).filter(Boolean))
  );
  if (!sectionIdList.length) {
    return res.status(400).json({ message: "sectionIds requerido" });
  }

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
  if (sectionInternalIds.length !== sectionIdList.length) {
    return res.status(404).json({ message: "Seccion no encontrada" });
  }

  const scheduleDaysMask = Number.isFinite(Number(daysMask)) ? Number(daysMask) : 127;
  const scheduleStartTime = startTime ? String(startTime).trim() : null;
  const scheduleEndTime = endTime ? String(endTime).trim() : null;
  const scheduleTimezone = timezone ? String(timezone).trim() : "America/Costa_Rica";
  const schedulePriority = Number.isFinite(Number(priority)) ? Number(priority) : 0;
  const scheduleActive = assignmentActive !== false;

  let created: any;
  try {
    created = await prisma.$transaction(async (tx) => {
      const menu = await tx.restaurantMenu.create({
        data: { hotelId, name: nm, active: active !== false },
      });

      await tx.restaurantMenuAssignment.createMany({
        data: sectionInternalIds.map((internalId: string) => ({
          hotelId,
          sectionId: internalId,
          menuId: menu.id,
          daysMask: scheduleDaysMask,
          startTime: scheduleStartTime,
          endTime: scheduleEndTime,
          timezone: scheduleTimezone,
          priority: schedulePriority,
          active: scheduleActive,
          serviceType: normalizedServiceType,
        })),
        skipDuplicates: true,
      });

      return menu;
    });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ message: "Ya existe un men? con ese nombre" });
    }
    throw err;
  }

  res.json(sanitizeMenu(created));
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

  let updated: any;
  try {
    updated = await prisma.restaurantMenu.update({ where: { id: existing.id }, data });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ message: "Ya existe un men? con ese nombre" });
    }
    throw err;
  }
  res.json(sanitizeMenu(updated));
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
  res.json(items.map((i: any) => sanitizeMenuItem(i, user.hotelId!)));
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
  res.json(sanitizeMenuItem(item, user.hotelId!));
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
          barcode: e.item.barcode,
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
  res.json(entries.map((e: any) => { const { hotelId: _h, ...s } = e; return s; }));
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
  res.json(list.map((a: any) => { const { hotelId: _h, ...s } = a; return s; }));
}

const SERVICE_TYPES = ["DINE_IN", "TAKEOUT", "DELIVERY", "ROOM"] as const;

/** null = aplica a todos; undefined = valor inválido. */
function normalizeMenuServiceType(value: unknown): string | null | undefined {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return null;
  const normalized = raw === "TAKEAWAY" ? "TAKEOUT" : raw;
  return (SERVICE_TYPES as readonly string[]).includes(normalized) ? normalized : undefined;
}

export async function createSectionMenuAssignment(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const { sectionId } = req.params as { sectionId?: string };
  const { menuId, daysMask, startTime, endTime, timezone, priority, active, serviceType } = req.body || {};
  if (!sectionId || !menuId) return res.status(400).json({ message: "sectionId y menuId requeridos" });
  const normalizedServiceType = normalizeMenuServiceType(serviceType);
  if (normalizedServiceType === undefined) {
    return res.status(400).json({ message: "serviceType inválido: usa DINE_IN, TAKEOUT, DELIVERY o ROOM." });
  }

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
      serviceType: normalizedServiceType,
    },
    include: { menu: { select: { id: true, name: true, active: true } } },
  });
  res.json((() => { const { hotelId: _h, ...s } = created; return s; })());
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
  if ("serviceType" in body) {
    const normalizedServiceType = normalizeMenuServiceType(body.serviceType);
    if (normalizedServiceType === undefined) {
      return res.status(400).json({ message: "serviceType inválido: usa DINE_IN, TAKEOUT, DELIVERY o ROOM." });
    }
    data.serviceType = normalizedServiceType;
  }
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
  res.json((() => { const { hotelId: _h, ...s } = updated; return s; })());
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
  res.json(families.map(sanitizeFamily));
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
  res.json(sanitizeFamily(created));
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

  res.json(sanitizeFamily(updated));
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
  res.json(list.map(sanitizeSubFamily));
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
  res.json(sanitizeSubFamily(created));
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
  res.json(list.map(sanitizeSubSubFamily));
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
  res.json(sanitizeSubSubFamily(created));
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
      barcode: i.barcode,
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
        kind: t.tax?.kind,
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
    const barcode = raw?.barcode ? String(raw.barcode).trim() : "";
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
        barcode: barcode || null,
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
      barcode: item.barcode,
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

  res.json(Array.isArray(created) ? created.map((c: any) => sanitizeFamily(c)) : sanitizeFamily(created));
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
      if ("barcode" in body) {
        const nextBarcode = String(body.barcode || "").trim();
        data.barcode = nextBarcode || null;
      }
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
      barcode: updated.barcode,
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

  res.json(orders.map((o) => sanitizeOrder(o, hotelId)));
}

export async function createOrUpdateOrder(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const { sectionId, tableId, items, note, covers, serviceType, roomId, guestId, orderId, restaurantOrderId, createNew, forceNew, waiterId, discountId, discountPercent, sentItemsMap: sentItemsMapInput } = req.body as {
    sectionId?: string;
    tableId: string;
    items: { id?: string; itemId?: string; variantKey?: string; detailNote?: string; name: string; category?: string; price: number; qty: number; discountId?: string; discountPercent?: number }[];
    note?: string;
    covers?: number;
    serviceType?: string;
    roomId?: string;
    guestId?: string;
    orderId?: string;
    restaurantOrderId?: string;
    createNew?: boolean;
    forceNew?: boolean;
    status?: string;
    waiterId?: string;
    discountId?: string;
    discountPercent?: number;
    sentItemsMap?: Record<string, number>;
  };

  // Validar que el guest pertenece al mismo hotel
  const safeGuestId = guestId ? String(guestId).trim() : null;
  if (safeGuestId) {
    const guestExists = await prisma.guest.findFirst({ where: { id: safeGuestId, hotelId }, select: { id: true } });
    if (!guestExists) return res.status(400).json({ message: "Cliente no encontrado en este hotel" });
  }
  if (!tableId || !Array.isArray(items)) return res.status(400).json({ message: "tableId e items requeridos" });
  const mergeItems = Boolean((req.body as any)?.mergeItems);

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
  const staffSession = readStaffSession(req);
  const openShiftForOrder = await prisma.cashAudit.findFirst({
    where: { hotelId, module: "RESTAURANT", closedAt: null },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  });
  // Quién generó la venta: el staff de la sesión; si no hay, el mesero pedido.
  const creatorStaffId = staffSession?.hotelId === hotelId ? staffSession.staffId : "";
  // El mesero autenticado manda: no se acepta atribuir la orden a otro.
  const sessionWaiterId =
    staffSession?.hotelId === hotelId && staffSession.staffRole === "WAITER" ? staffSession.staffId : "";
  const effectiveWaiterId = sessionWaiterId || String(waiterId || "").trim();
  if (effectiveWaiterId) {
    const requestedWaiter = effectiveWaiterId;
    {
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

  const mergeItemsList = (base: any[], incoming: any[]) => {
    const byKey = new Map<string, any>();
    const keyOf = (i: any) => `${String(i.itemId || i.id)}::${String(i.variantKey || "")}`;
    base.forEach((it) => byKey.set(keyOf(it), { ...it }));
    incoming.forEach((it) => {
      const key = keyOf(it);
      const prev = byKey.get(key);
      if (prev) {
        byKey.set(key, { ...prev, ...it, qty: Number(prev.qty || 0) + Number(it.qty || 0) });
      } else {
        byKey.set(key, { ...it });
      }
    });
    return Array.from(byKey.values());
  };

  const normalizedItems = mergeItems && existing ? mergeItemsList(existing.items || [], items) : items;
  const itemIds = normalizedItems.map((i) => String(i.itemId || i.id));
  const itemRules = await prisma.restaurantItem.findMany({
    where: { hotelId, id: { in: itemIds } },
    include: { taxes: { include: { tax: true } } },
  });
  const rulesById = new Map(itemRules.map((r) => [r.id, r]));

  // Precio autoritativo: el POS envía el precio, aquí se contrasta contra el
  // artículo guardado (base, tallas, detalles) y los overrides de menú.
  const legacyItemIds = Array.from(new Set(itemIds.filter((id) => !rulesById.has(id))));
  const legacyItems = legacyItemIds.length
    ? await prisma.restaurantMenuItem.findMany({
        where: { hotelId, id: { in: legacyItemIds } },
        select: { id: true, price: true, name: true },
      })
    : [];
  const legacyPriceById = new Map(legacyItems.map((i) => [i.id, Number(i.price || 0)]));
  const legacyNameById = new Map(legacyItems.map((i) => [i.id, i.name]));

  // El nombre del ítem puede venir del POS o resolverse del catálogo: nunca debe
  // guardarse vacío (la base lo exige y rompía el alta de la orden).
  const resolveItemName = (raw: any, itemId: string) =>
    String(raw?.name || rulesById.get(itemId)?.name || legacyNameById.get(itemId) || "").trim() ||
    `Artículo ${itemId}`;
  const menuOverrides = await prisma.restaurantMenuEntry.findMany({
    where: { hotelId, itemId: { in: itemIds }, active: true, price: { not: null } },
    select: { itemId: true, price: true },
  });
  const overridesByItem = new Map<string, number[]>();
  for (const entry of menuOverrides) {
    if (entry.price == null) continue;
    const list = overridesByItem.get(entry.itemId) || [];
    list.push(Number(entry.price));
    overridesByItem.set(entry.itemId, list);
  }

  const priceViolations: string[] = [];
  for (const i of normalizedItems) {
    const itemId = String(i.itemId || i.id);
    const rule = rulesById.get(itemId);
    const legacyPrice = legacyPriceById.get(itemId);
    if (!rule && legacyPrice === undefined) continue;
    const allowed = rule
      ? resolveAllowedUnitPrices({
          basePrice: Number(rule.price || 0),
          sizes: (rule as any).sizes,
          details: (rule as any).details,
          menuOverrides: overridesByItem.get(itemId) || [],
          variantKey: i.variantKey,
        })
      : { prices: [legacyPrice as number], verified: true };
    if (!isPriceAllowed(Number(i.price || 0), allowed)) {
      const label = String(i.name || rule?.name || itemId);
      priceViolations.push(`${label} (enviado ₡${asNumber(i.price)}, permitido ₡${allowed.prices.join(" / ")} )`);
    }
  }
  if (priceViolations.length > 0) {
    const priceAuthz = await authorizeStaffAction(req, user, ["restaurant.orders.edit_price"]);
    if (!priceAuthz.allowed) {
      return res.status(403).json({
        code: "PRICE_NOT_ALLOWED",
        message: `El precio enviado no coincide con el del menú: ${priceViolations.join("; ")}.`,
      });
    }
  }

  const configForLimits = await getOrCreateRestaurantConfig(hotelId);
  const taxSettings = (configForLimits.taxes && typeof configForLimits.taxes === "object" ? configForLimits.taxes : {}) as any;
  const descuentosHabilitados = taxSettings.permitirDescuentos !== false;
  const descuentoMax = taxSettings.descuentoMax != null ? clampPercent(taxSettings.descuentoMax) : 100;
  const requestedDiscounts = [
    ...normalizedItems.map((i) => clampPercent(i.discountPercent)),
    clampPercent(discountPercent),
  ];
  const exceedsCap = requestedDiscounts.some((p) => p > descuentoMax);
  const hasAnyDiscount = requestedDiscounts.some((p) => p > 0);
  if (exceedsCap || (!descuentosHabilitados && hasAnyDiscount)) {
    const discountAuthz = await authorizeStaffAction(req, user, ["restaurant.orders.discount"]);
    if (!discountAuthz.allowed) {
      return res.status(403).json({
        code: "DISCOUNT_NOT_ALLOWED",
        message: descuentosHabilitados
          ? `El descuento supera el máximo permitido (${descuentoMax}%).`
          : "Los descuentos están deshabilitados en la configuración del restaurante.",
      });
    }
  }

  const totalsInputFor = (discountPercents: { order: number; byItem: Map<string, number> }) =>
    normalizedItems.map((i) => {
      const itemId = String(i.itemId || i.id);
      const rule = rulesById.get(itemId);
      // Si el POS manda un id de descuento, manda el porcentaje guardado del
      // descuento, no el número que envía la pantalla.
      const itemDiscountPercent = discountPercents.byItem.has(String(i.discountId || "").trim())
        ? discountPercents.byItem.get(String(i.discountId || "").trim())!
        : i.discountPercent;
      return {
        price: Number(i.price || 0),
        qty: Number(i.qty || 0),
        discountPercent: itemDiscountPercent,
        priceIncludesTaxesAndService: rule?.priceIncludesTaxesAndService !== false,
        taxes:
          rule && rule.taxes && rule.taxes.length > 0
            ? rule.taxes
                .filter((rt: any) => rt.tax?.active !== false)
                .map((rt: any) => ({ percent: Number(rt.tax?.percent || 0), kind: String(rt.tax?.kind || "OTHER") }))
            : null,
      };
    });

  const discountIdRaw = String(discountId || "").trim();
  const discountIdToSave = discountIdRaw || null;
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

  // Descuentos: deben existir, estar activos, no estar vencidos y, si el
  // descuento lo exige, venir acompañados del PIN de administrador.
  const discountRows = await prisma.discount.findMany({
    where: { hotelId },
    select: { id: true, name: true, value: true, active: true, expiresAt: true, requiresPin: true },
  });
  const discountById = new Map(discountRows.map((d) => [d.id, d]));
  const requestedDiscountIds = new Set<string>();
  if (discountIdToSave) requestedDiscountIds.add(discountIdToSave);
  for (const item of items as any[]) {
    const rawId = String(item?.discountId || "").trim();
    if (rawId) requestedDiscountIds.add(rawId);
  }
  const now = new Date();
  let discountRequiringPin: string | null = null;
  for (const id of requestedDiscountIds) {
    const discount = discountById.get(id);
    if (!discount) {
      return res.status(400).json({ code: "DISCOUNT_NOT_FOUND", message: "El descuento seleccionado no existe." });
    }
    if (discount.active === false) {
      return res.status(400).json({
        code: "DISCOUNT_INACTIVE",
        message: `El descuento "${discount.name}" está inactivo.`,
      });
    }
    if (discount.expiresAt && discount.expiresAt.getTime() < now.getTime()) {
      return res.status(400).json({
        code: "DISCOUNT_EXPIRED",
        message: `El descuento "${discount.name}" está vencido.`,
      });
    }
    if (discount.requiresPin) discountRequiringPin = discount.name;
  }
  if (discountRequiringPin) {
    const pin = (req.body as any)?.discountPin ?? (req.body as any)?.adminCode;
    const authorized = await requireAdminOrAdminCode(user, hotelId, pin);
    if (!authorized) {
      return res.status(403).json({
        code: "DISCOUNT_PIN_REQUIRED",
        message: `El descuento "${discountRequiringPin}" requiere PIN de administrador.`,
      });
    }
  }
  const validDiscountIds = new Set(discountRows.map((d) => d.id));
  const safeOrderDiscountId = discountIdToSave && validDiscountIds.has(discountIdToSave) ? discountIdToSave : null;

  // El porcentaje sale del descuento guardado; el del body solo se usa cuando
  // no hay id (descuento manual), y siempre acotado por el máximo permitido.
  const effectiveOrderDiscountPercent = safeOrderDiscountId
    ? clampPercent(discountById.get(safeOrderDiscountId)?.value ?? 0)
    : clampPercent(discountPercent);
  const discountPercentByItemId = new Map<string, number>(
    discountRows.map((d) => [d.id, clampPercent(d.value)] as [string, number])
  );
  const normalizedDiscountPercent = effectiveOrderDiscountPercent;
  const totals = calculateOrderTotals(
    totalsInputFor({ order: effectiveOrderDiscountPercent, byItem: discountPercentByItemId }),
    taxes,
    effectiveOrderDiscountPercent
  );
  const { subtotal, service, tax, total, discountAmount } = totals;

  let order: any = null;
  try {
    order = existing
      ? await prisma.$transaction(async (tx) => {
        const waiterIdToSave = resolvedWaiterId || existing.waiterId || null;
        await tx.restaurantOrder.updateMany({
          where: { id: existing.id, hotelId },
          data: {
            sectionId: resolvedSectionId || existing.sectionId,
            tableId: internalTableId,
            waiterId: waiterIdToSave,
            shiftId: existing.shiftId || openShiftForOrder?.id || null,
            createdByStaffId: existing.createdByStaffId || creatorStaffId || waiterIdToSave || null,
            note: note ?? existing.note,
            covers: covers ?? existing.covers,
            serviceType: inferredServiceType,
            roomId: roomId ?? existing.roomId,
            guestId: safeGuestId ?? existing.guestId,
            discountId: safeOrderDiscountId,
            discountPercent: normalizedDiscountPercent,
            discountAmount,
            subtotal,
            tax,
            total,
            tip10: service,
            status: nextStatus,
            ...(sentItemsMapInput !== undefined ? { sentItemsMap: sentItemsMapInput } : {}),
          },
        });

        const toKey = (itemId: string, variantKey: string) => `${itemId}::${variantKey || ""}`;
        const existingItems = await tx.restaurantOrderItem.findMany({
          where: { hotelId, orderId: existing.id },
          select: { itemId: true, variantKey: true, area: true, status: true, qty: true },
        });
        const existingMap = new Map(existingItems.map((i) => [toKey(i.itemId, i.variantKey || ""), i]));
        const incomingKeys = items.map((i) => ({
          itemId: String(i.itemId || i.id),
          variantKey: String(i.variantKey || ""),
        }));

        if (!mergeItems) {
          await tx.restaurantOrderItem.deleteMany({
            where: {
              hotelId,
              orderId: existing.id,
              NOT: { OR: incomingKeys },
            },
          });
        }

        for (const i of normalizedItems) {
          const itemId = String(i.itemId || i.id);
          const variantKey = String(i.variantKey || "");
          const prev = existingMap.get(`${itemId}::${variantKey}`);
          const cat = (i.category || "").toLowerCase();
          const isBar = cat.includes("bebida") || cat.includes("bar");
              const includes = rulesById.get(itemId)?.priceIncludesTaxesAndService !== false;
              const itemDiscountRaw = String(i.discountId || "").trim();
              const itemDiscountId = itemDiscountRaw && validDiscountIds.has(itemDiscountRaw) ? itemDiscountRaw : null;
              const itemDiscountPercent = itemDiscountId
                ? clampPercent(discountById.get(itemDiscountId)?.value ?? 0)
                : clampPercent(i.discountPercent);
              const nextQty = mergeItems && prev ? Number(prev.qty || 0) + Number(i.qty || 0) : i.qty;
              await tx.restaurantOrderItem.upsert({
                where: { hotelId_orderId_itemId_variantKey: { hotelId, orderId: existing.id, itemId, variantKey } },
                update: {
                  name: resolveItemName(i, itemId),
                  category: i.category || "",
                  price: i.price,
                  qty: nextQty,
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
                  name: resolveItemName(i, itemId),
                  category: i.category || "",
                  price: i.price,
                  qty: nextQty,
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
            itemsCount: normalizedItems.length,
            note: note ?? existing.note ?? "",
          } as any,
        });

        return tx.restaurantOrder.findFirst({ where: { id: existing.id, hotelId }, include: { items: true } });
      })
    : await prisma.$transaction(async (tx) => {
        // Verificación atómica para evitar orden duplicada en mesa concurrente
        const concurrent = await tx.restaurantOrder.findFirst({
          where: { hotelId, status: "OPEN", tableId: { in: [internalTableId, String(tableId)] } },
          orderBy: { updatedAt: "desc" },
        });
        if (concurrent) {
          throw new Error(`CONCURRENT_ORDER:${concurrent.id}`);
        }

        const created = await tx.restaurantOrder.create({
          data: {
            hotelId,
            sectionId: resolvedSectionId || null,
            tableId: internalTableId,
            waiterId: resolvedWaiterId || null,
            shiftId: openShiftForOrder?.id || null,
            createdByStaffId: creatorStaffId || resolvedWaiterId || null,
            status: nextStatus,
            note: note || "",
            covers: covers || 0,
            serviceType: inferredServiceType,
            roomId: roomId || null,
            guestId: safeGuestId || null,
            discountId: safeOrderDiscountId,
            discountPercent: normalizedDiscountPercent,
            discountAmount,
            subtotal,
            tax,
            total,
            tip10: service,
            ...(sentItemsMapInput !== undefined ? { sentItemsMap: sentItemsMapInput } : {}),
            items: {
              create: normalizedItems.map((i) => {
                const itemId = String(i.itemId || i.id);
                const variantKey = String(i.variantKey || "");
                const cat = (i.category || "").toLowerCase();
                const isBar = cat.includes("bebida") || cat.includes("bar");
                const includes = rulesById.get(itemId)?.priceIncludesTaxesAndService !== false;
                const itemDiscountRaw = String(i.discountId || "").trim();
                const itemDiscountId = itemDiscountRaw && validDiscountIds.has(itemDiscountRaw) ? itemDiscountRaw : null;
                const itemDiscountPercent = itemDiscountId
                  ? clampPercent(discountById.get(itemDiscountId)?.value ?? 0)
                  : clampPercent(i.discountPercent);
                return {
                  hotelId,
                  itemId,
                  variantKey,
                  name: resolveItemName(i, itemId),
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("CONCURRENT_ORDER:")) {
      return res.status(409).json({
        code: "CONCURRENT_ORDER",
        message: "La mesa ya tiene una orden abierta. Reintenta.",
        orderId: msg.split(":")[1],
      });
    }
    throw err;
  }

  if (!order) return res.status(500).json({ message: "No se pudo crear/actualizar la orden" });
  res.json(sanitizeOrder(order, hotelId));
}

/**
 * Consume inventario basado en recetas para una orden.
 * Extraído como helper para poder hacerlo no-bloqueante.
 */
async function consumeInventoryForOrder(
  tx: any,
  hotelId: string,
  order: any,
  actorSub?: string | null
): Promise<{ shortages: Array<{ label: string; required: number; available: number; unit: string }> }> {
  const itemIds = Array.from(new Set((order.items || []).map((i: any) => String(i.itemId))));
  if (!itemIds.length) return { shortages: [] };

  const recipes = await tx.restaurantRecipeLine.findMany({
    where: { hotelId, restaurantItemId: { in: itemIds } },
    include: {
      inventoryItem: { select: { id: true, unit: true, sku: true, desc: true, stock: true, inventoryControlled: true } },
    },
  });
  const byItem = new Map<string, typeof recipes>();
  for (const r of recipes) {
    const k = r.restaurantItemId;
    const arr = byItem.get(k) || [];
    arr.push(r);
    byItem.set(k, arr);
  }

  const consumptionByInventory = new Map<string, { id: string; label: string; unit: string; consumption: number }>();
  for (const oi of order.items) {
    const soldQty = Number(oi.qty || 0);
    if (!soldQty) continue;
    const lines = byItem.get(String(oi.itemId)) || [];
    for (const line of lines) {
      const inv = line.inventoryItem;
      if (!inv || inv.inventoryControlled === false) continue;
      const consumption = Number(line.qty) * soldQty;
      if (!Number.isFinite(consumption) || consumption <= 0) continue;
      const prev = consumptionByInventory.get(inv.id);
      if (prev) {
        prev.consumption += consumption;
      } else {
        consumptionByInventory.set(inv.id, { id: inv.id, label: inv.sku || inv.desc || inv.id, unit: inv.unit, consumption });
      }
    }
  }

  if (!consumptionByInventory.size) return { shortages: [] };

  // Validar todo antes de descontar: si falta algo no se toca ningún stock.
  const stockRows = await tx.restaurantInventoryItem.findMany({
    where: { id: { in: Array.from(consumptionByInventory.keys()) }, hotelId },
    select: { id: true, stock: true, inventoryControlled: true },
  });
  const stockById = new Map<string, number>(
    stockRows.map((s: any) => [String(s.id), Number(s.stock || 0)] as [string, number])
  );
  const shortages: Array<{ label: string; required: number; available: number; unit: string }> = [];
  for (const entry of consumptionByInventory.values()) {
    const available = stockById.get(entry.id) ?? 0;
    if (available < entry.consumption) {
      shortages.push({ label: entry.label, required: entry.consumption, available, unit: entry.unit });
    }
  }
  if (shortages.length > 0) return { shortages };

  const movementRows: Prisma.RestaurantInventoryMovementCreateManyInput[] = [];
  for (const entry of consumptionByInventory.values()) {
    const updatedInv = await tx.restaurantInventoryItem.updateMany({
      where: { id: entry.id, hotelId, inventoryControlled: true, stock: { gte: entry.consumption } },
      data: { stock: { decrement: entry.consumption } },
    });
    if (updatedInv.count === 0) {
      throw new Error(`Stock insuficiente para ${entry.label}: requiere ${entry.consumption} ${entry.unit}`);
    }
    movementRows.push({
      hotelId,
      itemId: entry.id,
      qtyDelta: -entry.consumption,
      reason: `Recipe consumption for order ${order.id}`,
      refType: "RESTAURANT_ORDER",
      refId: order.id,
      createdBy: actorSub,
    });
  }
  if (movementRows.length) {
    await tx.restaurantInventoryMovement.createMany({ data: movementRows });
  }
  return { shortages: [] };
}

export async function closeOrder(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;
  const activeStatuses = OPEN_ORDER_STATUSES;

  const closeAuthz = await authorizeStaffAction(req, user, ["restaurant.orders.close"]);
  if (!closeAuthz.allowed) {
    return res.status(403).json({ code: "STAFF_NOT_ALLOWED", message: closeAuthz.reason || "No tienes permiso para cobrar órdenes." });
  }

  // Si el hotel trabaja con turnos de caja, no se cobra fuera de turno: esa venta
  // quedaría fuera del arqueo. Los hoteles sin turnos registrados siguen igual.
  const openShift = await prisma.cashAudit.findFirst({
    where: { hotelId, module: "RESTAURANT", closedAt: null },
    select: { id: true },
  });
  if (!openShift) {
    const previousShift = await prisma.cashAudit.findFirst({
      where: { hotelId, module: "RESTAURANT" },
      select: { id: true },
    });
    if (previousShift) {
      return res.status(409).json({
        code: "SHIFT_NOT_OPEN",
        message: "No hay turno de caja abierto. Abre el turno antes de cobrar.",
      });
    }
  }

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

  // El cajero autenticado manda sobre el id que venga en el body.
  const sessionCashierId = closeAuthz.session?.staffRole === "CASHIER" ? closeAuthz.session.staffId : "";
  let resolvedCashierId = "";
  const requestedCashier = sessionCashierId || String(cashierId || "").trim();
  if (requestedCashier) {
    const staff = await prisma.restaurantStaff.findFirst({
      where: { id: requestedCashier, hotelId, role: "CASHIER", active: true },
      select: { id: true },
    });
    if (!staff) return res.status(403).json({ message: "Cajero no autorizado" });
    resolvedCashierId = requestedCashier;
  }

  // Los totales autoritativos son los guardados al armar la orden (calculados en
  // el servidor). Lo que envía el cliente sólo sirve para detectar una pantalla
  // desactualizada; nunca se persiste tal cual.
  if (!Array.isArray(order.items) || order.items.length === 0) {
    return res.status(400).json({ message: "La orden no tiene ítems para cobrar." });
  }
  const subtotalToSave = asNumber(order.subtotal);
  const taxToSave = asNumber(order.tax);
  const serviceToSave = asNumber(order.tip10);
  const totalToSave = asNumber(order.total);
  const clientTotal = asNumber((totals as any)?.total ?? (totals as any)?.reported);
  if (totals && ((totals as any).total != null || (totals as any).reported != null) && Math.abs(clientTotal - totalToSave) > 1) {
    return res.status(409).json({
      code: "TOTALS_MISMATCH",
      message: "El total de la pantalla no coincide con la orden guardada. Actualiza la orden e intenta de nuevo.",
      totals: { subtotal: subtotalToSave, tax: taxToSave, service: serviceToSave, total: totalToSave },
    });
  }
  const paidAt = new Date();
  const shouldAssignSaleNumber = !order.saleNumber;

  // Validar que la suma de pagos coincida con el total (tolerancia 1 CRC)
  const paymentsTotal = Object.values(payments || {}).reduce((sum: number, v: unknown) => sum + asNumber(v), 0);
  if (Math.abs(paymentsTotal - totalToSave) > 1) {
    return res.status(400).json({
      message: `La suma de pagos (${paymentsTotal}) no coincide con el total (${totalToSave})`,
    });
  }
  const cfg = await getOrCreateRestaurantConfig(hotelId);
  const payCfg = (cfg?.payments && typeof cfg.payments === "object" ? cfg.payments : {}) as any;
  const saleCurrency = String(order.currency || payCfg.monedaBase || "CRC").toUpperCase();
  const configuredMethods: any[] = Array.isArray(payCfg.paymentMethods) ? payCfg.paymentMethods : [];
  const findConfiguredMethod = (key: unknown, name: unknown) => {
    const k = String(key ?? "").trim().toLowerCase();
    const n = String(name ?? "").trim().toLowerCase();
    return configuredMethods.find((m) => {
      const mId = String(m?.id ?? "").trim().toLowerCase();
      const mName = String(m?.name ?? "").trim().toLowerCase();
      return (k && (mId === k || mName === k)) || (n && (mId === n || mName === n));
    });
  };

  // Detalle por medio de cobro (opcional). Permite cobros en moneda extranjera
  // con su tipo de cambio y la referencia del voucher; los importes se guardan
  // convertidos a la moneda de la venta.
  const rawPaymentDetails = Array.isArray((req.body as any)?.paymentDetails) ? (req.body as any).paymentDetails : [];
  const normalizedPaymentDetails: Array<{
    key: string;
    name: string;
    code: string;
    amount: number;
    amountBase: number;
    currency?: string;
    exchangeRate?: number;
    reference?: string;
  }> = [];
  if (rawPaymentDetails.length > 0) {
    for (const raw of rawPaymentDetails) {
      const amount = asNumber(raw?.amount ?? raw?.amountBase);
      if (!(amount > 0)) continue;
      const method = findConfiguredMethod(raw?.key, raw?.name);
      const currency = String(raw?.currency || saleCurrency).toUpperCase();
      const isForeign = currency !== saleCurrency;
      const rate = asNumber(raw?.exchangeRate);
      if (isForeign && !(rate > 0)) {
        return res.status(400).json({
          message: `Falta el tipo de cambio para el cobro en ${currency}.`,
        });
      }
      const amountBase = isForeign ? Math.round(amount * rate * 100) / 100 : amount;
      normalizedPaymentDetails.push({
        key: String(raw?.key || method?.id || raw?.name || "otro"),
        name: String(raw?.name || method?.name || raw?.key || "Otro"),
        code: resolveHaciendaPaymentCode({
          key: raw?.key ?? method?.id,
          name: raw?.name ?? method?.name,
          explicitCode: raw?.code ?? method?.haciendaCode,
        }),
        amount,
        amountBase,
        currency: isForeign ? currency : saleCurrency,
        exchangeRate: isForeign ? rate : 1,
        reference: raw?.reference ? String(raw.reference) : undefined,
      });
    }
    const detailsTotal = normalizedPaymentDetails.reduce((sum, p) => sum + p.amountBase, 0);
    if (rawPaymentDetails.length > 0 && Math.abs(detailsTotal - totalToSave) > 1) {
      return res.status(400).json({
        message: `La suma de los pagos detallados (${detailsTotal}) no coincide con el total (${totalToSave})`,
      });
    }
  }

  const inventoryEnabled =
    cfg?.general && typeof cfg.general === "object" ? (cfg.general as any).inventoryEnabled !== false : true;

  // Cargo a habitación (FrontDesk): se valida aquí y se asienta dentro de la
  // transacción del cierre, identificado por el número de venta de la orden.
  const roomAmount = asNumber(payments?.room);
  const roomTarget = String(roomId || order.roomId || payments?.roomId || payments?.roomNumber || "");
  let roomChargeTarget: { stayId: string; guestId: string | null; invoiceId: string | null } | null = null;
  if (roomAmount > 0 && roomTarget) {
    // Validar que cargoHabitacion esté habilitado en config
    if (cfg?.payments && typeof cfg.payments === "object" && (cfg.payments as any).cargoHabitacion === false) {
      return res.status(400).json({ message: "Cargo a habitación deshabilitado en configuración" });
    }
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
    roomChargeTarget = { stayId: stay.id, guestId: stay.guestId || null, invoiceId: stay.invoice?.id ?? null };
  }

  let updated: any = null;
  let inventoryWarnings: string[] = [];
  try {
    updated = await prisma.$transaction(
      async (tx) => {
      const cashierIdToSave = resolvedCashierId || order.cashierId || null;
      const closerStaffId = closeAuthz.session?.staffId || resolvedCashierId || order.closedByStaffId || null;
      let shiftIdToSave = order.shiftId || null;
      if (!shiftIdToSave) {
        const openShiftNow = await tx.cashAudit.findFirst({
          where: { hotelId, module: "RESTAURANT", closedAt: null },
          orderBy: { openedAt: "desc" },
          select: { id: true },
        });
        shiftIdToSave = openShiftNow?.id || null;
      }
      let saleNumberToSave: string | null = null;
      let saleNumberIntToSave: number | null = null;
      if (shouldAssignSaleNumber) {
        const seq = await tx.hotelSequence.upsert({
          where: { hotelId_key: { hotelId, key: "restaurant_sale" } },
          create: { hotelId, key: "restaurant_sale", nextNumber: 2 },
          update: { nextNumber: { increment: 1 } },
          select: { nextNumber: true },
        });
        const assigned = Math.max(1, Number(seq.nextNumber) - 1);
        saleNumberIntToSave = assigned;
        saleNumberToSave = `v-${padNumber(assigned, 4)}`;
      }
      const updateData: Prisma.RestaurantOrderUpdateManyMutationInput = {
        status: "PAID",
        paymentBreakdown: payments || {},
        subtotal: subtotalToSave,
        tax: taxToSave,
        total: totalToSave,
        tip10: serviceToSave,
        currency: saleCurrency,
        paymentDetails:
          normalizedPaymentDetails.length > 0
            ? (normalizedPaymentDetails as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        note: note ?? order.note,
        serviceType: String(serviceType || order.serviceType || "DINE_IN"),
        roomId: roomTarget || order.roomId,
        cashierId: cashierIdToSave,
        shiftId: shiftIdToSave,
        closedByStaffId: closerStaffId,
        updatedAt: paidAt,
      };
      if (saleNumberToSave && saleNumberIntToSave) {
        updateData.saleNumber = saleNumberToSave;
        updateData.saleNumberInt = saleNumberIntToSave;
      }
      const written = await tx.restaurantOrder.updateMany({
        where: { id: order.id, hotelId },
        data: updateData,
      });
    if (written.count === 0) return null;

    if (roomChargeTarget && roomAmount > 0) {
      let roomInvoiceId = roomChargeTarget.invoiceId;
      if (!roomInvoiceId) {
        const createdInvoice = await tx.invoice.create({
          data: {
            reservationId: roomChargeTarget.stayId,
            guestId: roomChargeTarget.guestId || undefined,
            number: `INV-${new Date().toISOString().slice(0, 10)}-${roomChargeTarget.stayId.slice(0, 6)}`,
            status: "DRAFT",
            hotelId,
          },
          select: { id: true },
        });
        roomInvoiceId = createdInvoice.id;
      }
      const saleRef = saleNumberToSave || order.saleNumber || "";
      const concept = `Restaurante - Mesa ${fromInternalId(hotelId, order.tableId)}${saleRef ? ` (${saleRef})` : ""}`;
      const exists = await tx.invoiceItem.findFirst({
        where: { invoiceId: roomInvoiceId, description: concept },
        select: { id: true },
      });
      if (!exists) {
        await tx.invoiceItem.create({
          data: { invoiceId: roomInvoiceId, description: concept, unitPrice: roomAmount, total: roomAmount, quantity: 1, hotelId },
        });
      }
    }

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
        totals: { subtotal: subtotalToSave, tax: taxToSave, service: serviceToSave, total: totalToSave },
        payments: payments || {},
        note: note ?? updatedOrder.note ?? "",
        serviceType: String(serviceType || updatedOrder.serviceType || "DINE_IN"),
        roomId: roomTarget || updatedOrder.roomId || null,
        cashierId: cashierIdToSave,
      } as any,
    });

    // Consume inventory based on recipes (per sold item qty) when inventory is enabled.
    if (inventoryEnabled) {
      const inventory = await consumeInventoryForOrder(tx, hotelId, updatedOrder, user.sub);
      if (inventory.shortages.length > 0) {
        // El stock no se descuenta (ni parcialmente), pero la venta no se bloquea:
        // queda registrado el faltante para que se corrija el inventario.
        inventoryWarnings = inventory.shortages.map(
          (s) => `Inventario: ${s.label} requiere ${s.required} ${s.unit} y hay ${s.available}. No se descontó stock.`
        );
        await recordOrderEvent(tx, {
          hotelId,
          orderId: updatedOrder.id,
          eventType: "INVENTORY_SHORTAGE",
          actorId: user.sub,
          payload: { shortages: inventory.shortages } as any,
        });
      }
    }

    return updatedOrder;
      },
      { maxWait: 10_000, timeout: 20_000 }
    );
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2028") {
      return res.status(503).json({
        code: "CLOSE_ORDER_TIMEOUT",
        message: "No se pudo cerrar la orden por carga temporal. Reintenta en unos segundos.",
      });
    }
    throw err;
  }
  if (!updated) return res.status(404).json({ message: "Orden no encontrada" });

  let issuedDoc: { doc: any; created: boolean; skipped?: string } | null = null;
  try {
    const cfg = await getOrCreateRestaurantConfig(hotelId);
    const billing = cfg.billing && typeof cfg.billing === "object" ? (cfg.billing as any) : {};
    const autoFactura = billing?.autoFactura !== false;
    const requestedDocType = resolveBillingDocType((req.body as any)?.docType);
    const billingInvoiceDocType = resolveBillingDocType(billing?.invoiceComprobante);
    const billingTicketDocType = resolveBillingDocType(billing?.ticketComprobante ?? billing?.comprobante);
    const docTypeToIssue = (requestedDocType || billingInvoiceDocType || billingTicketDocType || "TE") as "FE" | "TE";
    if (autoFactura && docTypeToIssue) {
      // El comprobante se arma con XML y datos del cliente; si el hotel no puede
      // emitir, no se crea documento ni se consume consecutivo.
      issuedDoc = await issueRestaurantDoc({
        hotelId,
        order: updated,
        docType: docTypeToIssue,
        receiver: (req.body as any)?.receiver,
        actorId: user?.sub ?? null,
      });
    }
  } catch (err) {
    console.warn("[restaurant.closeOrder] auto-doc failed:", err);
  }
  res.json({
    ok: true,
    order: sanitizeOrder(updated, hotelId),
    warnings: inventoryWarnings,
    eInvoice: issuedDoc?.doc
      ? {
          id: issuedDoc.doc.id,
          docType: issuedDoc.doc.docType,
          consecutive: issuedDoc.doc.consecutive ?? null,
          created: issuedDoc.created,
        }
      : null,
    eInvoiceSkipped: issuedDoc?.skipped ?? null,
  });

  // Contabilidad: solo si NO hay facturación electrónica activa (evita doble contabilización)
  // Cuando FE está activa, la contabilidad se genera al ser aceptado el documento por Hacienda.
  const einvCfg = await prisma.eInvoicingConfig.findUnique({
    where: { hotelId },
    select: { enabled: true, settings: true },
  });
  const einvSettings = (einvCfg?.settings || {}) as any;
  const einvRestaurantEnabled = einvCfg?.enabled && (einvSettings?.moduleConnections?.restaurant !== false);
  const isContingency = ["3", "4", "5"].includes(String(einvSettings?.restaurant?.situation || "1"));

  if (!einvRestaurantEnabled || isContingency) {
    // Sin FE activa, o en contingencia: contabilidad directa desde restaurante
    onRestaurantSale({
      hotelId,
      orderId: updated.id,
      saleNumber: updated.saleNumber ?? null,
      total: Number(updated.total ?? 0),
      tax: Number(updated.tax ?? 0),
      service: Number(updated.tip10 ?? 0),
      currency: String(updated.currency || saleCurrency || "CRC"),
      paidAt: paidAt,
      actorId: user?.sub ?? null,
      payments: buildAccountingPayments(updated),
    }).catch((err) => {
      console.error("[restaurant.closeOrder] accounting entry failed:", err);
    });
  }
}

/**
 * Desglose de cobro de una orden en la forma que espera la contabilidad, para
 * debitar la cuenta ligada a cada forma de pago.
 */
function buildAccountingPayments(order: any): { key?: string | null; name?: string | null; amount: number }[] {
  const details = Array.isArray(order?.paymentDetails) ? order.paymentDetails : [];
  if (details.length > 0) {
    return details
      .map((d: any) => ({
        key: d?.key ? String(d.key) : null,
        name: d?.name ? String(d.name) : null,
        amount: asNumber(d?.amountBase ?? d?.amount),
      }))
      .filter((d: any) => d.amount > 0);
  }
  const breakdown = order?.paymentBreakdown && typeof order.paymentBreakdown === "object" ? order.paymentBreakdown : {};
  return Object.entries(breakdown as Record<string, unknown>)
    .map(([key, amount]) => ({ key, name: key, amount: asNumber(amount) }))
    .filter((p) => p.amount > 0);
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
      stock: i.inventoryControlled ? Number(i.stock || 0) : 0,
      minimo: Number(i.min || 0),
      min: Number(i.min || 0),
      costo: Number(i.cost || 0),
      cost: Number(i.cost || 0),
      taxRate: i.taxRate ? Number(i.taxRate) : null,
      proveedor: i.supplierName || null,
      supplierName: i.supplierName || null,
      active: i.active !== false,
      inventoryControlled: i.inventoryControlled !== false,
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
  const inventoryControlled = req.body?.inventoryControlled !== false;

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
      inventoryControlled,
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

  const { orderId, restaurantOrderId, tableId, reason, adminCode, adminUser } = req.body || {};
  const incomingOrderId = String(orderId || restaurantOrderId || "").trim();
  if (!incomingOrderId && !tableId) return res.status(400).json({ message: "orderId o tableId requerido" });

  const roleKey = String(user.role || "").toUpperCase();
  let allowed = roleKey === "ADMIN" || roleKey === "MANAGER";
  if (!allowed) {
    const hasCancelPerm = await prisma.rolePermission.findFirst({
      where: { hotelId, roleId: user.role, permissionId: { in: ["restaurant.orders.cancel", "restaurant.orders.close"] } },
      select: { permissionId: true },
    });
    allowed = Boolean(hasCancelPerm);
  }
  if (!allowed) {
    allowed = await requireAdminOrAdminCode(user, hotelId, adminCode);
  }
  if (allowed) {
    const staffAuthz = await authorizeStaffAction(req, user, ["restaurant.orders.cancel", "restaurant.orders.close"]);
    if (!staffAuthz.allowed) {
      allowed = await requireAdminOrAdminCode(user, hotelId, adminCode);
    }
  }
  if (!allowed) return res.status(401).json({ message: "Admin PIN requerido" });

  const where: any = { hotelId, status: { in: OPEN_ORDER_STATUSES } };
  if (incomingOrderId) where.id = String(incomingOrderId);
  if (tableId) where.tableId = { in: [toInternalId(hotelId, String(tableId)), String(tableId)] };

  const order = await prisma.restaurantOrder.findFirst({
    where,
    orderBy: { updatedAt: "desc" },
    select: { id: true, note: true, updatedAt: true, items: { select: { id: true, name: true, qty: true, status: true, area: true, detailNote: true } } },
  });
  if (!order) return res.status(404).json({ message: "Orden abierta no encontrada" });

  const lastClose = await prisma.restaurantClose.findFirst({
    where: { hotelId, stage: "Z" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (lastClose?.createdAt && order.updatedAt <= lastClose.createdAt) {
    return res.status(403).json({ message: "No se puede anular una orden despu?s del cierre Z" });
  }

  const cancelReason = String(reason || "").trim();
  const cancelAdminUserStr = String(adminUser || "").trim();
  const nextNote = cancelReason ? `${order.note || ""}\n[CANCELED] ${cancelReason}`.trim() : order.note || "";
  const canceledAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.restaurantOrder.updateMany({
      where: { id: order.id, hotelId, status: { in: OPEN_ORDER_STATUSES } },
      data: {
        status: "CANCELED",
        note: nextNote,
        canceledAt,
        canceledBy: user.sub,
        cancelAdminUser: cancelAdminUserStr || null,
        cancelReason: cancelReason || null,
      },
    });
    await tx.restaurantOrderItem.updateMany({
      where: { orderId: order.id, hotelId, status: { notIn: ["SERVED", "VOIDED"] } },
      data: { status: "VOIDED" },
    });
    await recordOrderEvent(tx, {
      hotelId,
      orderId: order.id,
      eventType: "ORDER_VOID",
      actorId: user.sub,
      payload: { reason: cancelReason, adminUser: cancelAdminUserStr, note: nextNote } as any,
    });
  });

  return res.json({ ok: true, id: order.id, items: order.items });
}

/**
 * Anulación de una venta ya cobrada (devolución).
 *
 * Revierte la venta completa: marca la orden CANCELED, devuelve el inventario
 * consumido por recetas, quita el cargo a habitación y genera la reversa
 * contable. El comprobante electrónico se anula aparte (con Nota de Crédito
 * cuando corresponde), por eso la respuesta avisa si queda un documento activo.
 */
export async function voidPaidRestaurantOrder(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const { orderId, restaurantOrderId, reason, adminCode, adminUser } = req.body || {};
  const targetId = String(orderId || restaurantOrderId || "").trim();
  if (!targetId) return res.status(400).json({ message: "orderId requerido" });

  const roleKey = String(user.role || "").toUpperCase();
  let allowed = roleKey === "ADMIN" || roleKey === "MANAGER";
  if (!allowed) {
    const hasPerm = await prisma.rolePermission.findFirst({
      where: { hotelId, roleId: user.role, permissionId: { in: ["restaurant.orders.cancel", "restaurant.orders.close"] } },
      select: { permissionId: true },
    });
    allowed = Boolean(hasPerm) || (await requireAdminOrAdminCode(user, hotelId, adminCode));
  }
  if (!allowed) return res.status(401).json({ message: "Admin PIN requerido" });

  const order = await prisma.restaurantOrder.findFirst({
    where: { id: targetId, hotelId },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ message: "Venta no encontrada" });
  if (order.status === "CANCELED") {
    return res.status(409).json({ message: "Esta venta ya fue anulada.", canceledAt: order.canceledAt });
  }
  if (order.status !== "PAID") {
    return res.status(400).json({ message: "Solo se pueden anular ventas cobradas. Para una orden abierta usá Anular orden." });
  }

  const lastZ = await prisma.restaurantClose.findFirst({
    where: { hotelId, stage: "Z" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (lastZ?.createdAt && order.updatedAt <= lastZ.createdAt) {
    return res.status(403).json({ message: "No se puede anular una venta anterior al último cierre Z." });
  }

  const activeDoc = await prisma.eInvoicingDocument.findFirst({
    where: { hotelId, restaurantOrderId: order.id, status: { notIn: ["CANCELED"] } },
    select: { id: true, docType: true, status: true },
  });

  const cfg = await getOrCreateRestaurantConfig(hotelId);
  const inventoryEnabled =
    cfg?.general && typeof cfg.general === "object" ? (cfg.general as any).inventoryEnabled !== false : true;

  const cancelReason = String(reason || "").trim();
  const cancelAdminUserStr = String(adminUser || "").trim();
  const canceledAt = new Date();
  const nextNote = cancelReason ? `${order.note || ""}\n[ANULADA] ${cancelReason}`.trim() : order.note || "";

  const inventoryRestored: Array<{ itemId: string; qty: number }> = [];

  await prisma.$transaction(
    async (tx) => {
      const written = await tx.restaurantOrder.updateMany({
        where: { id: order.id, hotelId, status: "PAID" },
        data: {
          status: "CANCELED",
          note: nextNote,
          canceledAt,
          canceledBy: user.sub,
          cancelAdminUser: cancelAdminUserStr || null,
          cancelReason: cancelReason || null,
        },
      });
      if (written.count === 0) {
        throw new Error("La venta cambió de estado mientras se anulaba. Reintenta.");
      }

      await tx.restaurantOrderItem.updateMany({
        where: { orderId: order.id, hotelId },
        data: { status: "VOIDED" },
      });

      // Devolver el inventario consumido por recetas (una sola vez por venta).
      if (inventoryEnabled) {
        const consumed = await tx.restaurantInventoryMovement.findMany({
          where: { hotelId, refType: "RESTAURANT_ORDER", refId: order.id },
          select: { itemId: true, qtyDelta: true },
        });
        const alreadyRestored = await tx.restaurantInventoryMovement.count({
          where: { hotelId, refType: "RESTAURANT_ORDER_VOID", refId: order.id },
        });
        if (consumed.length > 0 && alreadyRestored === 0) {
          const perItem = new Map<string, number>();
          for (const m of consumed) {
            const qty = Math.abs(asNumber(m.qtyDelta));
            if (qty <= 0) continue;
            perItem.set(m.itemId, (perItem.get(m.itemId) || 0) + qty);
          }
          for (const [itemId, qty] of perItem) {
            const restored = await tx.restaurantInventoryItem.updateMany({
              where: { id: itemId, hotelId },
              data: { stock: { increment: qty } },
            });
            if (restored.count === 0) continue;
            await tx.restaurantInventoryMovement.create({
              data: {
                hotelId,
                itemId,
                qtyDelta: qty,
                reason: `Devolución por anulación de venta ${order.saleNumber || order.id}`,
                refType: "RESTAURANT_ORDER_VOID",
                refId: order.id,
                createdBy: user.sub,
              },
            });
            inventoryRestored.push({ itemId, qty });
          }
        }
      }

      // Quitar el cargo a habitación asociado a esta venta.
      if (order.roomId && order.saleNumber) {
        await tx.invoiceItem.deleteMany({
          where: { hotelId, description: { contains: order.saleNumber } },
        });
      }

      await recordOrderEvent(tx, {
        hotelId,
        orderId: order.id,
        eventType: "ORDER_VOID_PAID",
        actorId: user.sub,
        payload: {
          reason: cancelReason,
          adminUser: cancelAdminUserStr,
          saleNumber: order.saleNumber,
          total: asNumber(order.total),
          inventoryRestored: inventoryRestored.length,
          eInvoiceActive: activeDoc ? { id: activeDoc.id, docType: activeDoc.docType, status: activeDoc.status } : null,
        } as any,
      });
    },
    { maxWait: 10_000, timeout: 20_000 }
  );

  // Reversa contable (si el hotel tiene la integración activa).
  try {
    await onRestaurantSaleVoid({
      hotelId,
      orderId: order.id,
      saleNumber: order.saleNumber ?? null,
      total: asNumber(order.total),
      tax: asNumber(order.tax),
      service: asNumber(order.tip10),
      currency: String(order.currency || "CRC"),
      actorId: user.sub ?? null,
      payments: buildAccountingPayments(order),
    });
  } catch (err) {
    console.error("[restaurant.voidPaidOrder] reversa contable falló:", err);
  }

  const updated = await prisma.restaurantOrder.findFirst({ where: { id: order.id, hotelId } });
  return res.json({
    ok: true,
    order: sanitizeOrder(updated, hotelId),
    inventoryRestored,
    eInvoicePending: activeDoc
      ? {
          id: activeDoc.id,
          docType: activeDoc.docType,
          status: activeDoc.status,
          message: "La venta se anuló, pero el comprobante electrónico sigue activo. Anulalo desde el histórico para emitir la Nota de Crédito.",
        }
      : null,
  });
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
  const billing: any = cfg?.billing && typeof cfg.billing === "object" ? (cfg.billing as any) : {};
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
    const lastJob = await tx.restaurantPrintJob.findFirst({
      where: { hotelId, orderId: order.id },
      orderBy: { createdAt: "desc" },
    });
    const docType = lastJob?.docType || "TE";
    const formId = lastJob?.formId || null;
    const header =
      typeof lastJob?.header === "string"
        ? lastJob.header
        : docType === "TE"
          ? String(billing?.ticketHeader || "")
          : docType === "FE"
            ? String(billing?.invoiceHeader || "")
            : "";
    const footer =
      typeof lastJob?.footer === "string"
        ? lastJob.footer
        : docType === "TE"
          ? String(billing?.ticketFooter || "")
          : docType === "FE"
            ? String(billing?.invoiceFooter || "")
            : "";
    const created = await tx.restaurantPrintJob.create({
      data: {
        hotelId,
        orderId: order.id,
        sectionId: order.sectionId,
        tableId: order.tableId,
        items,
        note: order.note || "",
        covers: order.covers || 0,
        kitchenPrinter: cfg?.kitchenPrinter || null,
        barPrinter: cfg?.barPrinter || null,
        docType,
        formId,
        header,
        footer,
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

  res.json({ ok: true, job: sanitizePrintJob(job, user.hotelId) });
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
    where: { hotelId, stage: "Z" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const orderPaidAt = order?.updatedAt || doc.createdAt;
  if (lastClose?.createdAt && orderPaidAt <= lastClose.createdAt) {
    return res.status(403).json({ message: "No se puede anular un documento despu?s del cierre Z" });
  }


  if (doc.status !== "CANCELED") {
    // Documentos ACCEPTED en modo ATV API: cancelación legal mediante NC
    let ncDoc: any = null;
    if (doc.status === "ACCEPTED" && (doc.docType === "FE" || doc.docType === "TE")) {
      const einvCfg = await prisma.eInvoicingConfig.findUnique({
        where: { hotelId },
        select: { enabled: true, settings: true },
      });
      const einvSettings = (einvCfg?.settings || {}) as any;
      const atvMode = String(einvSettings?.atv?.mode || "manual").toLowerCase();

      if (atvMode === "api" && einvCfg?.enabled) {
        try {
          ncDoc = await createCreditDebitNote({
            hotelId,
            actorId: user.sub,
            referenceDocId: doc.id,
            docType: "NC",
            reason: String(reason || "Anulación desde el POS de Restaurante"),
            reasonCode: "01",
          });

          // Enviar la NC a Hacienda automáticamente
          try {
            await submitDocumentToHacienda({ hotelId, actorId: user.sub, documentId: ncDoc.id });
          } catch (submitErr) {
            console.warn("[voidRestaurantInvoice] NC creada pero no se pudo enviar a Hacienda:", submitErr);
            // Continuamos para marcar el original como cancelado; la NC queda en DRAFT/SIGNED para reenvío manual.
          }
        } catch (err) {
          if (err instanceof NoteCreationError) {
            return res.status(err.statusCode).json({
              message: "No se pudo emitir la Nota de Crédito de anulación",
              detail: err.message,
            });
          }
          return res.status(502).json({
            message: "No se pudo emitir la Nota de Crédito de anulación",
            detail: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    await prisma.eInvoicingDocument.updateMany({
      where: { id: doc.id, hotelId },
      data: {
        status: "CANCELED",
        response: {
          ...(doc.response && typeof doc.response === "object" ? (doc.response as any) : {}),
          canceledAt: new Date().toISOString(),
          canceledBy: user.sub,
          reason: String(reason || ""),
          ...(ncDoc ? { ncDocId: ncDoc.id, ncConsecutive: ncDoc.consecutive } : {}),
        } as any,
      },
    });

    await prisma.eInvoicingAcknowledgement.create({
      data: {
        hotelId,
        documentId: doc.id,
        type: "OTHER",
        status: "RECEIVED",
        message: ncDoc
          ? `Cancelado mediante NC ${ncDoc.consecutive || ""}`
          : String(reason || "Anulado desde el POS de Restaurante"),
        payload: {
          canceledAt: new Date().toISOString(),
          canceledBy: user.sub,
          ...(ncDoc ? { ncDocId: ncDoc.id, ncKey: ncDoc.key } : {}),
        } as any,
      },
    });
  }

  const updated = await prisma.eInvoicingDocument.findFirst({
    where: { id: doc.id, hotelId },
  });

  res.json({ ok: true, document: sanitizeEInvoicingDoc(updated || doc) });
}

export async function getRestaurantConfig(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const cfg = await prisma.restaurantConfig.findUnique({ where: { hotelId: user.hotelId } });
  res.json(sanitizeConfig(cfg) || {
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
  res.json(sanitizeConfig(cfg));
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
  res.json(publicPayments(stored));
}

/**
 * Configuración de pagos sin secretos. El token del BCCR nunca sale de la API:
 * la pantalla sólo sabe si está puesto.
 */
function publicPayments(stored: any) {
  const cobros = Array.isArray(stored?.cobros)
    ? stored.cobros
    : typeof stored?.cobros === "string"
      ? String(stored.cobros)
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : ["Efectivo", "Tarjeta"];
  const { bccrToken, ...safe } = stored || {};
  return {
    ...safe,
    monedaBase: String(stored?.monedaBase || "CRC"),
    monedaSec: String(stored?.monedaSec || "USD"),
    tipoCambio: asNumber(stored?.tipoCambio || 530),
    tipoCambioCompra: asNumber(stored?.tipoCambioCompra || stored?.tipoCambio || 530),
    tipoCambioVenta: asNumber(stored?.tipoCambioVenta || stored?.tipoCambio || 530),
    cobros,
    cargoHabitacion: typeof stored?.cargoHabitacion === "boolean" ? stored.cargoHabitacion : true,
    paymentMethods: normalizePaymentMethods(stored?.paymentMethods),
    accountingEnabled: Boolean(stored?.accountingEnabled),
    useBCCR: stored?.useBCCR === true,
    bccrEmail: String(stored?.bccrEmail || ""),
    bccrTokenSet: Boolean(bccrToken),
    bccrLastSync: stored?.bccrLastSync ?? null,
  };
}

/** Normaliza la lista de métodos de cobro conservando cuenta contable y código de Hacienda. */
function normalizePaymentMethods(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const list: Array<{ id: string; name: string; enabled: boolean; account: string; haciendaCode: string }> = [];
  for (const entry of raw) {
    const name = String((entry as any)?.name ?? (entry as any)?.id ?? "").trim();
    if (!name) continue;
    const id = String((entry as any)?.id || name).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    list.push({
      id,
      name,
      enabled: (entry as any)?.enabled !== false,
      account: String((entry as any)?.account ?? "").trim(),
      haciendaCode: resolveHaciendaPaymentCode({
        key: id,
        name,
        explicitCode: (entry as any)?.haciendaCode,
      }),
    });
  }
  return list;
}

export async function updateRestaurantPayments(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const cfg = await getOrCreateRestaurantConfig(user.hotelId);
  const stored = (cfg.payments && typeof cfg.payments === "object" ? cfg.payments : {}) as any;

  // Se parte de lo guardado para no borrar configuración que no venga en el body
  // (métodos de cobro, cuenta contable, contabilidad habilitada).
  const next: any = { ...stored };

  if ((body as any).monedaBase !== undefined) {
    next.monedaBase = String((body as any).monedaBase || "").trim() || "CRC";
  }
  if ((body as any).monedaSec !== undefined) {
    next.monedaSec = String((body as any).monedaSec || "").trim() || "USD";
  }
  if ((body as any).tipoCambio !== undefined) {
    const rate = asNumber((body as any).tipoCambio);
    if (!(rate > 0)) return res.status(400).json({ message: "El tipo de cambio debe ser mayor que cero." });
    next.tipoCambio = rate;
  }
  if ((body as any).tipoCambioCompra !== undefined) {
    const rate = asNumber((body as any).tipoCambioCompra);
    if (!(rate > 0)) return res.status(400).json({ message: "El tipo de cambio de compra debe ser mayor que cero." });
    next.tipoCambioCompra = rate;
  }
  if ((body as any).tipoCambioVenta !== undefined) {
    const rate = asNumber((body as any).tipoCambioVenta);
    if (!(rate > 0)) return res.status(400).json({ message: "El tipo de cambio de venta debe ser mayor que cero." });
    next.tipoCambioVenta = rate;
  }
  if ((body as any).cobros !== undefined) {
    next.cobros = Array.isArray((body as any).cobros)
      ? (body as any).cobros.map((c: unknown) => String(c || "").trim()).filter(Boolean)
      : String((body as any).cobros)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
  }
  if ((body as any).cargoHabitacion !== undefined) {
    next.cargoHabitacion = Boolean((body as any).cargoHabitacion);
  }
  if ((body as any).accountingEnabled !== undefined) {
    next.accountingEnabled = Boolean((body as any).accountingEnabled);
  }
  if ((body as any).useBCCR !== undefined) {
    next.useBCCR = Boolean((body as any).useBCCR);
  }
  if ((body as any).bccrEmail !== undefined) {
    next.bccrEmail = String((body as any).bccrEmail || "").trim();
  }
  // El token sólo se reemplaza cuando llega uno nuevo: la pantalla nunca lo
  // recibe de vuelta, así que un campo vacío significa "dejar el que está".
  if ((body as any).bccrToken !== undefined) {
    const incomingToken = String((body as any).bccrToken || "").trim();
    if (incomingToken) next.bccrToken = incomingToken;
  }
  if ((body as any).clearBccrToken === true) {
    delete next.bccrToken;
  }
  if ((body as any).paymentMethods !== undefined) {
    next.paymentMethods = normalizePaymentMethods((body as any).paymentMethods);
  }
  if (next.monedaBase === undefined) next.monedaBase = "CRC";
  if (next.monedaSec === undefined) next.monedaSec = "USD";
  if (next.tipoCambio === undefined) next.tipoCambio = 530;
  if (next.tipoCambioCompra === undefined) next.tipoCambioCompra = next.tipoCambio;
  if (next.tipoCambioVenta === undefined) next.tipoCambioVenta = next.tipoCambio;
  if (next.cobros === undefined) next.cobros = [];
  if (next.cargoHabitacion === undefined) next.cargoHabitacion = true;

  const saved = await prisma.restaurantConfig.upsert({
    where: { hotelId: user.hotelId },
    update: { payments: next as any },
    create: { hotelId: user.hotelId, kitchenPrinter: "", barPrinter: "", payments: next as any },
  });
  res.json(publicPayments(saved.payments));
}

/**
 * POST /restaurant/payments/bccr-sync
 * Pide al Banco Central el tipo de cambio de referencia y lo guarda como TC de
 * compra y de venta. Sin correo y token registrados no hay nada que consultar.
 */
export async function syncRestaurantBccrRate(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const cfg = await getOrCreateRestaurantConfig(user.hotelId);
  const stored = (cfg.payments && typeof cfg.payments === "object" ? cfg.payments : {}) as any;
  // Se aceptan el correo y el token del cuerpo para poder actualizar sin guardar
  // primero; si no vienen, se usan los que ya están configurados.
  const email = String((req.body as any)?.bccrEmail ?? stored.bccrEmail ?? "").trim();
  const incomingToken = String((req.body as any)?.bccrToken ?? "").trim();
  const token = incomingToken || String(stored.bccrToken || "").trim();
  if (!email || !token) {
    return res.status(400).json({
      message: "Falta el correo y el token del BCCR. Se obtienen gratis en el registro de Indicadores económicos del Banco Central.",
    });
  }

  let rate;
  try {
    rate = await fetchBccrExchangeRate(email, token);
  } catch (err: any) {
    return res.status(502).json({ message: err?.message || "No se pudo consultar el BCCR." });
  }

  const next = {
    ...stored,
    bccrEmail: email,
    bccrToken: token,
    tipoCambioCompra: rate.buy,
    tipoCambioVenta: rate.sell,
    tipoCambio: rate.buy,
    bccrLastSync: new Date().toISOString(),
  };
  const saved = await prisma.restaurantConfig.update({
    where: { hotelId: user.hotelId },
    data: { payments: next as any },
  });
  res.json({ ...publicPayments(saved.payments), rate: { buy: rate.buy, sell: rate.sell, date: rate.date } });
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

export async function listRestaurantPrintForms(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const forms = DEFAULT_PRINT_FORMS.filter((f) => String(f?.module || "").toLowerCase() === "restaurant");
  res.json({ forms });
}

export async function printRestaurantOrder(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const { sectionId, tableId, items, note, covers, printers, fromTableId, type, orderId } = req.body || {};

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
  const billing: any = cfg?.billing && typeof cfg.billing === "object" ? (cfg.billing as any) : {};
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
  const docType =
    printingTypeKey === "comanda"
      ? "COMANDA"
      : printingTypeKey === "ticket"
        ? "TE"
        : printingTypeKey === "electronicInvoice"
          ? "FE"
          : printingTypeKey === "closes"
            ? "CLOSES"
            : printingTypeKey === "document"
              ? "DOCUMENT"
              : null;
  const formId = typeCfg?.formId ? String(typeCfg.formId) : null;
  const header =
    docType === "TE"
      ? String(billing?.ticketHeader || "")
      : docType === "FE"
        ? String(billing?.invoiceHeader || "")
        : "";
  const footer =
    docType === "TE"
      ? String(billing?.ticketFooter || "")
      : docType === "FE"
        ? String(billing?.invoiceFooter || "")
        : "";
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
      orderId: orderId ? String(orderId) : null,
      sectionId: internalSectionId,
      tableId: internalTableId,
      type: normalizedType,
      docType,
      formId,
      header,
      footer,
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

  res.json({ ok: true, job: sanitizePrintJob(job, user.hotelId) });
}

export async function getRestaurantStats(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });
  const hotelId = user.hotelId;

  // Punto de corte: turno abierto actual, o último cierre Z definitivo.
  const openShift = await prisma.cashAudit.findFirst({
    where: { hotelId, module: "RESTAURANT", closedAt: null },
    orderBy: { openedAt: "desc" },
  });

  let cutoff: Date | null = openShift?.openedAt ?? null;
  if (!cutoff) {
    const lastZ = await prisma.restaurantClose.findFirst({
      where: { hotelId, stage: "Z" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    cutoff = lastZ?.createdAt ?? null;
  }

  const openOrders = await prisma.restaurantOrder.findMany({
    where: { hotelId, status: "OPEN" },
    select: { total: true },
  });
  const openOrderValue = openOrders.reduce((acc, o) => acc + asNumber(o.total), 0);

  const paidWhere: any = { hotelId, status: "PAID" };
  if (openShift?.id) {
    // Turno abierto: las ventas se toman por shiftId, con respaldo por fecha
    // para las ventas anteriores que no tenían turno asignado.
    paidWhere.OR = [{ shiftId: openShift.id }, { shiftId: null, updatedAt: { gte: cutoff } }];
  } else if (cutoff) {
    paidWhere.updatedAt = { gte: cutoff };
  }

  const paidOrders = await prisma.restaurantOrder.findMany({
    where: paidWhere,
    select: { total: true, subtotal: true, tax: true, tip10: true, paymentBreakdown: true },
  });

  const systemTotal = paidOrders.reduce((acc, o) => acc + asNumber(o.total), 0);
  const systemSubtotal = paidOrders.reduce((acc, o) => acc + asNumber(o.subtotal), 0);
  const systemTax = paidOrders.reduce((acc, o) => acc + asNumber(o.tax), 0);
  const systemService = paidOrders.reduce((acc, o) => acc + asNumber(o.tip10), 0);
  const byMethod: Record<string, number> = {};
  for (const o of paidOrders) {
    const pb = (o.paymentBreakdown && typeof o.paymentBreakdown === "object" ? o.paymentBreakdown : {}) as any;
    for (const k of Object.keys(pb || {})) {
      byMethod[k] = (byMethod[k] || 0) + asNumber(pb[k]);
    }
  }
  const split = splitCashMethods(byMethod);

  res.json({
    systemTotal,
    systemSubtotal,
    systemTax,
    systemService,
    systemCash: split.cashTotal,
    systemNonCash: split.nonCashTotal,
    openOrders: openOrders.length,
    salesCount: paidOrders.length,
    openOrderValue,
    lastCloseAt: cutoff,
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
      // Anulados y servidos ya no se preparan: no deben aparecer en cocina/bar.
      status: { notIn: ["SERVED", "VOIDED"] },
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

  res.json({ ok: true, item: sanitizeOrderItem(updated) });
}

export async function updateInventoryItem(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const id = String((req.params as any)?.id || "");
  if (!id) return res.status(400).json({ message: "id requerido" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const current = await prisma.restaurantInventoryItem.findFirst({
    where: { id, hotelId },
    select: { id: true, stock: true },
  });
  if (!current) return res.status(404).json({ message: "Inventario no encontrado" });

  const data: any = {};
  if (typeof body.inventoryControlled === "boolean") data.inventoryControlled = body.inventoryControlled;

  const stockRaw = body.stock ?? body.stockActual;
  if (stockRaw !== undefined && stockRaw !== null && stockRaw !== "") {
    const stock = Number(stockRaw);
    if (!Number.isFinite(stock) || stock < 0) {
      return res.status(400).json({ message: "El stock debe ser un número mayor o igual a 0." });
    }
    data.stock = stock;
  }

  const minRaw = body.minimo ?? body.min;
  if (minRaw !== undefined && minRaw !== null && minRaw !== "") {
    const min = Number(minRaw);
    if (!Number.isFinite(min) || min < 0) {
      return res.status(400).json({ message: "El mínimo debe ser un número mayor o igual a 0." });
    }
    data.min = min;
  }

  const costRaw = body.costo ?? body.cost;
  if (costRaw !== undefined && costRaw !== null && costRaw !== "") {
    const cost = Number(costRaw);
    if (!Number.isFinite(cost) || cost < 0) {
      return res.status(400).json({ message: "El costo debe ser un número mayor o igual a 0." });
    }
    data.cost = cost;
  }

  if (body.supplierName !== undefined || body.proveedor !== undefined) {
    data.supplierName = String(body.supplierName ?? body.proveedor ?? "").trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "Nada que actualizar." });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const written = await tx.restaurantInventoryItem.updateMany({
      where: { id, hotelId },
      data,
    });
    if (written.count === 0) return null;
    if (data.stock !== undefined) {
      const delta = Number(data.stock) - Number(current.stock || 0);
      if (delta !== 0) {
        await tx.restaurantInventoryMovement.create({
          data: {
            hotelId,
            itemId: id,
            qtyDelta: delta,
            reason: "Ajuste manual de inventario",
            refType: "INVENTORY_ADJUST",
            refId: id,
            createdBy: user.sub,
          },
        });
      }
    }
    return tx.restaurantInventoryItem.findFirst({ where: { id, hotelId } });
  });

  if (!updated) return res.status(404).json({ message: "Inventario no encontrado" });
  return res.json({ ok: true, item: updated });
}

const WASTE_REASONS = ["MERMA", "QUEMA", "VENCIDO", "ROBO", "OTRO"] as const;

/**
 * Merma / quema de inventario: descuenta stock con un movimiento auditables.
 * Es la salida de producto que no pasa por una venta (se quemó, venció, se perdió).
 */
export async function registerInventoryWaste(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const itemId = String(req.body?.itemId || req.body?.id || "").trim();
  const qty = Number(req.body?.qty ?? req.body?.quantity ?? 0);
  const reasonRaw = String(req.body?.reason || req.body?.motivo || "MERMA").trim().toUpperCase();
  const reason = (WASTE_REASONS as readonly string[]).includes(reasonRaw) ? reasonRaw : "OTRO";
  const note = String(req.body?.note || req.body?.nota || "").trim();

  if (!itemId) return res.status(400).json({ message: "itemId requerido" });
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ message: "La cantidad debe ser mayor que cero." });
  }

  const item = await prisma.restaurantInventoryItem.findFirst({
    where: { id: itemId, hotelId },
    select: { id: true, desc: true, unit: true, stock: true, inventoryControlled: true },
  });
  if (!item) return res.status(404).json({ message: "Insumo no encontrado" });
  if (item.inventoryControlled === false) {
    return res.status(400).json({ message: "Este insumo no controla inventario." });
  }

  const available = asNumber(item.stock);
  if (qty > available) {
    return res.status(400).json({
      message: `No hay stock suficiente: hay ${available} ${item.unit} de ${item.desc}.`,
      available,
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const written = await tx.restaurantInventoryItem.updateMany({
      where: { id: item.id, hotelId, stock: { gte: qty } },
      data: { stock: { decrement: qty } },
    });
    if (written.count === 0) {
      throw new Error("El stock cambió mientras se registraba la merma. Reintenta.");
    }
    await tx.restaurantInventoryMovement.create({
      data: {
        hotelId,
        itemId: item.id,
        qtyDelta: -qty,
        reason: `Merma ${reason}${note ? `: ${note}` : ""}`,
        refType: "INVENTORY_WASTE",
        refId: item.id,
        createdBy: user.sub,
      },
    });
    return tx.restaurantInventoryItem.findFirst({ where: { id: item.id, hotelId } });
  });

  return res.json({ ok: true, item: updated, wasted: qty, reason });
}

/** Movimientos de inventario (consumo, ajustes, mermas) para auditar. */
export async function listInventoryMovements(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const itemId = String((req.query as any)?.itemId || "").trim();
  const refType = String((req.query as any)?.refType || "").trim();
  const rawLimit = Number((req.query as any)?.limit ?? 100);
  const limit = Math.min(500, Math.max(1, Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 100));

  const list = await prisma.restaurantInventoryMovement.findMany({
    where: {
      hotelId: user.hotelId,
      ...(itemId ? { itemId } : {}),
      ...(refType ? { refType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const itemIds = Array.from(new Set(list.map((m) => m.itemId)));
  const items = itemIds.length
    ? await prisma.restaurantInventoryItem.findMany({
        where: { hotelId: user.hotelId, id: { in: itemIds } },
        select: { id: true, desc: true, sku: true, unit: true },
      })
    : [];
  const byId = new Map(items.map((i) => [i.id, i]));

  res.json(
    list.map((m) => ({
      id: m.id,
      itemId: m.itemId,
      item: byId.get(m.itemId) ? `${byId.get(m.itemId)!.sku} ${byId.get(m.itemId)!.desc}` : m.itemId,
      unit: byId.get(m.itemId)?.unit ?? "",
      qtyDelta: Number(m.qtyDelta),
      reason: m.reason,
      refType: m.refType,
      refId: m.refId,
      createdAt: m.createdAt,
      createdBy: m.createdBy,
    }))
  );
}

const toStaffPayload = (staff: any) => ({
  id: staff.id,
  name: staff.name,
  username: staff.username,
  role: staff.role,
  accessRoleId: staff.accessRoleId || "",
  accessRoleName: staff.accessRole?.name || "",
  launcherId: staff.launcherId || "",
  launcherName: staff.launcher?.name || "",
  launcherUserId: staff.launcher?.userId || staff.launcher?.username || "",
  active: staff.active !== false,
  createdAt: staff.createdAt,
  updatedAt: staff.updatedAt,
});

export async function listRestaurantStaff(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const staff = await prisma.restaurantStaff.findMany({
    where: { hotelId: user.hotelId },
    include: {
      launcher: { select: { id: true, username: true, name: true, roleId: true } },
      accessRole: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(staff.map(toStaffPayload));
}

export async function listRestaurantStaffRoles(_req: Request, res: Response) {
  // Return management-created access roles for assignment.
  // @ts-ignore
  const user = _req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const roles = await prisma.appRole.findMany({
    where: { hotelId: user.hotelId },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });
  res.json(roles.map(sanitizeRole));
}

export async function createRestaurantStaff(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const name = String(req.body?.name || "").trim();
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "").trim();
  const roleRaw = String(req.body?.role || "WAITER").trim().toUpperCase();
  const accessRoleId = String(req.body?.accessRoleId || "").trim() || null;
  const launcherId = String(req.body?.launcherId || "").trim() || null;
  const active = req.body?.active !== false;

  if (!name || !username || !password) {
    return res.status(400).json({ message: "Nombre, usuario y password son requeridos." });
  }
  if (roleRaw !== "CASHIER" && roleRaw !== "WAITER") {
    return res.status(400).json({ message: "Rol inválido: debe ser CASHIER o WAITER." });
  }
  const role = roleRaw as RestaurantStaffRole;
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return res.status(400).json({ message: "El usuario debe tener 3-32 caracteres: letras, números, punto, guion o guion bajo." });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "El password debe tener al menos 6 caracteres." });
  }
  if (accessRoleId) {
    const accessRole = await prisma.appRole.findFirst({
      where: { id: accessRoleId, hotelId: user.hotelId },
      select: { id: true },
    });
    if (!accessRole) return res.status(404).json({ message: "Perfil de permisos no encontrado" });
  }

  const exists = await prisma.restaurantStaff.findUnique({
    where: { hotelId_username: { hotelId: user.hotelId, username } },
    select: { id: true },
  });
  if (exists) return res.status(409).json({ message: "El usuario ya existe." });

  const passwordHash = await bcrypt.hash(password, ROUNDS);
  let resolvedAccessRoleId = accessRoleId;
  let resolvedLauncherId = launcherId;
  if (launcherId) {
    const launcher = await prisma.launcherAccount.findFirst({
      where: { id: launcherId, hotelId: user.hotelId },
      select: { id: true, roleId: true },
    });
    if (!launcher) return res.status(404).json({ message: "Perfil de launcher no encontrado" });
    resolvedLauncherId = launcher.id;
    if (!resolvedAccessRoleId) resolvedAccessRoleId = launcher.roleId || null;
  }

  const created = await prisma.restaurantStaff.create({
    data: {
      hotelId: user.hotelId,
      name,
      username,
      role,
      accessRoleId: resolvedAccessRoleId,
      launcherId: resolvedLauncherId,
      active,
      passwordHash,
    },
  });
  const staff = await prisma.restaurantStaff.findFirst({
    where: { id: created.id, hotelId: user.hotelId },
    include: {
      launcher: { select: { id: true, username: true, name: true, roleId: true } },
      accessRole: { select: { id: true, name: true } },
    },
  });
  res.json(toStaffPayload(staff));
}

export async function updateRestaurantStaff(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const id = String(req.params?.id || "").trim();
  if (!id) return res.status(400).json({ message: "id requerido" });

  const data: any = {};
  if (req.body?.name != null) {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "El nombre no puede estar vacío." });
    data.name = name;
  }
  if (req.body?.username != null) {
    const username = String(req.body.username || "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return res.status(400).json({ message: "El usuario debe tener 3-32 caracteres: letras, números, punto, guion o guion bajo." });
    }
    const duplicate = await prisma.restaurantStaff.findFirst({
      where: { hotelId: user.hotelId, username, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) return res.status(409).json({ message: "El usuario ya existe." });
    data.username = username;
  }
  if (req.body?.role != null) {
    const roleRaw = String(req.body.role || "").trim().toUpperCase();
    if (roleRaw !== "CASHIER" && roleRaw !== "WAITER") {
      return res.status(400).json({ message: "Rol inválido: debe ser CASHIER o WAITER." });
    }
    data.role = roleRaw;
  }
  if (req.body?.accessRoleId !== undefined) {
    const accessRoleId = String(req.body.accessRoleId || "").trim() || null;
    if (accessRoleId) {
      const accessRole = await prisma.appRole.findFirst({
        where: { id: accessRoleId, hotelId: user.hotelId },
        select: { id: true },
      });
      if (!accessRole) return res.status(404).json({ message: "Perfil de permisos no encontrado" });
    }
    data.accessRoleId = accessRoleId;
  }
  if (req.body?.launcherId !== undefined) {
    const launcherId = String(req.body.launcherId || "").trim() || null;
    if (launcherId) {
      const launcher = await prisma.launcherAccount.findFirst({
        where: { id: launcherId, hotelId: user.hotelId },
        select: { id: true, roleId: true },
      });
      if (!launcher) return res.status(404).json({ message: "Perfil de launcher no encontrado" });
      data.launcherId = launcher.id;
      if (!data.accessRoleId && req.body?.accessRoleId === undefined) data.accessRoleId = launcher.roleId || null;
    } else {
      data.launcherId = null;
    }
  }
  if (req.body?.active !== undefined) data.active = req.body.active !== false;
  if (req.body?.password) {
    const password = String(req.body.password).trim();
    if (password.length < 6) {
      return res.status(400).json({ message: "El password debe tener al menos 6 caracteres." });
    }
    data.passwordHash = await bcrypt.hash(password, ROUNDS);
  }

  try {
    await prisma.restaurantStaff.update({
      where: { id, hotelId: user.hotelId },
      data,
    });
  } catch (err: any) {
    if (err?.code === "P2025") return res.status(404).json({ message: "Personal no encontrado." });
    if (err?.code === "P2002") return res.status(409).json({ message: "El usuario ya existe." });
    throw err;
  }
  const staff = await prisma.restaurantStaff.findFirst({
    where: { id, hotelId: user.hotelId },
    include: {
      launcher: { select: { id: true, username: true, name: true, roleId: true } },
      accessRole: { select: { id: true, name: true } },
    },
  });
  res.json(toStaffPayload(staff));
}

export async function deleteRestaurantStaff(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const id = String(req.params?.id || "").trim();
  if (!id) return res.status(400).json({ message: "id requerido" });

  try {
    await prisma.restaurantStaff.delete({
      where: { id, hotelId: user.hotelId },
    });
  } catch (err: any) {
    if (err?.code === "P2025") return res.status(404).json({ message: "Personal no encontrado." });
    throw err;
  }
  res.json({ ok: true });
}

// Fuerza bruta: 5 intentos fallidos por usuario cada 15 minutos.
const STAFF_LOGIN_MAX_ATTEMPTS = 5;
const STAFF_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const staffLoginFailures = new Map<string, { count: number; firstAt: number }>();

function staffLoginKey(hotelId: string, username: string) {
  return `${hotelId}:${username.toLowerCase()}`;
}

function checkStaffLoginBlocked(key: string) {
  const entry = staffLoginFailures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > STAFF_LOGIN_WINDOW_MS) {
    staffLoginFailures.delete(key);
    return false;
  }
  return entry.count >= STAFF_LOGIN_MAX_ATTEMPTS;
}

function registerStaffLoginFailure(key: string) {
  const entry = staffLoginFailures.get(key);
  if (!entry || Date.now() - entry.firstAt > STAFF_LOGIN_WINDOW_MS) {
    staffLoginFailures.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

export async function loginRestaurantStaff(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "").trim();
  if (!username || !password) return res.status(400).json({ message: "Usuario y password requeridos." });

  const attemptKey = staffLoginKey(user.hotelId, username);
  if (checkStaffLoginBlocked(attemptKey)) {
    return res.status(429).json({ message: "Demasiados intentos fallidos. Espera unos minutos o pide a un administrador que resetee el acceso." });
  }

  const staff = await prisma.restaurantStaff.findUnique({
    where: { hotelId_username: { hotelId: user.hotelId, username } },
    include: { accessRole: { select: { id: true, name: true } } },
  });
  if (!staff || staff.active === false) {
    registerStaffLoginFailure(attemptKey);
    return res.status(401).json({ message: "Credenciales invalidas." });
  }

  const ok = await bcrypt.compare(password, staff.passwordHash);
  if (!ok) {
    registerStaffLoginFailure(attemptKey);
    return res.status(401).json({ message: "Credenciales invalidas." });
  }

  staffLoginFailures.delete(attemptKey);

  const permissions = staff.accessRoleId
    ? (
        await prisma.rolePermission.findMany({
          where: { hotelId: user.hotelId, roleId: staff.accessRoleId },
          select: { permissionId: true },
        })
      ).map((r) => r.permissionId)
    : [];

  const token = issueStaffToken({
    staffId: staff.id,
    hotelId: user.hotelId,
    staffRole: staff.role === "CASHIER" ? "CASHIER" : "WAITER",
    name: staff.name,
  });

  res.json({ ...toStaffPayload(staff), permissions, token });
}

const buildShiftPayload = (shift: any) => ({
  id: shift.id,
  openedAt: shift.openedAt,
  closedAt: shift.closedAt ?? null,
  openingAmount: asNumber((shift?.totals as any)?.openingAmount ?? (shift?.details as any)?.openingAmount),
  shiftNumber: asNumber((shift?.details as any)?.shiftNumber ?? (shift?.totals as any)?.shiftNumber) || null,
  note: shift?.note || "",
  openedByStaffId: shift?.openedByStaffId || "",
  openedByName: shift?.openedByName || "",
  closedByStaffId: shift?.closedByStaffId || "",
  closedByName: shift?.closedByName || "",
});

const buildShiftNumberMap = async (hotelId: string) => {
  const rows = await prisma.cashAudit.findMany({
    where: { hotelId, module: "RESTAURANT" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const map = new Map<string, number>();
  rows.forEach((r, idx) => map.set(r.id, idx + 1));
  return map;
};

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

  const openingAmount = asNumber(req.body?.openingAmount);
  if (!Number.isFinite(openingAmount) || openingAmount <= 0) {
    return res.status(400).json({ message: "Debes ingresar un monto de apertura mayor a 0." });
  }

  const note = String(req.body?.note || "").trim() || null;
  const openKey = `${user.hotelId}:RESTAURANT`;

  // Personal que abre el turno: el enviado por el POS o el de la sesión de staff.
  const requestedOpenerId = String(req.body?.staffId || "").trim();
  const openerSession = readStaffSession(req);
  let openerStaffId: string | null = null;
  let openerName: string | null = null;
  if (requestedOpenerId) {
    const staff = await prisma.restaurantStaff.findFirst({
      where: { id: requestedOpenerId, hotelId: user.hotelId, active: true },
      select: { id: true, name: true },
    });
    if (!staff) return res.status(404).json({ message: "Personal no encontrado o inactivo." });
    openerStaffId = staff.id;
    openerName = staff.name;
  } else if (openerSession && openerSession.hotelId === user.hotelId) {
    openerStaffId = openerSession.staffId;
    openerName = openerSession.name || null;
  }

  // El guard multi-tenant no permite upsert por una unique sin hotelId, así que
  // se busca el turno abierto y se crea uno nuevo.
  const previousOpen = await prisma.cashAudit.findFirst({
    where: { hotelId: user.hotelId, module: "RESTAURANT", openKey },
    select: { id: true, closedAt: true },
  });
  if (previousOpen && !previousOpen.closedAt) {
    return res.status(400).json({ message: "Ya hay un turno abierto." });
  }
  if (previousOpen?.closedAt) {
    // Turno viejo que conservó la llave: liberarla antes de crear el nuevo.
    await prisma.cashAudit.updateMany({
      where: { id: previousOpen.id, hotelId: user.hotelId },
      data: { openKey: null },
    });
  }

  const shiftNumber = await nextHotelSequence(user.hotelId, "restaurant_shift");

  try {
    const shift = await prisma.cashAudit.create({
      data: {
        hotelId: user.hotelId,
        module: "RESTAURANT",
        openedAt: new Date(),
        closedAt: null,
        openKey,
        totals: { openingAmount, shiftNumber },
        details: { openingAmount, shiftNumber },
        note,
        createdById: user.sub || null,
        openedByStaffId: openerStaffId,
        openedByName: openerName,
      },
    });

    res.json({ open: true, shift: buildShiftPayload(shift) });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(400).json({ message: "Ya hay un turno abierto." });
    }
    throw err;
  }
}

function sumPaymentBreakdown(paymentBreakdown: any): Record<string, number> {
  const byMethod: Record<string, number> = {};
  const pb = paymentBreakdown && typeof paymentBreakdown === "object" ? paymentBreakdown : {};
  for (const k of Object.keys(pb || {})) {
    byMethod[k] = asNumber(pb[k]);
  }
  return byMethod;
}

/**
 * Separa los cobros entre los que entran a la caja física (solo efectivo, código
 * de Hacienda 01) y los electrónicos/habitación, que no deben exigirse en el
 * conteo de caja del arqueo.
 */
function splitCashMethods(byMethod: Record<string, number>) {
  const cash: Record<string, number> = {};
  const nonCash: Record<string, number> = {};
  for (const [key, value] of Object.entries(byMethod)) {
    if (isCashPaymentMethod({ key })) cash[key] = asNumber(value);
    else nonCash[key] = asNumber(value);
  }
  const cashTotal = Object.values(cash).reduce((a, b) => a + b, 0);
  const nonCashTotal = Object.values(nonCash).reduce((a, b) => a + b, 0);
  return { cash, nonCash, cashTotal, nonCashTotal };
}

const SHIFT_SALES_SNAPSHOT_LIMIT = 2000;

async function computeShiftReconciliation(hotelId: string, shift: any) {
  const since = shift.openedAt || shift.createdAt || new Date(0);
  // El turno manda: se toma la venta por shiftId. Solo las ventas viejas sin
  // turno asignado usan la ventana de tiempo como respaldo.
  const paidOrders = await prisma.restaurantOrder.findMany({
    where: {
      hotelId,
      status: "PAID",
      OR: [{ shiftId: shift.id }, { shiftId: null, updatedAt: { gte: since } }],
    },
    select: {
      id: true,
      saleNumber: true,
      tableId: true,
      total: true,
      paymentBreakdown: true,
      subtotal: true,
      tax: true,
      tip10: true,
      updatedAt: true,
      closedByStaffId: true,
      createdByStaffId: true,
    },
    orderBy: { updatedAt: "asc" },
  });

  const systemTotal = paidOrders.reduce((acc, o) => acc + asNumber(o.total), 0);
  const systemSubtotal = paidOrders.reduce((acc, o) => acc + asNumber(o.subtotal), 0);
  const systemTax = paidOrders.reduce((acc, o) => acc + asNumber(o.tax), 0);
  const systemService = paidOrders.reduce((acc, o) => acc + asNumber(o.tip10), 0);
  const systemByMethod: Record<string, number> = {};
  for (const o of paidOrders) {
    const pb = sumPaymentBreakdown(o.paymentBreakdown);
    for (const k of Object.keys(pb)) {
      systemByMethod[k] = (systemByMethod[k] || 0) + pb[k];
    }
  }

  const systemSplit = splitCashMethods(systemByMethod);

  // Detalle por venta para reimprimir/comparar el cierre sin recalcular.
  const sales = paidOrders.slice(0, SHIFT_SALES_SNAPSHOT_LIMIT).map((o) => ({
    orderId: o.id,
    saleNumber: o.saleNumber ?? null,
    tableId: fromInternalId(hotelId, o.tableId),
    total: asNumber(o.total),
    subtotal: asNumber(o.subtotal),
    tax: asNumber(o.tax),
    service: asNumber(o.tip10),
    payments: sumPaymentBreakdown(o.paymentBreakdown),
    paidAt: o.updatedAt,
    createdByStaffId: o.createdByStaffId ?? null,
    closedByStaffId: o.closedByStaffId ?? null,
  }));

  return {
    salesCount: paidOrders.length,
    systemTotal,
    systemSubtotal,
    systemTax,
    systemService,
    systemByMethod,
    /** Total cobrado en efectivo (lo que debe estar en la caja). */
    systemCash: systemSplit.cashTotal,
    /** Total cobrado por medios que no pasan por la caja física. */
    systemNonCash: systemSplit.nonCashTotal,
    cashByMethod: systemSplit.cash,
    nonCashByMethod: systemSplit.nonCash,
    sales,
  };
}

export async function closeShift(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const hotelId = user.hotelId;
  const closeTypeRaw = String(req.body?.type || "Z").trim().toUpperCase();
  const stage = closeTypeRaw === "X" ? "X" : "Z";

  if (user.role !== "ADMIN") {
    const allowedPerms = stage === "X"
      ? ["restaurant.shift.closeX", "restaurant.shift.close"]
      : ["restaurant.shift.closeZ", "restaurant.shift.close"];
    const granted = await prisma.rolePermission.findFirst({
      where: { hotelId, roleId: user.role, permissionId: { in: allowedPerms } },
    });
    if (!granted) {
      return res.status(403).json({ message: `No tienes permiso para realizar el Cierre ${stage}` });
    }
  }

  const shift = await prisma.cashAudit.findFirst({
    where: { hotelId, module: "RESTAURANT", closedAt: null },
    orderBy: { openedAt: "desc" },
  });
  if (!shift) return res.status(400).json({ message: "No hay turno abierto." });

  const paymentsInput = (req.body?.payments ?? {}) as any;
  const reportedByMethod = sumPaymentBreakdown(paymentsInput);
  const reportedTotal = Object.values(reportedByMethod).reduce((a, b) => a + b, 0);

  const reconciliation = await computeShiftReconciliation(hotelId, shift);
  const systemSplit = splitCashMethods(reconciliation.systemByMethod);
  const reportedSplit = splitCashMethods(reportedByMethod);
  const diffByMethod: Record<string, number> = {};
  const allMethodKeys = new Set([
    ...Object.keys(systemSplit.cash),
    ...Object.keys(reportedSplit.cash),
    ...Object.keys(systemSplit.nonCash),
    ...Object.keys(reportedSplit.nonCash),
  ]);
  for (const k of allMethodKeys) {
    diffByMethod[k] = asNumber(reportedByMethod[k]) - asNumber(reconciliation.systemByMethod[k]);
  }
  // Solo el efectivo se compara contra el conteo físico de la caja.
  const diffTotal = reportedSplit.cashTotal - systemSplit.cashTotal;
  // Los medios electrónicos se comparan aparte y solo si el cajero los declaró.
  const diffNonCash =
    reportedSplit.nonCashTotal > 0 ? reportedSplit.nonCashTotal - systemSplit.nonCashTotal : 0;

  const openOrdersCount =
    stage === "Z" ? await prisma.restaurantOrder.count({ where: { hotelId, status: "OPEN" } }) : 0;

  const totals = {
    system: reconciliation.systemTotal,
    systemCash: systemSplit.cashTotal,
    systemNonCash: systemSplit.nonCashTotal,
    reported: reportedTotal,
    reportedCash: reportedSplit.cashTotal,
    reportedNonCash: reportedSplit.nonCashTotal,
    diff: diffTotal,
    diffNonCash,
    systemSubtotal: reconciliation.systemSubtotal,
    systemTax: reconciliation.systemTax,
    systemService: reconciliation.systemService,
    salesCount: reconciliation.salesCount,
    openOrders: openOrdersCount,
  };

  // Cierre Z: no cerrar con diferencias de caja ni con órdenes abiertas, salvo
  // permiso de forzado.
  if (stage === "Z") {
    const canForceZ =
      user.role === "ADMIN" ||
      Boolean(
        await prisma.rolePermission.findFirst({
          where: { hotelId, roleId: user.role, permissionId: { in: ["restaurant.shift.closeZ.force", "restaurant.shift.close"] } },
          select: { id: true },
        })
      );
    if (Math.abs(diffTotal) > 0.01 && !canForceZ) {
      return res.status(409).json({
        code: "SHIFT_DIFFERENCE",
        message:
          "El cierre Z tiene diferencias en el efectivo contra las ventas del sistema. Revisa el conteo o solicita permiso de administrador.",
        totals,
        diffByMethod,
        systemByMethod: reconciliation.systemByMethod,
        reportedByMethod,
        cashByMethod: systemSplit.cash,
      });
    }
    if (Math.abs(diffNonCash) > 1 && !canForceZ) {
      return res.status(409).json({
        code: "SHIFT_NONCASH_DIFFERENCE",
        message:
          "El cierre Z tiene diferencias en los medios electrónicos (tarjeta/SINPE/transferencia) contra el sistema.",
        totals,
        diffByMethod,
        systemByMethod: reconciliation.systemByMethod,
        reportedByMethod,
        nonCashByMethod: systemSplit.nonCash,
      });
    }
    if (openOrdersCount > 0 && !canForceZ) {
      return res.status(409).json({
        code: "OPEN_ORDERS",
        message: `Hay ${openOrdersCount} orden(es) abierta(s). Cóbralas o anúlalas antes de cerrar el turno.`,
        openOrders: openOrdersCount,
        totals,
      });
    }
  }

  const payments = paymentsInput as Prisma.InputJsonValue;
  const breakdown = {
    systemByMethod: reconciliation.systemByMethod,
    systemCashByMethod: systemSplit.cash,
    systemNonCashByMethod: systemSplit.nonCash,
    reportedByMethod,
    reportedCashByMethod: reportedSplit.cash,
    reportedNonCashByMethod: reportedSplit.nonCash,
    diffByMethod,
    salesCount: reconciliation.salesCount,
    sales: reconciliation.sales,
  } as Prisma.InputJsonValue;
  const note = String(req.body?.note || "").trim() || null;

  // Personal que cierra el turno (solo relevante para el cierre Z).
  const closerSession = readStaffSession(req);
  const requestedCloserId = String(req.body?.staffId || "").trim();
  let closerStaffId: string | null = null;
  let closerName: string | null = null;
  if (requestedCloserId) {
    const staff = await prisma.restaurantStaff.findFirst({
      where: { id: requestedCloserId, hotelId, active: true },
      select: { id: true, name: true },
    });
    if (!staff) return res.status(404).json({ message: "Personal no encontrado o inactivo." });
    closerStaffId = staff.id;
    closerName = staff.name;
  } else if (closerSession && closerSession.hotelId === hotelId) {
    closerStaffId = closerSession.staffId;
    closerName = closerSession.name || null;
  }

  // Transacción atómica: crear el cierre y, si es Z, cerrar el turno juntos.
  await prisma.$transaction(async (tx) => {
    // Re-verificar que el turno sigue abierto dentro de la transacción
    const stillOpen = await tx.cashAudit.findFirst({
      where: { id: shift.id, hotelId, closedAt: null },
      select: { id: true },
    });
    if (!stillOpen) {
      throw new Error("El turno ya fue cerrado por otro usuario/proceso.");
    }

    await tx.restaurantClose.create({
      data: {
        hotelId,
        turno: shift.id,
        stage,
        totals,
        payments,
        breakdown,
        note,
        userId: user.sub || null,
      },
    });

    if (stage === "Z") {
      await tx.cashAudit.update({
        where: { id: shift.id, hotelId },
        data: {
          closedAt: new Date(),
          openKey: null,
          totals,
          details: breakdown,
          note,
          closedByStaffId: closerStaffId,
          closedByName: closerName,
        },
      });
    }
  });

  res.json({ ok: true, totals, diffByMethod, systemByMethod: reconciliation.systemByMethod, reportedByMethod });
}

export async function listShiftInvoices(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });
  const hotelId = user.hotelId;

  const shift = await prisma.cashAudit.findFirst({
    where: { hotelId, module: "RESTAURANT", closedAt: null },
    orderBy: { openedAt: "desc" },
  });
  if (!shift) return res.json([]);

  const since = shift.openedAt || shift.createdAt || new Date(0);

  // Las ventas del turno se resuelven por shiftId (con respaldo por fecha para
  // las ventas viejas que no tienen turno asignado).
  const shiftOrders = await prisma.restaurantOrder.findMany({
    where: {
      hotelId,
      status: "PAID",
      OR: [{ shiftId: shift.id }, { shiftId: null, updatedAt: { gte: since } }],
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: { id: true, tableId: true, total: true, updatedAt: true, createdAt: true },
  });
  const shiftOrderIds = shiftOrders.map((o) => o.id);

  const docs = shiftOrderIds.length
    ? await prisma.eInvoicingDocument.findMany({
        where: { hotelId, restaurantOrderId: { in: shiftOrderIds } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          restaurantOrderId: true,
          docType: true,
          status: true,
          consecutive: true,
          key: true,
          createdAt: true,
        },
      })
    : [];

  const docOrderIds = new Set(docs.map((d) => d.restaurantOrderId).filter(Boolean) as string[]);

  const docOrders = await prisma.restaurantOrder.findMany({
    where: { hotelId, id: { in: Array.from(docOrderIds) } },
    select: { id: true, tableId: true, total: true },
  });
  const docOrderMap = new Map(docOrders.map((o) => [o.id, o]));

  const ordersWithoutDoc = shiftOrders.filter((o) => !docOrderIds.has(o.id)).slice(0, 200);

  const list = [
    ...docs.map((d) => {
      const order = d.restaurantOrderId ? docOrderMap.get(d.restaurantOrderId) : null;
      return ({
      id: d.id,
      restaurantOrderId: d.restaurantOrderId,
      docType: d.docType,
      status: d.status,
      consecutive: d.consecutive,
      key: d.key,
      createdAt: d.createdAt,
      order: order
        ? {
            id: order.id,
            tableId: fromInternalId(hotelId, order.tableId),
            total: order.total,
          }
        : null,
    });
    }),
    ...ordersWithoutDoc.map((o) => ({
      id: `NO_DOC:${o.id}`,
      restaurantOrderId: o.id,
      docType: "NO_DOC",
      status: "NO_DOC",
      consecutive: null,
      key: null,
      createdAt: o.updatedAt || o.createdAt,
      order: {
        id: o.id,
        tableId: fromInternalId(hotelId, o.tableId),
        total: o.total,
      },
    })),
  ];

  res.json(list);
}

export async function listClosedRestaurantShifts(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const shifts = await prisma.cashAudit.findMany({
    where: { hotelId: user.hotelId, module: "RESTAURANT", closedAt: { not: null } },
    orderBy: { closedAt: "desc" },
    take: 60,
  });
  const shiftNumberMap = await buildShiftNumberMap(user.hotelId);

  const closes = await prisma.restaurantClose.findMany({
    where: { hotelId: user.hotelId, turno: { in: shifts.map((s) => s.id) }, stage: "Z" },
    orderBy: { createdAt: "desc" },
  });
  const closesByShift = new Map<string, typeof closes[0]>();
  for (const c of closes) {
    if (!closesByShift.has(c.turno)) closesByShift.set(c.turno, c);
  }

  res.json(
    shifts.map((s) => {
      const close = closesByShift.get(s.id);
      return {
        ...buildShiftPayload(s),
        shiftNumber: buildShiftPayload(s).shiftNumber || shiftNumberMap.get(s.id) || null,
        closeTotals: (close?.totals ?? null) as any,
        closePayments: (close?.payments ?? null) as any,
        closeNote: close?.note ?? null,
      };
    })
  );
}

export async function listRestaurantHistorySales(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });
  const hotelId = user.hotelId;

  const type = String((req.query as any)?.type || "SALES").trim().toUpperCase();
  const missing: string[] = [];

  // Paginación real: el cliente pide bloques en vez de recibir todo el histórico.
  const limitRaw = Number((req.query as any)?.limit);
  const offsetRaw = Number((req.query as any)?.offset);
  const pageLimit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(500, Math.floor(limitRaw)) : 100;
  const pageOffset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;

  const useTurno = String((req.query as any)?.useTurno || "").toLowerCase() === "true";
  const shiftId = String((req.query as any)?.shiftId || "").trim();
  if (useTurno && !shiftId) missing.push("Filtro Turno requiere selección.");
  const useMoneda = String((req.query as any)?.useMoneda || "").toLowerCase() === "true";
  const currency = String((req.query as any)?.currency || "").trim();
  if (useMoneda && !currency) missing.push("Filtro Moneda requiere selección.");

  const dateFromRaw = String((req.query as any)?.dateFrom || "").trim();
  const dateToRaw = String((req.query as any)?.dateTo || "").trim();
  const dateTimeFromRaw = String((req.query as any)?.dateTimeFrom || "").trim();
  const dateTimeToRaw = String((req.query as any)?.dateTimeTo || "").trim();
  const useFecha = String((req.query as any)?.useFecha || "").toLowerCase() === "true";
  const useFechaHora = String((req.query as any)?.useFechaHora || "").toLowerCase() === "true";
  const dateFrom = dateFromRaw ? new Date(dateFromRaw) : null;
  const dateTo = dateToRaw ? new Date(dateToRaw) : null;
  const dateTimeFrom = dateTimeFromRaw ? new Date(dateTimeFromRaw) : null;
  const dateTimeTo = dateTimeToRaw ? new Date(dateTimeToRaw) : null;
  if (dateTo) dateTo.setHours(23, 59, 59, 999);
  if (dateTimeTo) dateTimeTo.setSeconds(59, 999);
  if (useFecha && !dateFrom && !dateTo) missing.push("Filtro Fecha requiere rango.");
  if (useFechaHora && !dateTimeFrom && !dateTimeTo) missing.push("Filtro Fecha y hora requiere rango.");

  if (type === "VOIDS") {
    const voidDateFrom = (req.query as any)?.dateFrom ? new Date(String((req.query as any).dateFrom)) : null;
    const voidDateTo = (req.query as any)?.dateTo ? new Date(String((req.query as any).dateTo)) : null;
    if (voidDateTo) voidDateTo.setHours(23, 59, 59, 999);
    const voidShiftId = String((req.query as any)?.shiftId || "").trim();
    const voidUseTurno = String((req.query as any)?.useTurno || "").toLowerCase() === "true";

    let voidRanges: { canceledAt: { gte: Date; lte: Date } }[] = [];
    if (voidUseTurno && voidShiftId) {
      const chosenShift = await prisma.cashAudit.findFirst({ where: { id: voidShiftId, hotelId } });
      if (chosenShift?.openedAt && chosenShift?.closedAt) {
        voidRanges = [{ canceledAt: { gte: chosenShift.openedAt, lte: chosenShift.closedAt } }];
      }
    } else if (voidDateFrom || voidDateTo) {
      const allShifts = await prisma.cashAudit.findMany({
        where: {
          hotelId, module: "RESTAURANT", closedAt: { not: null },
          ...(voidDateFrom || voidDateTo ? { closedAt: { ...(voidDateFrom ? { gte: voidDateFrom } : {}), ...(voidDateTo ? { lte: voidDateTo } : {}), not: null } } : {}),
        },
        orderBy: { closedAt: "desc" }, take: 60,
      });
      voidRanges = allShifts.filter((s) => s.openedAt && s.closedAt).map((s) => ({ canceledAt: { gte: s.openedAt as Date, lte: s.closedAt as Date } }));
    } else {
      const latestShift = await prisma.cashAudit.findFirst({
        where: { hotelId, module: "RESTAURANT", closedAt: { not: null } },
        orderBy: { closedAt: "desc" },
      });
      if (latestShift?.openedAt && latestShift?.closedAt) {
        voidRanges = [{ canceledAt: { gte: latestShift.openedAt, lte: latestShift.closedAt } }];
      }
    }

    if (voidRanges.length === 0) {
      return res.json({ items: [], missing: ["No hay turnos cerrados en el rango indicado."] });
    }

    const canceledOrders = await prisma.restaurantOrder.findMany({
      where: { hotelId, canceledAt: { not: null }, OR: voidRanges },
      include: { items: true },
      orderBy: { canceledAt: "desc" },
    });

    const rows = canceledOrders.map((o) => ({
      id: o.id,
      saleNumber: (o as any).invoiceNumber || o.id?.slice(-6),
      sectionId: (o as any).sectionId || "-",
      tableId: (o as any).tableId || "-",
      total: Number((o as any).total || 0).toFixed(2),
      canceledAt: (o as any).canceledAt,
      canceledBy: (o as any).canceledBy || "-",
      cancelAdminUser: (o as any).cancelAdminUser || "-",
      cancelReason: (o as any).cancelReason || "-",
      itemCount: o.items?.length || 0,
    }));

    return res.json({ items: rows, missing: [] });
  }

  const shiftWhere: Prisma.CashAuditWhereInput = {
    hotelId,
    module: "RESTAURANT",
    closedAt: { not: null },
  };
  if (dateFrom || dateTo) {
    shiftWhere.closedAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
      not: null,
    };
  }

  const shifts = await prisma.cashAudit.findMany({
    where: shiftWhere,
    orderBy: { closedAt: "desc" },
    take: 60,
  });
  const shiftNumberMap = await buildShiftNumberMap(hotelId);

  if (shifts.length === 0) {
    return res.json({ items: [], missing: ["No hay turnos cerrados disponibles."] });
  }

  let useShifts = dateFrom || dateTo || dateTimeFrom || dateTimeTo ? shifts : [shifts[0]];
  if (useTurno && shiftId) {
    const chosen = shifts.find((s) => s.id === shiftId);
    if (!chosen) {
      return res.json({ items: [], missing: ["Turno no encontrado o no cerrado."] });
    }
    useShifts = [chosen];
  }

  const ranges = useShifts
    .filter((s) => s.closedAt)
    .map((s) => ({
      createdAt: {
        gte: s.openedAt || s.createdAt || new Date(0),
        lte: s.closedAt as Date,
      },
    }));

  const useArticulo = String((req.query as any)?.useArticulo || "").toLowerCase() === "true";
  const useFamilia = String((req.query as any)?.useFamilia || "").toLowerCase() === "true";
  const useSubfamilia = String((req.query as any)?.useSubfamilia || "").toLowerCase() === "true";
  const familyId = String((req.query as any)?.familyId || "").trim();
  const subFamilyId = String((req.query as any)?.subFamilyId || "").trim();
  const itemId = String((req.query as any)?.itemId || "").trim();

  if (useArticulo && !itemId) missing.push("Filtro Artículo requiere selección.");
  if (useFamilia && !familyId) missing.push("Filtro Familia requiere selección.");
  if (useSubfamilia && !subFamilyId) missing.push("Filtro Subfamilia requiere selección.");

  let itemIds: string[] = [];
  if (useArticulo && itemId) {
    itemIds = [itemId];
  } else if (useFamilia || useSubfamilia) {
    const items = await prisma.restaurantItem.findMany({
      where: {
        hotelId,
        ...(useFamilia && familyId ? { familyId } : {}),
        ...(useSubfamilia && subFamilyId ? { subFamilyId } : {}),
      },
      select: { id: true },
    });
    itemIds = items.map((i) => i.id);
    if (itemIds.length === 0) {
      return res.json({ items: [], missing });
    }
  }

  const useCajero = String((req.query as any)?.useCajero || "").toLowerCase() === "true";
  const useMesero = String((req.query as any)?.useMesero || "").toLowerCase() === "true";
  const cashierId = String((req.query as any)?.cashierId || "").trim();
  const waiterId = String((req.query as any)?.waiterId || "").trim();
  if (useCajero && !cashierId) missing.push("Filtro Cajero requiere selección.");
  if (useMesero && !waiterId) missing.push("Filtro Mesero requiere selección.");
  const serviceType = String((req.query as any)?.serviceType || "").trim();
  const paymentKey = String((req.query as any)?.paymentKey || "").trim();
  const useTipoCobro = String((req.query as any)?.useTipoCobro || "").toLowerCase() === "true";
  const detailedByFamily = String((req.query as any)?.detailedByFamily || "").toLowerCase() === "true";
  const includeHouseAccount = String((req.query as any)?.includeHouseAccount || "").toLowerCase() === "true";
  const includeVoidedInvoices = String((req.query as any)?.includeVoidedInvoices || "").toLowerCase() === "true";
  const topCountRaw = String((req.query as any)?.topCount || "").trim();
  const topMode = String((req.query as any)?.topMode || "").trim();
  const includeItemsMode = String((req.query as any)?.includeItemsMode || "").trim();
  const focus = String((req.query as any)?.focus || "").trim();

  const orderDateFilter = dateTimeFrom || dateTimeTo || dateFrom || dateTo
    ? {
        createdAt: {
          ...(dateTimeFrom ? { gte: dateTimeFrom } : {}),
          ...(dateTimeTo ? { lte: dateTimeTo } : {}),
          ...(dateTimeFrom || dateTimeTo ? {} : dateFrom ? { gte: dateFrom } : {}),
          ...(dateTimeFrom || dateTimeTo ? {} : dateTo ? { lte: dateTo } : {}),
        },
      }
    : {};

  const orders = await prisma.restaurantOrder.findMany({
    where: {
      hotelId,
      status: { in: ["PAID", "CLOSED"] },
      OR: ranges,
      ...(orderDateFilter as any),
      ...(itemIds.length > 0 ? { items: { some: { itemId: { in: itemIds } } } } : {}),
      ...(useCajero && cashierId ? { cashierId } : {}),
      ...(useMesero && waiterId ? { waiterId } : {}),
      ...(serviceType ? { serviceType } : {}),
    },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  let filtered = orders;

  // Nombres del personal para la reportería (creador, mesero y cajero).
  const reportStaffIds = new Set<string>();
  for (const o of orders) {
    for (const id of [o.waiterId, o.cashierId, o.createdByStaffId, o.closedByStaffId]) {
      if (id) reportStaffIds.add(id);
    }
  }
  const reportStaff = reportStaffIds.size
    ? await prisma.restaurantStaff.findMany({
        where: { hotelId, id: { in: Array.from(reportStaffIds) } },
        select: { id: true, name: true },
      })
    : [];
  const staffNameById = new Map(reportStaff.map((s) => [s.id, s.name]));
  const shiftsById = new Map(useShifts.map((s) => [s.id, s]));

  if (useTipoCobro) {
    if (!paymentKey) {
      missing.push("Filtro Tipo de Cobro pendiente: selecciona un método.");
    } else {
      filtered = filtered.filter((o) => {
        const pb = (o.paymentBreakdown && typeof o.paymentBreakdown === "object" ? o.paymentBreakdown : {}) as any;
        const val = pb[paymentKey];
        return typeof val === "number" ? val > 0 : Boolean(val);
      });
    }
  }

  if (useMoneda && currency && currency !== "BASE") {
    missing.push("Filtro Moneda pendiente (TPV solo base).");
  }
  if (includeHouseAccount) missing.push("Filtro Cuenta Casa pendiente (TPV no expone).");
  if (includeVoidedInvoices) missing.push("Filtro Facturas Anuladas pendiente (TPV no expone).");
  if (detailedByFamily) missing.push("Detallado por Familia pendiente (TPV no expone).");
  if (includeItemsMode) missing.push("Filtro de inclusión de artículos pendiente (TPV no expone).");

  if (focus === "Cajero") {
    const nameOf = (id: any) => staffNameById.get(String(id || "")) || String(id || "");
    filtered = [...filtered].sort((a, b) => nameOf(a.cashierId).localeCompare(nameOf(b.cashierId)));
    filtered.forEach((o) => { (o as any).__groupKey = nameOf(o.cashierId) || "-"; });
  } else if (focus === "Mesero") {
    const nameOf = (id: any) => staffNameById.get(String(id || "")) || String(id || "");
    filtered = [...filtered].sort((a, b) => nameOf(a.waiterId).localeCompare(nameOf(b.waiterId)));
    filtered.forEach((o) => { (o as any).__groupKey = nameOf(o.waiterId) || "-"; });
  } else if (focus === "Creador") {
    const nameOf = (id: any) => staffNameById.get(String(id || "")) || String(id || "");
    filtered = [...filtered].sort((a, b) => nameOf(a.createdByStaffId).localeCompare(nameOf(b.createdByStaffId)));
    filtered.forEach((o) => { (o as any).__groupKey = nameOf(o.createdByStaffId) || "-"; });
  } else if (focus === "Servicio") {
    filtered = [...filtered].sort((a, b) => String(a.serviceType || "").localeCompare(String(b.serviceType || "")));
    filtered.forEach((o) => { (o as any).__groupKey = (o as any).serviceType || "-"; });
  } else if (focus === "Fecha") {
    filtered = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    filtered.forEach((o) => { (o as any).__groupKey = new Date(o.createdAt).toLocaleDateString(); });
  } else if (focus === "Cliente") {
    filtered = filtered.filter((o) => (o as any).guestId || (o as any).guestName);
    filtered.forEach((o) => { (o as any).__groupKey = (o as any).guestName || (o as any).guestId || "-"; });
  } else if (focus && !["Familia", "Subfamilia", "Artículo", "Artículo / Observación", "Fecha / Artículo", "Cuenta Casa"].includes(focus)) {
    missing.push(`Enfoque rápido '${focus}' pendiente.`);
  }

  const groupBy = String((req.query as any)?.groupBy || "").trim();
  const orderBy = String((req.query as any)?.orderBy || "").trim();

  if (orderBy === "Cobros" || orderBy === "Total (mayor a menor)") {
    filtered = [...filtered].sort((a, b) => asNumber(b.total) - asNumber(a.total));
  } else if (orderBy === "Total (menor a mayor)") {
    filtered = [...filtered].sort((a, b) => asNumber(a.total) - asNumber(b.total));
  } else if (orderBy === "Cantidad") {
    filtered = [...filtered].sort((a, b) => (b.items?.length || 0) - (a.items?.length || 0));
  } else if (orderBy === "Fecha") {
    filtered = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (orderBy === "Código") {
    filtered = [...filtered].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  if (groupBy === "Familia") {
    const allItemIds = new Set<string>();
    filtered.forEach((o) => (o.items || []).forEach((it: any) => it?.itemId && allItemIds.add(it.itemId)));
    if (allItemIds.size > 0) {
      const itemRows = await prisma.restaurantItem.findMany({
        where: { hotelId, id: { in: Array.from(allItemIds) } },
        include: { family: true },
      });
      const itemFamilyMap = new Map(itemRows.map((r) => [r.id, r.family?.name || r.familyId]));
      filtered = filtered.map((o) => {
        const firstItem = (o.items || []).find((it: any) => it?.itemId);
        const key = firstItem ? itemFamilyMap.get(firstItem.itemId) || "-" : "-";
        (o as any).__groupKey = key;
        return o;
      });
    }
  } else if (groupBy === "Mesero") {
    filtered = filtered.map((o) => {
      (o as any).__groupKey = staffNameById.get(String(o.waiterId || "")) || o.waiterId || "-";
      return o;
    });
  } else if (groupBy === "Cajero") {
    filtered = filtered.map((o) => {
      (o as any).__groupKey = staffNameById.get(String(o.cashierId || "")) || o.cashierId || "-";
      return o;
    });
  } else if (groupBy === "Creador") {
    filtered = filtered.map((o) => {
      (o as any).__groupKey = staffNameById.get(String(o.createdByStaffId || "")) || o.createdByStaffId || "-";
      return o;
    });
  } else if (groupBy === "Turno") {
    const shiftMap = shiftNumberMap;
    filtered = filtered.map((o) => {
      const matchShift =
        (o.shiftId ? shiftsById.get(o.shiftId) : null) ||
        useShifts.find((s) => {
          const start = s.openedAt || s.createdAt || new Date(0);
          const end = s.closedAt as Date;
          return o.createdAt >= start && o.createdAt <= end;
        });
      (o as any).__groupKey = matchShift ? `#${shiftMap.get(matchShift.id) ?? matchShift.id.slice(-6)}` : "-";
      return o;
    });
  } else if (groupBy === "Artículo" || groupBy === "Articulo") {
    filtered = filtered.map((o) => {
      const names = (o.items || []).map((it: any) => it?.name || it?.itemId || "").filter(Boolean);
      (o as any).__groupKey = names.length > 0 ? names[0] : "-";
      return o;
    });
  } else if (groupBy === "Fecha") {
    filtered = filtered.map((o) => {
      (o as any).__groupKey = o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "-";
      return o;
    });
  } else if (groupBy === "Subfamilia") {
    const allItemIds = new Set<string>();
    filtered.forEach((o) => (o.items || []).forEach((it: any) => it?.itemId && allItemIds.add(it.itemId)));
    if (allItemIds.size > 0) {
      const itemRows = await prisma.restaurantItem.findMany({
        where: { hotelId, id: { in: Array.from(allItemIds) } },
        select: { id: true, subFamilyId: true },
      });
      const subFamilyMap = new Map(itemRows.map((r) => [r.id, r.subFamilyId || "-"]));
      filtered = filtered.map((o) => {
        const firstItem = (o.items || []).find((it: any) => it?.itemId);
        (o as any).__groupKey = firstItem ? subFamilyMap.get(firstItem.itemId) || "-" : "-";
        return o;
      });
    }
  } else if (groupBy && !["Familia", "Subfamilia", "Mesero", "Cajero", "Creador", "Turno", "Artículo", "Fecha"].includes(groupBy)) {
    missing.push(`Agrupar por ${groupBy} pendiente.`);
  }

  const topCount = Number(topCountRaw || 0);
  if (topCountRaw && (!Number.isFinite(topCount) || topCount <= 0)) {
    missing.push("Seleccionar los requiere un número válido.");
  }
  if (topCount > 0 && topMode) {
    filtered = filtered.slice(0, topCount);
  } else if (topCount > 0 && !topMode) {
    missing.push("Seleccionar los requiere más vendidos o menos vendidos.");
  }

  const totalRows = filtered.length;
  const pageRows = filtered.slice(pageOffset, pageOffset + pageLimit);
  const summary = filtered.reduce(
    (acc, o: any) => {
      acc.total += asNumber(o.total);
      acc.subtotal += asNumber(o.subtotal);
      acc.tax += asNumber(o.tax);
      acc.tip10 += asNumber(o.tip10);
      return acc;
    },
    { total: 0, subtotal: 0, tax: 0, tip10: 0 }
  );

  return res.json({
    items: pageRows.map((o) => {
      const matchShift =
        (o.shiftId ? shiftsById.get(o.shiftId) : null) ||
        useShifts.find((s) => {
          const start = s.openedAt || s.createdAt || new Date(0);
          const end = s.closedAt as Date;
          return o.createdAt >= start && o.createdAt <= end;
        });
      const shiftNum = matchShift ? shiftNumberMap.get(matchShift.id) ?? null : null;
      const pb = (o.paymentBreakdown && typeof o.paymentBreakdown === "object" ? o.paymentBreakdown : {}) as any;
      const paymentMethods = Object.entries(pb).filter(([, v]) => Number(v) > 0).map(([name, amount]) => ({ name, amount: Number(amount) }));
      return {
        id: o.id,
        saleNumber: (o as any).saleNumber || null,
        saleNumberInt: (o as any).saleNumberInt || null,
        shiftNumber: shiftNum,
        tableId: fromInternalId(hotelId, o.tableId),
        sectionId: o.sectionId ? fromInternalId(hotelId, o.sectionId) : null,
        waiterId: o.waiterId,
        waiterName: staffNameById.get(String(o.waiterId || "")) || "",
        cashierId: o.cashierId,
        cashierName: staffNameById.get(String(o.cashierId || "")) || "",
        shiftId: o.shiftId || null,
        createdByStaffId: o.createdByStaffId || null,
        createdByStaffName: staffNameById.get(String(o.createdByStaffId || "")) || "",
        closedByStaffId: o.closedByStaffId || null,
        closedByStaffName: staffNameById.get(String(o.closedByStaffId || "")) || "",
        status: o.status,
        serviceType: o.serviceType,
        subtotal: (o as any).subtotal ?? null,
        tax: (o as any).tax ?? null,
        tip10: (o as any).tip10 ?? null,
        total: o.total,
        paymentMethods,
        itemCount: o.items?.length || 0,
        createdAt: o.createdAt,
        closedAt: (o as any).closedAt ?? o.updatedAt,
        groupKey: (o as any).__groupKey,
      };
    }),
    total: totalRows,
    limit: pageLimit,
    offset: pageOffset,
    summary,
    missing,
  });
}

export async function listRestaurantHistoryInvoices(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });
  const hotelId = user.hotelId;

  const missing: string[] = [];
  const useTurno = String((req.query as any)?.useTurno || "").toLowerCase() === "true";
  const shiftId = String((req.query as any)?.shiftId || "").trim();
  if (useTurno && !shiftId) missing.push("Filtro Turno requiere selecci?n.");

  const useFechaCierre = String((req.query as any)?.useFechaCierre || "").toLowerCase() === "true";
  const dateFromRaw = String((req.query as any)?.dateFrom || "").trim();
  const dateToRaw = String((req.query as any)?.dateTo || "").trim();
  const dateFrom = dateFromRaw ? new Date(dateFromRaw) : null;
  const dateTo = dateToRaw ? new Date(dateToRaw) : null;
  if (dateTo) dateTo.setHours(23, 59, 59, 999);
  if (useFechaCierre && !dateFrom && !dateTo) missing.push("Filtro Fecha de cierre requiere rango.");

  const limitRaw = Number((req.query as any)?.limit);
  const offsetRaw = Number((req.query as any)?.offset);
  const pageLimit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(500, Math.floor(limitRaw)) : 100;
  const pageOffset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;

  const includePaid = String((req.query as any)?.includePaid || "").toLowerCase() !== "false";
  const includeVoided = String((req.query as any)?.includeVoided || "").toLowerCase() === "true";
  const useMoneda = String((req.query as any)?.useMoneda || "").toLowerCase() === "true";
  const currency = String((req.query as any)?.currency || "").trim();
  if (useMoneda && !currency) missing.push("Filtro Moneda requiere selecci?n.");
  const useMonedaPago = String((req.query as any)?.useMonedaPago || "").toLowerCase() === "true";
  const paymentCurrency = String((req.query as any)?.paymentCurrency || "").trim();
  if (useMonedaPago && !paymentCurrency) missing.push("Filtro Moneda Pago requiere selecci?n.");
  const useTipoCobro = String((req.query as any)?.useTipoCobro || "").toLowerCase() === "true";
  const paymentKey = String((req.query as any)?.paymentKey || "").trim();
  if (useTipoCobro && !paymentKey) missing.push("Filtro Tipo de Cobro requiere selecci?n.");
  const useMotivo = String((req.query as any)?.useMotivo || "").toLowerCase() === "true";
  const motivo = String((req.query as any)?.motivo || "").trim();
  if (useMotivo && !motivo) missing.push("Filtro Motivo Anulaci?n requiere selecci?n.");
  const usePerfil = String((req.query as any)?.usePerfil || "").toLowerCase() === "true";
  const perfilId = String((req.query as any)?.perfilId || "").trim();
  if (usePerfil && !perfilId) missing.push("Filtro Perfil Empresa requiere selecci?n.");

  const invoiceNumberFrom = String((req.query as any)?.invoiceNumberFrom || "").trim();
  const invoiceNumberTo = String((req.query as any)?.invoiceNumberTo || "").trim();
  const useInvoiceNumber = String((req.query as any)?.useInvoiceNumber || "").toLowerCase() === "true";
  if (useInvoiceNumber && !invoiceNumberFrom && !invoiceNumberTo) missing.push("Filtro N. Factura requiere rango.");

  const restCfg = await prisma.restaurantConfig.findUnique({ where: { hotelId } });
  const storedPayments = (restCfg?.payments && typeof restCfg.payments === "object" ? restCfg.payments : {}) as any;
  const paymentCobros = Array.isArray(storedPayments.cobros)
    ? storedPayments.cobros
    : typeof storedPayments.cobros === "string"
      ? String(storedPayments.cobros)
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : ["Efectivo", "Tarjeta"];
  const paymentCurrencies = [storedPayments.monedaBase || "CRC", storedPayments.monedaSec || "USD"]
    .map((c: any) => String(c).trim())
    .filter(Boolean);
  const hotelRow = await prisma.hotel.findFirst({ where: { id: hotelId }, select: { name: true, currency: true } });
  const hotelCurrency = String(hotelRow?.currency || paymentCurrencies[0] || "CRC");

  const shiftWhere: Prisma.CashAuditWhereInput = {
    hotelId,
    module: "RESTAURANT",
    closedAt: { not: null },
  };
  if (useFechaCierre && (dateFrom || dateTo)) {
    shiftWhere.closedAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
      not: null,
    };
  }

  const shifts = await prisma.cashAudit.findMany({
    where: shiftWhere,
    orderBy: { closedAt: "desc" },
    take: 90,
  });
  if (shifts.length === 0) return res.json({ items: [], missing: ["No hay turnos cerrados disponibles."] });

  let useShifts = shifts;
  if (useTurno && shiftId) {
    const chosen = shifts.find((s) => s.id === shiftId);
    if (!chosen) return res.json({ items: [], missing: ["Turno no encontrado o no cerrado."] });
    useShifts = [chosen];
  } else if (!useFechaCierre && !useTurno) {
    useShifts = [shifts[0]];
  }
  const shiftNumberMap = new Map(useShifts.map((s, idx) => [s.id, idx + 1]));

  const ranges = useShifts
    .filter((s) => s.closedAt)
    .map((s) => ({
      createdAt: {
        gte: s.openedAt || s.createdAt || new Date(0),
        lte: s.closedAt as Date,
      },
    }));

  const docs = await prisma.eInvoicingDocument.findMany({
    where: {
      hotelId,
      restaurantOrderId: { not: null },
      OR: ranges,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      restaurantOrderId: true,
      docType: true,
      status: true,
      consecutive: true,
      key: true,
      createdAt: true,
    },
  });

  let filteredDocs = docs;
  if (useInvoiceNumber && (invoiceNumberFrom || invoiceNumberTo)) {
    const fromNum = invoiceNumberFrom ? Number(invoiceNumberFrom) : NaN;
    const toNum = invoiceNumberTo ? Number(invoiceNumberTo) : NaN;
    filteredDocs = filteredDocs.filter((d) => {
      const val = typeof d.consecutive === "string" ? Number(d.consecutive) : Number(d.consecutive ?? NaN);
      if (!Number.isFinite(val)) return false;
      if (Number.isFinite(fromNum) && val < fromNum) return false;
      if (Number.isFinite(toNum) && val > toNum) return false;
      return true;
    });
  }

  const orderIds = Array.from(new Set(filteredDocs.map((d) => d.restaurantOrderId).filter(Boolean) as string[]));
  const orders = await prisma.restaurantOrder.findMany({
    where: { hotelId, id: { in: orderIds } },
    select: {
      id: true,
      tableId: true,
      sectionId: true,
      subtotal: true,
      tax: true,
      total: true,
      tip10: true,
      discountAmount: true,
      note: true,
      covers: true,
      serviceType: true,
      roomId: true,
      waiterId: true,
      cashierId: true,
      shiftId: true,
      createdByStaffId: true,
      closedByStaffId: true,
      status: true,
      paymentBreakdown: true,
      items: {
        select: {
          id: true,
          name: true,
          qty: true,
          price: true,
          detailNote: true,
        },
      },
    },
  });
  const orderMap = new Map(orders.map((o) => [o.id, o]));

  const events = await prisma.restaurantOrderEvent.findMany({
    where: { hotelId, orderId: { in: orderIds }, eventType: "ORDER_VOID" },
    select: { orderId: true, payload: true },
  });
  const reasonMap = new Map(
    events
      .map((e) => ({ orderId: e.orderId || "", reason: (e.payload as any)?.reason }))
      .filter((e) => e.orderId && e.reason)
      .map((e) => [e.orderId, e.reason])
  );

  const normalized = filteredDocs.map((d) => {
    const order = d.restaurantOrderId ? orderMap.get(d.restaurantOrderId) : null;
    const shift =
      (order?.shiftId ? useShifts.find((s) => s.id === order.shiftId) : null) ||
      useShifts.find((s) => {
        const openedAt = s.openedAt || s.createdAt || new Date(0);
        const closedAt = s.closedAt || new Date(0);
        return d.createdAt >= openedAt && d.createdAt <= closedAt;
      });
    return {
      id: d.id,
      restaurantOrderId: d.restaurantOrderId,
      docType: d.docType,
      status: d.status,
      consecutive: d.consecutive,
      key: d.key,
      createdAt: d.createdAt,
      shiftId: shift?.id || null,
      shiftNumber: shift?.id ? shiftNumberMap.get(shift.id) || null : null,
      closedAt: shift?.closedAt || null,
      order: order
        ? {
            id: order.id,
            tableId: fromInternalId(hotelId, order.tableId),
            sectionId: order.sectionId ? fromInternalId(hotelId, order.sectionId) : null,
            subtotal: order.subtotal,
            tax: order.tax,
            total: order.total,
            tip10: order.tip10,
            discountAmount: order.discountAmount,
            note: order.note,
            covers: order.covers,
            serviceType: order.serviceType,
            roomId: order.roomId,
            items: order.items,
            waiterId: order.waiterId,
            cashierId: order.cashierId,
            shiftId: order.shiftId || null,
            createdByStaffId: order.createdByStaffId || null,
            closedByStaffId: order.closedByStaffId || null,
            currency: hotelCurrency,
            paymentCurrency: hotelCurrency,
            paymentBreakdown: order.paymentBreakdown,
            status: order.status,
            voidReason: reasonMap.get(order.id) || null,
          }
        : null,
    };
  });

  let filteredList = normalized;
  if (useMoneda && currency) {
    filteredList = filteredList.filter((row) => {
      const rowCurrency = (row as any)?.order?.currency || hotelCurrency;
      return String(rowCurrency || "").toUpperCase() === String(currency || "").toUpperCase();
    });
  }
  if (useMonedaPago && paymentCurrency) {
    filteredList = filteredList.filter((row) => {
      const rowPayCurrency = (row as any)?.order?.paymentCurrency || hotelCurrency;
      return String(rowPayCurrency || "").toUpperCase() === String(paymentCurrency || "").toUpperCase();
    });
  }
  if (useTipoCobro && paymentKey) {
    filteredList = filteredList.filter((row) => {
      const pb = (row as any)?.order?.paymentBreakdown && typeof (row as any).order.paymentBreakdown === "object"
        ? (row as any).order.paymentBreakdown
        : {};
      const val = (pb as any)[paymentKey];
      return typeof val === "number" ? val > 0 : Boolean(val);
    });
  }
  if (useMotivo && motivo) {
    filteredList = filteredList.filter((row) => String((row as any)?.order?.voidReason || "") === motivo);
  }
  if (usePerfil && perfilId) {
    filteredList = filteredList.filter(() => perfilId === hotelId);
  }

  const byStatus = filteredList.filter((row) => {
    const docStatus = String(row.status || "").toUpperCase();
    const isVoided = docStatus.includes("VOID") || docStatus.includes("CANCEL") || docStatus.includes("ANUL");
    if (isVoided && includeVoided) return true;
    if (!isVoided && includePaid) return true;
    return false;
  });

  const reasons = Array.from(new Set((byStatus || []).map((r: any) => r?.order?.voidReason).filter(Boolean)));
  const profiles = hotelRow ? [{ id: hotelId, name: hotelRow.name || hotelId }] : [];

  const totalRows = byStatus.length;
  const pageRows = byStatus.slice(pageOffset, pageOffset + pageLimit);

  return res.json({
    items: pageRows,
    total: totalRows,
    limit: pageLimit,
    offset: pageOffset,
    missing,
    filters: {
      currencies: paymentCurrencies,
      paymentMethods: paymentCobros,
      reasons,
      profiles,
    },
  });
}
