import "dotenv/config";
import express from "express";
import cors from "cors";
import { JobQueue } from "./jobQueue.js";
import { listPrinters, printFile, printText } from "./print.js";

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
  const key = String(req.headers["x-api-key"] || "").trim();
  if (key !== API_KEY) return res.status(401).json({ message: "Invalid API key" });
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

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
});
