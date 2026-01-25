-- Fix: Add default_monthly_shifts column to clubs table
-- This was in employee_shift_schedules.sql but didn't apply
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS default_monthly_shifts INTEGER DEFAULT 20;

-- Add constraint if column was just created
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'clubs_default_monthly_shifts_check'
    ) THEN
        ALTER TABLE clubs 
        ADD CONSTRAINT clubs_default_monthly_shifts_check 
        CHECK (default_monthly_shifts >= 1);
    END IF;
END $$;
