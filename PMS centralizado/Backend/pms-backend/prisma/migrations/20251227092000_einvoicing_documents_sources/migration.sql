-- Make EInvoicingDocument support multiple sources (Invoice or RestaurantOrder)

ALTER TABLE "EInvoicingDocument"
  ALTER COLUMN "invoiceId" DROP NOT NULL;

ALTER TABLE "EInvoicingDocument"
  ADD COLUMN IF NOT EXISTS "restaurantOrderId" TEXT;

-- FK to RestaurantOrder
ALTER TABLE "EInvoicingDocument"
  ADD CONSTRAINT "EInvoicingDocument_restaurantOrderId_fkey"
  FOREIGN KEY ("restaurantOrderId") REFERENCES "RestaurantOrder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique per restaurant order + docType (scoped by hotel)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'EInvoicingDocument_hotelId_restaurantOrderId_docType_key'
  ) THEN
    ALTER TABLE "EInvoicingDocument"
      ADD CONSTRAINT "EInvoicingDocument_hotelId_restaurantOrderId_docType_key"
      UNIQUE ("hotelId", "restaurantOrderId", "docType");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "EInvoicingDocument_restaurantOrderId_idx"
  ON "EInvoicingDocument"("restaurantOrderId");

