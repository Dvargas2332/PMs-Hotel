-- POS restaurante: configuraciones (taxes/payments/general/billing), plano de mesas (x/y),
-- tipo de servicio + cargo a habitacion, y estados KDS por item.

-- Enums para KDS
DO $$ BEGIN
  CREATE TYPE "RestaurantKdsArea" AS ENUM ('KITCHEN', 'BAR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RestaurantOrderItemStatus" AS ENUM ('NEW', 'IN_KITCHEN', 'READY', 'SERVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RestaurantConfig: guardar configuraciones de POS en JSONB
ALTER TABLE "RestaurantConfig"
  ADD COLUMN IF NOT EXISTS "taxes" JSONB,
  ADD COLUMN IF NOT EXISTS "payments" JSONB,
  ADD COLUMN IF NOT EXISTS "general" JSONB,
  ADD COLUMN IF NOT EXISTS "billing" JSONB;

-- Plano de mesas
ALTER TABLE "RestaurantTable"
  ADD COLUMN IF NOT EXISTS "x" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "y" DOUBLE PRECISION;

-- Orden: tipo de servicio / cargo a habitacion
ALTER TABLE "RestaurantOrder"
  ADD COLUMN IF NOT EXISTS "serviceType" TEXT NOT NULL DEFAULT 'DINE_IN',
  ADD COLUMN IF NOT EXISTS "roomId" TEXT;

-- Items: area y estado KDS
ALTER TABLE "RestaurantOrderItem"
  ADD COLUMN IF NOT EXISTS "area" "RestaurantKdsArea" NOT NULL DEFAULT 'KITCHEN',
  ADD COLUMN IF NOT EXISTS "status" "RestaurantOrderItemStatus" NOT NULL DEFAULT 'NEW';

-- Evitar duplicados de un mismo item por orden (para upsert estable)
CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantOrderItem_orderId_itemId_key"
  ON "RestaurantOrderItem" ("orderId", "itemId");

