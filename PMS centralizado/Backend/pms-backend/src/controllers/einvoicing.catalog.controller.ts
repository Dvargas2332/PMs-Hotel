import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

function normalizeText(v: any): string {
  return String(v ?? "").trim();
}

function parseImportText(text: string): Array<{ code: string; label: string }> {
  const out: Array<{ code: string; label: string }> = [];
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const parts = line.split(/[;\t|]/g).map((p) => p.trim());
    if (parts.length < 2) continue;
    const code = parts[0];
    const label = parts.slice(1).join(" ").trim();
    if (!code || !label) continue;
    out.push({ code, label });
  }
  return out;
}

export async function listCabys(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const q = normalizeText((req.query as any)?.q);
  const take = Math.min(200, Math.max(1, Number((req.query as any)?.take || 50) || 50));

  const where: any = { hotelId };
  if (q) {
    where.OR = [
      { id: { startsWith: q } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.cabysCode.findMany({
    where,
    orderBy: { id: "asc" },
    take,
    select: { id: true, description: true, updatedAt: true },
  });
  res.json(rows);
}

export async function importCabys(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const mode = normalizeText((req.body as any)?.mode || "merge"); // merge | replace
  const itemsRaw = Array.isArray((req.body as any)?.items) ? (req.body as any).items : null;
  const textRaw = normalizeText((req.body as any)?.text);

  let items: Array<{ code: string; label: string }> = [];
  if (itemsRaw) {
    items = itemsRaw
      .map((it: any) => ({ code: normalizeText(it?.code || it?.id), label: normalizeText(it?.label || it?.description) }))
      .filter((it: any) => it.code && it.label);
  } else if (textRaw) {
    items = parseImportText(textRaw);
  }

  if (!items.length) return res.status(400).json({ message: "No items to import" });

  const normalized = items.map((it) => ({
    id: String(it.code),
    description: String(it.label),
    hotelId,
  }));

  if (mode === "replace") {
    await prisma.cabysCode.deleteMany({ where: { hotelId } });
  }

  const chunks: typeof normalized[] = [];
  for (let i = 0; i < normalized.length; i += 5000) chunks.push(normalized.slice(i, i + 5000));

  let created = 0;
  for (const chunk of chunks) {
    const r = await prisma.cabysCode.createMany({ data: chunk, skipDuplicates: true });
    created += r.count || 0;
  }

  res.json({ ok: true, imported: normalized.length, created });
}

export async function listCatalogEntries(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const catalog = normalizeText((req.params as any)?.catalog);
  if (!catalog) return res.status(400).json({ message: "catalog requerido" });

  const q = normalizeText((req.query as any)?.q);
  const take = Math.min(200, Math.max(1, Number((req.query as any)?.take || 100) || 100));

  const where: any = { hotelId, catalog };
  if (q) {
    where.OR = [
      { code: { startsWith: q } },
      { label: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.eInvoicingCatalogEntry.findMany({
    where,
    orderBy: [{ code: "asc" }],
    take,
    select: { id: true, catalog: true, code: true, label: true, version: true, updatedAt: true },
  });
  res.json(rows);
}

export async function importCatalogEntries(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const catalog = normalizeText((req.params as any)?.catalog);
  if (!catalog) return res.status(400).json({ message: "catalog requerido" });

  const mode = normalizeText((req.body as any)?.mode || "merge"); // merge | replace
  const version = normalizeText((req.body as any)?.version || "CR-4.4");
  const itemsRaw = Array.isArray((req.body as any)?.items) ? (req.body as any).items : null;
  const textRaw = normalizeText((req.body as any)?.text);

  let items: Array<{ code: string; label: string }> = [];
  if (itemsRaw) {
    items = itemsRaw
      .map((it: any) => ({ code: normalizeText(it?.code || it?.id), label: normalizeText(it?.label || it?.description) }))
      .filter((it: any) => it.code && it.label);
  } else if (textRaw) {
    items = parseImportText(textRaw);
  }

  if (!items.length) return res.status(400).json({ message: "No items to import" });

  if (mode === "replace") {
    await prisma.eInvoicingCatalogEntry.deleteMany({ where: { hotelId, catalog } });
  }

  const normalized = items.map((it) => ({
    hotelId,
    catalog,
    code: String(it.code),
    label: String(it.label),
    version: version || null,
  }));

  const chunks: typeof normalized[] = [];
  for (let i = 0; i < normalized.length; i += 5000) chunks.push(normalized.slice(i, i + 5000));

  let created = 0;
  for (const chunk of chunks) {
    const r = await prisma.eInvoicingCatalogEntry.createMany({ data: chunk as any, skipDuplicates: true });
    created += r.count || 0;
  }

  res.json({ ok: true, catalog, version: version || null, imported: normalized.length, created });
}

