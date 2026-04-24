ALTER TABLE warehouse_products
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_warehouse_products_deleted_at ON warehouse_products(club_id, deleted_at);
