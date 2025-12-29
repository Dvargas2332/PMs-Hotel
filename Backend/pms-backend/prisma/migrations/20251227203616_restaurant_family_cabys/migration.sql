-- AlterTable
ALTER TABLE "RestaurantFamily" ADD COLUMN     "cabys" TEXT;

-- RenameIndex
ALTER INDEX "RestaurantRecipeLine_hotelId_restaurantItemId_inventoryItemId_k" RENAME TO "RestaurantRecipeLine_hotelId_restaurantItemId_inventoryItem_key";
