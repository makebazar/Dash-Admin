-- Add tg_username column to crm_leads
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS tg_username TEXT;
