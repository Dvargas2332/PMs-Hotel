import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import { nextHotelSequence, padNumber } from "../lib/sequences.js";
import { canConvert, convertQty, isSupportedUnit, normalizeUnit } from "../lib/units.js";

const asNumber = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
};

const toInternalId = (hotelId: string, externalId: string) => `${hotelId}:${externalId}`;
const fromInternalId = (hotelId: string, internalId: string) => {
  const prefix = `${hotelId}:`;
  return internalId.startsWith(prefix) ? internalId.slice(prefix.length) : internalId;
};

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

  const mapped = sections.map((s) => ({
    ...s,
    id: fromInternalId(hotelId, s.id),
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
  if (!section) return res.status(404).json({ message: "Seccion no encontrada" });

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
  if (!section) return res.status(404).json({ message: "Seccion no encontrada" });

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
  if (!section) return res.status(404).json({ message: "Seccion no encontrada" });

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
  if (!section) return res.status(404).json({ message: "Seccion no encontrada" });

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
  if (!section) return res.status(404).json({ message: "Seccion no encontrada" });

  const internalTableId = toInternalId(hotelId, tableId);
  const table = await prisma.restaurantTable.findFirst({
    where: { hotelId, sectionId: section.id, OR: [{ id: internalTableId }, { id: tableId }] },
  });
  if (!table) return res.status(404).json({ message: "Mesa no encontrada" });

  const { x, y } = req.body || {};
  const nx = typeof x === "number" ? x : typeof x === "string" ? Number(x) : undefined;
  const ny = typeof y === "number" ? y : typeof y === "string" ? Number(y) : undefined;
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return res.status(400).json({ message: "x e y requeridos" });

  const updated = await prisma.restaurantTable.update({
    where: { id: table.id },
    data: { x: nx, y: ny },
  });
  res.json({ ...updated, id: fromInternalId(hotelId, updated.id), sectionId });
}

export async function createSection(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { id, name } = req.body || {};
  if (!id || !name) return res.status(400).json({ message: "id y name requeridos" });

  const externalId = String(id);
  const internalId = toInternalId(user.hotelId, externalId);
  const section = await prisma.restaurantSection.upsert({
    where: { id: internalId },
    update: { name, hotelId: user.hotelId },
    create: { id: internalId, name, hotelId: user.hotelId },
  });
  res.json({ ...section, id: externalId });
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
  if (!exists) return res.status(404).json({ message: "Seccion no encontrada" });

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
  if (!section) return res.status(404).json({ message: "Seccion no encontrada" });

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
  if (!section) return res.status(404).json({ message: "Seccion no encontrada" });

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
  const internalSectionId = sectionId ? toInternalId(user.hotelId, sectionId) : undefined;
  const where = internalSectionId
    ? { hotelId: user.hotelId, sectionId: { in: [internalSectionId, sectionId as string] } }
    : { hotelId: user.hotelId };
  const items = await prisma.restaurantMenuItem.findMany({
    where,
    orderBy: [{ sectionId: "asc" }, { category: "asc" }, { name: "asc" }],
  });
  res.json(items);
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
  if (!section) return res.status(404).json({ message: "Seccion no encontrada" });

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

export async function deleteMenuItem(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { sectionId, itemId } = req.params as { sectionId?: string; itemId?: string };
  if (!sectionId || !itemId) return res.status(400).json({ message: "sectionId y itemId requeridos" });

  const item = await prisma.restaurantMenuItem.findFirst({ where: { id: itemId, hotelId: user.hotelId } });
  if (!item) return res.status(404).json({ message: "Item no encontrado" });

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

  const { name, active } = req.body || {};
  if (!name) return res.status(400).json({ message: "name requerido" });

  const created = await prisma.restaurantFamily.create({
    data: { hotelId: user.hotelId, name: String(name).trim(), active: active !== false },
  });
  res.json(created);
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
    res.status(409).json({ message: "No se puede eliminar: hay artículos asociados" });
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

  const { familyId, name, active } = req.body || {};
  if (!familyId || !name) return res.status(400).json({ message: "familyId y name requeridos" });

  const family = await prisma.restaurantFamily.findFirst({ where: { id: String(familyId), hotelId: user.hotelId } });
  if (!family) return res.status(404).json({ message: "Familia no encontrada" });

  const created = await prisma.restaurantSubFamily.create({
    data: { hotelId: user.hotelId, familyId: family.id, name: String(name).trim(), active: active !== false },
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
    res.status(409).json({ message: "No se puede eliminar: hay artículos asociados" });
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

  const { subFamilyId, name, active } = req.body || {};
  if (!subFamilyId || !name) return res.status(400).json({ message: "subFamilyId y name requeridos" });

  const sf = await prisma.restaurantSubFamily.findFirst({ where: { id: String(subFamilyId), hotelId: user.hotelId } });
  if (!sf) return res.status(404).json({ message: "Subfamilia no encontrada" });

  const created = await prisma.restaurantSubSubFamily.create({
    data: { hotelId: user.hotelId, subFamilyId: sf.id, name: String(name).trim(), active: active !== false },
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
    res.status(409).json({ message: "No se puede eliminar: hay artículos asociados" });
  }
}

export async function listItems(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const items = await prisma.restaurantItem.findMany({
    where: { hotelId: user.hotelId },
    include: { family: true, subFamily: true, subSubFamily: true },
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
      price: i.price,
      tax: i.tax,
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
  if (!list.length) return res.status(400).json({ message: "items requerido" });

  const created: any[] = [];
  for (const raw of list) {
    const incomingCode = String(raw?.code || "").trim();
    const name = String(raw?.name || "").trim();
    const familyId = String(raw?.familyId || "").trim();
    const subFamilyId = raw?.subFamilyId ? String(raw.subFamilyId).trim() : null;
    const subSubFamilyId = raw?.subSubFamilyId ? String(raw.subSubFamilyId).trim() : null;

    if (!name || !familyId) {
      return res.status(400).json({ message: "name y familyId son requeridos" });
    }

    const family = await prisma.restaurantFamily.findFirst({ where: { id: familyId, hotelId: user.hotelId } });
    if (!family) return res.status(404).json({ message: `Familia no encontrada (${familyId})` });

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
    const code = incomingCode || `ITEM-${padNumber(number, 6)}`;

    const item = await prisma.restaurantItem.create({
      data: {
        hotelId: user.hotelId,
        number,
        code,
        name,
        cabys: raw?.cabys ? String(raw.cabys) : null,
        price: Number(raw?.price || 0),
        tax: Number(raw?.tax || 0),
        notes: raw?.notes ? String(raw.notes) : null,
        active: raw?.active !== false,
        familyId: family.id,
        subFamilyId: sf?.id || null,
        subSubFamilyId: ssf?.id || null,
      },
      include: { family: true, subFamily: true, subSubFamily: true },
    });

    created.push({
      id: item.id,
      hotelId: item.hotelId,
      code: item.code,
      name: item.name,
      cabys: item.cabys,
      price: item.price,
      tax: item.tax,
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

export async function deleteItem(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { id } = req.params as { id?: string };
  if (!id) return res.status(400).json({ message: "id requerido" });

  const it = await prisma.restaurantItem.findFirst({ where: { id, hotelId: user.hotelId } });
  if (!it) return res.status(404).json({ message: "Artículo no encontrado" });

  await prisma.restaurantItem.deleteMany({ where: { id: it.id, hotelId: user.hotelId } });
  res.json({ ok: true });
}

export async function listOrders(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const status = (req.query.status as string | undefined) || "OPEN";
  const sectionId = (req.query.section as string | undefined) || undefined;
  const internalSectionId = sectionId ? toInternalId(hotelId, sectionId) : undefined;

  const orders = await prisma.restaurantOrder.findMany({
    where: {
      hotelId,
      ...(status ? { status: status as any } : {}),
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

export async function createOrUpdateOrder(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const { sectionId, tableId, items, note, covers, serviceType, roomId } = req.body as {
    sectionId?: string;
    tableId: string;
    items: { id: string; name: string; category?: string; price: number; qty: number }[];
    note?: string;
    covers?: number;
    serviceType?: string;
    roomId?: string;
  };
  if (!tableId || !Array.isArray(items)) return res.status(400).json({ message: "tableId e items requeridos" });

  const internalTableId = toInternalId(hotelId, String(tableId));
  const internalSectionId = sectionId ? toInternalId(hotelId, String(sectionId)) : undefined;

  const existing = await prisma.restaurantOrder.findFirst({
    where: { hotelId, status: "OPEN", tableId: { in: [internalTableId, String(tableId)] } },
    include: { items: true },
  });

  const subtotal = items.reduce((acc, i) => acc + Number(i.price || 0) * Number(i.qty || 0), 0);
  const taxes = await getRestaurantTaxesForHotel(hotelId);
  const service = subtotal * (taxes.servicio / 100);
  const tax = (subtotal + service) * (taxes.iva / 100);
  const total = subtotal + service + tax;
  const inferredServiceType = String(serviceType || existing?.serviceType || "DINE_IN");

  const resolvedSectionId = internalSectionId
    ? (await prisma.restaurantSection.findFirst({
        where: { hotelId, OR: [{ id: internalSectionId }, { id: String(sectionId) }] },
        select: { id: true },
      }))?.id ?? internalSectionId
    : undefined;

  const order = existing
    ? await prisma.$transaction(async (tx) => {
        await tx.restaurantOrder.updateMany({
          where: { id: existing.id, hotelId },
          data: {
            sectionId: resolvedSectionId || existing.sectionId,
            tableId: internalTableId,
            waiterId: user.sub,
            note: note ?? existing.note,
            covers: covers ?? existing.covers,
            serviceType: inferredServiceType,
            roomId: roomId ?? existing.roomId,
            total,
            tip10: service,
          },
        });

        const existingItems = await tx.restaurantOrderItem.findMany({
          where: { hotelId, orderId: existing.id },
          select: { itemId: true, area: true, status: true },
        });
        const existingMap = new Map(existingItems.map((i) => [i.itemId, i]));
        const incomingIds = items.map((i) => String(i.id));

        await tx.restaurantOrderItem.deleteMany({
          where: { hotelId, orderId: existing.id, itemId: { notIn: incomingIds } },
        });

        for (const i of items) {
          const prev = existingMap.get(String(i.id));
          const cat = (i.category || "").toLowerCase();
          const isBar = cat.includes("bebida") || cat.includes("bar");
          await tx.restaurantOrderItem.upsert({
            where: { hotelId_orderId_itemId: { hotelId, orderId: existing.id, itemId: String(i.id) } },
            update: {
              name: i.name,
              category: i.category || "",
              price: i.price,
              qty: i.qty,
              area: prev?.area ?? (isBar ? "BAR" : "KITCHEN"),
              status: prev?.status ?? "NEW",
            },
            create: {
              hotelId,
              orderId: existing.id,
              itemId: String(i.id),
              name: i.name,
              category: i.category || "",
              price: i.price,
              qty: i.qty,
              area: isBar ? "BAR" : "KITCHEN",
              status: "NEW",
            },
          });
        }

        return tx.restaurantOrder.findFirst({ where: { id: existing.id, hotelId }, include: { items: true } });
      })
    : await prisma.restaurantOrder.create({
        data: {
          hotelId,
          sectionId: resolvedSectionId || null,
          tableId: internalTableId,
          waiterId: user.sub,
          status: "OPEN",
          note: note || "",
          covers: covers || 0,
          serviceType: inferredServiceType,
          roomId: roomId || null,
          total,
          tip10: service,
          items: {
            create: items.map((i) => {
              const cat = (i.category || "").toLowerCase();
              const isBar = cat.includes("bebida") || cat.includes("bar");
              return {
                hotelId,
                itemId: String(i.id),
                name: i.name,
                category: i.category || "",
                price: i.price,
                qty: i.qty,
                area: isBar ? "BAR" : "KITCHEN",
                status: "NEW",
              };
            }),
          },
        },
        include: { items: true },
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

  const { tableId, payments, totals, note, serviceType, roomId } = req.body || {};
  if (!tableId) return res.status(400).json({ message: "tableId requerido" });

  const order = await prisma.restaurantOrder.findFirst({
    where: {
      hotelId,
      status: "OPEN",
      tableId: { in: [toInternalId(hotelId, String(tableId)), String(tableId)] },
    },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ message: "Orden no encontrada" });

  const totalToSave = asNumber(totals?.total ?? totals?.reported) || asNumber(order.total);
  const serviceToSave = asNumber(totals?.service) || asNumber(order.tip10);

  // Cargo a habitacion (FrontDesk): creamos un InvoiceItem en la factura del hospedaje.
  const roomAmount = asNumber(payments?.room);
  const roomTarget = String(roomId || order.roomId || payments?.roomId || payments?.roomNumber || "");
  if (roomAmount > 0 && roomTarget) {
    const room = await prisma.room.findFirst({
      where: { hotelId, number: roomTarget },
      select: { id: true },
    });
    if (!room) return res.status(400).json({ message: "Habitacion no encontrada para cargo" });

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
    if (!stay) return res.status(400).json({ message: "No hay estancia activa para esa habitacion" });

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
      },
    });
    if (written.count === 0) return null;

    const updatedOrder = await tx.restaurantOrder.findFirst({
      where: { id: order.id, hotelId },
      include: { items: true },
    });
    if (!updatedOrder) return null;

    // Consume inventory based on recipes (per sold item qty).
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

    return updatedOrder;
  });
  if (!updated) return res.status(404).json({ message: "Orden no encontrada" });
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

  if (!desc) return res.status(400).json({ message: "desc requerido" });
  if (!unit) return res.status(400).json({ message: "unidad requerida" });
  if (!isSupportedUnit(unit)) return res.status(400).json({ message: "unidad inválida" });

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
      codigo: r.restaurantItem?.code || r.restaurantItemId,
      ingrediente: r.inventoryItem?.sku || r.inventoryItemId,
      cantidad: Number(r.qty || 0),
      unidad: r.inventoryItem?.unit || "",
      note: r.note || "",
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

  if (!codigo || !ingrediente) return res.status(400).json({ message: "codigo e ingrediente requeridos" });
  if (!Number.isFinite(cantidad) || cantidad <= 0) return res.status(400).json({ message: "cantidad inválida" });
  if (unidad && !isSupportedUnit(unidad)) return res.status(400).json({ message: "unidad inválida" });

  const restaurantItem = await prisma.restaurantItem.findFirst({
    where: {
      hotelId: user.hotelId,
      OR: [{ id: codigo }, { code: codigo }],
    },
    select: { id: true, code: true, name: true },
  });
  if (!restaurantItem) return res.status(404).json({ message: "Artículo de venta no encontrado (codigo)" });

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

export async function moveOrderTable(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { fromTableId, toTableId } = req.body || {};
  if (!fromTableId || !toTableId) return res.status(400).json({ message: "fromTableId y toTableId requeridos" });

  const hotelId = user.hotelId;
  const fromInternal = toInternalId(hotelId, String(fromTableId));
  const toInternal = toInternalId(hotelId, String(toTableId));

  if (fromInternal === toInternal) return res.json({ ok: true, moved: false });

  const role = String(user.role || "").toUpperCase();
  if (!["ADMIN", "MANAGER"].includes(role)) {
    return res.status(403).json({ message: "Solo ADMIN/MANAGER pueden cambiar mesa" });
  }

  const order = await prisma.restaurantOrder.findFirst({
    where: { hotelId, status: "OPEN", tableId: { in: [fromInternal, String(fromTableId)] } },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ message: "Orden abierta no encontrada para esa mesa" });

  const target = await prisma.restaurantTable.findFirst({
    where: { hotelId, id: { in: [toInternal, String(toTableId)] } },
    select: { id: true, sectionId: true },
  });
  if (!target) return res.status(404).json({ message: "Mesa destino no encontrada" });

  const existsOnTarget = await prisma.restaurantOrder.findFirst({
    where: { hotelId, status: "OPEN", tableId: target.id },
    select: { id: true },
  });
  if (existsOnTarget) return res.status(409).json({ message: "La mesa destino ya tiene una orden abierta" });

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

  const { orderId, tableId } = req.body || {};
  if (!orderId && !tableId) return res.status(400).json({ message: "orderId o tableId requerido" });

  const where: any = { hotelId };
  if (orderId) where.id = String(orderId);
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

  const job = await prisma.restaurantPrintJob.create({
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

  res.json({ ok: true, job });
}

export async function voidRestaurantInvoice(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });
  const hotelId = user.hotelId;

  const { restaurantOrderId, tableId, docType, reason } = req.body || {};
  if (!restaurantOrderId && !tableId) return res.status(400).json({ message: "restaurantOrderId o tableId requerido" });

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
  if (type && !["FE", "TE"].includes(type)) return res.status(400).json({ message: "docType invalido" });

  const doc = await prisma.eInvoicingDocument.findFirst({
    where: {
      hotelId,
      restaurantOrderId: orderId,
      ...(type ? { docType: type as any } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  if (!doc) return res.status(404).json({ message: "No hay documento electronico para anular" });

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
        message: String(reason || "Canceled from Restaurant POS"),
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
  res.json(cfg || { kitchenPrinter: "", barPrinter: "" });
}

export async function updateRestaurantConfig(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const payload = {
    kitchenPrinter: req.body?.kitchenPrinter || "",
    barPrinter: req.body?.barPrinter || "",
  };

  const cfg = await prisma.restaurantConfig.upsert({
    where: { hotelId: user.hotelId },
    update: payload,
    create: { hotelId: user.hotelId, ...payload },
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
  res.json(cfg.payments || { monedaBase: "CRC", monedaSec: "USD", tipoCambio: 530, cobros: ["Efectivo", "Tarjeta"], cargoHabitacion: true });
}

export async function updateRestaurantPayments(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const next = {
    monedaBase: String((body as any).monedaBase || "CRC"),
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
  ].filter(Boolean);
  res.json(list);
}

export async function printRestaurantOrder(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const { sectionId, tableId, items, note, covers, printers, fromTableId } = req.body || {};

  if (!tableId || !Array.isArray(items)) {
    return res.status(400).json({ message: "tableId e items son requeridos" });
  }

  if (fromTableId && fromTableId !== tableId) {
    const role = (user.role || "").toUpperCase();
    if (!["ADMIN", "MANAGER"].includes(role)) {
      return res.status(403).json({ message: "No puedes reasignar productos a otra mesa" });
    }
  }

  if (printers && (printers.kitchenPrinter || printers.barPrinter)) {
    const role = (user.role || "").toUpperCase();
    if (!["ADMIN", "MANAGER"].includes(role)) {
      return res.status(403).json({ message: "Solo perfiles autorizados pueden cambiar impresoras" });
    }
  }

  const internalTableId = toInternalId(user.hotelId, String(tableId));
  const internalSectionId = sectionId ? toInternalId(user.hotelId, String(sectionId)) : null;

  const job = await prisma.restaurantPrintJob.create({
    data: {
      hotelId: user.hotelId,
      sectionId: internalSectionId,
      tableId: internalTableId,
      items,
      note: note || "",
      covers: covers || 0,
      kitchenPrinter: printers?.kitchenPrinter || null,
      barPrinter: printers?.barPrinter || null,
      userId: user.sub,
    },
  });

  res.json({ ok: true, job });
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
  if (!["KITCHEN", "BAR"].includes(area)) return res.status(400).json({ message: "area invalida" });

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
    return res.status(400).json({ message: "status invalido" });
  }

  const item = await prisma.restaurantOrderItem.findFirst({
    where: { id: orderItemId, hotelId: user.hotelId, order: { hotelId: user.hotelId } },
    select: { id: true },
  });
  if (!item) return res.status(404).json({ message: "Item no encontrado" });

  const written = await prisma.restaurantOrderItem.updateMany({
    where: { id: orderItemId, hotelId: user.hotelId },
    data: { status: nextStatus as any },
  });
  if (written.count === 0) return res.status(404).json({ message: "Item no encontrado" });
  const updated = await prisma.restaurantOrderItem.findFirst({ where: { id: orderItemId, hotelId: user.hotelId } });

  res.json({ ok: true, item: updated });
}

export async function listCloses(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const closes = await prisma.restaurantClose.findMany({
    where: { hotelId: user.hotelId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(closes);
}

export async function closeShift(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  if (!user.hotelId) return res.status(400).json({ message: "Hotel no definido" });

  const role = (user.role || "").toUpperCase();
  if (!["ADMIN", "MANAGER"].includes(role)) {
    return res.status(403).json({ message: "Solo ADMIN/MANAGER pueden cerrar turno" });
  }

  const { totals, payments, note, breakdown } = req.body || {};

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

  const reported =
    typeof totals === "object" && totals
      ? asNumber((totals as any).reported ?? (totals as any).system)
      : asNumber(
          payments && typeof payments === "object"
            ? Object.values(payments as Record<string, unknown>).reduce<number>((acc, v) => acc + asNumber(v), 0)
            : 0
        );

  const safeTotals = { system, reported, diff: reported - system };

  const close = await prisma.restaurantClose.create({
    data: {
      hotelId: user.hotelId,
      turno: `T-${Date.now()}`,
      totals: safeTotals as any,
      payments: (payments || {}) as any,
      breakdown: breakdown || {},
      note: note || "",
      userId: user.sub,
    },
  });

  res.json({ ok: true, close });
}
