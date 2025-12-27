-- CreateTable
CREATE TABLE "CabysCode" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hotelId" TEXT NOT NULL,

    CONSTRAINT "CabysCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoicingCatalogEntry" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "catalog" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "version" TEXT,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EInvoicingCatalogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CabysCode_hotelId_idx" ON "CabysCode"("hotelId");

-- CreateIndex
CREATE INDEX "CabysCode_hotelId_description_idx" ON "CabysCode"("hotelId", "description");

-- CreateIndex
CREATE INDEX "EInvoicingCatalogEntry_hotelId_catalog_idx" ON "EInvoicingCatalogEntry"("hotelId", "catalog");

-- CreateIndex
CREATE INDEX "EInvoicingCatalogEntry_hotelId_code_idx" ON "EInvoicingCatalogEntry"("hotelId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoicingCatalogEntry_hotelId_catalog_code_key" ON "EInvoicingCatalogEntry"("hotelId", "catalog", "code");

-- AddForeignKey
ALTER TABLE "CabysCode" ADD CONSTRAINT "CabysCode_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoicingCatalogEntry" ADD CONSTRAINT "EInvoicingCatalogEntry_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
