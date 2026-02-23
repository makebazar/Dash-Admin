
-- Add maintenance_enabled column to equipment table
ALTER TABLE equipment
ADD COLUMN maintenance_enabled BOOLEAN DEFAULT TRUE;

-- Update existing equipment to have maintenance enabled by default
UPDATE equipment
SET maintenance_enabled = TRUE
WHERE maintenance_enabled IS NULL;
