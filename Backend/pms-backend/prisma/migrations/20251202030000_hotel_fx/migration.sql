-- Añade columnas de tipo de cambio por hotel

ALTER TABLE "Hotel"
ADD COLUMN "fxBuy" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN "fxSell" DECIMAL(12,4) NOT NULL DEFAULT 0;
