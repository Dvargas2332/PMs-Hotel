//copyright (c) 2025 by Diego Alonso Vargas Almengor
//all rights reserved
// src/app.ts



import express from "express";
import cors from "cors";
import "dotenv/config";
import authRouter from "./routes/auth.route.js";
import healthRouter from "./routes/health.route.js";
import rooms from "./routes/rooms.route.js";
import roomTypes from "./routes/roomTypes.route.js";
import reservations from "./routes/reservations.route.js";
import guests from "./routes/guests.route.js";
import hotelRoutes from "./routes/hotel.route.js";
import rolesRoutes from "./routes/roles.route.js";
import permissionsRoutes from "./routes/permissions.route.js";
import restaurantRoutes from "./routes/restaurant.route.js";
import reportRoutes from "./routes/report.route.js";
import invoiceRoutes from "./routes/invoice.route.js";
import geoRoutes from "./routes/geo.route.js";
import cashAuditRoutes from "./routes/cashAudit.route.js";
import usersRoutes from "./routes/users.route.js";
import launcherRoutes from "./routes/launcher.route.js";

import { tenantCtx } from "./middleware/tenant.js";
import prisma from "./lib/prisma.js";
import { auth } from "./middleware/auth.js";
import { logger } from "./lib/logger.js";



const app = express();

app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: false, // usamos Bearer, no cookies
  })
);
// Prefijo /api para todo
const api = express.Router();

app.use("/api", api);

// Públicas
api.use("/health", healthRouter);   // → /api/health y /api/health/db
api.use("/auth", authRouter); // p.ej. POST /api/auth/login
api.use("/launcher", launcherRoutes);

// Protegidas (requieren Authorization: Bearer <token>)
api.use(auth);
api.use(tenantCtx);
api.use("/rooms", rooms); //-> GET/POST /api/rooms
api.use("/roomTypes", roomTypes); // -> /api/roomTypes
api.use("/reservations", reservations);
api.use("/guests", guests);
api.use("/hotel", hotelRoutes);
api.use("/roles", rolesRoutes);
api.use("/permissions", permissionsRoutes);
api.use("/restaurant", restaurantRoutes);
api.use("/reports", reportRoutes);
api.use("/invoices", invoiceRoutes);
api.use("/geo", geoRoutes);
api.use("/cash-audits", cashAuditRoutes);
api.use("/users", usersRoutes);


app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err);
  res.status(500).json({ message: "Internal Server Error" });
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/healthz/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up" });
  } catch (e) {
    res.status(500).json({ ok: false, db: "down", error: String(e) });
  }
});

export default app;
// 404
app.use((_req, res) => res.status(404).json({ message: "Not found" }));

// Error handler
