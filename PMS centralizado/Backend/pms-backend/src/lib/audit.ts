type ModuleRule = {
  prefix: string;
  module: string;
  entity: string;
};

const MODULE_RULES: ModuleRule[] = [
  { prefix: "/frontdesk/taxes", module: "frontdesk", entity: "FrontdeskTax" },
  { prefix: "/roomtypes", module: "frontdesk", entity: "RoomType" },
  { prefix: "/rooms", module: "frontdesk", entity: "Room" },
  { prefix: "/reservations", module: "frontdesk", entity: "Reservation" },
  { prefix: "/guests", module: "frontdesk", entity: "Guest" },
  { prefix: "/rateplans", module: "frontdesk", entity: "RatePlan" },
  { prefix: "/mealplans", module: "frontdesk", entity: "MealPlan" },
  { prefix: "/contracts", module: "frontdesk", entity: "Contract" },
  { prefix: "/geo", module: "frontdesk", entity: "Geo" },
  { prefix: "/restaurant", module: "restaurant", entity: "Restaurant" },
  { prefix: "/taxes", module: "accounting", entity: "Tax" },
  { prefix: "/invoices", module: "accounting", entity: "Invoice" },
  { prefix: "/cash-audits", module: "accounting", entity: "CashAudit" },
  { prefix: "/einvoicing", module: "einvoicing", entity: "EInvoicing" },
  { prefix: "/hotel", module: "management", entity: "Hotel" },
  { prefix: "/roles", module: "management", entity: "Role" },
  { prefix: "/permissions", module: "management", entity: "Permission" },
  { prefix: "/users", module: "management", entity: "User" },
  { prefix: "/launcher", module: "management", entity: "Launcher" },
  { prefix: "/audit", module: "audit", entity: "AuditLog" },
];

const SENSITIVE_KEY_RE = /(pass(word)?|token|secret|authorization|cookie|api[-_]?key|jwt|cert|private)/i;
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_ITEMS = 30;
const MAX_OBJECT_KEYS = 50;
const MAX_DEPTH = 5;
const PATH_ID_BLOCKLIST = new Set([
  "checkin",
  "checkout",
  "cancel",
  "close",
  "open",
  "list",
  "search",
  "bulk",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toStringId(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return null;
}

function toEntityToken(entity: string): string {
  const normalized = entity
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized ? normalized.toUpperCase() : "ENTITY";
}

function capitalize(word: string): string {
  if (!word) return "";
  return word[0].toUpperCase() + word.slice(1);
}

function segmentToEntity(segment: string): string {
  return segment
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((w) => capitalize(w.toLowerCase()))
    .join("");
}

export function normalizeAuditPath(path: string | undefined): string {
  let clean = String(path || "").trim();
  clean = clean.replace(/^https?:\/\/[^/]+/i, "");
  if (!clean.startsWith("/")) clean = `/${clean}`;
  clean = clean.split("?")[0] || "/";

  if (clean === "/api") return "/";
  if (clean.startsWith("/api/")) return clean.slice(4);
  return clean;
}

export function getAuditMeta(path: string | undefined): {
  module: string;
  entity: string;
  normalizedPath: string;
} {
  const normalizedPath = normalizeAuditPath(path);
  const lowerPath = normalizedPath.toLowerCase();
  const rule = MODULE_RULES.find((candidate) => {
    const prefix = candidate.prefix.toLowerCase();
    return lowerPath === prefix || lowerPath.startsWith(`${prefix}/`);
  });

  if (rule) {
    return { module: rule.module, entity: rule.entity, normalizedPath };
  }

  const first = normalizedPath.split("/").filter(Boolean)[0] || "system";
  return {
    module: "general",
    entity: segmentToEntity(first) || "System",
    normalizedPath,
  };
}

export function actionFromMethod(method: string, entity: string, statusCode?: number): string {
  const upperMethod = String(method || "").toUpperCase();
  const verb =
    upperMethod === "GET"
      ? "READ"
      : upperMethod === "POST"
      ? "CREATE"
      : upperMethod === "PUT" || upperMethod === "PATCH"
      ? "UPDATE"
      : upperMethod === "DELETE"
      ? "DELETE"
      : "EXECUTE";
  const failedPrefix = typeof statusCode === "number" && statusCode >= 400 ? "FAILED_" : "";
  return `${failedPrefix}${verb}_${toEntityToken(entity)}`;
}

export function extractEntityIdCandidate(input: {
  params?: Record<string, unknown>;
  body?: unknown;
  query?: Record<string, unknown>;
  path?: string;
}): string {
  const params = input.params ?? {};
  const query = input.query ?? {};
  const body = asRecord(input.body);
  const bodyAfter = asRecord(body?.after);
  const bodyBefore = asRecord(body?.before);

  const directCandidates: unknown[] = [
    params.entityId,
    params.id,
    query.entityId,
    query.id,
    body?.entityId,
    body?.id,
    bodyAfter?.entityId,
    bodyAfter?.id,
    bodyBefore?.entityId,
    bodyBefore?.id,
  ];

  for (const candidate of directCandidates) {
    const id = toStringId(candidate);
    if (id) return id;
  }

  const normalizedPath = normalizeAuditPath(input.path);
  const pathSegments = normalizedPath.split("/").filter(Boolean);
  if (pathSegments.length >= 2) {
    const probableId = pathSegments[1];
    const looksLikeAction = PATH_ID_BLOCKLIST.has(probableId.toLowerCase());
    if (!looksLikeAction) {
      const id = toStringId(probableId);
      if (id) return id;
    }
  }

  return "n/a";
}

export function sanitizeForAudit(value: unknown): unknown {
  const seen = new WeakSet<object>();

  const visit = (current: unknown, depth: number): unknown => {
    if (current === null || current === undefined) return current ?? null;
    if (typeof current === "string") {
      if (current.length <= MAX_STRING_LENGTH) return current;
      return `${current.slice(0, MAX_STRING_LENGTH)}...(${current.length} chars)`;
    }
    if (typeof current === "number" || typeof current === "boolean") return current;
    if (typeof current === "bigint") return current.toString();
    if (current instanceof Date) return current.toISOString();
    if (depth >= MAX_DEPTH) return "[MaxDepth]";

    if (Array.isArray(current)) {
      return current.slice(0, MAX_ARRAY_ITEMS).map((item) => visit(item, depth + 1));
    }

    if (typeof current === "object") {
      if (seen.has(current as object)) return "[Circular]";
      seen.add(current as object);

      const source = current as Record<string, unknown>;
      const keys = Object.keys(source).slice(0, MAX_OBJECT_KEYS);
      const target: Record<string, unknown> = {};
      for (const key of keys) {
        if (SENSITIVE_KEY_RE.test(key)) {
          target[key] = "[REDACTED]";
          continue;
        }
        target[key] = visit(source[key], depth + 1);
      }
      return target;
    }

    return String(current);
  };

  return visit(value, 0);
}

export function inferModuleFromLog(payload: unknown, entity: string, action: string): string {
  const payloadObj = asRecord(payload);
  const payloadModule = toStringId(payloadObj?.module)?.toLowerCase();
  if (payloadModule) return payloadModule;

  const payloadPath = toStringId(payloadObj?.path);
  if (payloadPath) return getAuditMeta(payloadPath).module;

  const token = `${entity} ${action}`.toLowerCase();
  if (token.includes("restaurant")) return "restaurant";
  if (token.includes("role") || token.includes("permission") || token.includes("user") || token.includes("hotel") || token.includes("launcher")) {
    return "management";
  }
  if (token.includes("invoice") || token.includes("tax") || token.includes("cash") || token.includes("payment")) {
    return "accounting";
  }
  if (token.includes("einvoicing") || token.includes("hacienda")) return "einvoicing";
  if (token.includes("room") || token.includes("reservation") || token.includes("guest") || token.includes("rateplan") || token.includes("mealplan") || token.includes("contract")) {
    return "frontdesk";
  }
  if (token.includes("audit")) return "audit";
  return "general";
}

export function summarizeAuditPayload(payload: unknown): string {
  const obj = asRecord(payload);
  if (!obj) return "";

  const method = toStringId(obj.method)?.toUpperCase() || "";
  const path = toStringId(obj.path) || "";
  const statusRaw = obj.statusCode;
  const statusCode = typeof statusRaw === "number" ? statusRaw : null;

  const parts = [
    method,
    path,
    statusCode !== null ? `status ${statusCode}` : "",
  ].filter(Boolean);

  return parts.join(" ");
}
