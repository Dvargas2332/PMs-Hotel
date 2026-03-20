-- Add visual customization fields for POS item tiles (optional)
ALTER TABLE "RestaurantItem"
ADD COLUMN IF NOT EXISTS "color" TEXT,
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

