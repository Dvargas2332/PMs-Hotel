/*
  Warnings:

  - You are about to drop the column `notes` on the `Reservation` table. All the data in the column will be lost.
  - The `source` column on the `Reservation` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `baseRate` on the `Room` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(10,2)`.
  - The `status` column on the `RoomDay` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `number` on table `Invoice` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `RoomDay` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('DIRECT', 'OTA', 'MANUAL');

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_reservationId_fkey";

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "number" SET NOT NULL;

-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "notes",
ADD COLUMN     "hotelId" TEXT,
DROP COLUMN "source",
ADD COLUMN     "source" "BookingSource";

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "hotelId" TEXT,
ALTER COLUMN "baseRate" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "RoomDay" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "date" SET DATA TYPE TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE';

-- DropEnum
DROP TYPE "RoomDayStatus";

-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CRC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reservation_hotelId_idx" ON "Reservation"("hotelId");

-- CreateIndex
CREATE INDEX "Room_hotelId_idx" ON "Room"("hotelId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
