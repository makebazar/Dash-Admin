-- Create crm_leads table
CREATE TABLE IF NOT EXISTS crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'new', -- 'new', 'working', 'negotiation', 'decision', 'success', 'rejected'
    notes TEXT,
    next_contact_at TIMESTAMP WITH TIME ZONE,
    "position" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(status);
