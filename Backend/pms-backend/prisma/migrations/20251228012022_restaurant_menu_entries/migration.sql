-- CreateTable
CREATE TABLE "RestaurantMenuEntry" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "price" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantMenuEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestaurantMenuEntry_hotelId_idx" ON "RestaurantMenuEntry"("hotelId");

-- CreateIndex
CREATE INDEX "RestaurantMenuEntry_menuId_idx" ON "RestaurantMenuEntry"("menuId");

-- CreateIndex
CREATE INDEX "RestaurantMenuEntry_itemId_idx" ON "RestaurantMenuEntry"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantMenuEntry_hotelId_menuId_itemId_key" ON "RestaurantMenuEntry"("hotelId", "menuId", "itemId");

-- AddForeignKey
ALTER TABLE "RestaurantMenuEntry" ADD CONSTRAINT "RestaurantMenuEntry_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "RestaurantMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantMenuEntry" ADD CONSTRAINT "RestaurantMenuEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RestaurantItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantMenuEntry" ADD CONSTRAINT "RestaurantMenuEntry_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
