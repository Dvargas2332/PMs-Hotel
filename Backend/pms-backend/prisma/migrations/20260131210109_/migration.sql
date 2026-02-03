/*
  Warnings:

  - A unique constraint covering the columns `[hotelId,code]` on the table `RestaurantFamily` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hotelId,familyId,code]` on the table `RestaurantSubFamily` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hotelId,subFamilyId,code]` on the table `RestaurantSubSubFamily` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "RestaurantFamily" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "RestaurantSubFamily" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "RestaurantSubSubFamily" ADD COLUMN     "code" TEXT;

-- CreateTable
CREATE TABLE "Tax" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percent" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "scope" TEXT NOT NULL DEFAULT 'room',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tax_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantItemTax" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,

    CONSTRAINT "RestaurantItemTax_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tax_hotelId_idx" ON "Tax"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "Tax_hotelId_code_key" ON "Tax"("hotelId", "code");

-- CreateIndex
CREATE INDEX "RestaurantItemTax_hotelId_idx" ON "RestaurantItemTax"("hotelId");

-- CreateIndex
CREATE INDEX "RestaurantItemTax_itemId_idx" ON "RestaurantItemTax"("itemId");

-- CreateIndex
CREATE INDEX "RestaurantItemTax_taxId_idx" ON "RestaurantItemTax"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantItemTax_hotelId_itemId_taxId_key" ON "RestaurantItemTax"("hotelId", "itemId", "taxId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantFamily_hotelId_code_key" ON "RestaurantFamily"("hotelId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantSubFamily_hotelId_familyId_code_key" ON "RestaurantSubFamily"("hotelId", "familyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantSubSubFamily_hotelId_subFamilyId_code_key" ON "RestaurantSubSubFamily"("hotelId", "subFamilyId", "code");

-- AddForeignKey
ALTER TABLE "Tax" ADD CONSTRAINT "Tax_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantItemTax" ADD CONSTRAINT "RestaurantItemTax_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantItemTax" ADD CONSTRAINT "RestaurantItemTax_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RestaurantItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantItemTax" ADD CONSTRAINT "RestaurantItemTax_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES "Tax"("id") ON DELETE CASCADE ON UPDATE CASCADE;
