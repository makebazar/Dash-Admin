-- Add shift_id to evaluations
-- NOTE: shifts.id is UUID, not INTEGER
ALTER TABLE evaluations 
ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_evaluations_shift ON evaluations(shift_id);
