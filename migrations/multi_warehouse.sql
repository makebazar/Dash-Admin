-- Multi-Warehouse Architecture

-- 1. Create Warehouse Stock Table
-- Stores how much of each product is in each warehouse
CREATE TABLE IF NOT EXISTS warehouse_stock (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    
    -- Ensure unique stock entry per product per warehouse
    UNIQUE(warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_stock_product ON warehouse_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_warehouse ON warehouse_stock(warehouse_id);

-- 2. Create Replenishment Rules Table
-- Defines how one warehouse fills another (e.g. Fridge <- Main Warehouse)
CREATE TABLE IF NOT EXISTS warehouse_replenishment_rules (
    id SERIAL PRIMARY KEY,
    source_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE, -- From where?
    target_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE, -- To where?
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id) ON DELETE CASCADE, -- What?
    
    min_stock_level INTEGER NOT NULL DEFAULT 0, -- Threshold to trigger restock
    max_stock_level INTEGER NOT NULL DEFAULT 0, -- Capacity (fill up to this)
    
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE(source_warehouse_id, target_warehouse_id, product_id)
);

-- 3. Update Tasks table to support warehouse context (already supports related_entity)
-- We might want to add target_warehouse_id to tasks for clarity, but related_entity_id (product) + description is enough for now.

-- 4. Add 'is_default' to warehouses to identify the Main Storage
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
