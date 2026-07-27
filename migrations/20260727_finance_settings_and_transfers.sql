-- Migration: Add club_finance_settings table and transfer support to finance_transactions

CREATE TABLE IF NOT EXISTS club_finance_settings (
    club_id INTEGER PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
    tax_regime VARCHAR(50) DEFAULT 'patent_usn6',
    custom_tax_rate DECIMAL(5, 2) DEFAULT 6.00,
    patent_cost DECIMAL(12, 2) DEFAULT 12500.00,
    limit_exceeded BOOLEAN DEFAULT FALSE,
    usn_categories JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE finance_transactions 
ADD COLUMN IF NOT EXISTS is_transfer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS transfer_pair_id INTEGER REFERENCES finance_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_transactions_transfer ON finance_transactions(club_id, is_transfer);
