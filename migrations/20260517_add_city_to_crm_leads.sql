-- Add city column to crm_leads
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS city TEXT;
