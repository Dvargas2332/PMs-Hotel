-- Add archived flag to keep historial reservations while ocultando habitaciones borradas
ALTER TABLE "Room" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT FALSE;
