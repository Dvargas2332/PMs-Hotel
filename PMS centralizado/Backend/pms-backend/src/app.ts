//copyright (c) 2025 by Diego Alonso Vargas Almengor
//all rights reserved
// src/app.ts



import express from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
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
import frontdeskTaxesRoutes from "./routes/frontdeskTaxes.route.js";
import discountsRoutes from "./routes/discounts.route.js";
import invoiceRoutes from "./routes/invoice.route.js";
import ratePlansRoutes from "./routes/ratePlans.route.js";
import rateOverridesRoutes from "./routes/rateOverrides.route.js";
import mealPlansRoutes from "./routes/mealPlans.route.js";
import contractsRoutes from "./routes/contracts.route.js";
import geoRoutes from "./routes/geo.route.js";
import cashAuditRoutes from "./routes/cashAudit.route.js";
import usersRoutes from "./routes/users.route.js";
import auditRoutes from "./routes/audit.route.js";
import launcherRoutes from "./routes/launcher.route.js";
import einvoicingRoutes from "./routes/einvoicing.route.js";
import gestorRoutes from "./routes/gestor.route.js";
import versionRoutes from "./routes/version.route.js";
import forminfoRoutes from "./routes/forminfo.route.js";
import accountingRoutes from "./routes/accounting.route.js";
import reportsRoutes from "./routes/reports.route.js";

import { tenantCtx } from "./middleware/tenant.js";
import prisma from "./lib/prisma.js";
import { auth, requireGestor } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { requireMembership } from "./middleware/membership.js";
import { auditMiddleware } from "./middleware/audit.js";
import { logger } from "./lib/logger.js";



const app = express();

// Saltos de proxy de confianza: con 1 (Render, Cloudflare, nginx) Express toma
// la IP real del cliente de X-Forwarded-For y el rate limit deja de compartir
// un solo cubo entre todos. TRUST_PROXY=0 si la API se expone directo.
const trustProxyHops = Number(process.env.TRUST_PROXY ?? 1);
app.set("trust proxy", Number.isFinite(trustProxyHops) ? trustProxyHops : 1);

// Helmet: cabeceras de seguridad (HSTS, nosniff, frameguard, oculta X-Powered-By).
// CSP se desactiva porque la representación gráfica de facturas (/documents/:id/html)
// usa <style> y style inline, y Hacienda exige que se vea tal cual.
// CORP cross-origin permite abrir PDF/HTML desde el dominio del frontend.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

// Parse cookies for httpOnly token auth
app.use(cookieParser());

// Compress all JSON/text responses (skip if client doesn't accept)
app.use(compression());

// El límite alto de JSON sólo se aplica a las rutas que transportan archivos
// embebidos en base64 o catálogos completos. El resto de la API queda en 512kb,
// suficiente para el JSON normal (el POS comprime las imágenes a 512px).
const bulkJson = express.json({ limit: "15mb" });   // catálogos CABYS/FE y certificado .p12
const xmlJson = express.json({ limit: "2mb" });     // XML de comprobantes (tope real: 1 MB)
for (const path of [
  "/api/einvoicing/config",
  "/api/einvoicing/cabys/import",
  "/api/einvoicing/catalogs",
]) {
  app.use(path, bulkJson);
}
for (const path of [
  "/api/einvoicing/documents/import-xml",
  "/api/restaurant/inventory/invoices/import-xml",
]) {
  app.use(path, xmlJson);
}
app.use(express.json({ limit: "512kb" }));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.STATIC_WEBSITE_URL,
  "http://localhost:3000",
  "http://192.168.20.137:3000",
  "https://kazehanacloud.com",
  "https://www.kazehanacloud.com",
  "https://form.kazehanacloud.com",
].filter(Boolean) as string[];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // curl / server-to-server
      if (allowedOrigins.includes(origin)) return callback(null, true);
      const err = new Error("Origen no permitido por CORS") as Error & { status: number };
      err.status = 403;
      return callback(err);
    },
    credentials: true, // permite cookies httpOnly cross-origin
  })
);
// Prefijo /api para todo
const api = express.Router();

app.use("/api", api);

// Públicas
api.use("/health", healthRouter);   // → /api/health y /api/health/db
api.use("/version", versionRoutes);
api.use("/auth", authRouter); // p.ej. POST /api/auth/login
api.use("/launcher", launcherRoutes);
api.use("/forminfo", forminfoRoutes);

// Gestor SaaS (sin tenant scoping)
const gestorLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, keyPrefix: "gestor" });
api.use("/gestor", gestorLimiter, auth, requireGestor, gestorRoutes);

// Protegidas (requieren Authorization: Bearer <token>)
api.use(auth);
api.use(tenantCtx);
api.use(auditMiddleware);
api.use("/rooms", requireMembership("frontdesk"), rooms); //-> GET/POST /api/rooms
api.use("/roomTypes", requireMembership("frontdesk"), roomTypes); // -> /api/roomTypes
api.use("/reservations", requireMembership("frontdesk"), reservations);
api.use("/guests", requireMembership("frontdesk"), guests);
api.use("/hotel", requireMembership("management"), hotelRoutes);
api.use("/roles", requireMembership("management"), rolesRoutes);
api.use("/permissions", requireMembership("management"), permissionsRoutes);
api.use("/restaurant", requireMembership("restaurant"), restaurantRoutes);
api.use("/discounts", requireMembership("frontdesk", "restaurant", "management"), discountsRoutes);
// Taxes catalog is used by restaurant items too
api.use("/taxes", requireMembership("accounting", "restaurant"), taxesRoutes);
api.use("/frontdesk/taxes", requireMembership("frontdesk"), frontdeskTaxesRoutes);
api.use("/invoices", requireMembership("frontdesk", "accounting", "einvoicing"), invoiceRoutes);
api.use("/ratePlans", requireMembership("frontdesk"), ratePlansRoutes);
api.use("/rateOverrides", requireMembership("frontdesk"), rateOverridesRoutes);
api.use("/mealPlans", requireMembership("frontdesk"), mealPlansRoutes);
api.use("/contracts", requireMembership("frontdesk"), contractsRoutes);
api.use("/einvoicing", requireMembership("einvoicing"), einvoicingRoutes);
api.use("/accounting", requireMembership("accounting"), accountingRoutes);
api.use("/reports", requireMembership("frontdesk"), reportsRoutes);
api.use("/geo", requireMembership("frontdesk"), geoRoutes);
api.use("/cash-audits", requireMembership("frontdesk", "restaurant", "accounting"), cashAuditRoutes);
api.use("/users", requireMembership("management"), usersRoutes);
api.use("/audit", requireMembership("management"), auditRoutes);


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

// 404 para rutas no registradas (debe ir después de todas las rutas)
app.use((_req, res) => res.status(404).json({ message: "Not found" }));

// Error handler global (siempre al final)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Errores del parser de body: payload excesivo, JSON malformado, etc.
  // Se responden con su propio status para no disfrazarlos de 500.
  const status = Number(err?.status || err?.statusCode || 0);
  if (status >= 400 && status < 500) {
    const message =
      err?.type === "entity.too.large"
        ? "El contenido enviado es demasiado grande"
        : err?.type === "entity.parse.failed"
          ? "JSON inválido"
          : "Solicitud inválida";
    return res.status(status).json({ message });
  }
  logger.error(err);
  res.status(500).json({ message: "Internal Server Error" });
});

export default app;
