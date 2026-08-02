-- Add crm lead separation and club referral fields

-- 1. Add assigned_user_id to crm_leads
ALTER TABLE crm_leads 
ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for faster querying by assignee
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned_user ON crm_leads(assigned_user_id);

-- 2. Add created_by_id to crm_notes
ALTER TABLE crm_notes 
ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for notes creator
CREATE INDEX IF NOT EXISTS idx_crm_notes_created_by ON crm_notes(created_by_id);

-- 3. Add referred_by_id to clubs
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for referral manager
CREATE INDEX IF NOT EXISTS idx_clubs_referred_by ON clubs(referred_by_id);
