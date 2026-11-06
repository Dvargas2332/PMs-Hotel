// src/middleware/membership.ts

import type { NextFunction, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { allowedModulesForMembership } from "../config/membership.js";
import type { AuthUser } from "./auth.js";

type CacheEntry = {
  allowed: string[];
  active: boolean;
  expiresAt: number;
};

const membershipCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 1 minute

function getCached(hotelId: string): CacheEntry | null {
  const entry = membershipCache.get(hotelId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    membershipCache.delete(hotelId);
    return null;
  }
  return entry;
}

function setCached(hotelId: string, entry: { allowed: string[]; active: boolean }) {
  membershipCache.set(hotelId, { ...entry, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Fuerza a releer la membresía en la próxima petición (p. ej. al cambiarla desde el gestor). */
export function invalidateMembershipCache(hotelId: string) {
  if (!hotelId) return;
  membershipCache.delete(hotelId);
}

export function requireMembership(...modules: string[]) {
  const required = modules.map((m) => String(m).trim().toLowerCase()).filter(Boolean);
  return async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const user = req.user as AuthUser | undefined;
    const hotelId = user?.hotelId;
    if (!hotelId) return res.status(401).json({ message: "No autenticado" });

    try {
      let entry: { allowed: string[]; active: boolean } | null = getCached(hotelId);
      if (!entry) {
        const hotel = await prisma.hotel.findUnique({
          where: { id: hotelId },
          select: { membership: true, active: true },
        });
        entry = { allowed: allowedModulesForMembership(hotel?.membership), active: hotel?.active !== false };
        setCached(hotelId, entry);
      }
      // Un hotel suspendido desde el gestor no puede operar.
      if (!entry.active) {
        return res.status(403).json({
          code: "HOTEL_SUSPENDED",
          message: "El hotel está suspendido. Contacte al proveedor del sistema.",
        });
      }
      const ok = required.length === 0 || required.some((m) => entry!.allowed.includes(m));
      if (!ok) return res.status(403).json({ message: "Membresia insuficiente" });
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
