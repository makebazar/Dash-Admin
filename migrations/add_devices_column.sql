-- Add devices column to agent_telemetry
ALTER TABLE agent_telemetry ADD COLUMN IF NOT EXISTS devices JSONB;
