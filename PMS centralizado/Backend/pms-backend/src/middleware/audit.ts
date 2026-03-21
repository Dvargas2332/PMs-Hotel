import type { NextFunction, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "./auth.js";
import {
  actionFromMethod,
  extractEntityIdCandidate,
  getAuditMeta,
  normalizeAuditPath,
  sanitizeForAudit,
} from "../lib/audit.js";

const EXCLUDED_PREFIXES = ["/health", "/version", "/audit"];

function shouldSkip(path: string, method: string): boolean {
  if (String(method).toUpperCase() === "OPTIONS") return true;
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
          action: actionFromMethod(req.method, entity, res.statusCode),
          entity,
          entityId,
          reason: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : null,
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
