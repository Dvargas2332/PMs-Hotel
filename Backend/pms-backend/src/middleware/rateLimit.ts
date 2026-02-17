// src/middleware/rateLimit.ts

import type { Request, Response, NextFunction } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  message?: string;
  keyGenerator?: (req: Request) => string;
};

type RateEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateEntry>();

function getClientIp(req: Request) {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  const ip = String(raw || req.ip || req.socket.remoteAddress || "unknown");
  return ip.split(",")[0].trim() || "unknown";
}

export function rateLimit(opts: RateLimitOptions) {
  const windowMs = Math.max(1000, Number(opts.windowMs || 0));
  const max = Math.max(1, Number(opts.max || 0));
  const keyPrefix = opts.keyPrefix || "rl";
  const message = opts.message || "Demasiados intentos. Intenta de nuevo mas tarde.";

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${keyPrefix}:${opts.keyGenerator ? opts.keyGenerator(req) : getClientIp(req)}`;
    const current = store.get(key);
    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ message });
    }

    // Best-effort cleanup to avoid unbounded growth
    if (store.size > 10000) {
      for (const [k, v] of store.entries()) {
        if (v.resetAt <= now) store.delete(k);
      }
    }

    return next();
  };
}
