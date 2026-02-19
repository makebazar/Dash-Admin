-- Warehouse Analytics & Procurement

-- 1. Add Analytics Fields to Products
-- sales_velocity: Average units sold per day (calculated over last 30 days)
-- last_restock_date: Date of last supply
-- abc_category: 'A', 'B', 'C' (Already exists but ensure it's used)
-- ideal_stock_days: Target days of stock coverage (e.g. keep 14 days of stock)
ALTER TABLE warehouse_products 
ADD COLUMN IF NOT EXISTS sales_velocity NUMERIC(10, 2) DEFAULT 0, -- e.g. 1.5 units/day
ADD COLUMN IF NOT EXISTS last_restock_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS ideal_stock_days INTEGER DEFAULT 14; -- Default: aim for 2 weeks coverage

-- 2. Create Procurement Lists Table (Draft Orders)
CREATE TABLE IF NOT EXISTS warehouse_procurement_lists (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, SENT, COMPLETED, ARCHIVED
    name VARCHAR(255) DEFAULT 'Закупка',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_procurement_items (
    id SERIAL PRIMARY KEY,
    list_id INTEGER NOT NULL REFERENCES warehouse_procurement_lists(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id) ON DELETE CASCADE,
    current_stock INTEGER NOT NULL,
    suggested_quantity INTEGER NOT NULL, -- Calculated based on velocity
    actual_quantity INTEGER NOT NULL, -- User override
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_procurement_lists_club ON warehouse_procurement_lists(club_id);
