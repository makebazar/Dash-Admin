ALTER TABLE warehouse_stock_movements ADD COLUMN IF NOT EXISTS shift_id INTEGER REFERENCES shifts(id);
