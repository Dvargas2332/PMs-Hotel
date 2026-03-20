-- Migration: restaurant close

CREATE TABLE "RestaurantClose" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "turno" TEXT NOT NULL,
    "totals" JSONB NOT NULL,
    "payments" JSONB NOT NULL,
    "breakdown" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "RestaurantClose_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RestaurantClose_hotelId_idx" ON "RestaurantClose"("hotelId");

ALTER TABLE "RestaurantClose"
  ADD CONSTRAINT "RestaurantClose_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
