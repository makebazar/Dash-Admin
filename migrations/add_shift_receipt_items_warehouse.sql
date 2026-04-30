ALTER TABLE shift_receipts
ALTER COLUMN warehouse_id DROP NOT NULL;

ALTER TABLE shift_receipt_items
ADD COLUMN warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE RESTRICT;

UPDATE shift_receipt_items i
SET warehouse_id = r.warehouse_id
FROM shift_receipts r
WHERE r.id = i.receipt_id
  AND i.warehouse_id IS NULL;

ALTER TABLE shift_receipt_items
ALTER COLUMN warehouse_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shift_receipt_items_warehouse ON shift_receipt_items(warehouse_id);

