/*
  Warnings:

  - A unique constraint covering the columns `[hotelId,code]` on the table `Reservation` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Reservation_code_key";

-- AlterTable
ALTER TABLE "RestaurantOrder" ADD COLUMN     "guestId" TEXT;

-- CreateTable
CREATE TABLE "RateOverride" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "minStay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateOverride_hotelId_ratePlanId_idx" ON "RateOverride"("hotelId", "ratePlanId");

-- CreateIndex
CREATE INDEX "RateOverride_hotelId_ratePlanId_date_idx" ON "RateOverride"("hotelId", "ratePlanId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RateOverride_hotelId_ratePlanId_roomTypeId_date_key" ON "RateOverride"("hotelId", "ratePlanId", "roomTypeId", "date");

-- CreateIndex
CREATE INDEX "Guest_hotelId_idNumber_idx" ON "Guest"("hotelId", "idNumber");

-- CreateIndex
CREATE INDEX "Reservation_hotelId_roomId_idx" ON "Reservation"("hotelId", "roomId");

-- CreateIndex
CREATE INDEX "Reservation_hotelId_status_checkIn_idx" ON "Reservation"("hotelId", "status", "checkIn");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_hotelId_code_key" ON "Reservation"("hotelId", "code");

-- CreateIndex
CREATE INDEX "RestaurantOrder_guestId_idx" ON "RestaurantOrder"("guestId");

-- AddForeignKey
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateOverride" ADD CONSTRAINT "RateOverride_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateOverride" ADD CONSTRAINT "RateOverride_hotelId_ratePlanId_fkey" FOREIGN KEY ("hotelId", "ratePlanId") REFERENCES "RatePlan"("hotelId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
