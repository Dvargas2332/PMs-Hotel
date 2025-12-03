//copyright (c) 2025 by Diego Alonso Vargas Almengor
//all rights reserved
// src/app.ts



import express from "express";
import cors from "cors";
import "dotenv/config";
import authRouter from "./routes/auth.route.js";
import healthRouter from "./routes/health.route.js";
import rooms from "./routes/rooms.route.js";
import reservations from "./routes/reservations.route.js";
import guests from "./routes/guests.route.js";
import hotelRoutes from "./routes/hotel.route.js";

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



// Protegidas (requieren Authorization: Bearer <token>)
api.use(auth);
api.use(tenantCtx);
api.use("/rooms", rooms); //-> GET/POST /api/rooms
api.use("/reservations", reservations);
api.use("/guests", guests);
api.use("/hotel", hotelRoutes);


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
