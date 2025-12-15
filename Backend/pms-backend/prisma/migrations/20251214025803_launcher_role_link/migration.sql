-- AlterTable
ALTER TABLE "LauncherAccount" ADD COLUMN     "roleId" TEXT NOT NULL DEFAULT 'ADMIN';

-- CreateIndex
CREATE INDEX "LauncherAccount_hotelId_roleId_idx" ON "LauncherAccount"("hotelId", "roleId");

-- AddForeignKey
ALTER TABLE "LauncherAccount" ADD CONSTRAINT "LauncherAccount_hotelId_roleId_fkey" FOREIGN KEY ("hotelId", "roleId") REFERENCES "AppRole"("hotelId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
