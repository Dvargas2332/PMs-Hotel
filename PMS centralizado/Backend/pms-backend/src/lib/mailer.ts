// src/lib/mailer.ts
// Gestor SaaS mailer — uses Resend to send administrative emails to hotels.
// Hotel-level SMTP (invoices, e-invoicing) is configured per-hotel separately.

import { Resend } from "resend";
import prisma from "./prisma.js";

const SAAS_CONFIG_KEY = "GLOBAL";

async function getResendClient(): Promise<{ client: Resend; from: string; replyTo?: string }> {
  const config = await prisma.saasConfig.findUnique({ where: { key: SAAS_CONFIG_KEY } });
  const rc = ((config as any)?.resendConfig || {}) as any;
  const apiKey = String(rc.apiKey || process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) throw new Error("Resend API key no configurado. Ve a Gestor → Configuración → Correo del gestor.");
  const from = String(rc.from || process.env.RESEND_FROM || "Kazehana Cloud <noreply@kazehanacloud.com>").trim();
  const replyTo = String(rc.replyTo || "").trim() || undefined;
  return { client: new Resend(apiKey), from, replyTo };
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendGestorMail(opts: SendMailOptions) {
  const { client, from, replyTo } = await getResendClient();
  const result = await client.emails.send({
    from,
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    ...(replyTo ? { replyTo } : {}),
  });
  if (result.error) throw new Error(`Resend error: ${result.error.message}`);
  return result.data;
}

// ── Pre-built templates ───────────────────────────────────────────────────────

function baseLayout(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e}
  .wrap{max-width:580px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .hdr{background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;color:#fff}
  .hdr h1{margin:0;font-size:20px;font-weight:700;letter-spacing:-.3px}
  .hdr p{margin:4px 0 0;font-size:13px;opacity:.8}
  .body{padding:32px}
  .body p{font-size:14px;line-height:1.7;margin:0 0 12px;color:#374151}
  .card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:16px 0}
  .card .row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid #f0f0f0}
  .card .row:last-child{border-bottom:none;font-weight:600}
  .badge{display:inline-block;background:#4f46e5;color:#fff;border-radius:20px;padding:4px 14px;font-size:12px;font-weight:600}
  .footer{background:#f9fafb;padding:16px 32px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #f0f0f0}
  a{color:#4f46e5}
</style>
</head>
<body><div class="wrap">
<div class="hdr"><h1>Kazehana Cloud</h1><p>Sistema de Gestión Hotelera</p></div>
<div class="body">${body}</div>
<div class="footer">© ${new Date().getFullYear()} Kazehana Cloud · Este es un correo automático, no responder directamente.</div>
</div></body></html>`;
}

export function buildBillingEmail(opts: {
  hotelName: string;
  month: string;
  amount: number;
  currency: string;
  note?: string;
}) {
  const amt = new Intl.NumberFormat("es-CR", { style: "currency", currency: opts.currency, minimumFractionDigits: 2 }).format(opts.amount);
  const body = `
    <p>Estimado equipo de <strong>${opts.hotelName}</strong>,</p>
    <p>Se ha registrado el siguiente cobro mensual por uso del sistema <strong>Kazehana PMS</strong>:</p>
    <div class="card">
      <div class="row"><span>Hotel</span><span>${opts.hotelName}</span></div>
      <div class="row"><span>Período</span><span>${opts.month}</span></div>
      ${opts.note ? `<div class="row"><span>Nota</span><span>${opts.note}</span></div>` : ""}
      <div class="row"><span>Total</span><span>${amt}</span></div>
    </div>
    <p>Si tiene alguna consulta sobre este cobro, comuníquese con su gestor de cuenta.</p>`;
  return {
    subject: `Cobro mensual Kazehana PMS — ${opts.month}`,
    html: baseLayout(`Cobro mensual — ${opts.hotelName}`, body),
    text: `Cobro mensual ${opts.month} para ${opts.hotelName}: ${amt}${opts.note ? ` (${opts.note})` : ""}`,
  };
}

export function buildWelcomeEmail(opts: {
  hotelName: string;
  userEmail: string;
  userPassword: string;
  adminUsername: string;
  adminPassword: string;
}) {
  const body = `
    <p>¡Bienvenido a <strong>Kazehana PMS</strong>! A continuación sus credenciales de acceso para <strong>${opts.hotelName}</strong>:</p>
    <div class="card">
      <div class="row"><span>Hotel</span><span>${opts.hotelName}</span></div>
      <div class="row"><span>Usuario PMS</span><span>${opts.userEmail}</span></div>
      <div class="row"><span>Contraseña PMS</span><span>${opts.userPassword}</span></div>
      <div class="row"><span>Usuario launcher</span><span>${opts.adminUsername}</span></div>
      <div class="row"><span>Contraseña launcher</span><span>${opts.adminPassword}</span></div>
    </div>
    <p style="color:#ef4444;font-size:13px">⚠️ Por seguridad, cambie sus contraseñas en el primer ingreso.</p>`;
  return {
    subject: `Bienvenido a Kazehana PMS — ${opts.hotelName}`,
    html: baseLayout(`Bienvenido — ${opts.hotelName}`, body),
    text: `Credenciales de acceso para ${opts.hotelName}. Usuario PMS: ${opts.userEmail}. Launcher: ${opts.adminUsername}.`,
  };
}

export function buildPasswordChangedEmail(opts: { hotelName: string; userName: string; changedAt?: string }) {
  const when = opts.changedAt || new Date().toLocaleString("es-CR");
  const body = `
    <p>Estimado equipo de <strong>${opts.hotelName}</strong>,</p>
    <p>La contraseña del usuario <strong>${opts.userName}</strong> fue modificada por el gestor del sistema el <strong>${when}</strong>.</p>
    <p>Si este cambio no fue autorizado, comuníquese de inmediato con soporte.</p>`;
  return {
    subject: `Cambio de contraseña — ${opts.hotelName}`,
    html: baseLayout(`Cambio de contraseña — ${opts.hotelName}`, body),
    text: `La contraseña de ${opts.userName} (${opts.hotelName}) fue cambiada el ${when}.`,
  };
}

export function buildInviteEmail(opts: {
  name: string;
  email: string;
  hotelName: string;
  inviteUrl: string;
  expiresAt: Date;
}) {
  const expires = opts.expiresAt.toLocaleString("es-CR");
  const body = `
    <p>Hola <strong>${opts.name || "equipo"}</strong>,</p>
    <p>Te invitaron a administrar <strong>${opts.hotelName}</strong> en <strong>Kazehana PMS</strong>.</p>
    <p>Para crear tu contraseña, abrí este enlace:</p>
    <p style="margin:20px 0">
      <a class="badge" href="${opts.inviteUrl}" style="text-decoration:none">Crear contraseña</a>
    </p>
    <div class="card">
      <div class="row"><span>Correo</span><span>${opts.email}</span></div>
      <div class="row"><span>Vence</span><span>${expires}</span></div>
    </div>
    <p style="font-size:12px;color:#6b7280">Si el botón no funciona, copiá este enlace en el navegador:<br/>${opts.inviteUrl}</p>`;
  return {
    subject: `Invitación a Kazehana PMS — ${opts.hotelName}`,
    html: baseLayout(`Invitación — ${opts.hotelName}`, body),
    text: `Te invitaron a ${opts.hotelName}. Creá tu contraseña en ${opts.inviteUrl} (vence ${expires}).`,
  };
}

export function buildPasswordResetEmail(opts: {
  name: string;
  hotelName: string;
  resetUrl: string;
  expiresAt: Date;
}) {
  const expires = opts.expiresAt.toLocaleString("es-CR");
  const body = `
    <p>Hola <strong>${opts.name || "equipo"}</strong>,</p>
    <p>Pediste restablecer la contraseña de <strong>${opts.hotelName}</strong> en <strong>Kazehana PMS</strong>.</p>
    <p style="margin:20px 0">
      <a class="badge" href="${opts.resetUrl}" style="text-decoration:none">Cambiar contraseña</a>
    </p>
    <div class="card">
      <div class="row"><span>Vence</span><span>${expires}</span></div>
    </div>
    <p style="font-size:12px;color:#6b7280">El enlace sirve una sola vez. Si no pediste este cambio, ignorá este correo: tu contraseña actual sigue funcionando.</p>
    <p style="font-size:12px;color:#6b7280">Si el botón no funciona, copiá este enlace en el navegador:<br/>${opts.resetUrl}</p>`;
  return {
    subject: `Restablecer contraseña — ${opts.hotelName}`,
    html: baseLayout(`Restablecer contraseña — ${opts.hotelName}`, body),
    text: `Para cambiar tu contraseña de ${opts.hotelName} abrí ${opts.resetUrl} (vence ${expires}).`,
  };
}

export function buildTestEmail(to: string) {
  const body = `
    <p>Este es un correo de prueba enviado desde el <strong>Gestor Kazehana Cloud</strong>.</p>
    <p>Si lo recibiste correctamente, la configuración de Resend está funcionando.</p>
    <p><span class="badge">✓ Conexión exitosa</span></p>`;
  return {
    to,
    subject: "Prueba de correo — Kazehana Cloud Gestor",
    html: baseLayout("Prueba de correo", body),
    text: "Correo de prueba del gestor Kazehana Cloud. Configuración Resend OK.",
  };
}
