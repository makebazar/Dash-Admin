-- Add address, social_link, and maps_link columns to crm_leads
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS social_link TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS maps_link TEXT;
