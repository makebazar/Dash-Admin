
-- Add warehouse_id to warehouse_inventories
ALTER TABLE warehouse_inventories 
ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES warehouses(id);

-- Add inventory_settings to clubs
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS inventory_settings JSONB DEFAULT '{}';
