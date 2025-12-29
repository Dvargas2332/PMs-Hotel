-- AlterTable
ALTER TABLE "RestaurantConfig" ADD COLUMN     "cashierPrinter" TEXT,
ADD COLUMN     "printing" JSONB;

-- AlterTable
ALTER TABLE "RestaurantPrintJob" ADD COLUMN     "cashierPrinter" TEXT,
ADD COLUMN     "paperType" TEXT,
ADD COLUMN     "type" TEXT;
