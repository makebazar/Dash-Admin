
-- Add calculated_revenue to warehouse_inventory_items
ALTER TABLE warehouse_inventory_items 
ADD COLUMN IF NOT EXISTS calculated_revenue DECIMAL(10, 2);
