-- Add hotelId scoping to tenant tables that previously didn't have it.
-- This prevents cross-hotel data mixing in a SaaS setup.

-- 1) Add columns (nullable first)
ALTER TABLE "RestaurantOrderItem" ADD COLUMN IF NOT EXISTS "hotelId" TEXT;
ALTER TABLE "RestaurantTable" ADD COLUMN IF NOT EXISTS "hotelId" TEXT;
ALTER TABLE "RoomDay" ADD COLUMN IF NOT EXISTS "hotelId" TEXT;

-- 2) Backfill from parent relations
UPDATE "RestaurantOrderItem" i
SET "hotelId" = o."hotelId"
FROM "RestaurantOrder" o
WHERE i."hotelId" IS NULL
  AND i."orderId" = o."id";

UPDATE "RestaurantTable" t
SET "hotelId" = s."hotelId"
FROM "RestaurantSection" s
WHERE t."hotelId" IS NULL
  AND t."sectionId" = s."id";

UPDATE "RoomDay" d
SET "hotelId" = r."hotelId"
FROM "Room" r
WHERE d."hotelId" IS NULL
  AND d."roomId" = r."id";

-- 3) Enforce NOT NULL
ALTER TABLE "RestaurantOrderItem" ALTER COLUMN "hotelId" SET NOT NULL;
ALTER TABLE "RestaurantTable" ALTER COLUMN "hotelId" SET NOT NULL;
ALTER TABLE "RoomDay" ALTER COLUMN "hotelId" SET NOT NULL;

-- 4) Foreign keys
ALTER TABLE "RestaurantOrderItem" DROP CONSTRAINT IF EXISTS "RestaurantOrderItem_hotelId_fkey";
ALTER TABLE "RestaurantOrderItem"
ADD CONSTRAINT "RestaurantOrderItem_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RestaurantTable" DROP CONSTRAINT IF EXISTS "RestaurantTable_hotelId_fkey";
ALTER TABLE "RestaurantTable"
ADD CONSTRAINT "RestaurantTable_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomDay" DROP CONSTRAINT IF EXISTS "RoomDay_hotelId_fkey";
ALTER TABLE "RoomDay"
ADD CONSTRAINT "RoomDay_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Indexes
CREATE INDEX IF NOT EXISTS "RestaurantOrderItem_hotelId_idx" ON "RestaurantOrderItem"("hotelId");
CREATE INDEX IF NOT EXISTS "RestaurantTable_hotelId_idx" ON "RestaurantTable"("hotelId");
CREATE INDEX IF NOT EXISTS "RoomDay_hotelId_idx" ON "RoomDay"("hotelId");

-- 6) Uniques
ALTER TABLE "RestaurantOrderItem" DROP CONSTRAINT IF EXISTS "RestaurantOrderItem_orderId_itemId_key";
ALTER TABLE "RestaurantOrderItem" DROP CONSTRAINT IF EXISTS "RestaurantOrderItem_hotelId_orderId_itemId_key";
ALTER TABLE "RestaurantOrderItem"
ADD CONSTRAINT "RestaurantOrderItem_hotelId_orderId_itemId_key" UNIQUE ("hotelId", "orderId", "itemId");

ALTER TABLE "RoomDay" DROP CONSTRAINT IF EXISTS "RoomDay_roomId_date_key";
ALTER TABLE "RoomDay" DROP CONSTRAINT IF EXISTS "RoomDay_hotelId_roomId_date_key";
ALTER TABLE "RoomDay"
ADD CONSTRAINT "RoomDay_hotelId_roomId_date_key" UNIQUE ("hotelId", "roomId", "date");

