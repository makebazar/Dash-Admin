-- Add shift and warehouse references to stock movements (required by inventory POS logic)

ALTER TABLE warehouse_stock_movements
ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_shift_id ON warehouse_stock_movements(shift_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_id ON warehouse_stock_movements(warehouse_id);

