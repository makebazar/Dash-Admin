-- Add units_per_box to products
ALTER TABLE warehouse_products 
ADD COLUMN IF NOT EXISTS units_per_box INTEGER DEFAULT 1;
