CREATE TABLE "RoomType" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "beds" TEXT,
  "hotelId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RoomType"
  ADD CONSTRAINT "RoomType_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "RoomType_hotelId_id_key" ON "RoomType"("hotelId","id");
CREATE INDEX "RoomType_hotelId_idx" ON "RoomType"("hotelId");

