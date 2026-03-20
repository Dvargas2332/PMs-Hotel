-- Per-item pricing rule: whether the entered price already includes taxes and service.
ALTER TABLE "RestaurantItem"
ADD COLUMN IF NOT EXISTS "priceIncludesTaxesAndService" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "RestaurantOrderItem"
ADD COLUMN IF NOT EXISTS "priceIncludesTaxesAndService" BOOLEAN NOT NULL DEFAULT true;

