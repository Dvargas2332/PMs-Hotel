// src/routes/health.route.ts
import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

// GET /api/health
router.get("/", (_req, res) => {
  res.json({ ok: true });
});

// GET /api/health/db
router.get("/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up" });
  } catch (e) {
    res.status(500).json({ ok: false, db: "down", error: String(e) });
  }
});

export default router;
