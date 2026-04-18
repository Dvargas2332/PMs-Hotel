-- Migration: accounting_module
-- Módulo de contabilidad para Kazehana PMS

-- Enums
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE', 'COST');
CREATE TYPE "AccountingEntryStatus" AS ENUM ('DRAFT', 'PENDING', 'POSTED', 'VOIDED');
CREATE TYPE "AccountingEntrySource" AS ENUM ('MANUAL', 'EINVOICING', 'RESTAURANT', 'FRONTDESK');
CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- Configuración del módulo de contabilidad por hotel
CREATE TABLE "AccountingSettings" (
    "hotelId"       TEXT NOT NULL,
    "country"       TEXT NOT NULL DEFAULT 'CR',
    "autoPost"      BOOLEAN NOT NULL DEFAULT false,
    "fiscalPeriods" BOOLEAN NOT NULL DEFAULT false,
    "integrations"  JSONB NOT NULL DEFAULT '{}',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountingSettings_pkey" PRIMARY KEY ("hotelId")
);

-- Plan de cuentas
CREATE TABLE "AccountingAccount" (
    "id"          TEXT NOT NULL,
    "hotelId"     TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "type"        "AccountType" NOT NULL,
    "parentId"    TEXT,
    "isSystem"    BOOLEAN NOT NULL DEFAULT false,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountingAccount_pkey" PRIMARY KEY ("id")
);

-- Períodos contables
CREATE TABLE "AccountingPeriod" (
    "id"        TEXT NOT NULL,
    "hotelId"   TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate"   TIMESTAMP(3) NOT NULL,
    "status"    "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt"  TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- Asiento contable (cabecera)
CREATE TABLE "AccountingEntry" (
    "id"          TEXT NOT NULL,
    "hotelId"     TEXT NOT NULL,
    "number"      TEXT NOT NULL,
    "date"        TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "status"      "AccountingEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "source"      "AccountingEntrySource" NOT NULL DEFAULT 'MANUAL',
    "sourceRefId" TEXT,
    "periodId"    TEXT,
    "currency"    TEXT NOT NULL DEFAULT 'CRC',
    "createdBy"   TEXT,
    "approvedBy"  TEXT,
    "approvedAt"  TIMESTAMP(3),
    "voidedBy"    TEXT,
    "voidedAt"    TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountingEntry_pkey" PRIMARY KEY ("id")
);

-- Líneas del asiento (partida doble)
CREATE TABLE "AccountingEntryLine" (
    "id"          TEXT NOT NULL,
    "hotelId"     TEXT NOT NULL,
    "entryId"     TEXT NOT NULL,
    "accountId"   TEXT NOT NULL,
    "debit"       DECIMAL(15,2) NOT NULL DEFAULT 0,
    "credit"      DECIMAL(15,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingEntryLine_pkey" PRIMARY KEY ("id")
);

-- Foreign Keys
ALTER TABLE "AccountingSettings"
    ADD CONSTRAINT "AccountingSettings_hotelId_fkey"
    FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountingAccount"
    ADD CONSTRAINT "AccountingAccount_hotelId_fkey"
    FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountingAccount"
    ADD CONSTRAINT "AccountingAccount_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "AccountingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccountingPeriod"
    ADD CONSTRAINT "AccountingPeriod_hotelId_fkey"
    FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountingEntry"
    ADD CONSTRAINT "AccountingEntry_hotelId_fkey"
    FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountingEntry"
    ADD CONSTRAINT "AccountingEntry_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccountingEntryLine"
    ADD CONSTRAINT "AccountingEntryLine_hotelId_fkey"
    FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountingEntryLine"
    ADD CONSTRAINT "AccountingEntryLine_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "AccountingEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountingEntryLine"
    ADD CONSTRAINT "AccountingEntryLine_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "AccountingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Índices únicos
CREATE UNIQUE INDEX "AccountingAccount_hotelId_code_key" ON "AccountingAccount"("hotelId", "code");
CREATE UNIQUE INDEX "AccountingEntry_hotelId_number_key" ON "AccountingEntry"("hotelId", "number");

-- Índices de rendimiento
CREATE INDEX "AccountingAccount_hotelId_idx" ON "AccountingAccount"("hotelId");
CREATE INDEX "AccountingPeriod_hotelId_idx" ON "AccountingPeriod"("hotelId");
CREATE INDEX "AccountingEntry_hotelId_idx" ON "AccountingEntry"("hotelId");
CREATE INDEX "AccountingEntry_hotelId_status_idx" ON "AccountingEntry"("hotelId", "status");
CREATE INDEX "AccountingEntry_hotelId_source_sourceRefId_idx" ON "AccountingEntry"("hotelId", "source", "sourceRefId");
CREATE INDEX "AccountingEntryLine_hotelId_idx" ON "AccountingEntryLine"("hotelId");
CREATE INDEX "AccountingEntryLine_entryId_idx" ON "AccountingEntryLine"("entryId");
CREATE INDEX "AccountingEntryLine_accountId_idx" ON "AccountingEntryLine"("accountId");
