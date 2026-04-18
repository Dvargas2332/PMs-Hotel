-- Migration: einvoicing NC/ND support
-- Adds NC (Nota de Crédito) and ND (Nota de Débito) to EInvoicingDocType enum
-- Adds reference fields to EInvoicingDocument for NC/ND→FE linkage

-- 1. Add new enum values
ALTER TYPE "EInvoicingDocType" ADD VALUE IF NOT EXISTS 'NC';
ALTER TYPE "EInvoicingDocType" ADD VALUE IF NOT EXISTS 'ND';

-- 2. Add reference fields to EInvoicingDocument
ALTER TABLE "EInvoicingDocument"
  ADD COLUMN IF NOT EXISTS "referenceDocId"  TEXT,
  ADD COLUMN IF NOT EXISTS "referenceKey"    TEXT,
  ADD COLUMN IF NOT EXISTS "referenceReason" TEXT;

-- 3. Foreign key from NC/ND document to referenced document
ALTER TABLE "EInvoicingDocument"
  ADD CONSTRAINT "EInvoicingDocument_referenceDocId_fkey"
  FOREIGN KEY ("referenceDocId")
  REFERENCES "EInvoicingDocument"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 4. Index for fast lookup of notes by reference
CREATE INDEX IF NOT EXISTS "EInvoicingDocument_referenceDocId_idx"
  ON "EInvoicingDocument"("referenceDocId");
