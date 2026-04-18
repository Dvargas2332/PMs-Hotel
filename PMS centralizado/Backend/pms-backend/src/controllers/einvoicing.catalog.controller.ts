import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import { searchCabysHacienda, getCabysHacienda, fetchCabysPage } from "../services/cabys.hacienda.js";

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

/**
 * GET /einvoicing/cabys/hacienda?q=<texto>&top=<n>
 * Consulta la API pública de CABYS de Hacienda en tiempo real.
 * No requiere que el hotel haya importado nada — busca directo en Hacienda.
 */
export async function searchCabysFromHacienda(req: Request, res: Response) {
  const q = String((req.query as any)?.q || "").trim();
  if (!q) return res.status(400).json({ message: "Parámetro q requerido" });

  const top = Math.min(500, Math.max(1, Number((req.query as any)?.top || 20) || 20));

  try {
    const items = await searchCabysHacienda(q, top);
    return res.json(
      items.map((it) => ({
        id: String(it.codigo),
        description: String(it.descripcion),
        taxRate: typeof it.impuesto === "number" ? it.impuesto : 13,
      }))
    );
  } catch (err: any) {
    return res.status(502).json({
      message: "Error al consultar la API de Hacienda",
      detail: err?.message || String(err),
    });
  }
}

/**
 * GET /einvoicing/cabys/hacienda/:codigo
 * Obtiene un código CABYS exacto desde Hacienda.
 */
export async function getCabysFromHacienda(req: Request, res: Response) {
  const codigo = String((req.params as any)?.codigo || "").trim();
  if (!codigo) return res.status(400).json({ message: "codigo requerido" });

  try {
    const item = await getCabysHacienda(codigo);
    if (!item) return res.status(404).json({ message: "Código CABYS no encontrado en Hacienda" });
    return res.json({
      id: String(item.codigo),
      description: String(item.descripcion),
      taxRate: typeof item.impuesto === "number" ? item.impuesto : 13,
    });
  } catch (err: any) {
    return res.status(502).json({
      message: "Error al consultar la API de Hacienda",
      detail: err?.message || String(err),
    });
  }
}

/**
 * POST /einvoicing/cabys/sync
 * Descarga códigos CABYS de Hacienda y los guarda en la BD del hotel.
 * Body: { q: string, top?: number, mode?: "merge"|"replace" }
 *
 * q puede ser un término genérico como "hotel", "restaurant", "alojamiento"
 * para traer los CABYS relevantes para el hotel y guardarlos localmente.
 */
export async function syncCabysFromHacienda(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const q = String((req.body as any)?.q || "").trim();
  if (!q) return res.status(400).json({ message: "Parámetro q requerido" });

  const top = Math.min(500, Math.max(1, Number((req.body as any)?.top || 100) || 100));
  const mode = String((req.body as any)?.mode || "merge");

  try {
    const items = await fetchCabysPage(q, top);
    if (!items.length) return res.json({ ok: true, synced: 0, message: "Sin resultados de Hacienda" });

    if (mode === "replace") {
      await prisma.cabysCode.deleteMany({ where: { hotelId } });
    }

    const data = items.map((it) => ({
      id: it.id,
      description: it.description,
      hotelId,
    }));

    const chunks: typeof data[] = [];
    for (let i = 0; i < data.length; i += 5000) chunks.push(data.slice(i, i + 5000));

    let created = 0;
    for (const chunk of chunks) {
      const r = await prisma.cabysCode.createMany({ data: chunk, skipDuplicates: true });
      created += r.count || 0;
    }

    return res.json({ ok: true, synced: items.length, created, query: q });
  } catch (err: any) {
    return res.status(502).json({
      message: "Error al sincronizar CABYS desde Hacienda",
      detail: err?.message || String(err),
    });
  }
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

