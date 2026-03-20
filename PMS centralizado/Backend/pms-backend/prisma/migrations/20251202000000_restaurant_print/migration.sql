-- Migration: restaurant print + config

CREATE TABLE "RestaurantConfig" (
    "hotelId" TEXT NOT NULL,
    "kitchenPrinter" TEXT,
    "barPrinter" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantConfig_pkey" PRIMARY KEY ("hotelId")
);

CREATE TABLE "RestaurantPrintJob" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "sectionId" TEXT,
    "tableId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "note" TEXT,
    "covers" INTEGER,
    "kitchenPrinter" TEXT,
    "barPrinter" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantPrintJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RestaurantPrintJob_hotelId_idx" ON "RestaurantPrintJob"("hotelId");

ALTER TABLE "RestaurantConfig"
  ADD CONSTRAINT "RestaurantConfig_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RestaurantPrintJob"
  ADD CONSTRAINT "RestaurantPrintJob_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
