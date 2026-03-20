-- Add barcode to restaurant items
ALTER TABLE "RestaurantItem" ADD COLUMN "barcode" TEXT;

CREATE UNIQUE INDEX "RestaurantItem_hotelId_barcode_key" ON "RestaurantItem"("hotelId", "barcode");
