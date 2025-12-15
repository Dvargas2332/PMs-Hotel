-- CreateTable
CREATE TABLE "LauncherAccount" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LauncherAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LauncherAccount_username_key" ON "LauncherAccount"("username");

-- CreateIndex
CREATE INDEX "LauncherAccount_hotelId_idx" ON "LauncherAccount"("hotelId");

-- AddForeignKey
ALTER TABLE "LauncherAccount" ADD CONSTRAINT "LauncherAccount_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
