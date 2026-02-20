-- Add inventory_required column to clubs if it doesn't exist
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS inventory_required BOOLEAN DEFAULT FALSE;
