-- CreateTable
CREATE TABLE "RestaurantFamily" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantSubFamily" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSubFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantSubSubFamily" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "subFamilyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSubSubFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantItem" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cabys" TEXT,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "familyId" TEXT NOT NULL,
    "subFamilyId" TEXT,
    "subSubFamilyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestaurantFamily_hotelId_idx" ON "RestaurantFamily"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantFamily_hotelId_name_key" ON "RestaurantFamily"("hotelId", "name");

-- CreateIndex
CREATE INDEX "RestaurantSubFamily_hotelId_idx" ON "RestaurantSubFamily"("hotelId");

-- CreateIndex
CREATE INDEX "RestaurantSubFamily_familyId_idx" ON "RestaurantSubFamily"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantSubFamily_hotelId_familyId_name_key" ON "RestaurantSubFamily"("hotelId", "familyId", "name");

-- CreateIndex
CREATE INDEX "RestaurantSubSubFamily_hotelId_idx" ON "RestaurantSubSubFamily"("hotelId");

-- CreateIndex
CREATE INDEX "RestaurantSubSubFamily_subFamilyId_idx" ON "RestaurantSubSubFamily"("subFamilyId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantSubSubFamily_hotelId_subFamilyId_name_key" ON "RestaurantSubSubFamily"("hotelId", "subFamilyId", "name");

-- CreateIndex
CREATE INDEX "RestaurantItem_hotelId_idx" ON "RestaurantItem"("hotelId");

-- CreateIndex
CREATE INDEX "RestaurantItem_familyId_idx" ON "RestaurantItem"("familyId");

-- CreateIndex
CREATE INDEX "RestaurantItem_subFamilyId_idx" ON "RestaurantItem"("subFamilyId");

-- CreateIndex
CREATE INDEX "RestaurantItem_subSubFamilyId_idx" ON "RestaurantItem"("subSubFamilyId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantItem_hotelId_code_key" ON "RestaurantItem"("hotelId", "code");

-- AddForeignKey
ALTER TABLE "RestaurantFamily" ADD CONSTRAINT "RestaurantFamily_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantSubFamily" ADD CONSTRAINT "RestaurantSubFamily_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantSubFamily" ADD CONSTRAINT "RestaurantSubFamily_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "RestaurantFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantSubSubFamily" ADD CONSTRAINT "RestaurantSubSubFamily_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantSubSubFamily" ADD CONSTRAINT "RestaurantSubSubFamily_subFamilyId_fkey" FOREIGN KEY ("subFamilyId") REFERENCES "RestaurantSubFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantItem" ADD CONSTRAINT "RestaurantItem_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantItem" ADD CONSTRAINT "RestaurantItem_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "RestaurantFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantItem" ADD CONSTRAINT "RestaurantItem_subFamilyId_fkey" FOREIGN KEY ("subFamilyId") REFERENCES "RestaurantSubFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantItem" ADD CONSTRAINT "RestaurantItem_subSubFamilyId_fkey" FOREIGN KEY ("subSubFamilyId") REFERENCES "RestaurantSubSubFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
