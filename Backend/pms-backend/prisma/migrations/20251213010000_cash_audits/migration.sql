-- Cash audits (cierres de caja) for Frontdesk & Restaurant

CREATE TYPE "CashAuditModule" AS ENUM ('FRONTDESK', 'RESTAURANT');

CREATE TABLE "CashAudit" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "module" "CashAuditModule" NOT NULL,
  "openedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "totals" JSONB,
  "details" JSONB,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashAudit_hotelId_idx" ON "CashAudit"("hotelId");
CREATE INDEX "CashAudit_hotelId_module_createdAt_idx" ON "CashAudit"("hotelId","module","createdAt");

ALTER TABLE "CashAudit"
  ADD CONSTRAINT "CashAudit_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

