// src/middleware/tenant.ts

import type { Request, Response, NextFunction } from "express";
import { tenantStorage } from "../lib/tenant.js";

export function tenantCtx(req: Request, _res: Response, next: NextFunction) {
  const hotelIdFromUser = (req as any)?.user?.hotelId as string | undefined;
  // No aceptamos hotelId por header para evitar escalamiento entre hoteles.
  (req as any).tenantId = hotelIdFromUser;

  tenantStorage.run({ hotelId: hotelIdFromUser }, () => next());
}
