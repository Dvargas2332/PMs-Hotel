// src/server.ts
import { setDefaultResultOrder } from "node:dns";
setDefaultResultOrder("ipv4first");
import app from "./app.js";
import { logger } from "./lib/logger.js";
import prisma from "./lib/prisma.js";
import { startDailyChargesJob } from "./jobs/charges.cron.js";
// Health fuera de /api, útil para uptime checks SIN auth
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/healthz/db", async (_req, res) => {
    try {
        await prisma.$queryRaw `SELECT 1`;
        res.json({ ok: true, db: "up" });
    }
    catch (e) {
        res.status(500).json({ ok: false, db: "down", error: String(e) });
    }
});
const port = Number(process.env.PORT || 4000);
app.listen(port, () => logger.info({ port }, "HTTP server listening"));
startDailyChargesJob(); // cron
