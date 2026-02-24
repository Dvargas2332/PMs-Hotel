-- Add per-hotel sale number for restaurant orders
ALTER TABLE "RestaurantOrder" ADD COLUMN IF NOT EXISTS "saleNumber" TEXT;
ALTER TABLE "RestaurantOrder" ADD COLUMN IF NOT EXISTS "saleNumberInt" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantOrder_hotelId_saleNumber_key" ON "RestaurantOrder"("hotelId", "saleNumber");
