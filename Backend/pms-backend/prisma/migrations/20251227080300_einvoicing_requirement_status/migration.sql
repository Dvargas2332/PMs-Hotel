-- AlterTable
ALTER TABLE "EInvoicingRequirement" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';
