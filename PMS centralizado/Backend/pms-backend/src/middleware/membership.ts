// src/middleware/membership.ts

import type { NextFunction, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { allowedModulesForMembership } from "../config/membership.js";
import type { AuthUser } from "./auth.js";

type CacheEntry = {
  allowed: string[];
  expiresAt: number;
};

const membershipCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 1 minute

function getCachedAllowed(hotelId: string): string[] | null {
  const entry = membershipCache.get(hotelId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    membershipCache.delete(hotelId);
    return null;
  }
  return entry.allowed;
}

function setCachedAllowed(hotelId: string, allowed: string[]) {
  membershipCache.set(hotelId, { allowed, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function requireMembership(...modules: string[]) {
  const required = modules.map((m) => String(m).trim().toLowerCase()).filter(Boolean);
  return async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const user = req.user as AuthUser | undefined;
    const hotelId = user?.hotelId;
    if (!hotelId) return res.status(401).json({ message: "No autenticado" });

    try {
      let allowed = getCachedAllowed(hotelId);
      if (!allowed) {
        const hotel = await prisma.hotel.findUnique({
          where: { id: hotelId },
          select: { membership: true },
        });
        allowed = allowedModulesForMembership(hotel?.membership);
        setCachedAllowed(hotelId, allowed);
      }
      const ok = required.length === 0 || required.some((m) => allowed.includes(m));
      if (!ok) return res.status(403).json({ message: "Membresia insuficiente" });
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
