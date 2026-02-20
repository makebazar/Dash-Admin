-- Create table for report templates
CREATE TABLE IF NOT EXISTS club_report_templates (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(100) DEFAULT 'Основной отчет',
    schema JSONB NOT NULL, -- Array of { metric_key: string, custom_label: string, is_required: boolean, order: int }
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Update shifts table to store dynamic report data
ALTER TABLE shifts 
ADD COLUMN IF NOT EXISTS report_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES club_report_templates(id);

-- Create index for faster analytics on report data keys
CREATE INDEX IF NOT EXISTS idx_shifts_report_data ON shifts USING gin (report_data);
