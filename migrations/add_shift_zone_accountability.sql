-- Shift accountability for computer club zones: fridge / showcase / backroom.

ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS shift_zone_key VARCHAR(20),
ADD COLUMN IF NOT EXISTS shift_accountability_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS shift_zone_snapshots (
    id BIGSERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES users(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    snapshot_type VARCHAR(10) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(shift_id, warehouse_id, snapshot_type)
);

CREATE INDEX IF NOT EXISTS idx_shift_zone_snapshots_shift
    ON shift_zone_snapshots(shift_id, snapshot_type);

CREATE INDEX IF NOT EXISTS idx_shift_zone_snapshots_warehouse
    ON shift_zone_snapshots(warehouse_id, snapshot_type);

CREATE TABLE IF NOT EXISTS shift_zone_snapshot_items (
    id BIGSERIAL PRIMARY KEY,
    snapshot_id BIGINT NOT NULL REFERENCES shift_zone_snapshots(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id) ON DELETE CASCADE,
    counted_quantity INTEGER NOT NULL,
    system_quantity INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(snapshot_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_zone_snapshot_items_snapshot
    ON shift_zone_snapshot_items(snapshot_id);

CREATE INDEX IF NOT EXISTS idx_shift_zone_snapshot_items_product
    ON shift_zone_snapshot_items(product_id);
