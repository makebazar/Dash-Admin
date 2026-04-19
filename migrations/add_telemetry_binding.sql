-- Add binding code for telemetry agent
ALTER TABLE club_workstations
ADD COLUMN IF NOT EXISTS binding_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS agent_last_seen TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS agent_status VARCHAR(20) DEFAULT 'OFFLINE';

CREATE UNIQUE INDEX IF NOT EXISTS idx_workstations_binding_code ON club_workstations(binding_code) WHERE binding_code IS NOT NULL;

-- Table for telemetry history
CREATE TABLE IF NOT EXISTS agent_telemetry (
    id BIGSERIAL PRIMARY KEY,
    workstation_id UUID NOT NULL REFERENCES club_workstations(id) ON DELETE CASCADE,
    hostname TEXT,
    cpu_temp DECIMAL(5,2),
    cpu_usage DECIMAL(5,2),
    cpu_model TEXT,
    gpu_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_telemetry_workstation ON agent_telemetry(workstation_id, created_at DESC);