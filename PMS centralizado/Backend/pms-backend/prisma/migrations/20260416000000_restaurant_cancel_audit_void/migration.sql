-- Add VOIDED status to RestaurantOrderItemStatus enum
ALTER TYPE "RestaurantOrderItemStatus" ADD VALUE IF NOT EXISTS 'VOIDED';

-- Add cancel audit fields and sentItemsMap to RestaurantOrder
ALTER TABLE "RestaurantOrder" ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP(3);
ALTER TABLE "RestaurantOrder" ADD COLUMN IF NOT EXISTS "canceledBy" TEXT;
ALTER TABLE "RestaurantOrder" ADD COLUMN IF NOT EXISTS "cancelAdminUser" TEXT;
ALTER TABLE "RestaurantOrder" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "RestaurantOrder" ADD COLUMN IF NOT EXISTS "sentItemsMap" JSONB;
