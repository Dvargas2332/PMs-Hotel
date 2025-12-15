/*
  Warnings:

  - You are about to drop the `LauncherAccount` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "LauncherAccount" DROP CONSTRAINT "LauncherAccount_hotelId_fkey";

-- DropForeignKey
ALTER TABLE "LauncherAccount" DROP CONSTRAINT "LauncherAccount_hotelId_roleId_fkey";

-- DropTable
DROP TABLE "LauncherAccount";

-- CreateTable
CREATE TABLE "UserLauncher" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLauncher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserLauncher_hotelId_idx" ON "UserLauncher"("hotelId");

-- CreateIndex
CREATE INDEX "UserLauncher_hotelId_roleId_idx" ON "UserLauncher"("hotelId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLauncher_hotelId_username_key" ON "UserLauncher"("hotelId", "username");

-- AddForeignKey
ALTER TABLE "UserLauncher" ADD CONSTRAINT "UserLauncher_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLauncher" ADD CONSTRAINT "UserLauncher_hotelId_roleId_fkey" FOREIGN KEY ("hotelId", "roleId") REFERENCES "AppRole"("hotelId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
