-- CreateTable
CREATE TABLE "RestaurantSectionObject" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "w" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "h" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "color" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSectionObject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestaurantSectionObject_hotelId_idx" ON "RestaurantSectionObject"("hotelId");

-- CreateIndex
CREATE INDEX "RestaurantSectionObject_sectionId_idx" ON "RestaurantSectionObject"("sectionId");

-- AddForeignKey
ALTER TABLE "RestaurantSectionObject" ADD CONSTRAINT "RestaurantSectionObject_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "RestaurantSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantSectionObject" ADD CONSTRAINT "RestaurantSectionObject_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
