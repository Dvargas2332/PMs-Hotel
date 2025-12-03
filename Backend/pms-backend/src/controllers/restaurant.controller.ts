import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

export async function listSections(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const sections = await prisma.restaurantSection.findMany({
    where: { hotelId: user.hotelId },
    include: { tables: true },
    orderBy: { name: "asc" },
  });
  return res.json(sections);
}

export async function createSection(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { id, name } = req.body || {};
  if (!id || !name) return res.status(400).json({ message: "id y name requeridos" });

  const section = await prisma.restaurantSection.create({
    data: { id, name, hotelId: user.hotelId },
  });
  res.json(section);
}

export async function deleteSection(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { sectionId } = req.params as { sectionId?: string };
  if (!sectionId) return res.status(400).json({ message: "sectionId requerido" });

  const exists = await prisma.restaurantSection.findFirst({ where: { id: sectionId, hotelId: user.hotelId } });
  if (!exists) return res.status(404).json({ message: "Seccion no encontrada" });

  await prisma.restaurantSection.delete({
    where: { id: sectionId },
  });
  res.json({ ok: true });
}

export async function addTableToSection(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { sectionId } = req.params as { sectionId?: string };
  const { id, name, seats } = req.body || {};
  if (!sectionId || !id || !name) return res.status(400).json({ message: "sectionId, id y name requeridos" });

  const section = await prisma.restaurantSection.findFirst({ where: { id: sectionId, hotelId: user.hotelId } });
  if (!section) return res.status(404).json({ message: "Seccion no encontrada" });

  await prisma.restaurantTable.create({
    data: { id, name, seats: Number(seats || 0) || 2, sectionId: section.id },
  });

  const tables = await prisma.restaurantTable.findMany({ where: { sectionId }, orderBy: { name: "asc" } });
  res.json(tables);
}

export async function deleteTableFromSection(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { sectionId, tableId } = req.params as { sectionId?: string; tableId?: string };
  if (!sectionId || !tableId) return res.status(400).json({ message: "sectionId y tableId requeridos" });

  const section = await prisma.restaurantSection.findFirst({ where: { id: sectionId, hotelId: user.hotelId } });
  if (!section) return res.status(404).json({ message: "Seccion no encontrada" });

  await prisma.restaurantTable.delete({ where: { id: tableId } });
  res.json({ ok: true });
}

export async function listMenu(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const sectionId = (req.query.section as string | undefined) || undefined;
  const where = sectionId ? { hotelId: user.hotelId, sectionId } : { hotelId: user.hotelId };
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

  const section = await prisma.restaurantSection.findFirst({ where: { id: sectionId, hotelId: user.hotelId } });
  if (!section) return res.status(404).json({ message: "Seccion no encontrada" });

  const item = await prisma.restaurantMenuItem.create({
    data: {
      id: id || undefined,
      hotelId: user.hotelId,
      sectionId,
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

  await prisma.restaurantMenuItem.delete({ where: { id: itemId } });
  res.json({ ok: true });
}

export async function createOrUpdateOrder(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { sectionId, tableId, items, note, covers } = req.body as {
    sectionId?: string;
    tableId: string;
    items: { id: string; name: string; category?: string; price: number; qty: number }[];
    note?: string;
    covers?: number;
  };
  if (!tableId || !Array.isArray(items)) return res.status(400).json({ message: "tableId e items requeridos" });

  const existing = await prisma.restaurantOrder.findFirst({
    where: { hotelId: user.hotelId, tableId, status: "OPEN" },
    include: { items: true },
  });

  const total = items.reduce((acc, i) => acc + Number(i.price || 0) * Number(i.qty || 0), 0);
  const tip10 = total * 0.1;

  const order = existing
    ? await prisma.restaurantOrder.update({
        where: { id: existing.id },
        data: {
          sectionId: sectionId || existing.sectionId,
          waiterId: user.sub,
          note: note ?? existing.note,
          covers: covers ?? existing.covers,
          total,
          tip10,
          items: {
            deleteMany: {},
            create: items.map((i) => ({
              itemId: i.id,
              name: i.name,
              category: i.category || "",
              price: i.price,
              qty: i.qty,
            })),
          },
        },
        include: { items: true },
      })
    : await prisma.restaurantOrder.create({
        data: {
          hotelId: user.hotelId,
          sectionId: sectionId || null,
          tableId,
          waiterId: user.sub,
          status: "OPEN",
          note: note || "",
          covers: covers || 0,
          total,
          tip10,
          items: {
            create: items.map((i) => ({
              itemId: i.id,
              name: i.name,
              category: i.category || "",
              price: i.price,
              qty: i.qty,
            })),
          },
        },
        include: { items: true },
      });

  res.json(order);
}

export async function closeOrder(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.hotelId) return res.status(401).json({ message: "No autenticado" });

  const { tableId, payments, totals, note } = req.body || {};
  if (!tableId) return res.status(400).json({ message: "tableId requerido" });

  const order = await prisma.restaurantOrder.findFirst({
    where: { hotelId: user.hotelId, tableId, status: "OPEN" },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ message: "Orden no encontrada" });

  const updated = await prisma.restaurantOrder.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paymentBreakdown: payments || {},
      total: totals?.reported ?? order.total,
      tip10: totals?.service ?? order.tip10,
      note: note ?? order.note,
    },
    include: { items: true },
  });
  res.json({ ok: true, order: updated });
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

  const job = await prisma.restaurantPrintJob.create({
    data: {
      hotelId: user.hotelId,
      sectionId: sectionId || null,
      tableId,
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
  if (!totals || typeof totals.system !== "number") {
    return res.status(400).json({ message: "totals.system requerido" });
  }

  const close = await prisma.restaurantClose.create({
    data: {
      hotelId: user.hotelId,
      turno: `T-${Date.now()}`,
      totals,
      payments,
      breakdown: breakdown || {},
      note: note || "",
      userId: user.sub,
    },
  });

  res.json({ ok: true, close });
}
