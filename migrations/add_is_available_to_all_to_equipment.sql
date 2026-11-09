ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS is_available_to_all BOOLEAN;
