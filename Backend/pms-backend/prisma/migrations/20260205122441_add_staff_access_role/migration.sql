-- AlterTable
ALTER TABLE "RestaurantStaff" ADD COLUMN     "accessRoleId" TEXT;

-- AddForeignKey
ALTER TABLE "RestaurantStaff" ADD CONSTRAINT "RestaurantStaff_hotelId_accessRoleId_fkey" FOREIGN KEY ("hotelId", "accessRoleId") REFERENCES "AppRole"("hotelId", "id") ON DELETE SET NULL ON UPDATE CASCADE;
