-- Enums/tabla planning y ajustes para cargos/factura
DO $$ BEGIN
  CREATE TYPE "RoomDayStatus" AS ENUM ('RESERVED','BLOCKED','OOO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Room"
ADD COLUMN "baseRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'CRC';


ALTER TABLE "Reservation"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- number ahora puede ser nulo hasta emitir
ALTER TABLE "Invoice"
  ALTER COLUMN "number" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "RoomDay" (
  "id" TEXT PRIMARY KEY,
  "roomId" TEXT NOT NULL REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "date" DATE NOT NULL,
  "status" "RoomDayStatus" NOT NULL DEFAULT 'RESERVED',
  "reservationId" TEXT REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "RoomDay_roomId_date_key" ON "RoomDay"("roomId","date");
CREATE INDEX IF NOT EXISTS "RoomDay_reservationId_idx" ON "RoomDay"("reservationId");
