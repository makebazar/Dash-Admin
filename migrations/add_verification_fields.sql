-- Add verification fields to equipment maintenance tasks
ALTER TABLE equipment_maintenance_tasks
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'NONE', -- NONE, PENDING, APPROVED, REJECTED
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS verification_note TEXT;

-- Create index for faster queries of pending verifications
CREATE INDEX IF NOT EXISTS idx_maint_tasks_verification ON equipment_maintenance_tasks(verification_status);

-- Update existing COMPLETED tasks to have a status (optional, maybe set to APPROVED or NONE)
-- For now, let's leave them as NONE or update to APPROVED if we assume old ones are fine.
-- Let's set old completed tasks to APPROVED to avoid cluttering the new queue.
UPDATE equipment_maintenance_tasks 
SET verification_status = 'APPROVED', verified_at = completed_at 
WHERE status = 'COMPLETED' AND verification_status = 'NONE';
