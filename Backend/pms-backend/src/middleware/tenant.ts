// src/middleware/tenant.ts

import type { Request, Response, NextFunction } from "express";

export function tenantCtx(req: Request, _res: Response, next: NextFunction) {
  // Preferimos el hotelId del usuario autenticado; fallback al header opcional
  const hotelIdFromUser = (req as any)?.user?.hotelId as string | undefined;
  const headerHotel = req.headers["x-tenant-id"] as string | undefined;
  (req as any).tenantId = hotelIdFromUser ?? headerHotel ?? "default";
  next();
}
