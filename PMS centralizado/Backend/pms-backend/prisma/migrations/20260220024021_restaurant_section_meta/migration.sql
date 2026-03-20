-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "contractId" TEXT,
ADD COLUMN     "mealPlanId" TEXT,
ADD COLUMN     "ratePlanId" TEXT;

-- AlterTable
ALTER TABLE "RestaurantSection" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "quickCashEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RatePlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CRC',
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "derived" BOOLEAN NOT NULL DEFAULT false,
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "restrictions" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hotelId" TEXT NOT NULL,

    CONSTRAINT "RatePlan_pkey" PRIMARY KEY ("hotelId","id")
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hotelId" TEXT NOT NULL,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("hotelId","id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "commission" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ratePlans" JSONB,
    "mealPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hotelId" TEXT NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("hotelId","id")
);

-- CreateIndex
CREATE INDEX "RatePlan_hotelId_idx" ON "RatePlan"("hotelId");

-- CreateIndex
CREATE INDEX "MealPlan_hotelId_idx" ON "MealPlan"("hotelId");

-- CreateIndex
CREATE INDEX "Contract_hotelId_idx" ON "Contract"("hotelId");

-- AddForeignKey
ALTER TABLE "RestaurantStaff" ADD CONSTRAINT "RestaurantStaff_hotelId_accessRoleId_fkey" FOREIGN KEY ("hotelId", "accessRoleId") REFERENCES "AppRole"("hotelId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLauncher" ADD CONSTRAINT "UserLauncher_hotelId_roleId_fkey" FOREIGN KEY ("hotelId", "roleId") REFERENCES "AppRole"("hotelId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_hotelId_contractId_fkey" FOREIGN KEY ("hotelId", "contractId") REFERENCES "Contract"("hotelId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_hotelId_ratePlanId_fkey" FOREIGN KEY ("hotelId", "ratePlanId") REFERENCES "RatePlan"("hotelId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_hotelId_mealPlanId_fkey" FOREIGN KEY ("hotelId", "mealPlanId") REFERENCES "MealPlan"("hotelId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
