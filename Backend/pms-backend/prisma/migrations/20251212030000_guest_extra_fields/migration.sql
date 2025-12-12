-- Guest extra fields: documento, direccion, empresa, notas
ALTER TABLE "Guest"
  ADD COLUMN IF NOT EXISTS "state"    TEXT,
  ADD COLUMN IF NOT EXISTS "idType"   TEXT,
  ADD COLUMN IF NOT EXISTS "idNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "country"  TEXT,
  ADD COLUMN IF NOT EXISTS "city"     TEXT,
  ADD COLUMN IF NOT EXISTS "address"  TEXT,
  ADD COLUMN IF NOT EXISTS "company"  TEXT,
  ADD COLUMN IF NOT EXISTS "notes"    TEXT;
