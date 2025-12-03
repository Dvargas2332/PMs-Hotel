-- Restaurant sections, tables y menu por seccion

CREATE TABLE "RestaurantSection" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "RestaurantSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RestaurantSection_hotelId_id_key" ON "RestaurantSection" ("hotelId", "id");
CREATE INDEX "RestaurantSection_hotelId_idx" ON "RestaurantSection" ("hotelId");

CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 2,
    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RestaurantTable_sectionId_idx" ON "RestaurantTable" ("sectionId");

CREATE TABLE "RestaurantMenuItem" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "sectionId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantMenuItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RestaurantMenuItem_hotelId_idx" ON "RestaurantMenuItem" ("hotelId");
CREATE INDEX "RestaurantMenuItem_sectionId_idx" ON "RestaurantMenuItem" ("sectionId");

ALTER TABLE "RestaurantSection"
  ADD CONSTRAINT "RestaurantSection_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RestaurantTable"
  ADD CONSTRAINT "RestaurantTable_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "RestaurantSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RestaurantMenuItem"
  ADD CONSTRAINT "RestaurantMenuItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "RestaurantSection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "RestaurantMenuItem_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
