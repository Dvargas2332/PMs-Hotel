// src/lib/userInvites.ts
// Invitaciones al usuario principal (el que inicia sesión con correo).

import crypto from "crypto";
import prisma from "./prisma.js";
import { buildInviteEmail, sendGestorMail } from "./mailer.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInviteToken(token: string) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function buildInviteUrl(token: string) {
  const base = String(
    process.env.FRONTEND_URL || process.env.APP_URL || process.env.PUBLIC_APP_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");
  // Apunta a la raíz (?invite=) y no a /accept-invite: el hosting estático
  // responde 200 en "/" y 404 en rutas profundas, aunque el SPA se pinte igual.
  return `${base}/?invite=${encodeURIComponent(token)}`;
}

export interface InviteResult {
  inviteUrl: string;
  expiresAt: Date;
  emailSent: boolean;
  emailError?: string;
}

/**
 * Genera un token nuevo para el usuario, lo guarda hasheado y manda el correo.
 * Si Resend no está configurado, devuelve igual el enlace para que el gestor
 * pueda copiarlo.
 */
export async function sendUserInvite(opts: {
  userId: string;
  email: string;
  name?: string | null;
  hotelName: string;
}): Promise<InviteResult> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await prisma.user.update({
    where: { id: opts.userId },
    data: {
      inviteTokenHash: hashInviteToken(token),
      inviteExpiresAt: expiresAt,
      inviteSentAt: new Date(),
    },
  });

  const inviteUrl = buildInviteUrl(token);
  let emailSent = false;
  let emailError: string | undefined;
  try {
    const mail = buildInviteEmail({
      name: String(opts.name || ""),
      email: opts.email,
      hotelName: opts.hotelName,
      inviteUrl,
      expiresAt,
    });
    await sendGestorMail({ to: opts.email, subject: mail.subject, html: mail.html, text: mail.text });
    emailSent = true;
  } catch (err: any) {
    emailError = err?.message || "No se pudo enviar el correo.";
  }

  return { inviteUrl, expiresAt, emailSent, emailError };
}
