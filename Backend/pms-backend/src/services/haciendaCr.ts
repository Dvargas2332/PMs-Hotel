type HaciendaEnv = "sandbox" | "production";

export type HaciendaEndpoints = {
  tokenUrl?: string;
  sendUrl?: string;
  statusUrl?: string; // may contain {{key}} placeholder
};

export type HaciendaApiConfig = {
  env: HaciendaEnv;
  endpoints?: HaciendaEndpoints;
  atv: {
    username: string;
    password: string;
    clientId?: string; // api-stag | api-prod
    clientSecret: string;
  };
};

export type HaciendaToken = {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  obtainedAt: string;
};

function isPlaceholder(value: string | undefined | null) {
  const s = String(value || "").trim();
  if (!s) return true;
  return (
    s.includes("PLACEHOLDER") ||
    s.includes("example.com") ||
    s.startsWith("https://TODO") ||
    s.startsWith("http://TODO")
  );
}

const DEFAULT_ENDPOINTS = {
  sandbox: {
    tokenUrl: "https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token",
    sendUrl: "https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/",
    statusUrl: "https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/{{key}}",
  },
  production: {
    tokenUrl: "https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token",
    sendUrl: "https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/",
    statusUrl: "https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/{{key}}",
  },
} as const;

function resolveEndpoints(cfg: HaciendaApiConfig) {
  const env = cfg.env === "production" ? "production" : "sandbox";
  const base = DEFAULT_ENDPOINTS[env];
  const overrides = cfg.endpoints || {};
  return {
    tokenUrl: overrides.tokenUrl || base.tokenUrl,
    sendUrl: overrides.sendUrl || base.sendUrl,
    statusUrl: overrides.statusUrl || base.statusUrl,
  };
}

export function validateHaciendaConfig(cfg: HaciendaApiConfig) {
  const issues: string[] = [];
  const endpoints = resolveEndpoints(cfg);
  if (isPlaceholder(endpoints.tokenUrl)) issues.push("TOKEN_URL_MISSING");
  if (isPlaceholder(endpoints.sendUrl)) issues.push("SEND_URL_MISSING");
  if (isPlaceholder(endpoints.statusUrl)) issues.push("STATUS_URL_MISSING");
  if (!cfg.atv.username?.trim()) issues.push("ATV_USERNAME_MISSING");
  if (!cfg.atv.password?.trim()) issues.push("ATV_PASSWORD_MISSING");
  if (!cfg.atv.clientSecret?.trim()) issues.push("ATV_CLIENT_SECRET_MISSING");
  if (!cfg.atv.clientId?.trim()) issues.push("ATV_CLIENT_ID_MISSING");
  if (cfg.atv.clientId && !["api-stag", "api-prod"].includes(cfg.atv.clientId)) {
    issues.push("ATV_CLIENT_ID_INVALID");
  }
  return issues;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit & { timeoutMs?: number }) {
  const { timeoutMs = 15000, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...rest, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export async function getHaciendaToken(cfg: HaciendaApiConfig, grantType: "password" | "refresh_token", refreshToken?: string): Promise<HaciendaToken> {
  const issues = validateHaciendaConfig(cfg);
  if (issues.some((x) => x.endsWith("_URL_MISSING"))) {
    throw new Error(
      `Hacienda sandbox endpoints not configured (placeholders). Missing: ${issues
        .filter((x) => x.endsWith("_URL_MISSING"))
        .join(", ")}`
    );
  }

  const endpoints = resolveEndpoints(cfg);
  const body = new URLSearchParams({
    grant_type: grantType,
    client_id: cfg.atv.clientId || "api-stag",
    client_secret: cfg.atv.clientSecret,
  });
  if (grantType === "password") {
    body.set("username", cfg.atv.username);
    body.set("password", cfg.atv.password);
  } else if (grantType === "refresh_token") {
    if (!refreshToken) throw new Error("Missing refresh_token");
    body.set("refresh_token", refreshToken);
  }

  const res = await fetchWithTimeout(endpoints.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    timeoutMs: 15000,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Hacienda token error (${res.status}): ${text.slice(0, 500)}`);
  }
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Hacienda token response is not JSON: ${text.slice(0, 500)}`);
  }

  const accessToken = String(json.access_token || json.accessToken || "");
  const tokenType = String(json.token_type || json.tokenType || "Bearer");
  if (!accessToken) throw new Error("Hacienda token response missing access_token");

  return {
    accessToken,
    tokenType,
    expiresIn: Number.isFinite(Number(json.expires_in)) ? Number(json.expires_in) : undefined,
    obtainedAt: new Date().toISOString(),
  };
}

export async function sendHaciendaDocument(
  cfg: HaciendaApiConfig,
  token: HaciendaToken,
  xmlSigned: string,
  key: string,
  opts: {
    issuedAt: string;
    issuerIdType: string;
    issuerIdNumber: string;
    receiverIdType?: string | null;
    receiverIdNumber?: string | null;
    callbackUrl?: string | null;
  }
) {
  const endpoints = resolveEndpoints(cfg);
  if (isPlaceholder(endpoints.sendUrl)) {
    throw new Error("Hacienda sendUrl not configured (placeholder).");
  }

  const payload: any = {
    clave: key,
    fecha: opts.issuedAt,
    emisor: {
      tipoIdentificacion: opts.issuerIdType,
      numeroIdentificacion: opts.issuerIdNumber,
    },
    comprobanteXml: Buffer.from(xmlSigned, "utf8").toString("base64"),
  };
  if (opts.receiverIdType && opts.receiverIdNumber) {
    payload.receptor = {
      tipoIdentificacion: opts.receiverIdType,
      numeroIdentificacion: opts.receiverIdNumber,
    };
  }
  if (opts.callbackUrl) payload.callbackUrl = opts.callbackUrl;

  const res = await fetchWithTimeout(endpoints.sendUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `${token.tokenType} ${token.accessToken}`,
    },
    body: JSON.stringify(payload),
    timeoutMs: 15000,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Hacienda send error (${res.status}): ${text.slice(0, 500)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function getHaciendaStatus(cfg: HaciendaApiConfig, token: HaciendaToken, key: string) {
  const endpoints = resolveEndpoints(cfg);
  if (isPlaceholder(endpoints.statusUrl)) {
    throw new Error("Hacienda statusUrl not configured (placeholder).");
  }
  const url = endpoints.statusUrl.includes("{{key}}")
    ? endpoints.statusUrl.replaceAll("{{key}}", encodeURIComponent(key))
    : endpoints.statusUrl;

  const res = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      Authorization: `${token.tokenType} ${token.accessToken}`,
    },
    timeoutMs: 15000,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Hacienda status error (${res.status}): ${text.slice(0, 500)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
