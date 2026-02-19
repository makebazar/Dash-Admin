-- Warehouse Advanced Features

-- 1. Add Min Stock and ABC Category to Products
ALTER TABLE warehouse_products 
ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS abc_category CHAR(1); -- 'A', 'B', 'C'

-- 2. Create Warehouse Stock Movements Table
-- Tracks every change in stock quantity
CREATE TABLE IF NOT EXISTS warehouse_stock_movements (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    
    change_amount INTEGER NOT NULL, -- Positive for add, Negative for remove
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    
    type VARCHAR(50) NOT NULL, -- SUPPLY, SALE, INVENTORY_ADJUSTMENT, WRITE_OFF, MANUAL_EDIT
    reason TEXT,
    
    related_entity_type VARCHAR(50), -- SUPPLY, INVENTORY
    related_entity_id INTEGER,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON warehouse_stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_club ON warehouse_stock_movements(club_id);
