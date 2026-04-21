-- Add memory_usage column for easier charting
ALTER TABLE agent_telemetry 
ADD COLUMN IF NOT EXISTS memory_usage DECIMAL(5,2);