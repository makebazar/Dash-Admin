-- Add units_per_box to procurement items
ALTER TABLE warehouse_procurement_items 
ADD COLUMN IF NOT EXISTS units_per_box INTEGER DEFAULT 1;
