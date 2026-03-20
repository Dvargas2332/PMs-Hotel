-- AlterTable
ALTER TABLE "RestaurantInventoryItem" ADD COLUMN     "inventoryControlled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "RestaurantPrintJob" ADD COLUMN     "docType" TEXT,
ADD COLUMN     "footer" TEXT,
ADD COLUMN     "formId" TEXT,
ADD COLUMN     "header" TEXT,
ADD COLUMN     "orderId" TEXT;
