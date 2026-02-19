-- Create suppliers table
CREATE TABLE IF NOT EXISTS warehouse_suppliers (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_info TEXT, -- Phone, email, or any other info (minimal as requested)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(club_id, name)
);

-- Add supplier_id to warehouse_supplies for linking
ALTER TABLE warehouse_supplies
ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES warehouse_suppliers(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_warehouse_suppliers_club_id ON warehouse_suppliers(club_id);
