-- Add soft delete support and fix hard delete cascades
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Fix shifts cascade
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_club_id_fkey;
ALTER TABLE shifts ADD CONSTRAINT shifts_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Fix shift_reports cascade
ALTER TABLE shift_reports DROP CONSTRAINT IF EXISTS shift_reports_club_id_fkey;
ALTER TABLE shift_reports ADD CONSTRAINT shift_reports_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Fix schedule_slots cascade if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schedule_slots') THEN
        ALTER TABLE schedule_slots DROP CONSTRAINT IF EXISTS schedule_slots_club_id_fkey;
        ALTER TABLE schedule_slots ADD CONSTRAINT schedule_slots_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
