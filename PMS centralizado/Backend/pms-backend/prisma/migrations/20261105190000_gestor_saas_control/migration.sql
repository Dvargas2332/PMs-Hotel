-- Gestor SaaS: suspensión de hoteles, correo del administrador del launcher y bitácora.

ALTER TABLE "Hotel" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Hotel" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);

ALTER TABLE "UserLauncher" ADD COLUMN IF NOT EXISTS "email" TEXT;

CREATE TABLE IF NOT EXISTS "SaasAuditLog" (
  "id" TEXT NOT NULL,
  "actor" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaasAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SaasAuditLog_createdAt_idx" ON "SaasAuditLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "SaasAuditLog_entity_entityId_idx" ON "SaasAuditLog" ("entity", "entityId");
