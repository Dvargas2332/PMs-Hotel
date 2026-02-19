/*
  Warnings:

  - The primary key for the `AppRole` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_roleId_fkey";

-- DropIndex
DROP INDEX "AppRole_hotelId_id_key" CASCADE;

-- AlterTable
ALTER TABLE "AppRole" DROP CONSTRAINT "AppRole_pkey",
ADD CONSTRAINT "AppRole_pkey" PRIMARY KEY ("hotelId", "id");

-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "managerName" TEXT,
ADD COLUMN     "membershipMonthlyFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "phone1" TEXT,
ADD COLUMN     "phone2" TEXT;

-- AlterTable
ALTER TABLE "RestaurantInventoryItem" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "supplierName" TEXT,
ADD COLUMN     "taxRate" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "RestaurantInventoryInvoice" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "docNumber" TEXT,
    "docType" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "issueDate" TIMESTAMP(3),
    "currency" TEXT,
    "total" DECIMAL(14,4),
    "taxTotal" DECIMAL(14,4),
    "externalKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantInventoryInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantInventoryInvoiceLine" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "cost" DECIMAL(14,4) NOT NULL,
    "taxRate" DECIMAL(5,2),
    "taxAmount" DECIMAL(14,4),
    "lineTotal" DECIMAL(14,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantInventoryInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT,
    "email" TEXT,
    "phone1" TEXT,
    "phone2" TEXT,
    "ownerName" TEXT,
    "managerName" TEXT,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasBillingPayment" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaasBillingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestaurantInventoryInvoice_hotelId_idx" ON "RestaurantInventoryInvoice"("hotelId");

-- CreateIndex
CREATE INDEX "RestaurantInventoryInvoiceLine_hotelId_idx" ON "RestaurantInventoryInvoiceLine"("hotelId");

-- CreateIndex
CREATE INDEX "RestaurantInventoryInvoiceLine_invoiceId_idx" ON "RestaurantInventoryInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "RestaurantInventoryInvoiceLine_inventoryItemId_idx" ON "RestaurantInventoryInvoiceLine"("inventoryItemId");

-- CreateIndex
CREATE INDEX "SaasBillingPayment_hotelId_idx" ON "SaasBillingPayment"("hotelId");

-- CreateIndex
CREATE INDEX "SaasBillingPayment_hotelId_paidAt_idx" ON "SaasBillingPayment"("hotelId", "paidAt");

-- AddForeignKey
ALTER TABLE "RestaurantInventoryInvoice" ADD CONSTRAINT "RestaurantInventoryInvoice_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantInventoryInvoiceLine" ADD CONSTRAINT "RestaurantInventoryInvoiceLine_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantInventoryInvoiceLine" ADD CONSTRAINT "RestaurantInventoryInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "RestaurantInventoryInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantInventoryInvoiceLine" ADD CONSTRAINT "RestaurantInventoryInvoiceLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "RestaurantInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasBillingPayment" ADD CONSTRAINT "SaasBillingPayment_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "SaasClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_hotelId_fkey" FOREIGN KEY ("roleId", "hotelId") REFERENCES "AppRole"("id", "hotelId") ON DELETE CASCADE ON UPDATE CASCADE;
