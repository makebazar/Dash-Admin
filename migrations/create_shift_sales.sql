-- Shift Sales (Employee scanning during shift; committed to stock movements on shift close)

CREATE TABLE IF NOT EXISTS shift_sales (
    id BIGSERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id) ON DELETE CASCADE,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    selling_price_snapshot DECIMAL(10, 2) NOT NULL DEFAULT 0,
    cost_price_snapshot DECIMAL(10, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    committed_at TIMESTAMP,
    committed_movement_id INTEGER REFERENCES warehouse_stock_movements(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_shift_sales_club_shift ON shift_sales(club_id, shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_sales_product ON shift_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_shift_sales_committed ON shift_sales(shift_id, committed_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_sales_unique_open
ON shift_sales(shift_id, product_id, warehouse_id)
WHERE committed_at IS NULL;

CREATE OR REPLACE FUNCTION shift_sales_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_shift_sales_set_updated_at ON shift_sales;
CREATE TRIGGER trg_shift_sales_set_updated_at
BEFORE UPDATE ON shift_sales
FOR EACH ROW
EXECUTE PROCEDURE shift_sales_set_updated_at();

