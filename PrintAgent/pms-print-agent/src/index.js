const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const crypto = require("node:crypto");
const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const { JobQueue } = require("./jobQueue.js");
const { listPrinters, printFile, printText } = require("./print.js");

function isLocalhost(remoteAddress) {
  const ip = String(remoteAddress || "").trim();
  return ip === "127.0.0.1" || ip === "::1" || ip.startsWith("::ffff:127.0.0.1");
}

function generateApiKey() {
  return crypto.randomBytes(32).toString("base64url");
}

function getConfigDir() {
  const preferred =
    process.env.PMS_PRINT_AGENT_HOME ||
    (process.env.APPDATA ? path.join(process.env.APPDATA, "PMS Print Agent") : "");

  if (!preferred) return process.cwd();

  try {
    fs.mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    return process.cwd();
  }
}

const configDir = getConfigDir();
const envPath = path.join(configDir, ".env");
const configPath = path.join(configDir, "pms-print-agent.config.json");

function ensureEnvFile() {
  if (fs.existsSync(envPath)) return;

  const key = generateApiKey();
  const contents = [
    "# Auto-generated on first run",
    "PRINT_AGENT_HOST=127.0.0.1",
    "PRINT_AGENT_PORT=8787",
    `PRINT_AGENT_API_KEY=${key}`,
    "PRINT_AGENT_ALLOWED_ORIGINS=http://localhost:3000",
    "PRINT_AGENT_BODY_LIMIT=5mb",
    "",
  ].join("\n");

  fs.writeFileSync(envPath, contents, { encoding: "utf8" });
}

function defaultConfig(apiKey) {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    keys: [
      {
        id: `key_${Date.now()}`,
        label: "Default",
        key: apiKey,
        createdAt: new Date().toISOString(),
        allowedPrinters: ["*"],
      },
    ],
  };
}

function loadConfig(apiKeyForBootstrap) {
  try {
    if (!fs.existsSync(configPath)) {
      const cfg = defaultConfig(apiKeyForBootstrap);
      fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), "utf8");
      return cfg;
    }
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.keys)) {
      const cfg = defaultConfig(apiKeyForBootstrap);
      fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), "utf8");
      return cfg;
    }
    return parsed;
  } catch {
    return defaultConfig(apiKeyForBootstrap);
  }
}

async function saveConfig(cfg) {
  await fsp.mkdir(configDir, { recursive: true });
  await fsp.writeFile(configPath, JSON.stringify(cfg, null, 2), "utf8");
}

ensureEnvFile();
dotenv.config({ path: envPath });

const HOST = process.env.PRINT_AGENT_HOST || "127.0.0.1";
const PORT = Number(process.env.PRINT_AGENT_PORT || 8787);
const API_KEY = String(process.env.PRINT_AGENT_API_KEY || "").trim();
const BODY_LIMIT = process.env.PRINT_AGENT_BODY_LIMIT || "5mb";

const allowedOrigins = String(process.env.PRINT_AGENT_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!API_KEY) {
  // eslint-disable-next-line no-console
  console.error("PRINT_AGENT_API_KEY is required. Set it in .env");
  process.exit(1);
}

const app = express();
const queue = new JobQueue();
let cfg = loadConfig(API_KEY);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0) return cb(null, false);
      return cb(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: BODY_LIMIT }));

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (req.path === "/ui" || req.path.startsWith("/ui/")) return next();
  if (req.path.startsWith("/admin/")) return next();

  const headerKey = String(req.headers["x-api-key"] || "").trim();
  const auth = String(req.headers.authorization || "").trim();
  const bearerKey = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const queryKey = String((req.query && req.query.key) || "").trim();
  const key = headerKey || bearerKey || queryKey;

  const matched = cfg.keys.find((k) => k.key === key);
  if (!matched) return res.status(401).json({ message: "Invalid API key" });
  req._pmsKey = matched;
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/ui", (req, res) => {
  if (!isLocalhost(req.socket.remoteAddress)) return res.status(403).send("Forbidden");
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PMS Print Agent</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 20px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; }
    h1 { margin: 0 0 12px; font-size: 18px; }
    h2 { margin: 0 0 10px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 8px; border-top: 1px solid #f1f5f9; vertical-align: top; }
    th { text-align: left; color: #334155; }
    code { background: #f8fafc; padding: 2px 6px; border-radius: 6px; }
    .btn { cursor: pointer; border: 1px solid #cbd5e1; background: #fff; padding: 6px 10px; border-radius: 10px; font-size: 12px; }
    .btn.primary { background: #0ea5e9; color: #fff; border-color: #0ea5e9; }
    .btn.danger { background: #ef4444; color: #fff; border-color: #ef4444; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; background: #f1f5f9; color: #0f172a; }
    input, select { width: 100%; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 12px; }
    .muted { color: #64748b; font-size: 12px; }
    .stack { display: grid; gap: 8px; }
  </style>
</head>
<body>
  <h1>PMS Print Agent</h1>
  <div class="muted">Local UI. Config dir: <code id="cfgDir">...</code></div>
  <div style="height: 14px"></div>

  <div class="row">
    <div class="card">
      <h2>API Keys</h2>
      <div class="stack">
        <div>
          <label class="muted">Label</label>
          <input id="newLabel" placeholder="e.g. Restaurant POS" />
        </div>
        <div>
          <label class="muted">Allowed printers</label>
          <select id="newPrinters" multiple size="6"></select>
          <div class="muted">Select one or more printers. If none selected, key will allow all printers.</div>
        </div>
        <div style="display:flex; gap: 8px;">
          <button class="btn primary" id="btnCreate">Generate key</button>
          <button class="btn" id="btnRefresh">Refresh</button>
        </div>
      </div>

      <div style="height: 12px"></div>
      <table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Key</th>
            <th>Allowed printers</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="keysTbody"></tbody>
      </table>
    </div>

    <div class="card">
      <h2>Printers</h2>
      <table>
        <thead>
          <tr><th>Name</th><th>Driver</th><th>Port</th></tr>
        </thead>
        <tbody id="printersTbody"></tbody>
      </table>
    </div>
  </div>

  <script>
    const byId = (id) => document.getElementById(id);
    const elCfg = byId('cfgDir');
    const keysTbody = byId('keysTbody');
    const printersTbody = byId('printersTbody');
    const newPrinters = byId('newPrinters');

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',\"'\":'&#39;'}[c]));
    }

    async function fetchState() {
      const res = await fetch('/admin/state');
      if (!res.ok) throw new Error('Failed to load state');
      return await res.json();
    }

    function setPrintersOptions(printers) {
      newPrinters.innerHTML = '';
      printers.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.Name;
        opt.textContent = p.Name;
        newPrinters.appendChild(opt);
      });
    }

    function renderPrinters(printers) {
      printersTbody.innerHTML = printers.map((p) => (
        '<tr>' +
          '<td><span class=\"pill\">' + escapeHtml(p.Name) + '</span></td>' +
          '<td>' + escapeHtml(p.DriverName || '') + '</td>' +
          '<td>' + escapeHtml(p.PortName || '') + '</td>' +
        '</tr>'
      )).join('');
    }

    function renderKeys(keys) {
      keysTbody.innerHTML = keys.map((k) => {
        const printers = Array.isArray(k.allowedPrinters) ? k.allowedPrinters : ['*'];
        const printersLabel = printers.includes('*') ? 'ALL' : printers.join(', ');
        return (
          '<tr>' +
            '<td>' + escapeHtml(k.label || '') + '<div class=\"muted\">' + escapeHtml(k.createdAt || '') + '</div></td>' +
            '<td><code>' + escapeHtml(k.key || '') + '</code></td>' +
            '<td>' + escapeHtml(printersLabel) + '</td>' +
            '<td style=\"white-space:nowrap\">' +
              '<button class=\"btn\" data-copy=\"' + escapeHtml(k.key || '') + '\">Copy</button> ' +
              '<button class=\"btn danger\" data-del=\"' + escapeHtml(k.id || '') + '\">Delete</button>' +
            '</td>' +
          '</tr>'
        );
      }).join('');

      keysTbody.querySelectorAll('button[data-copy]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const key = btn.getAttribute('data-copy');
          try { await navigator.clipboard.writeText(key); btn.textContent = 'Copied'; setTimeout(() => btn.textContent='Copy', 900); } catch {}
        });
      });
      keysTbody.querySelectorAll('button[data-del]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-del');
          if (!confirm('Delete this key?')) return;
          await fetch('/admin/keys/' + encodeURIComponent(id), { method: 'DELETE' });
          await refresh();
        });
      });
    }

    async function refresh() {
      const state = await fetchState();
      elCfg.textContent = state.configDir || '';
      setPrintersOptions(state.printers || []);
      renderPrinters(state.printers || []);
      renderKeys(state.keys || []);
    }

    byId('btnRefresh').addEventListener('click', refresh);
    byId('btnCreate').addEventListener('click', async () => {
      const label = byId('newLabel').value || 'Key';
      const selected = Array.from(newPrinters.selectedOptions || []).map(o => o.value);
      const payload = { label, allowedPrinters: selected.length ? selected : ['*'] };
      await fetch('/admin/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      byId('newLabel').value = '';
      Array.from(newPrinters.options).forEach(o => o.selected = false);
      await refresh();
    });

    refresh().catch((e) => { document.body.innerHTML = '<pre>' + escapeHtml(String(e && e.message || e)) + '</pre>'; });
  </script>
</body>
</html>`);
});

function requireLocalAdmin(req, res, next) {
  if (!isLocalhost(req.socket.remoteAddress)) return res.status(403).json({ message: "Forbidden" });
  next();
}

app.get("/admin/state", requireLocalAdmin, async (_req, res) => {
  try {
    const printers = await listPrinters();
    res.json({ configDir, keys: cfg.keys, printers });
  } catch (err) {
    res.status(500).json({ message: err?.message || "Could not load state" });
  }
});

app.post("/admin/keys", requireLocalAdmin, async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const label = String(body.label || "Key").trim().slice(0, 80);
  const allowedPrinters = Array.isArray(body.allowedPrinters) && body.allowedPrinters.length ? body.allowedPrinters : ["*"];
  const key = generateApiKey();
  const record = {
    id: `key_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    label,
    key,
    createdAt: new Date().toISOString(),
    allowedPrinters: allowedPrinters.map(String),
  };
  cfg.keys.unshift(record);
  await saveConfig(cfg);
  res.json(record);
});

app.delete("/admin/keys/:id", requireLocalAdmin, async (req, res) => {
  const id = String(req.params.id || "").trim();
  const before = cfg.keys.length;
  cfg.keys = cfg.keys.filter((k) => k.id !== id);
  if (cfg.keys.length === before) return res.status(404).json({ message: "Not found" });
  await saveConfig(cfg);
  res.json({ ok: true });
});

app.get("/printers", async (_req, res) => {
  try {
    const printers = await listPrinters();
    res.json(printers);
  } catch (err) {
    res.status(500).json({ message: err?.message || "Could not list printers" });
  }
});

app.get("/jobs", (_req, res) => res.json(queue.list()));
app.get("/jobs/:id", (req, res) => {
  const job = queue.get(req.params.id);
  if (!job) return res.status(404).json({ message: "Not found" });
  res.json(job);
});

app.post("/print", async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const printerName = String(body.printerName || "").trim();
  const mode = String(body.mode || "text").trim().toLowerCase();
  const copies = Number(body.copies || 1);

  if (!printerName) return res.status(400).json({ message: "printerName is required" });
  if (!["text", "file"].includes(mode)) return res.status(400).json({ message: "mode must be text|file" });

  const k = req._pmsKey;
  const allowed = Array.isArray(k?.allowedPrinters) ? k.allowedPrinters : ["*"];
  const canPrint = allowed.includes("*") || allowed.includes(printerName);
  if (!canPrint) return res.status(403).json({ message: "API key not allowed to use this printer" });

  const job = queue.create({ printerName, mode, copies });
  queue.run(job.id, async () => {
    if (mode === "text") {
      const text = String(body.text || "");
      await printText({ printerName, text, copies });
      return;
    }
    const filename = String(body.filename || "document.bin");
    const dataBase64 = String(body.dataBase64 || "");
    await printFile({ printerName, filename, dataBase64, copies });
  });

  res.json({ id: job.id, status: job.status });
});

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[pms-print-agent] listening on http://${HOST}:${PORT}`);
  console.log(`[pms-print-agent] config dir: ${configDir}`);
  console.log(`[pms-print-agent] UI: http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}/ui`);
});
