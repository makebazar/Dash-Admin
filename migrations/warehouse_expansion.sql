-- WAREHOUSE EXPANSION

-- 1. Expand Categories
ALTER TABLE warehouse_categories 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES warehouse_categories(id) ON DELETE SET NULL;

-- Ensure unique category name per club
CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouse_categories_unique_name_per_club 
ON warehouse_categories(club_id, name);

-- 2. Create Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    type VARCHAR(50) DEFAULT 'GENERAL', -- GENERAL, COLD_STORAGE, KITCHEN, BAR
    responsible_user_id UUID REFERENCES users(id),
    contact_info TEXT,
    characteristics JSONB DEFAULT '{}', -- area, temperature, etc.
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warehouses_club ON warehouses(club_id);

-- 3. Warehouse Stock (Per-warehouse inventory)
CREATE TABLE IF NOT EXISTS warehouse_stock (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(warehouse_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_warehouse ON warehouse_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_product ON warehouse_stock(product_id);

-- 4. Operation Logs
CREATE TABLE IF NOT EXISTS operation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- CREATE_CATEGORY, CREATE_WAREHOUSE, UPDATE_STOCK
    entity_type VARCHAR(50) NOT NULL, -- CATEGORY, WAREHOUSE, PRODUCT
    entity_id VARCHAR(50),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_operation_logs_club ON operation_logs(club_id);
