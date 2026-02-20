type MicroTokenResp = {
  status: number;
  headers?: Record<string, string>;
  body?: any;
  error?: string;
};

const BASE_URL = String(process.env.MICROFACTURA_URL || "").replace(/\/+$/, "");
const API_KEY = String(process.env.MICROFACTURA_API_KEY || "");

function assertConfigured() {
  if (!BASE_URL) {
    throw new Error("MICROFACTURA_URL is not configured");
  }
}

async function post(path: string, payload: any) {
  assertConfigured();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
    },
    body: JSON.stringify(payload ?? {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`Microfactura error (${res.status}): ${typeof json === "string" ? json : JSON.stringify(json)}`);
  }
  return json;
}

export async function microfacturaSignXml(opts: {
  xmlBase64?: string;
  xml?: string;
  certBase64: string;
  certPassword: string;
}) {
  const resp = await post("/sign", opts);
  const signed = resp?.xmlSignedBase64 || resp?.body?.xmlSignedBase64;
  if (!signed) throw new Error("Microfactura did not return xmlSignedBase64");
  return signed as string;
}

export async function microfacturaToken(opts: {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  grantType?: "password" | "refresh_token";
  refreshToken?: string;
}): Promise<MicroTokenResp> {
  const resp = await post("/token", opts);
  return resp as MicroTokenResp;
}

export async function microfacturaSend(opts: {
  token: string;
  clientId: string;
  clave: string;
  fecha: string;
  emisor: { tipoIdentificacion: string; numeroIdentificacion: string };
  receptor?: { tipoIdentificacion: string; numeroIdentificacion: string };
  comprobanteXmlBase64: string;
  callbackUrl?: string | null;
  consecutivoReceptor?: string | null;
}) {
  return post("/send", opts);
}

export async function microfacturaStatus(opts: { token: string; clientId: string; clave: string }) {
  return post("/status", opts);
}
