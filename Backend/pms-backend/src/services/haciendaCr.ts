type HaciendaEnv = "sandbox" | "production";

export type HaciendaEndpoints = {
  tokenUrl: string;
  sendUrl: string;
  statusUrl: string; // may contain {{key}} placeholder
};

export type HaciendaApiConfig = {
  env: HaciendaEnv;
  endpoints: HaciendaEndpoints;
  atv: {
    username: string;
    password: string;
    clientId?: string;
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

export function validateHaciendaSandboxConfig(cfg: HaciendaApiConfig) {
  const issues: string[] = [];
  if (cfg.env !== "sandbox") issues.push("ENV_NOT_SANDBOX");
  if (isPlaceholder(cfg.endpoints.tokenUrl)) issues.push("TOKEN_URL_MISSING");
  if (isPlaceholder(cfg.endpoints.sendUrl)) issues.push("SEND_URL_MISSING");
  if (isPlaceholder(cfg.endpoints.statusUrl)) issues.push("STATUS_URL_MISSING");
  if (!cfg.atv.username?.trim()) issues.push("ATV_USERNAME_MISSING");
  if (!cfg.atv.password?.trim()) issues.push("ATV_PASSWORD_MISSING");
  if (!cfg.atv.clientSecret?.trim()) issues.push("ATV_CLIENT_SECRET_MISSING");
  // clientId is optional for some flows, but we keep a warning if missing
  if (!cfg.atv.clientId?.trim()) issues.push("ATV_CLIENT_ID_MISSING");
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

export async function getSandboxToken(cfg: HaciendaApiConfig): Promise<HaciendaToken> {
  const issues = validateHaciendaSandboxConfig(cfg);
  if (issues.some((x) => x.endsWith("_URL_MISSING"))) {
    throw new Error(
      `Hacienda sandbox endpoints not configured (placeholders). Missing: ${issues
        .filter((x) => x.endsWith("_URL_MISSING"))
        .join(", ")}`
    );
  }

  // NOTE: Placeholder implementation. Replace body/headers according to Hacienda docs.
  const body = new URLSearchParams({
    grant_type: "password",
    username: cfg.atv.username,
    password: cfg.atv.password,
    client_id: cfg.atv.clientId || "PLACEHOLDER_CLIENT_ID",
    client_secret: cfg.atv.clientSecret,
  });

  const res = await fetchWithTimeout(cfg.endpoints.tokenUrl, {
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

export async function sendSandboxDocument(cfg: HaciendaApiConfig, token: HaciendaToken, xmlSigned: string, key: string) {
  if (isPlaceholder(cfg.endpoints.sendUrl)) {
    throw new Error("Hacienda sendUrl not configured (placeholder).");
  }

  // NOTE: Placeholder implementation. Replace payload shape according to Hacienda docs.
  const payload = {
    clave: key,
    xml: Buffer.from(xmlSigned, "utf8").toString("base64"),
    sandbox: true,
  };

  const res = await fetchWithTimeout(cfg.endpoints.sendUrl, {
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

export async function getSandboxStatus(cfg: HaciendaApiConfig, token: HaciendaToken, key: string) {
  if (isPlaceholder(cfg.endpoints.statusUrl)) {
    throw new Error("Hacienda statusUrl not configured (placeholder).");
  }
  const url = cfg.endpoints.statusUrl.includes("{{key}}")
    ? cfg.endpoints.statusUrl.replaceAll("{{key}}", encodeURIComponent(key))
    : cfg.endpoints.statusUrl;

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

