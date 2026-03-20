-- CreateTable
CREATE TABLE "EInvoicingConfig" (
    "hotelId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'CR-4.4',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'hacienda-cr',
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "credentials" JSONB,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EInvoicingConfig_pkey" PRIMARY KEY ("hotelId")
);

-- CreateTable
CREATE TABLE "EInvoicingRequirement" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'CR-4.4',
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EInvoicingRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EInvoicingRequirement_hotelId_idx" ON "EInvoicingRequirement"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoicingRequirement_hotelId_code_key" ON "EInvoicingRequirement"("hotelId", "code");

-- AddForeignKey
ALTER TABLE "EInvoicingConfig" ADD CONSTRAINT "EInvoicingConfig_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoicingRequirement" ADD CONSTRAINT "EInvoicingRequirement_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
