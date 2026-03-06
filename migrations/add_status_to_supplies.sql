
-- Add status column to warehouse_supplies
ALTER TABLE warehouse_supplies 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'COMPLETED';
