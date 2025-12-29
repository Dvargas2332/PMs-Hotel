const LS_URL = "pms.printAgent.url";
const LS_KEY = "pms.printAgent.key";

const DEFAULT_URL = "http://127.0.0.1:8787";

function normalizeBaseUrl(url) {
  const u = String(url || "").trim();
  if (!u) return DEFAULT_URL;
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

export function getPrintAgentConfig() {
  const url = normalizeBaseUrl(localStorage.getItem(LS_URL) || DEFAULT_URL);
  const key = String(localStorage.getItem(LS_KEY) || "").trim();
  return { url, key };
}

export function setPrintAgentConfig({ url, key }) {
  if (url != null) localStorage.setItem(LS_URL, normalizeBaseUrl(url));
  if (key != null) localStorage.setItem(LS_KEY, String(key || "").trim());
}

export function ensurePrintAgentConfigInteractive() {
  const current = getPrintAgentConfig();
  if (current.key) return current;

  const nextKey = (window.prompt("Enter PMS Print Agent API key (see http://127.0.0.1:8787/ui):", "") || "").trim();
  if (!nextKey) return null;
  setPrintAgentConfig({ key: nextKey });
  return { ...current, key: nextKey };
}

export async function printTextToAgent({ agentUrl, apiKey, printerName, text, copies = 1 }) {
  const url = normalizeBaseUrl(agentUrl);
  const key = String(apiKey || "").trim();
  const printer = String(printerName || "").trim();
  if (!url) throw new Error("Print Agent URL is missing");
  if (!key) throw new Error("Print Agent API key is missing");
  if (!printer) throw new Error("printerName is required");

  const res = await fetch(`${url}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({ printerName: printer, mode: "text", text: String(text || ""), copies }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `Print Agent error (${res.status})`);
  }

  return res.json().catch(() => ({}));
}

export async function listPrintersFromAgent({ agentUrl, apiKey }) {
  const url = normalizeBaseUrl(agentUrl);
  const key = String(apiKey || "").trim();
  if (!url) throw new Error("Print Agent URL is missing");
  if (!key) throw new Error("Print Agent API key is missing");

  const res = await fetch(`${url}/printers`, { headers: { "x-api-key": key } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `Print Agent error (${res.status})`);
  }
  return res.json();
}

