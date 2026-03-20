-- Campos adicionales para clientes empresariales

ALTER TABLE "Guest"
  ADD COLUMN IF NOT EXISTS "legalName" TEXT,
  ADD COLUMN IF NOT EXISTS "managerName" TEXT,
  ADD COLUMN IF NOT EXISTS "economicActivity" TEXT,
  ADD COLUMN IF NOT EXISTS "emailAlt1" TEXT,
  ADD COLUMN IF NOT EXISTS "emailAlt2" TEXT;

