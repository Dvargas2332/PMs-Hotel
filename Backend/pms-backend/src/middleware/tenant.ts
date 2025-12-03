// src/middleware/tenant.ts

import type { Request, Response, NextFunction } from "express";

export function tenantCtx(req: Request, _res: Response, next: NextFunction) {
  // ejemplo simple: header opcional, si no, "default"
  (req as any).tenantId = (req.headers["x-tenant-id"] as string) ?? "default";
  next();
}
