import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import {
  extractEntityIdCandidate,
  getAuditMeta,
  inferModuleFromLog,
  sanitizeForAudit,
  summarizeAuditPayload,
} from "../lib/audit.js";

function parseDate(value: unknown, endOfDay = false): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

function normalizeAction(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function actorLabel(
  actorId: string | null,
  usersById: Map<string, { name: string | null; email: string }>,
  launchersById: Map<string, { username: string; name: string }>
): string {
  if (!actorId) return "system";

  const user = usersById.get(actorId);
  if (user) {
    const identity = user.name?.trim() || user.email;
    return identity === actorId ? identity : `${identity} (${actorId})`;
  }

  const launcher = launchersById.get(actorId);
  if (launcher) {
    const identity = launcher.name?.trim() || launcher.username;
    return identity === actorId ? identity : `${identity} (${actorId})`;
  }

  return actorId;
}

export async function listAuditLogs(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  const hotelId = user?.hotelId;
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const q = String(req.query.q || "").trim();
  const userFilter = String(req.query.user || "").trim();
  const moduleFilter = String(req.query.module || "").trim().toLowerCase();

  const fromDate = parseDate(req.query.from);
  if (req.query.from && !fromDate) return res.status(400).json({ message: "from invalida" });

  const toDate = parseDate(req.query.to, true);
  if (req.query.to && !toDate) return res.status(400).json({ message: "to invalida" });

  const requestedLimit = Number(req.query.limit ?? req.query.take ?? 500);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 2000) : 500;

  const where: any = { hotelId };
  const and: any[] = [];

  if (q) {
    and.push({
      OR: [
        { action: { contains: q, mode: "insensitive" } },
        { entity: { contains: q, mode: "insensitive" } },
        { entityId: { contains: q, mode: "insensitive" } },
        { reason: { contains: q, mode: "insensitive" } },
        { actorId: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (userFilter) {
    and.push({ actorId: { contains: userFilter, mode: "insensitive" } });
  }

  if (fromDate || toDate) {
    const createdAt: Record<string, Date> = {};
    if (fromDate) createdAt.gte = fromDate;
    if (toDate) createdAt.lte = toDate;
    and.push({ createdAt });
  }

  if (and.length > 0) where.AND = and;

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const actorIds = Array.from(new Set(logs.map((row) => row.actorId).filter((id): id is string => Boolean(id))));

  const [users, launchers] =
    actorIds.length > 0
      ? await Promise.all([
          prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true, email: true },
          }),
          prisma.launcherAccount.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, username: true, name: true },
          }),
        ])
      : [[], []];

  const usersById = new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]));
  const launchersById = new Map(launchers.map((l) => [l.id, { username: l.username, name: l.name }]));

  const rows = logs
    .map((row) => {
      const payload = row.payload as unknown;
      const moduleValue = inferModuleFromLog(payload, row.entity, row.action);
      return {
        id: row.id,
        timestamp: row.createdAt.toISOString(),
        userId: actorLabel(row.actorId, usersById, launchersById),
        actorId: row.actorId,
        module: moduleValue,
        action: row.action,
        entityType: row.entity,
        entityId: row.entityId,
        reason: row.reason || summarizeAuditPayload(payload),
        details: summarizeAuditPayload(payload),
      };
    })
    .filter((row) => !moduleFilter || row.module.toLowerCase() === moduleFilter);

  return res.json(rows);
}

// Manual audit endpoint (compatibilidad con frontend actual)
export async function createAuditLog(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  const hotelId = user?.hotelId;
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const body = asRecord(req.body) || {};
  const inferredMeta = getAuditMeta(String(body.path || req.originalUrl || ""));
  const entity = String(body.entity || body.entityType || inferredMeta.entity || "Entity").trim();
  const entityId = extractEntityIdCandidate({
    params: req.params as Record<string, unknown>,
    query: req.query as Record<string, unknown>,
    body,
    path: String(body.path || req.originalUrl || ""),
  });

  const action = normalizeAction(body.action) || `MANUAL_${normalizeAction(entity) || "ACTION"}`;
  const reason = String(body.reason || body.detail || "").trim() || null;
  const moduleValue = String(body.module || inferredMeta.module || "general").trim().toLowerCase();

  const payload = sanitizeForAudit(
    body.payload ?? {
      module: moduleValue,
      before: body.before ?? null,
      after: body.after ?? null,
      source: "manual",
    }
  );

  const created = await prisma.auditLog.create({
    data: {
      actorId: user?.sub ?? null,
      action,
      entity,
      entityId,
      reason,
      payload: payload as any,
      hotelId,
    },
  });

  return res.status(201).json({
    id: created.id,
    timestamp: created.createdAt.toISOString(),
    userId: user?.sub ?? "system",
    module: moduleValue,
    action: created.action,
    entityType: created.entity,
    entityId: created.entityId,
    reason: created.reason,
  });
}
