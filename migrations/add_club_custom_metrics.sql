CREATE TABLE IF NOT EXISTS club_custom_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    key VARCHAR(120) NOT NULL,
    label VARCHAR(120) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (club_id, key)
);

CREATE INDEX IF NOT EXISTS idx_club_custom_metrics_club_id
ON club_custom_metrics(club_id);
