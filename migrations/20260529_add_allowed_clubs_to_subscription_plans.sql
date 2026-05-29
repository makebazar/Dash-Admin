-- Create junction table to specify individual subscription conditions
CREATE TABLE IF NOT EXISTS subscription_plan_allowed_clubs (
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (plan_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_spac_plan_id ON subscription_plan_allowed_clubs(plan_id);
CREATE INDEX IF NOT EXISTS idx_spac_club_id ON subscription_plan_allowed_clubs(club_id);
