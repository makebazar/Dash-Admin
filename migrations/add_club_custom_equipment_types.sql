-- Support system and club-specific equipment types in one dictionary

ALTER TABLE equipment_types
ADD COLUMN IF NOT EXISTS club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE;

ALTER TABLE equipment_types
ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE equipment_types
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE equipment_types
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE equipment_types
ADD COLUMN IF NOT EXISTS base_type_code TEXT REFERENCES equipment_types(code) ON DELETE SET NULL;

UPDATE equipment_types
SET club_id = NULL,
    is_system = TRUE,
    is_active = TRUE
WHERE club_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_types_club_id ON equipment_types(club_id);
CREATE INDEX IF NOT EXISTS idx_equipment_types_active ON equipment_types(is_active);
CREATE INDEX IF NOT EXISTS idx_equipment_types_base_type ON equipment_types(base_type_code);
