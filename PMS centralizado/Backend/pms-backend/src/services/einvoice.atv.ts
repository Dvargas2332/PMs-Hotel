/**
 * Cliente del API de Hacienda (ATV) para comprobantes 4.4.
 *
 * Tres pasos, tal como los publica Hacienda:
 *   1. token  → OAuth2 password grant contra el IdP (rut-stag / rut).
 *   2. envío  → POST /recepcion con la clave, el emisor y el XML firmado en base64.
 *   3. estado → GET /recepcion/{clave} para saber si fue aceptado o rechazado.
 *
 * No se usa un servicio intermedio: las credenciales son de cada hotel.
 */

export type AtvEnvironment = "sandbox" | "production";

const IDP: Record<AtvEnvironment, string> = {
  sandbox: "https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token",
  production: "https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token",
};

const API: Record<AtvEnvironment, string> = {
  sandbox: "https://api-stag.comprobanteselectronicos.go.cr",
  production: "https://api.comprobanteselectronicos.go.cr",
};

export interface AtvCredentials {
  environment: AtvEnvironment;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

export interface AtvIdentity {
  tipoIdentificacion: string;
  numeroIdentificacion: string;
}

function baseUrl(env: AtvEnvironment) {
  return API[env] || API.sandbox;
}

async function readBody(res: Response) {
  const text = await res.text();
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

/** Pide el token de acceso al IdP de Hacienda. */
export async function atvToken(creds: AtvCredentials): Promise<{ accessToken: string; expiresIn: number }> {
  const env: AtvEnvironment = creds.environment === "production" ? "production" : "sandbox";
  const form = new URLSearchParams({
    grant_type: "password",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    username: creds.username,
    password: creds.password,
  });

  const res = await fetch(IDP[env], {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    signal: AbortSignal.timeout(20_000),
  });
  const { json, text } = await readBody(res);
  if (!res.ok) {
    const detail = json?.error_description || json?.error || text.slice(0, 200);
    throw new Error(`Hacienda rechazó las credenciales (${res.status}): ${detail}`);
  }
  const accessToken = String(json?.access_token || "");
  if (!accessToken) throw new Error("Hacienda no devolvió access_token");
  return { accessToken, expiresIn: Number(json?.expires_in || 0) };
}

/** Envía el comprobante firmado a recepción. Hacienda responde 202 con el estado. */
export async function atvSend(opts: {
  environment: AtvEnvironment;
  token: string;
  clave: string;
  issuedAt: string;
  emisor: AtvIdentity;
  receptor?: AtvIdentity | null;
  consecutivoReceptor?: string | null;
  xmlSignedBase64: string;
}): Promise<{ status: number; body: any }> {
  const payload: Record<string, unknown> = {
    clave: opts.clave,
    fecha: opts.issuedAt,
    emisor: opts.emisor,
    comprobanteXml: opts.xmlSignedBase64,
  };
  if (opts.receptor?.numeroIdentificacion) {
    payload.receptor = opts.receptor;
    if (opts.consecutivoReceptor) payload.consecutivoReceptor = opts.consecutivoReceptor;
  }

  const res = await fetch(`${baseUrl(opts.environment)}/recepcion/v1/recepcion`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const { json, text } = await readBody(res);
  if (!res.ok) {
    throw new Error(`Hacienda rechazó el envío (${res.status}): ${json?.mensaje || json?.message || text.slice(0, 200)}`);
  }
  return { status: res.status, body: json ?? text };
}

/** Consulta el estado del comprobante por su clave. */
export async function atvStatus(opts: {
  environment: AtvEnvironment;
  token: string;
  clave: string;
}): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl(opts.environment)}/recepcion/v1/recepcion/${encodeURIComponent(opts.clave)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${opts.token}` },
    signal: AbortSignal.timeout(20_000),
  });
  const { json, text } = await readBody(res);
  return { status: res.status, body: json ?? text };
}
