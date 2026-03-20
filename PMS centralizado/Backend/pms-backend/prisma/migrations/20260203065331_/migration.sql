/*
  Warnings:

  - A unique constraint covering the columns `[hotelId,orderId,itemId,variantKey]` on the table `RestaurantOrderItem` will be added. If there are existing duplicate values, this will fail.

*/
-- Drop constraint backing the old unique index
ALTER TABLE "RestaurantOrderItem" DROP CONSTRAINT IF EXISTS "RestaurantOrderItem_hotelId_orderId_itemId_key";

-- AlterTable
ALTER TABLE "RestaurantItem" ADD COLUMN     "details" JSONB,
ADD COLUMN     "sizes" JSONB;

-- AlterTable
ALTER TABLE "RestaurantOrderItem" ADD COLUMN     "detailNote" TEXT,
ADD COLUMN     "variantKey" TEXT NOT NULL DEFAULT '';

-- Ensure uniqueness before creating the new constraint (dedupe by id)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "hotelId", "orderId", "itemId"
      ORDER BY id
    ) AS rn
  FROM "RestaurantOrderItem"
)
UPDATE "RestaurantOrderItem" r
SET "variantKey" = 'dup-' || r.id
FROM ranked
WHERE r.id = ranked.id AND ranked.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantOrderItem_hotelId_orderId_itemId_variantKey_key" ON "RestaurantOrderItem"("hotelId", "orderId", "itemId", "variantKey");
