-- CreateEnum
CREATE TYPE "EInvoicingAckType" AS ENUM ('HACIENDA_RECEIPT', 'HACIENDA_STATUS', 'RECEIVER_MESSAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "EInvoicingAckStatus" AS ENUM ('RECEIVED', 'ACCEPTED', 'REJECTED', 'ERROR');

-- CreateTable
CREATE TABLE "EInvoicingAcknowledgement" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "type" "EInvoicingAckType" NOT NULL,
    "status" "EInvoicingAckStatus" NOT NULL DEFAULT 'RECEIVED',
    "message" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EInvoicingAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EInvoicingAcknowledgement_hotelId_idx" ON "EInvoicingAcknowledgement"("hotelId");

-- CreateIndex
CREATE INDEX "EInvoicingAcknowledgement_documentId_idx" ON "EInvoicingAcknowledgement"("documentId");

-- AddForeignKey
ALTER TABLE "EInvoicingAcknowledgement" ADD CONSTRAINT "EInvoicingAcknowledgement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "EInvoicingDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoicingAcknowledgement" ADD CONSTRAINT "EInvoicingAcknowledgement_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
