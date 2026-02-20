-- Add is_active to evaluation_template_items for soft delete
ALTER TABLE evaluation_template_items 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
