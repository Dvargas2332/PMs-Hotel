-- Create reports table for hotel FrontDesk reports
CREATE TABLE "Report" (
  "id" TEXT PRIMARY KEY,
  "hotelId" TEXT NOT NULL,
  "title" TEXT,
  "category" TEXT,
  "type" TEXT,
  "periodStart" TIMESTAMPTZ,
  "periodEnd" TIMESTAMPTZ,
  "filters" JSONB,
  "payload" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdBy" TEXT,
  CONSTRAINT "Report_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Report_hotelId_idx" ON "Report" ("hotelId");
CREATE INDEX "Report_hotelId_period_idx" ON "Report" ("hotelId", "periodStart", "periodEnd");
