ALTER TABLE evaluation_responses
ADD COLUMN IF NOT EXISTS selected_workstations JSONB DEFAULT '[]'::jsonb;
