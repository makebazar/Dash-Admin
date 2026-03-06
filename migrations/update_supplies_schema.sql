-- Migration: Add status and warehouse_id to warehouse_supplies
-- Allows for draft supplies and specific warehouse targeting.

ALTER TABLE warehouse_supplies 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'COMPLETED',
ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES warehouses(id);

-- Update existing records to COMPLETED if status is null
UPDATE warehouse_supplies SET status = 'COMPLETED' WHERE status IS NULL;
