-- Add display_order to club_employees for custom ordering
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='club_employees' AND column_name='display_order') THEN
        ALTER TABLE club_employees ADD COLUMN display_order INTEGER DEFAULT 0;
    END IF;
END $$;
