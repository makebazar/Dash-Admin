-- Preserve canceled inventories as history instead of deleting them.

ALTER TABLE warehouse_inventories
ADD COLUMN IF NOT EXISTS canceled_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP;
