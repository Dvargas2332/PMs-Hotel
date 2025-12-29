const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { runPowerShell } = require("./powershell.js");

function psEscapeSingleQuotes(s) {
  return String(s).replace(/'/g, "''");
}

async function listPrinters() {
  const cmd = `Get-Printer | Select-Object Name,DriverName,PortName,Shared,Published | ConvertTo-Json -Depth 3`;
  const out = await runPowerShell(cmd, { timeoutMs: 30000 });
  const trimmed = out.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function printText({ printerName, text, copies = 1 }) {
  const safePrinter = psEscapeSingleQuotes(printerName);
  const safeText = psEscapeSingleQuotes(text);
  const n = Math.max(1, Math.min(50, Number(copies) || 1));

  const cmd = `
$p='${safePrinter}';
$t='${safeText}';
for ($i=0; $i -lt ${n}; $i++) { $t | Out-Printer -Name $p }
`;
  await runPowerShell(cmd, { timeoutMs: 60000 });
}

async function printFile({ printerName, filename, dataBase64, copies = 1 }) {
  const safePrinter = psEscapeSingleQuotes(printerName);
  const buf = Buffer.from(String(dataBase64 || ""), "base64");
  if (!buf.length) throw new Error("Empty file payload");

  const ext = path.extname(filename || "").slice(0, 10) || ".bin";
  const tmpPath = path.join(os.tmpdir(), `pms_print_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`);
  await fs.writeFile(tmpPath, buf);

  const n = Math.max(1, Math.min(20, Number(copies) || 1));
  const safePath = psEscapeSingleQuotes(tmpPath);
  const cmd = `
$p='${safePrinter}';
$f='${safePath}';
for ($i=0; $i -lt ${n}; $i++) {
  Start-Process -FilePath $f -Verb PrintTo -ArgumentList $p -WindowStyle Hidden | Out-Null
  Start-Sleep -Milliseconds 350
}
`;
  try {
    await runPowerShell(cmd, { timeoutMs: 120000 });
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}

module.exports = { listPrinters, printText, printFile };
