-- Add shift hour settings to clubs
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clubs' AND column_name='day_start_hour') THEN
        ALTER TABLE clubs ADD COLUMN day_start_hour INTEGER DEFAULT 9;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clubs' AND column_name='night_start_hour') THEN
        ALTER TABLE clubs ADD COLUMN night_start_hour INTEGER DEFAULT 21;
    END IF;
END $$;

-- Ensure club_employees has is_active
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='club_employees' AND column_name='is_active') THEN
        ALTER TABLE club_employees ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Create work_schedules table
CREATE TABLE IF NOT EXISTS work_schedules (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    shift_type VARCHAR(20) NOT NULL, -- 'DAY', 'NIGHT'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_work_schedules_club_date ON work_schedules(club_id, date);
