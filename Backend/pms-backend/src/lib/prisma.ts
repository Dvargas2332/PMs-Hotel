// src/lib/prisma.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { tenantStorage } from "./tenant.js";

function ensureSupabaseSsl(url: string | undefined) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith("supabase.co") && !parsed.searchParams.has("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
      return parsed.toString();
    }
    return url;
  } catch {
    return url;
  }
}

function redactUrl(url: string) {
  if (!url) return "";
  // Avoid leaking credentials in logs/errors
  return url
    .replace(/(postgres(?:ql)?:\/\/)([^:@/]+):([^@/]+)@/i, "$1$2:***@")
    .slice(0, 200);
}

function validateDatabaseUrl(url: string | undefined) {
  if (!url) return;
  const trimmed = url.trim();
  if (trimmed !== url) process.env.DATABASE_URL = trimmed;

  if (!/^postgres(ql)?:\/\//i.test(trimmed)) {
    throw new Error(
      `DATABASE_URL inválida (debe iniciar con postgresql:// o postgres://). Valor recibido: ${redactUrl(trimmed)}`
    );
  }
  if (/subabase\.co/i.test(trimmed)) {
    throw new Error(
      `DATABASE_URL inválida: el host parece tener un typo ("subabase.co"). Debe ser "supabase.co". Valor recibido: ${redactUrl(trimmed)}`
    );
  }
  if (/\[YOUR-PASSWORD\]/i.test(trimmed)) {
    throw new Error(
      `DATABASE_URL inválida: aún contiene el placeholder "[YOUR-PASSWORD]". Reemplázalo por la contraseña real.`
    );
  }
}

function buildUrlFromSupabaseEnv() {
  const host = process.env.SUPABASE_DB_HOST;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!host || !password) return undefined;

  const user = process.env.SUPABASE_DB_USER ?? "postgres";
  const port = process.env.SUPABASE_DB_PORT ?? "5432";
  const db = process.env.SUPABASE_DB_NAME ?? "postgres";
  const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${db}`;
  return ensureSupabaseSsl(url);
}

if (!process.env.DATABASE_URL) {
  const fallback = buildUrlFromSupabaseEnv();
  if (fallback) process.env.DATABASE_URL = fallback;
}

process.env.DATABASE_URL = ensureSupabaseSsl(process.env.DATABASE_URL);
process.env.DIRECT_URL = ensureSupabaseSsl(process.env.DIRECT_URL ?? process.env.DATABASE_URL);
validateDatabaseUrl(process.env.DATABASE_URL);

const TENANT_MODELS = new Set([
  "HotelSequence",
  "AppRole",
  "AuditLog",
  "CabysCode",
  "CashAudit",
  "CreditNote",
  "EInvoicingAcknowledgement",
  "EInvoicingCatalogEntry",
  "EInvoicingConfig",
  "EInvoicingDocument",
  "EInvoicingRequirement",
  "EInvoicingSequence",
  "Guest",
  "Invoice",
  "InvoiceItem",
  "LauncherAccount",
  "Payment",
  "Report",
  "Reservation",
  "ReservationSequence",
  "AdvanceDeposit",
  "RestaurantClose",
  "RestaurantConfig",
  "RestaurantFamily",
  "RestaurantItem",
  "RestaurantMenuItem",
  "RestaurantOrder",
  "RestaurantOrderItem",
  "RestaurantInventoryItem",
  "RestaurantInventoryInvoice",
  "RestaurantInventoryInvoiceLine",
  "RestaurantInventoryMovement",
  "RestaurantPrintJob",
  "RestaurantRecipeLine",
  "RestaurantSection",
  "RestaurantSectionObject",
  "RestaurantSubFamily",
  "RestaurantSubSubFamily",
  "RestaurantTable",
  "RolePermission",
  "Room",
  "RoomDay",
  "RoomType",
  "User",
]);

function addHotelScope(where: any, hotelId: string) {
  if (!where) return { hotelId };
  if (where?.hotelId === hotelId) return where;
  return { AND: [where, { hotelId }] };
}

function mustUseScopedUnique(action: string, model: string, where: any) {
  const keys = where ? Object.keys(where) : [];
  // allow compound unique inputs (e.g. hotelId_id, hotelId_number, etc.)
  const hasScopedUnique =
    keys.includes("hotelId") || keys.some((k) => k.startsWith("hotelId_")) || keys.includes("hotelId_id");
  if (hasScopedUnique) return false;
  // allow hotel model lookups by id (hotelId itself)
  if (model === "Hotel") return false;
  // allow global unique lookups (User by email is global unique in schema)
  if (model === "User" && keys.includes("email")) return false;
  return true;
}

export const prisma = new PrismaClient();
export default prisma;

function safeDbHint() {
  const url = process.env.DATABASE_URL;
  if (!url) return "missing";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const db = parsed.pathname?.replace("/", "") || "";
    const sslmode = parsed.searchParams.get("sslmode");
    return `${host}/${db || "db"}${sslmode ? `?sslmode=${sslmode}` : ""}`;
  } catch {
    return "set";
  }
}

console.log("[DB] DATABASE_URL:", safeDbHint());

prisma.$use(async (params, next) => {
  const ctx = tenantStorage.getStore();
  const hotelId = ctx?.hotelId;
  if (ctx?.bypass || !hotelId) return next(params);
  const model = params.model ?? "";
  if (!TENANT_MODELS.has(model)) return next(params);

  params.args ??= {};
  const args = params.args;

  // READS
  if (params.action === "findMany" || params.action === "findFirst" || params.action === "count") {
    args.where = addHotelScope(args.where, hotelId);
    return next(params);
  }
  if (params.action === "aggregate" || params.action === "groupBy") {
    args.where = addHotelScope(args.where, hotelId);
    return next(params);
  }
  if (params.action === "findUnique") {
    if (mustUseScopedUnique(params.action, model, args.where)) {
      throw new Error(
        `[tenant] ${model}.${params.action} requiere scoping por hotelId. Usa findFirst({ where: { id, hotelId } }) o un unique compuesto que incluya hotelId.`
      );
    }
    return next(params);
  }

  // WRITES
  if (params.action === "create") {
    if (args.data && typeof args.data === "object") {
      if ("hotelId" in args.data && args.data.hotelId && args.data.hotelId !== hotelId) {
        throw new Error(`[tenant] ${model}.create: hotelId no coincide con el tenant actual.`);
      }
      if ("hotelId" in args.data) args.data.hotelId = hotelId;
    }
    return next(params);
  }
  if (params.action === "createMany") {
    const data = args.data;
    if (Array.isArray(data)) {
      args.data = data.map((row) => {
        if (row && typeof row === "object" && "hotelId" in row) {
          if (row.hotelId && row.hotelId !== hotelId) {
            throw new Error(`[tenant] ${model}.createMany: hotelId no coincide con el tenant actual.`);
          }
          return { ...row, hotelId };
        }
        return row;
      });
    }
    return next(params);
  }

  if (params.action === "updateMany" || params.action === "deleteMany") {
    args.where = addHotelScope(args.where, hotelId);
    return next(params);
  }

  if (params.action === "update" || params.action === "delete" || params.action === "upsert") {
    if (mustUseScopedUnique(params.action, model, args.where)) {
      throw new Error(
        `[tenant] ${model}.${params.action} requiere scoping por hotelId. Usa updateMany/deleteMany con where { id, hotelId } o un unique compuesto que incluya hotelId.`
      );
    }
    // ensure writes also carry tenant scoping when possible
    if (params.action === "upsert" && args.create && typeof args.create === "object" && "hotelId" in args.create) {
      args.create.hotelId = hotelId;
    }
    return next(params);
  }

  return next(params);
});

process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
