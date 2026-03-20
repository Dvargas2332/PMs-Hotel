-- Add Hotel.number with autoincrement sequence
ALTER TABLE "Hotel" ADD COLUMN "number" INTEGER;

CREATE SEQUENCE IF NOT EXISTS "Hotel_number_seq";
ALTER TABLE "Hotel" ALTER COLUMN "number" SET DEFAULT nextval('"Hotel_number_seq"');
ALTER SEQUENCE "Hotel_number_seq" OWNED BY "Hotel"."number";

-- Backfill existing rows (if any)
UPDATE "Hotel" SET "number" = nextval('"Hotel_number_seq"') WHERE "number" IS NULL;

ALTER TABLE "Hotel" ALTER COLUMN "number" SET NOT NULL;
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_number_key" UNIQUE ("number");
