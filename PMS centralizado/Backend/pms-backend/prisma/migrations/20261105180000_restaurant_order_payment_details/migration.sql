-- Moneda y detalle de pagos por venta de restaurante.
-- La venta guarda su moneda base y, opcionalmente, el detalle de cada medio de
-- cobro (moneda original, tipo de cambio y referencia) para el XML y el arqueo.

ALTER TABLE "RestaurantOrder" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'CRC';
ALTER TABLE "RestaurantOrder" ADD COLUMN IF NOT EXISTS "paymentDetails" JSONB;
