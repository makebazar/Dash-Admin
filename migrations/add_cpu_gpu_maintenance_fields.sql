ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS cpu_thermal_paste_last_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cpu_thermal_paste_interval_days INTEGER DEFAULT 365,
ADD COLUMN IF NOT EXISTS cpu_thermal_paste_type TEXT,
ADD COLUMN IF NOT EXISTS cpu_thermal_paste_note TEXT,
ADD COLUMN IF NOT EXISTS gpu_thermal_paste_last_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS gpu_thermal_paste_interval_days INTEGER DEFAULT 365,
ADD COLUMN IF NOT EXISTS gpu_thermal_paste_type TEXT,
ADD COLUMN IF NOT EXISTS gpu_thermal_paste_note TEXT;

UPDATE equipment
SET
    cpu_thermal_paste_last_changed_at = thermal_paste_last_changed_at,
    cpu_thermal_paste_interval_days = COALESCE(thermal_paste_interval_days, cpu_thermal_paste_interval_days, 365),
    cpu_thermal_paste_type = thermal_paste_type,
    cpu_thermal_paste_note = thermal_paste_note
WHERE
    (cpu_thermal_paste_last_changed_at IS NULL AND thermal_paste_last_changed_at IS NOT NULL)
    OR (cpu_thermal_paste_type IS NULL AND thermal_paste_type IS NOT NULL)
    OR (cpu_thermal_paste_note IS NULL AND thermal_paste_note IS NOT NULL);
