-- Migration: Add price snapshot to stock movements
-- This ensures that historical sales reports remain accurate even if current product price changes.

ALTER TABLE warehouse_stock_movements 
ADD COLUMN IF NOT EXISTS price_at_time DECIMAL(10, 2);

-- Backfill existing movements with current product prices (best effort)
UPDATE warehouse_stock_movements sm
SET price_at_time = p.selling_price
FROM warehouse_products p
WHERE sm.product_id = p.id AND sm.price_at_time IS NULL;
