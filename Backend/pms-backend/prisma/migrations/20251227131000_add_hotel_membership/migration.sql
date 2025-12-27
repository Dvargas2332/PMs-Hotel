-- Add membership tier to Hotel (SaaS gating by plan)
ALTER TABLE "Hotel"
ADD COLUMN IF NOT EXISTS "membership" TEXT NOT NULL DEFAULT 'PLATINUM';

