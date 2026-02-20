import type { Request, Response } from "express";
import nodemailer from "nodemailer";
import prisma from "../lib/prisma.js";

export type FormPayload = {
  formType?: string;
  fullName?: string;
  company?: string;
  workEmail?: string;
  phone?: string;
  rooms?: string | number;
  cityCountry?: string;
  needs?: string;
  website?: string; // honeypot
  source?: string;
  pageUrl?: string;
};

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1h
const RATE_LIMIT_MAX = 20;
const rateBuckets = new Map<string, number[]>();

function cleanOldHits(list: number[], now: number) {
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  while (list.length && list[0] < cutoff) list.shift();
}

function canAccept(ip: string) {
  const now = Date.now();
  const list = rateBuckets.get(ip) || [];
  cleanOldHits(list, now);
  if (list.length >= RATE_LIMIT_MAX) return false;
  list.push(now);
  rateBuckets.set(ip, list);
  return true;
}

function required(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim().length > 0;
}

function readEnvBool(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback;
  return ["1", "true", "yes", "y"].includes(String(value).toLowerCase());
}

type SmtpConfig = {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  secure?: boolean;
  from?: string;
  to?: string;
  replyTo?: string;
};

async function loadSaasSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const config = await prisma.saasConfig.findUnique({ where: { key: "GLOBAL" } });
    const smtp = (config?.smtp || {}) as any;
    if (!smtp?.host || !smtp?.user || !smtp?.pass) return null;
    return {
      host: String(smtp.host || "").trim(),
      port: Number(smtp.port || 587),
      user: String(smtp.user || "").trim(),
      pass: String(smtp.pass || "").trim(),
      secure: Boolean(smtp.secure),
      from: smtp.from ? String(smtp.from).trim() : undefined,
      to: smtp.to ? String(smtp.to).trim() : undefined,
      replyTo: smtp.replyTo ? String(smtp.replyTo).trim() : undefined,
    };
  } catch {
    return null;
  }
}

function buildTransport(cfg: SmtpConfig | null) {
  const host = cfg?.host || process.env.FORMINFO_SMTP_HOST;
  const port = Number(cfg?.port ?? process.env.FORMINFO_SMTP_PORT ?? "587");
  const user = cfg?.user || process.env.FORMINFO_SMTP_USER;
  const pass = cfg?.pass || process.env.FORMINFO_SMTP_PASS;
  const secure = cfg?.secure ?? readEnvBool(process.env.FORMINFO_SMTP_SECURE, port === 465);
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

export async function processFormInfo(body: FormPayload, ip: string) {
  if (!canAccept(ip)) return { status: 429, message: "Too many requests" };

  // Honeypot for bots
  if (body.website && String(body.website).trim().length > 0) {
    return { status: 200, ok: true };
  }

  if (!required(body.fullName)) return { status: 400, message: "Full name is required" };
  if (!required(body.company)) return { status: 400, message: "Hotel / Company is required" };
  if (!required(body.workEmail)) return { status: 400, message: "Work email is required" };
  if (!required(body.phone)) return { status: 400, message: "Phone is required" };
  if (!required(body.rooms)) return { status: 400, message: "Rooms is required" };
  if (!required(body.cityCountry)) return { status: 400, message: "City / Country is required" };
  if (!required(body.needs)) return { status: 400, message: "Needs is required" };

  const formType = String(body.formType || "general").trim() || "general";
  const saasSmtp = await loadSaasSmtpConfig();
  const to = saasSmtp?.to || process.env.FORMINFO_TO || "vargas.almengor@gmail.com";
  const from =
    saasSmtp?.from || process.env.FORMINFO_FROM || process.env.FORMINFO_SMTP_USER || "info@kazehanacloud.com";

  const transport = buildTransport(saasSmtp);
  if (!transport) {
    return { status: 500, message: "SMTP not configured" };
  }

  const subject = `New inquiry (${formType}) - ${body.company}`;
  const text = [
    `Form: ${formType}`,
    `Full name: ${body.fullName}`,
    `Hotel / Company: ${body.company}`,
    `Work email: ${body.workEmail}`,
    `Phone: ${body.phone}`,
    `Rooms: ${body.rooms}`,
    `City / Country: ${body.cityCountry}`,
    `Needs: ${body.needs}`,
    body.source ? `Source: ${body.source}` : null,
    body.pageUrl ? `Page: ${body.pageUrl}` : null,
    `IP: ${ip}`,
  ]
    .filter(Boolean)
    .join("\n");

  await transport.sendMail({
    to,
    from,
    subject,
    text,
    replyTo: saasSmtp?.replyTo || body.workEmail,
  });

  return { status: 200, ok: true };
}

export async function submitFormInfo(req: Request, res: Response) {
  const body = (req.body || {}) as FormPayload;
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();

  const result = await processFormInfo(body, ip);
  if (result.status !== 200) return res.status(result.status).json({ message: result.message });
  return res.json({ ok: true });
}
