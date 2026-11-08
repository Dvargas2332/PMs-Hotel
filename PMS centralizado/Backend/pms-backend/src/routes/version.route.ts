import { Router } from "express";
import fs from "fs";
import path from "path";
import prisma from "../lib/prisma.js";

const router = Router();

const readAppVersion = () => {
  try {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    const raw = fs.readFileSync(pkgPath, "utf8");
    const parsed = JSON.parse(raw);
    return String(parsed?.version || "0.0.0");
  } catch {
    return "0.0.0";
  }
};

router.get("/", async (_req, res) => {
  const appVersion = readAppVersion();
  try {
    const rows = await prisma.$queryRaw<
      { migration_name: string; finished_at: Date | null }[]
    >`SELECT migration_name, finished_at
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1`;
    const latest = rows?.[0];
    // La versión de la base se cuenta en migraciones aplicadas y se muestra como
    // v1.0.<n>: mismo formato que la del app y legible, en vez del timestamp
    // crudo de la carpeta de migración (20261105190000).
    const counted = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS total
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL`;
    res.json({
      appVersion,
      dbVersion: latest?.migration_name || null,
      dbAppliedAt: latest?.finished_at || null,
      dbMigrations: Number(counted?.[0]?.total ?? 0),
    });
  } catch {
    res.json({ appVersion, dbVersion: null, dbAppliedAt: null, dbMigrations: null });
  }
});

export default router;
