-- Add photos support to equipment
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}';
