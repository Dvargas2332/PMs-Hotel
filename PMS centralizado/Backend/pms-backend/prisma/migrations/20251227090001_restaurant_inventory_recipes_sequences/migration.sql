-- Restaurant: inventory + recipes + per-hotel sequences + consecutive numbers

-- 1) Generic per-hotel sequences
CREATE TABLE IF NOT EXISTS "HotelSequence" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HotelSequence_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'HotelSequence_hotelId_key_key'
  ) THEN
    CREATE UNIQUE INDEX "HotelSequence_hotelId_key_key" ON "HotelSequence" ("hotelId","key");
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "HotelSequence_hotelId_idx" ON "HotelSequence" ("hotelId");

ALTER TABLE "HotelSequence"
  DROP CONSTRAINT IF EXISTS "HotelSequence_hotelId_fkey";
ALTER TABLE "HotelSequence"
  ADD CONSTRAINT "HotelSequence_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Add consecutive number to RestaurantItem
ALTER TABLE "RestaurantItem" ADD COLUMN IF NOT EXISTS "number" INTEGER;

-- Backfill numbers per hotel (stable order)
WITH ranked AS (
  SELECT id, "hotelId", ROW_NUMBER() OVER (PARTITION BY "hotelId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "RestaurantItem"
  WHERE "number" IS NULL
)
UPDATE "RestaurantItem" ri
SET "number" = ranked.rn
FROM ranked
WHERE ranked.id = ri.id;

-- Ensure not null (after backfill)
ALTER TABLE "RestaurantItem" ALTER COLUMN "number" SET NOT NULL;

-- Unique per hotel
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'RestaurantItem_hotelId_number_key'
  ) THEN
    CREATE UNIQUE INDEX "RestaurantItem_hotelId_number_key" ON "RestaurantItem" ("hotelId","number");
  END IF;
END$$;

-- 3) Inventory tables
CREATE TABLE IF NOT EXISTS "RestaurantInventoryItem" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "sku" TEXT NOT NULL,
  "desc" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "stock" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "min" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "cost" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RestaurantInventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantInventoryItem_hotelId_number_key" ON "RestaurantInventoryItem" ("hotelId","number");
CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantInventoryItem_hotelId_sku_key" ON "RestaurantInventoryItem" ("hotelId","sku");
CREATE INDEX IF NOT EXISTS "RestaurantInventoryItem_hotelId_idx" ON "RestaurantInventoryItem" ("hotelId");

ALTER TABLE "RestaurantInventoryItem"
  DROP CONSTRAINT IF EXISTS "RestaurantInventoryItem_hotelId_fkey";
ALTER TABLE "RestaurantInventoryItem"
  ADD CONSTRAINT "RestaurantInventoryItem_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Inventory movements
CREATE TABLE IF NOT EXISTS "RestaurantInventoryMovement" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "qtyDelta" DECIMAL(14,4) NOT NULL,
  "reason" TEXT,
  "refType" TEXT,
  "refId" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RestaurantInventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RestaurantInventoryMovement_hotelId_idx" ON "RestaurantInventoryMovement" ("hotelId");
CREATE INDEX IF NOT EXISTS "RestaurantInventoryMovement_itemId_idx" ON "RestaurantInventoryMovement" ("itemId");
CREATE INDEX IF NOT EXISTS "RestaurantInventoryMovement_hotelId_refType_refId_idx" ON "RestaurantInventoryMovement" ("hotelId","refType","refId");

ALTER TABLE "RestaurantInventoryMovement"
  DROP CONSTRAINT IF EXISTS "RestaurantInventoryMovement_itemId_fkey";
ALTER TABLE "RestaurantInventoryMovement"
  ADD CONSTRAINT "RestaurantInventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RestaurantInventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RestaurantInventoryMovement"
  DROP CONSTRAINT IF EXISTS "RestaurantInventoryMovement_hotelId_fkey";
ALTER TABLE "RestaurantInventoryMovement"
  ADD CONSTRAINT "RestaurantInventoryMovement_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Recipe lines (links sale items to inventory)
CREATE TABLE IF NOT EXISTS "RestaurantRecipeLine" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "restaurantItemId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "qty" DECIMAL(14,4) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RestaurantRecipeLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantRecipeLine_hotelId_restaurantItemId_inventoryItemId_key"
  ON "RestaurantRecipeLine" ("hotelId","restaurantItemId","inventoryItemId");
CREATE INDEX IF NOT EXISTS "RestaurantRecipeLine_hotelId_idx" ON "RestaurantRecipeLine" ("hotelId");
CREATE INDEX IF NOT EXISTS "RestaurantRecipeLine_restaurantItemId_idx" ON "RestaurantRecipeLine" ("restaurantItemId");
CREATE INDEX IF NOT EXISTS "RestaurantRecipeLine_inventoryItemId_idx" ON "RestaurantRecipeLine" ("inventoryItemId");

ALTER TABLE "RestaurantRecipeLine"
  DROP CONSTRAINT IF EXISTS "RestaurantRecipeLine_hotelId_fkey";
ALTER TABLE "RestaurantRecipeLine"
  ADD CONSTRAINT "RestaurantRecipeLine_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RestaurantRecipeLine"
  DROP CONSTRAINT IF EXISTS "RestaurantRecipeLine_restaurantItemId_fkey";
ALTER TABLE "RestaurantRecipeLine"
  ADD CONSTRAINT "RestaurantRecipeLine_restaurantItemId_fkey" FOREIGN KEY ("restaurantItemId") REFERENCES "RestaurantItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RestaurantRecipeLine"
  DROP CONSTRAINT IF EXISTS "RestaurantRecipeLine_inventoryItemId_fkey";
ALTER TABLE "RestaurantRecipeLine"
  ADD CONSTRAINT "RestaurantRecipeLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "RestaurantInventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

