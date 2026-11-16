/**
 * Cliente del PMS Print Agent (Windows).
 *
 * El agente es un programa aparte que corre en la caja: escucha en
 * `127.0.0.1:8787`, habla con la impresora instalada y expone una API local
 * protegida con una clave. Aquí sólo se arma el trabajo y se envía; la impresión
 * la hace el agente, así que la pantalla del PMS no necesita permisos especiales.
 *
 * Protocolo (ver README del agente):
 *   GET  /health            → estado, sin clave
 *   GET  /api/printers      → impresoras instaladas, con clave
 *   POST /api/job           → { job: { job_id, type, printer_name, copies, payload } }
 */

const LS_URL = "pms.printAgent.url";
const LS_KEY = "pms.printAgent.key";
const LS_MODE = "pms.printAgent.mode";

const DEFAULT_URL = "http://127.0.0.1:8787";

function normalizeBaseUrl(url) {
  const u = String(url || "").trim();
  if (!u) return DEFAULT_URL;
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

export function getPrintAgentConfig() {
  const url = normalizeBaseUrl(localStorage.getItem(LS_URL) || DEFAULT_URL);
  const key = String(localStorage.getItem(LS_KEY) || "").trim();
  const mode = String(localStorage.getItem(LS_MODE) || "escpos").trim() === "html" ? "html" : "escpos";
  return { url, key, mode };
}

export function setPrintAgentConfig({ url, key, mode }) {
  if (url != null) localStorage.setItem(LS_URL, normalizeBaseUrl(url));
  if (key != null) localStorage.setItem(LS_KEY, String(key || "").trim());
  if (mode != null) localStorage.setItem(LS_MODE, String(mode) === "html" ? "html" : "escpos");
}

export function ensurePrintAgentConfigInteractive() {
  const current = getPrintAgentConfig();
  if (current.key) return current;
  return null; // la pantalla que llama debe pedir la clave
}

// ── Codificación para impresoras térmicas ────────────────────────────────────
// ESC/POS no usa UTF-8: se manda la página de códigos 850 (la de Windows en
// español). Sólo se traducen las letras acentuadas y los símbolos que salen en
// los comprobantes; lo que no esté en la tabla pierde la tilde o se vuelve "?".

const CP850 = {
  "Ç": 0x80, "ü": 0x81, "é": 0x82, "â": 0x83, "ä": 0x84, "à": 0x85, "å": 0x86, "ç": 0x87,
  "ê": 0x88, "ë": 0x89, "è": 0x8a, "ï": 0x8b, "î": 0x8c, "ì": 0x8d, "Ä": 0x8e, "Å": 0x8f,
  "É": 0x90, "æ": 0x91, "Æ": 0x92, "ô": 0x93, "ö": 0x94, "ò": 0x95, "û": 0x96, "ù": 0x97,
  "ÿ": 0x98, "Ö": 0x99, "Ü": 0x9a, "ø": 0x9b, "£": 0x9c, "Ø": 0x9d, "×": 0x9e,
  "á": 0xa0, "í": 0xa1, "ó": 0xa2, "ú": 0xa3, "ñ": 0xa4, "Ñ": 0xa5, "ª": 0xa6, "º": 0xa7,
  "¿": 0xa8, "®": 0xa9, "¬": 0xaa, "½": 0xab, "¼": 0xac, "¡": 0xad, "«": 0xae, "»": 0xaf,
  "Á": 0xb5, "Â": 0xb6, "À": 0xb7, "©": 0xb8, "¢": 0xbd, "¥": 0xbe, "ã": 0xc6, "Ã": 0xc7,
  "¤": 0xcf, "ð": 0xd0, "Ð": 0xd1, "Ê": 0xd2, "Ë": 0xd3, "È": 0xd4, "Í": 0xd6, "Î": 0xd7,
  "Ï": 0xd8, "¦": 0xdd, "Ì": 0xde, "Ó": 0xe0, "ß": 0xe1, "Ô": 0xe2, "Ò": 0xe3, "õ": 0xe4,
  "Õ": 0xe5, "µ": 0xe6, "þ": 0xe7, "Þ": 0xe8, "Ú": 0xe9, "Û": 0xea, "Ù": 0xeb, "ý": 0xec,
  "Ý": 0xed, "¯": 0xee, "´": 0xef, "±": 0xf1, "¾": 0xf3, "¶": 0xf4, "§": 0xf5,
  "÷": 0xf6, "¸": 0xf7, "°": 0xf8, "¨": 0xf9, "·": 0xfa, "¹": 0xfb, "³": 0xfc,
  "²": 0xfd, "■": 0xfe,
};

const ASCII_FALLBACK = {
  "—": "-", "–": "-", "‑": "-",
  "“": '"', "”": '"', "„": '"',
  "‘": "'", "’": "'", "‚": "'",
  "…": "...", "•": "*", "₡": "C", "€": "E", "→": ">", "←": "<",
  "\t": "  ", "\u00a0": " ",
};

export function encodeCp850(text) {
  const bytes = [];
  for (const ch of String(text ?? "")) {
    const code = ch.codePointAt(0);
    if (code === 10) {
      bytes.push(0x0a);
      continue;
    }
    if (code < 0x80) {
      bytes.push(code);
      continue;
    }
    if (CP850[ch] != null) {
      bytes.push(CP850[ch]);
      continue;
    }
    const fallback = ASCII_FALLBACK[ch];
    if (fallback != null) {
      for (let i = 0; i < fallback.length; i += 1) bytes.push(fallback.charCodeAt(i));
      continue;
    }
    // Letra con tilde que no está en la tabla: se manda sin tilde.
    const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (base && base !== ch && base.codePointAt(0) < 0x80) {
      bytes.push(base.codePointAt(0));
      continue;
    }
    bytes.push(0x3f); // "?"
  }
  return new Uint8Array(bytes);
}

/** ESC @ (inicializar) + ESC t 2 (página 850) + texto + avance de papel. */
export function buildEscPosBytes(text, { feed = 4 } = {}) {
  const body = encodeCp850(text);
  const head = new Uint8Array([0x1b, 0x40, 0x1b, 0x74, 0x02]);
  const tail = new Uint8Array([0x0a, 0x1b, 0x64, Math.max(0, Math.min(255, feed))]);
  const out = new Uint8Array(head.length + body.length + tail.length);
  out.set(head, 0);
  out.set(body, head.length);
  out.set(tail, head.length + body.length);
  return out;
}

function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** El mismo texto, pero como documento de 80 mm para una impresora normal. */
export function buildReceiptHtml(text, { paperWidthMm = 80 } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  @page { size: ${paperWidthMm}mm auto; margin: 3mm; }
  body { font-family: "Consolas", "Courier New", monospace; font-size: 9px; line-height: 1.25; margin: 0; }
  pre { white-space: pre-wrap; word-break: break-word; margin: 0; font: inherit; }
</style></head><body><pre>${escapeHtml(text)}</pre></body></html>`;
}

function jobId() {
  return `pms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readJson(res) {
  return res.json().catch(() => null);
}

export async function getAgentStatus({ agentUrl } = {}) {
  const url = normalizeBaseUrl(agentUrl || getPrintAgentConfig().url);
  const res = await fetch(`${url}/health`);
  const data = await readJson(res);
  if (!res.ok) throw new Error(data?.error || `Print Agent error (${res.status})`);
  return data || {};
}

export async function listPrintersFromAgent({ agentUrl, apiKey } = {}) {
  const cfg = getPrintAgentConfig();
  const url = normalizeBaseUrl(agentUrl || cfg.url);
  const key = String(apiKey ?? cfg.key ?? "").trim();
  if (!key) throw new Error("Print Agent API key is missing");

  const res = await fetch(`${url}/api/printers`, { headers: { "X-API-Key": key } });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data?.error || `Print Agent error (${res.status})`);
  const list = Array.isArray(data?.printers) ? data.printers : [];
  return list
    .map((p) => (typeof p === "string" ? { name: p, alias: "", mode: "" } : { name: String(p?.name || ""), alias: String(p?.alias || ""), mode: String(p?.mode || "") }))
    .filter((p) => p.name);
}

export async function printTextToAgent({ agentUrl, apiKey, printerName, text, copies = 1 }) {
  const cfg = getPrintAgentConfig();
  const url = normalizeBaseUrl(agentUrl || cfg.url);
  const key = String(apiKey ?? cfg.key ?? "").trim();
  const printer = String(printerName || "").trim();
  if (!url) throw new Error("Print Agent URL is missing");
  if (!key) throw new Error("Print Agent API key is missing");
  if (!printer) throw new Error("printerName is required");

  const mode = String(cfg.mode || "escpos") === "html" ? "html" : "escpos";
  const payload =
    mode === "html"
      ? { html: buildReceiptHtml(text) }
      : { raw_base64: toBase64(buildEscPosBytes(text)) };

  const job = {
    job_id: jobId(),
    type: mode,
    printer_name: printer,
    copies: Math.max(1, Number(copies) || 1),
    payload,
    options: mode === "html" ? { paper_size: "80mm", paper_width_mm: 80 } : {},
  };

  const res = await fetch(`${url}/api/job`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": key },
    body: JSON.stringify({ job }),
  });
  const data = await readJson(res);
  if (!res.ok || String(data?.status || "").toLowerCase() === "error") {
    throw new Error(data?.message || data?.error || `Print Agent error (${res.status})`);
  }
  return data || { status: "ok" };
}
