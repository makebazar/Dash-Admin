-- Harden inventory reconciliation schema for auditability and immutable history.

ALTER TABLE warehouse_inventories
ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS sales_capture_mode_snapshot VARCHAR(20);

ALTER TABLE warehouse_inventory_items
ADD COLUMN IF NOT EXISTS adjusted_expected_stock INTEGER,
ADD COLUMN IF NOT EXISTS stock_before_close INTEGER,
ADD COLUMN IF NOT EXISTS applied_stock_delta INTEGER,
ADD COLUMN IF NOT EXISTS added_manually BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS counted_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS counted_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS inventory_post_close_corrections (
    id BIGSERIAL PRIMARY KEY,
    inventory_id INTEGER NOT NULL REFERENCES warehouse_inventories(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id),
    old_actual_stock INTEGER NOT NULL,
    new_actual_stock INTEGER NOT NULL,
    difference_before INTEGER,
    difference_after INTEGER NOT NULL,
    stock_delta INTEGER NOT NULL,
    reason TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_post_close_corrections_inventory
    ON inventory_post_close_corrections(inventory_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_post_close_corrections_product
    ON inventory_post_close_corrections(product_id, created_at DESC);
