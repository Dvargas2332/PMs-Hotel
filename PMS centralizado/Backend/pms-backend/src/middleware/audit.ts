import type { NextFunction, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "./auth.js";
import {
  describeAction,
  extractEntityIdCandidate,
  getAuditMeta,
  normalizeAuditPath,
  sanitizeForAudit,
  shouldSkipAuditPath,
} from "../lib/audit.js";

const EXCLUDED_PREFIXES = ["/health", "/version", "/audit"];
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function shouldSkip(path: string, method: string): boolean {
  const upper = String(method).toUpperCase();
  if (upper === "OPTIONS" || upper === "GET" || upper === "HEAD") return true;
  if (!MUTATION_METHODS.has(upper)) return true;
  if (shouldSkipAuditPath(path)) return true;
  const lowerPath = path.toLowerCase();
  return EXCLUDED_PREFIXES.some((prefix) => lowerPath === prefix || lowerPath.startsWith(`${prefix}/`));
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  const normalizedPath = normalizeAuditPath(req.originalUrl || req.url);

  if (shouldSkip(normalizedPath, req.method)) {
    return next();
  }

  res.on("finish", () => {
    // @ts-ignore
    const user = req.user as AuthUser | undefined;
    const hotelId = ((req as any).tenantId as string | undefined) || user?.hotelId;

    // La bitácora es de tareas hechas por usuarios, no de errores del sistema:
    // una petición rechazada no es un movimiento y sólo agrega ruido.
    if (res.statusCode >= 400) return;

    if (!hotelId || !user?.sub) return;

    const { module, entity } = getAuditMeta(normalizedPath);
    const entityId = extractEntityIdCandidate({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
      body: req.body,
      path: normalizedPath,
    });

    const payload = sanitizeForAudit({
      module,
      method: req.method,
      path: normalizedPath,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      query: req.query ?? null,
      body: req.body ?? null,
      ip: req.ip,
      userAgent: req.headers["user-agent"] ?? null,
    });

    void prisma.auditLog
      .create({
        data: {
          actorId: user.sub,
          action: describeAction(req.method, normalizedPath, entity),
          entity,
          entityId,
          reason: normalizedPath,
          payload: payload as any,
          hotelId,
        },
      })
      .catch((err) => {
        console.error("[audit.middleware] failed to persist audit log", err);
      });
  });

  return next();
}
