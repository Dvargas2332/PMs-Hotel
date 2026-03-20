-- CreateTable
CREATE TABLE "RestaurantOrderEvent" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "orderId" TEXT,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestaurantOrderEvent_hotelId_idx" ON "RestaurantOrderEvent"("hotelId");

-- CreateIndex
CREATE INDEX "RestaurantOrderEvent_hotelId_orderId_idx" ON "RestaurantOrderEvent"("hotelId", "orderId");

-- CreateIndex
CREATE INDEX "RestaurantOrderEvent_hotelId_createdAt_idx" ON "RestaurantOrderEvent"("hotelId", "createdAt");

-- AddForeignKey
ALTER TABLE "RestaurantOrderEvent" ADD CONSTRAINT "RestaurantOrderEvent_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrderEvent" ADD CONSTRAINT "RestaurantOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RestaurantOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
