-- AlterTable
ALTER TABLE "RestaurantMenuItem" ADD COLUMN     "menuId" TEXT;

-- CreateTable
CREATE TABLE "RestaurantMenu" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantMenuAssignment" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "daysMask" INTEGER NOT NULL DEFAULT 127,
    "startTime" TEXT,
    "endTime" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Costa_Rica',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantMenuAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestaurantMenu_hotelId_idx" ON "RestaurantMenu"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantMenu_hotelId_name_key" ON "RestaurantMenu"("hotelId", "name");

-- CreateIndex
CREATE INDEX "RestaurantMenuAssignment_hotelId_idx" ON "RestaurantMenuAssignment"("hotelId");

-- CreateIndex
CREATE INDEX "RestaurantMenuAssignment_sectionId_idx" ON "RestaurantMenuAssignment"("sectionId");

-- CreateIndex
CREATE INDEX "RestaurantMenuAssignment_menuId_idx" ON "RestaurantMenuAssignment"("menuId");

-- CreateIndex
CREATE INDEX "RestaurantMenuAssignment_hotelId_sectionId_active_idx" ON "RestaurantMenuAssignment"("hotelId", "sectionId", "active");

-- CreateIndex
CREATE INDEX "RestaurantMenuItem_menuId_idx" ON "RestaurantMenuItem"("menuId");

-- AddForeignKey
ALTER TABLE "RestaurantMenu" ADD CONSTRAINT "RestaurantMenu_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantMenuAssignment" ADD CONSTRAINT "RestaurantMenuAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "RestaurantSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantMenuAssignment" ADD CONSTRAINT "RestaurantMenuAssignment_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "RestaurantMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantMenuAssignment" ADD CONSTRAINT "RestaurantMenuAssignment_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantMenuItem" ADD CONSTRAINT "RestaurantMenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "RestaurantMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
