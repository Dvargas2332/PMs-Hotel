-- Restaurant orders and items

CREATE TYPE "RestaurantOrderStatus" AS ENUM ('OPEN', 'CLOSED', 'PAID');

CREATE TABLE "RestaurantOrder" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "sectionId" TEXT,
    "tableId" TEXT NOT NULL,
    "waiterId" TEXT,
    "status" "RestaurantOrderStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "covers" INTEGER,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tip10" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentBreakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestaurantOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "qty" INTEGER NOT NULL,
    CONSTRAINT "RestaurantOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RestaurantOrder_hotelId_idx" ON "RestaurantOrder"("hotelId");
CREATE INDEX "RestaurantOrder_hotelId_tableId_status_idx" ON "RestaurantOrder"("hotelId", "tableId", "status");

ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantOrderItem" ADD CONSTRAINT "RestaurantOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RestaurantOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
