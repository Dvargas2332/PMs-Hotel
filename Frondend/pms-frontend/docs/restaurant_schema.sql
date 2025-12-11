-- Esquema propuesto para módulo de restaurante con multi-hotel y relación con Front Desk.
-- Todas las tablas llevan hotel_id como FK obligatorio para aislar datos por hotel.

CREATE TABLE hotels (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE rooms (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  number TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE restaurant_sections (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

CREATE TABLE restaurant_tables (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  section_id UUID NOT NULL REFERENCES restaurant_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  seats INT DEFAULT 2
);

CREATE TABLE restaurant_categories (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  name TEXT NOT NULL,
  parent_id UUID NULL REFERENCES restaurant_categories(id) ON DELETE SET NULL
);

CREATE TABLE restaurant_items (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  category_id UUID NULL REFERENCES restaurant_categories(id),
  name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  cabys TEXT NULL,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  route TEXT DEFAULT 'KITCHEN',
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE restaurant_orders (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  table_id UUID NULL REFERENCES restaurant_tables(id),
  section_id UUID NULL REFERENCES restaurant_sections(id),
  service_type TEXT NOT NULL DEFAULT 'DINE_IN', -- DINE_IN, TAKEOUT, DELIVERY, ROOM
  status TEXT NOT NULL DEFAULT 'OPEN',          -- OPEN, IN_KITCHEN, SERVED, CLOSED, CANCELLED
  covers INT DEFAULT 1,
  guest_name TEXT NULL,
  room_id UUID NULL REFERENCES rooms(id),        -- para cargos a habitación
  note TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE restaurant_order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES restaurant_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES restaurant_items(id),
  qty NUMERIC(10,2) NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  note TEXT NULL,
  route TEXT DEFAULT 'KITCHEN',                  -- KITCHEN / BAR
  status TEXT DEFAULT 'PENDING',                 -- PENDING, IN_KITCHEN, READY, SERVED, CANCELLED
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE restaurant_payments (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES restaurant_orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL,                          -- CASH, CARD, SINPE, TRANSFER, ROOM
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CRC',
  fx_rate NUMERIC(12,4) DEFAULT 1,
  detail JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE restaurant_closures (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  turno TEXT NULL,
  totals_system NUMERIC(12,2) NOT NULL DEFAULT 0,
  totals_reported NUMERIC(12,2) NOT NULL DEFAULT 0,
  diff NUMERIC(12,2) NOT NULL DEFAULT 0,
  breakdown JSONB NULL,
  payments JSONB NULL,
  created_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE restaurant_inventory_items (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  unit TEXT NOT NULL,
  stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  min_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  cost NUMERIC(12,4) NOT NULL DEFAULT 0,
  location TEXT NULL
);

CREATE TABLE restaurant_recipes (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  item_id UUID NOT NULL REFERENCES restaurant_items(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES restaurant_inventory_items(id) ON DELETE CASCADE,
  qty NUMERIC(12,3) NOT NULL,
  unit TEXT NOT NULL
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  module TEXT NOT NULL,
  user_id UUID NULL,
  action TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices recomendados
CREATE INDEX ON restaurant_orders (hotel_id, status, service_type);
CREATE INDEX ON restaurant_order_items (order_id, route, status);
CREATE INDEX ON restaurant_payments (order_id, method);
CREATE INDEX ON restaurant_closures (hotel_id, created_at DESC);

