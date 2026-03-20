-- Multi-hotel isolation for guests, invoices, payments, audit logs
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "hotelId" TEXT;
UPDATE "Guest" g SET "hotelId" = r."hotelId"
FROM "Reservation" r
WHERE r."guestId" = g.id AND g."hotelId" IS NULL;
UPDATE "Guest" SET "hotelId" = 'hotel-demo' WHERE "hotelId" IS NULL;
ALTER TABLE "Guest" ALTER COLUMN "hotelId" SET NOT NULL;
ALTER TABLE "Guest" DROP CONSTRAINT IF EXISTS "Guest_email_key";
ALTER TABLE "Guest" DROP CONSTRAINT IF EXISTS "Guest_hotelId_fkey";
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE;
ALTER TABLE "Guest" DROP CONSTRAINT IF EXISTS "Guest_hotelId_email_key";
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_hotelId_email_key" UNIQUE ("hotelId","email");
CREATE INDEX IF NOT EXISTS "Guest_hotelId_idx" ON "Guest"("hotelId");

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "hotelId" TEXT;
UPDATE "Invoice" i SET "hotelId" = r."hotelId" FROM "Reservation" r WHERE i."reservationId" = r.id;
UPDATE "Invoice" SET "hotelId" = 'hotel-demo' WHERE "hotelId" IS NULL;
ALTER TABLE "Invoice" ALTER COLUMN "hotelId" SET NOT NULL;
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_hotelId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "Invoice_hotelId_idx" ON "Invoice"("hotelId");

ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "hotelId" TEXT;
UPDATE "InvoiceItem" ii SET "hotelId" = i."hotelId" FROM "Invoice" i WHERE ii."invoiceId" = i.id;
UPDATE "InvoiceItem" SET "hotelId" = 'hotel-demo' WHERE "hotelId" IS NULL;
ALTER TABLE "InvoiceItem" ALTER COLUMN "hotelId" SET NOT NULL;
ALTER TABLE "InvoiceItem" DROP CONSTRAINT IF EXISTS "InvoiceItem_hotelId_fkey";
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "InvoiceItem_hotelId_idx" ON "InvoiceItem"("hotelId");

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "hotelId" TEXT;
UPDATE "Payment" p SET "hotelId" = i."hotelId" FROM "Invoice" i WHERE p."invoiceId" = i.id;
UPDATE "Payment" SET "hotelId" = 'hotel-demo' WHERE "hotelId" IS NULL;
ALTER TABLE "Payment" ALTER COLUMN "hotelId" SET NOT NULL;
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_hotelId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "Payment_hotelId_idx" ON "Payment"("hotelId");

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "hotelId" TEXT;
UPDATE "AuditLog" SET "hotelId" = 'hotel-demo' WHERE "hotelId" IS NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "hotelId" SET NOT NULL;
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_hotelId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "AuditLog_hotelId_idx" ON "AuditLog"("hotelId");
