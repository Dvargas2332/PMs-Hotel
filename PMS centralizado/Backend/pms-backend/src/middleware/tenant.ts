// src/middleware/tenant.ts

import type { Request, Response, NextFunction } from "express";
import { tenantStorage } from "../lib/tenant.js";

export function tenantCtx(req: Request, _res: Response, next: NextFunction) {
  const hotelIdFromUser = (req as any)?.user?.hotelId as string | undefined;
  // No aceptamos hotelId por header para evitar escalamiento entre hoteles.
  (req as any).tenantId = hotelIdFromUser;
  // Los controladores de contabilidad leen req.hotelId; sin esto quedaba
  // undefined y todo el módulo respondía 500.
  (req as any).hotelId = hotelIdFromUser;

  tenantStorage.run({ hotelId: hotelIdFromUser }, () => next());
}
