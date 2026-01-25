-- Create club_employees table for many-to-many relationship
CREATE TABLE IF NOT EXISTS club_employees (
  id SERIAL PRIMARY KEY,
  club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hired_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);

-- Add default roles if they don't exist
INSERT INTO roles (name, default_kpi_settings)
VALUES 
  ('Админ', '{"base_rate": 150, "kpi_multiplier": 1.2}'),
  ('Клинер', '{"base_rate": 100, "kpi_multiplier": 1.0}'),
  ('Охрана', '{"base_rate": 120, "kpi_multiplier": 1.1}'),
  ('Бариста', '{"base_rate": 110, "kpi_multiplier": 1.0}')
ON CONFLICT (name) DO NOTHING;

-- Add club_id to shift_reports if not exists
ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS club_id INT REFERENCES clubs(id);
