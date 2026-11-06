-- Invitaciones del usuario principal e inicio de configuración de Resend en el gestor.

ALTER TABLE "SaasConfig" ADD COLUMN IF NOT EXISTS "resendConfig" JSONB;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_inviteTokenHash_idx" ON "User" ("inviteTokenHash");
