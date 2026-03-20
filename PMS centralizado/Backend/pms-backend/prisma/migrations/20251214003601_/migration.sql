-- CreateTable
CREATE TABLE "ReservationSequence" (
    "hotelId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ReservationSequence_pkey" PRIMARY KEY ("hotelId")
);

-- AddForeignKey
ALTER TABLE "ReservationSequence" ADD CONSTRAINT "ReservationSequence_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
