-- Trazabilidad de turnos y ventas por personal del restaurante.
-- Los ids apuntan a RestaurantStaff pero sin FK, para conservar el histórico
-- cuando se elimina un empleado (el nombre queda como snapshot en el turno).

ALTER TABLE "CashAudit" ADD COLUMN IF NOT EXISTS "openedByStaffId" TEXT;
ALTER TABLE "CashAudit" ADD COLUMN IF NOT EXISTS "openedByName" TEXT;
ALTER TABLE "CashAudit" ADD COLUMN IF NOT EXISTS "closedByStaffId" TEXT;
ALTER TABLE "CashAudit" ADD COLUMN IF NOT EXISTS "closedByName" TEXT;

ALTER TABLE "RestaurantOrder" ADD COLUMN IF NOT EXISTS "shiftId" TEXT;
ALTER TABLE "RestaurantOrder" ADD COLUMN IF NOT EXISTS "createdByStaffId" TEXT;
ALTER TABLE "RestaurantOrder" ADD COLUMN IF NOT EXISTS "closedByStaffId" TEXT;

CREATE INDEX IF NOT EXISTS "RestaurantOrder_hotelId_shiftId_idx"
  ON "RestaurantOrder" ("hotelId", "shiftId");

CREATE INDEX IF NOT EXISTS "RestaurantOrder_hotelId_createdByStaffId_idx"
  ON "RestaurantOrder" ("hotelId", "createdByStaffId");
