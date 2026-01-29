-- Add shift verification fields
-- This migration adds fields to track shift verification by owner

ALTER TABLE shifts ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS has_owner_corrections BOOLEAN DEFAULT false;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS owner_notes TEXT;

-- Add index for faster queries on verified shifts
CREATE INDEX IF NOT EXISTS idx_shifts_verified ON shifts(verified_by, verified_at) WHERE verified_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
