-- Create crm_contacts table
CREATE TABLE IF NOT EXISTS crm_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    tg_username TEXT,
    role TEXT, -- 'Owner', 'Admin', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migrate existing data from crm_leads to crm_contacts
INSERT INTO crm_contacts (lead_id, name, phone, tg_username, role)
SELECT id, contact_person, phone, tg_username, 'Основной контакт'
FROM crm_leads
WHERE contact_person IS NOT NULL OR phone IS NOT NULL OR tg_username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_lead_id ON crm_contacts(lead_id);
