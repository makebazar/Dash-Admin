-- Add lateness settings to clubs table
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS lateness_settings JSONB DEFAULT '{"grace_period": 5, "thresholds": []}'::jsonb;

-- Add lateness fields to shifts table
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS lateness_minutes INTEGER DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS lateness_status VARCHAR(20) DEFAULT 'NONE';
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS lateness_penalty DECIMAL(10, 2) DEFAULT 0.00;
