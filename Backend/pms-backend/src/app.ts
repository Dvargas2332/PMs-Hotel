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
import taxesRoutes from "./routes/taxes.route.js";
import reportRoutes from "./routes/report.route.js";
import invoiceRoutes from "./routes/invoice.route.js";
import geoRoutes from "./routes/geo.route.js";
import cashAuditRoutes from "./routes/cashAudit.route.js";
import usersRoutes from "./routes/users.route.js";
import launcherRoutes from "./routes/launcher.route.js";
import einvoicingRoutes from "./routes/einvoicing.route.js";
import gestorRoutes from "./routes/gestor.route.js";

import { tenantCtx } from "./middleware/tenant.js";
import prisma from "./lib/prisma.js";
import { auth, requireGestor } from "./middleware/auth.js";
import { requireMembership } from "./middleware/membership.js";
import { logger } from "./lib/logger.js";



const app = express();

// e-invoicing configurations may include base64 certificates; allow larger JSON payloads.
app.use(express.json({ limit: "15mb" }));
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

// Gestor SaaS (sin tenant scoping)
api.use("/gestor", auth, requireGestor, gestorRoutes);

// Protegidas (requieren Authorization: Bearer <token>)
api.use(auth);
api.use(tenantCtx);
api.use("/rooms", requireMembership("frontdesk"), rooms); //-> GET/POST /api/rooms
api.use("/roomTypes", requireMembership("frontdesk"), roomTypes); // -> /api/roomTypes
api.use("/reservations", requireMembership("frontdesk"), reservations);
api.use("/guests", requireMembership("frontdesk"), guests);
api.use("/hotel", requireMembership("management"), hotelRoutes);
api.use("/roles", requireMembership("management"), rolesRoutes);
api.use("/permissions", requireMembership("management"), permissionsRoutes);
api.use("/restaurant", requireMembership("restaurant"), restaurantRoutes);
api.use("/taxes", requireMembership("accounting"), taxesRoutes);
api.use("/reports", requireMembership("accounting"), reportRoutes);
api.use("/invoices", requireMembership("accounting"), invoiceRoutes);
api.use("/einvoicing", requireMembership("einvoicing"), einvoicingRoutes);
api.use("/geo", requireMembership("frontdesk"), geoRoutes);
api.use("/cash-audits", requireMembership("frontdesk", "restaurant", "accounting"), cashAuditRoutes);
api.use("/users", requireMembership("management"), usersRoutes);


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
    res.status(500).json({ ok: false, db: "down" });
  }
});

export default app;
// 404
app.use((_req, res) => res.status(404).json({ message: "Not found" }));

// Error handler
