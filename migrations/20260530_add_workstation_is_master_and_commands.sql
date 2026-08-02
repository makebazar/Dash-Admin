-- Migration: Add is_master column and agent_commands table
ALTER TABLE club_workstations
ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT FALSE;

-- Ensure an index on is_master
CREATE INDEX IF NOT EXISTS idx_workstations_is_master ON club_workstations(club_id, is_master) WHERE is_master = TRUE;

-- Create agent_commands table
CREATE TABLE IF NOT EXISTS agent_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workstation_id UUID NOT NULL REFERENCES club_workstations(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- e.g., 'update_game', 'message'
    payload JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SENT, COMPLETED, FAILED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by workstation and status
CREATE INDEX IF NOT EXISTS idx_agent_commands_ws_status ON agent_commands(workstation_id, status);
