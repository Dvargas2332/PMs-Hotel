-- Align schema with multi-hotel + roles/permissions and user.hotelId

-- Drop existing FKs to adjust cascade rules
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_hotelId_fkey";
ALTER TABLE "Guest" DROP CONSTRAINT "Guest_hotelId_fkey";
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_hotelId_fkey";
ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_hotelId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_hotelId_fkey";
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_hotelId_fkey";
ALTER TABLE "Room" DROP CONSTRAINT "Room_hotelId_fkey";

-- Drop old unique indexes that conflict with per-hotel uniqueness
DROP INDEX "Guest_email_key";
DROP INDEX "Room_number_key";

-- Ensure hotel scoping and timestamps
ALTER TABLE "Reservation" ALTER COLUMN "hotelId" SET NOT NULL;
ALTER TABLE "RestaurantConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "RestaurantOrder" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Room" ALTER COLUMN "hotelId" SET NOT NULL;

-- User belongs to a hotel
ALTER TABLE "User" ADD COLUMN "hotelId" TEXT NOT NULL;

-- Roles and permissions (per hotel)
CREATE TABLE "AppRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hotelId" TEXT NOT NULL,
    CONSTRAINT "AppRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "AppRole_hotelId_idx" ON "AppRole"("hotelId");
CREATE UNIQUE INDEX "AppRole_hotelId_id_key" ON "AppRole"("hotelId", "id");
CREATE INDEX "RolePermission_hotelId_idx" ON "RolePermission"("hotelId");
CREATE UNIQUE INDEX "RolePermission_hotelId_roleId_permissionId_key" ON "RolePermission"("hotelId", "roleId", "permissionId");
CREATE UNIQUE INDEX "Room_hotelId_number_key" ON "Room"("hotelId", "number");
CREATE INDEX "User_hotelId_idx" ON "User"("hotelId");

-- Recreate FKs with cascade
ALTER TABLE "User" ADD CONSTRAINT "User_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppRole" ADD CONSTRAINT "AppRole_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AppRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
