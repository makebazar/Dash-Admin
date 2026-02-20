-- Add photo support to evaluation templates and responses

-- Add 'is_photo_required' to evaluation_template_items
ALTER TABLE evaluation_template_items 
ADD COLUMN IF NOT EXISTS is_photo_required BOOLEAN DEFAULT FALSE;

-- Add 'photo_url' to evaluation_responses
ALTER TABLE evaluation_responses 
ADD COLUMN IF NOT EXISTS photo_url TEXT;
