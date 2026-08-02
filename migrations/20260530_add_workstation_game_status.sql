-- Migration: Add workstation_game_status table to track client PC game updates
CREATE TABLE IF NOT EXISTS workstation_game_status (
    id SERIAL PRIMARY KEY,
    workstation_id UUID NOT NULL REFERENCES club_workstations(id) ON DELETE CASCADE,
    game_name VARCHAR(100) NOT NULL,
    app_id INT, -- Steam AppID if applicable (e.g. 730 for CS2)
    installed_build VARCHAR(50), -- Steam build ID or version string
    is_update_required BOOLEAN DEFAULT FALSE,
    last_checked TIMESTAMP DEFAULT NOW(),
    UNIQUE(workstation_id, game_name)
);

-- Index for fast lookup by workstation
CREATE INDEX IF NOT EXISTS idx_workstation_game_status_ws ON workstation_game_status(workstation_id);
