-- WAREHOUSE SYSTEM

-- CATEGORIES
CREATE TABLE IF NOT EXISTS warehouse_categories (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warehouse_categories_club ON warehouse_categories(club_id);

-- PRODUCTS
CREATE TABLE IF NOT EXISTS warehouse_products (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES warehouse_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    selling_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    current_stock INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warehouse_products_club ON warehouse_products(club_id);

-- SUPPLIES (INCOMING STOCK)
CREATE TABLE IF NOT EXISTS warehouse_supplies (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    supplier_name VARCHAR(255),
    notes TEXT,
    total_cost DECIMAL(10, 2) DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warehouse_supplies_club ON warehouse_supplies(club_id);

CREATE TABLE IF NOT EXISTS warehouse_supply_items (
    id SERIAL PRIMARY KEY,
    supply_id INTEGER NOT NULL REFERENCES warehouse_supplies(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id),
    quantity INTEGER NOT NULL,
    cost_price DECIMAL(10, 2) NOT NULL, -- Snapshot of cost at that time
    total_cost DECIMAL(10, 2)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_supply_items_supply ON warehouse_supply_items(supply_id);

-- INVENTORIES (BLIND CHECK)
CREATE TABLE IF NOT EXISTS warehouse_inventories (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'OPEN', -- OPEN, CLOSED
    started_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP,
    target_metric_key VARCHAR(50), -- The metric key from system_metrics to compare against (e.g. 'bar_revenue')
    reported_revenue DECIMAL(10, 2), -- The value of that metric entered by admin
    calculated_revenue DECIMAL(10, 2), -- Calculated from stock difference
    revenue_difference DECIMAL(10, 2), -- reported - calculated
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventories_club ON warehouse_inventories(club_id);

CREATE TABLE IF NOT EXISTS warehouse_inventory_items (
    id SERIAL PRIMARY KEY,
    inventory_id INTEGER NOT NULL REFERENCES warehouse_inventories(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id),
    expected_stock INTEGER NOT NULL, -- Snapshot before count
    actual_stock INTEGER, -- Filled by admin
    difference INTEGER, -- actual - expected (negative means loss/sold)
    cost_price_snapshot DECIMAL(10, 2),
    selling_price_snapshot DECIMAL(10, 2)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_items_inventory ON warehouse_inventory_items(inventory_id);
