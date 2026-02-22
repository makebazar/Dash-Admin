ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS thermal_paste_last_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS thermal_paste_interval_days INTEGER DEFAULT 365,
ADD COLUMN IF NOT EXISTS thermal_paste_type TEXT,
ADD COLUMN IF NOT EXISTS thermal_paste_note TEXT;
