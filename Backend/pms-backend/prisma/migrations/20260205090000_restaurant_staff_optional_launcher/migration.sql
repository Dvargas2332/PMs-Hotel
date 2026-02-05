DO $$ BEGIN
  CREATE TYPE "RestaurantStaffRole" AS ENUM ('CASHIER', 'WAITER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RestaurantStaff" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "launcherId" TEXT,
  "name" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "role" "RestaurantStaffRole" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RestaurantStaff_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RestaurantStaff_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RestaurantStaff_launcherId_fkey" FOREIGN KEY ("launcherId") REFERENCES "UserLauncher"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantStaff_hotelId_username_key" ON "RestaurantStaff"("hotelId", "username");
CREATE INDEX IF NOT EXISTS "RestaurantStaff_hotelId_idx" ON "RestaurantStaff"("hotelId");
CREATE INDEX IF NOT EXISTS "RestaurantStaff_hotelId_launcherId_idx" ON "RestaurantStaff"("hotelId", "launcherId");

ALTER TABLE "RestaurantStaff" ALTER COLUMN "launcherId" DROP NOT NULL;
ALTER TABLE "RestaurantStaff" DROP CONSTRAINT IF EXISTS "RestaurantStaff_launcherId_fkey";
ALTER TABLE "RestaurantStaff" ADD CONSTRAINT "RestaurantStaff_launcherId_fkey" FOREIGN KEY ("launcherId") REFERENCES "UserLauncher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
