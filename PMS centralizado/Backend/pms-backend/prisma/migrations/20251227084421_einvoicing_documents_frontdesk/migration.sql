-- CreateEnum
CREATE TYPE "EInvoicingDocType" AS ENUM ('FE', 'TE');

-- CreateEnum
CREATE TYPE "EInvoicingDocStatus" AS ENUM ('DRAFT', 'SIGNED', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELED', 'CONTINGENCY');

-- CreateTable
CREATE TABLE "EInvoicingSequence" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "docType" "EInvoicingDocType" NOT NULL,
    "branch" TEXT NOT NULL DEFAULT '001',
    "terminal" TEXT NOT NULL DEFAULT '00001',
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EInvoicingSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoicingDocument" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "docType" "EInvoicingDocType" NOT NULL,
    "status" "EInvoicingDocStatus" NOT NULL DEFAULT 'DRAFT',
    "branch" TEXT NOT NULL DEFAULT '001',
    "terminal" TEXT NOT NULL DEFAULT '00001',
    "consecutive" TEXT,
    "key" TEXT,
    "receiver" JSONB,
    "payload" JSONB,
    "xmlSigned" TEXT,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EInvoicingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EInvoicingSequence_hotelId_idx" ON "EInvoicingSequence"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoicingSequence_hotelId_docType_branch_terminal_key" ON "EInvoicingSequence"("hotelId", "docType", "branch", "terminal");

-- CreateIndex
CREATE INDEX "EInvoicingDocument_hotelId_idx" ON "EInvoicingDocument"("hotelId");

-- CreateIndex
CREATE INDEX "EInvoicingDocument_invoiceId_idx" ON "EInvoicingDocument"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoicingDocument_hotelId_invoiceId_docType_key" ON "EInvoicingDocument"("hotelId", "invoiceId", "docType");

-- AddForeignKey
ALTER TABLE "EInvoicingSequence" ADD CONSTRAINT "EInvoicingSequence_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoicingDocument" ADD CONSTRAINT "EInvoicingDocument_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoicingDocument" ADD CONSTRAINT "EInvoicingDocument_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
