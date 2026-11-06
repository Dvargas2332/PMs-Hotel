-- Tipo de servicio al que aplica un menú por sección.
-- null = aplica a todos los tipos (DINE_IN, TAKEAWAY, DELIVERY, ROOM).
ALTER TABLE "RestaurantMenuAssignment" ADD COLUMN IF NOT EXISTS "serviceType" TEXT;

CREATE INDEX IF NOT EXISTS "RestaurantMenuAssignment_hotelId_sectionId_serviceType_idx"
  ON "RestaurantMenuAssignment" ("hotelId", "sectionId", "serviceType");
