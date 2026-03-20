-- AlterTable
ALTER TABLE "Report" ALTER COLUMN "periodStart" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "periodEnd" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "otaCode" TEXT,
ADD COLUMN     "rooming" TEXT;

-- CreateTable
CREATE TABLE "Country" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "regionId" TEXT,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceDeposit" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT,
    "guestId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CRC',
    "note" TEXT,
    "appliedInvoice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hotelId" TEXT NOT NULL,

    CONSTRAINT "AdvanceDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT,
    "guestId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CRC',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hotelId" TEXT NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Region_countryCode_idx" ON "Region"("countryCode");

-- CreateIndex
CREATE INDEX "City_countryCode_idx" ON "City"("countryCode");

-- CreateIndex
CREATE INDEX "City_regionId_idx" ON "City"("regionId");

-- CreateIndex
CREATE INDEX "AdvanceDeposit_hotelId_idx" ON "AdvanceDeposit"("hotelId");

-- CreateIndex
CREATE INDEX "AdvanceDeposit_reservationId_idx" ON "AdvanceDeposit"("reservationId");

-- CreateIndex
CREATE INDEX "AdvanceDeposit_guestId_idx" ON "AdvanceDeposit"("guestId");

-- CreateIndex
CREATE INDEX "CreditNote_hotelId_idx" ON "CreditNote"("hotelId");

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");

-- CreateIndex
CREATE INDEX "CreditNote_guestId_idx" ON "CreditNote"("guestId");

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceDeposit" ADD CONSTRAINT "AdvanceDeposit_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceDeposit" ADD CONSTRAINT "AdvanceDeposit_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceDeposit" ADD CONSTRAINT "AdvanceDeposit_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Report_hotelId_period_idx" RENAME TO "Report_hotelId_periodStart_periodEnd_idx";
