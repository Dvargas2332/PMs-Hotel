-- AlterTable
ALTER TABLE "RestaurantOrder" ADD COLUMN     "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountId" TEXT,
ADD COLUMN     "discountPercent" DECIMAL(6,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RestaurantOrderItem" ADD COLUMN     "discountId" TEXT,
ADD COLUMN     "discountPercent" DECIMAL(6,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Discount" (
    "hotelId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'percent',
    "value" DECIMAL(12,2) NOT NULL,
    "requiresPin" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("hotelId","id")
);

-- CreateTable
CREATE TABLE "SaasConfig" (
    "key" TEXT NOT NULL,
    "smtp" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Discount_hotelId_idx" ON "Discount"("hotelId");

-- AddForeignKey
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_hotelId_discountId_fkey" FOREIGN KEY ("hotelId", "discountId") REFERENCES "Discount"("hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrderItem" ADD CONSTRAINT "RestaurantOrderItem_hotelId_discountId_fkey" FOREIGN KEY ("hotelId", "discountId") REFERENCES "Discount"("hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
