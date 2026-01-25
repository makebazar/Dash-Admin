-- Add shift_type to shifts table
ALTER TABLE shifts 
ADD COLUMN IF NOT EXISTS shift_type VARCHAR(10) DEFAULT 'DAY';

-- Add shift time boundaries to clubs
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS day_start_hour INTEGER DEFAULT 8;

ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS night_start_hour INTEGER DEFAULT 20;
