-- Add dismissed_at column to club_employees for improved historical tracking
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='club_employees' AND column_name='dismissed_at') THEN
        ALTER TABLE club_employees ADD COLUMN dismissed_at TIMESTAMP;
    END IF;
    
    -- Ensure is_active is present (in case previous auto-migration didn't stick or for consistency)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='club_employees' AND column_name='is_active') THEN
        ALTER TABLE club_employees ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;
