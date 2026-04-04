-- Rename legacy OTHER equipment type to CHAIR
-- Keeps existing records and instruction bindings consistent.

BEGIN;

-- Create or refresh CHAIR type in the system dictionary.
INSERT INTO equipment_types (code, name, name_ru, default_cleaning_interval, icon, sort_order)
VALUES ('CHAIR', 'Chair', 'Кресло', 30, 'armchair', 11)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ru = EXCLUDED.name_ru,
    default_cleaning_interval = EXCLUDED.default_cleaning_interval,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order;

-- Move per-club instructions to the new type code.
DO $$
BEGIN
    IF to_regclass('public.club_equipment_instructions') IS NOT NULL THEN
        UPDATE club_equipment_instructions
        SET equipment_type_code = 'CHAIR'
        WHERE equipment_type_code = 'OTHER'
          AND NOT EXISTS (
              SELECT 1
              FROM club_equipment_instructions existing
              WHERE existing.club_id = club_equipment_instructions.club_id
                AND existing.equipment_type_code = 'CHAIR'
          );

        DELETE FROM club_equipment_instructions
        WHERE equipment_type_code = 'OTHER';
    END IF;
END $$;

-- Move equipment items themselves to the new type code.
DO $$
BEGIN
    IF to_regclass('public.equipment') IS NOT NULL THEN
        UPDATE equipment
        SET type = 'CHAIR'
        WHERE type = 'OTHER';
    END IF;
END $$;

-- Update default for future records.
ALTER TABLE IF EXISTS equipment
ALTER COLUMN type SET DEFAULT 'CHAIR';

-- Drop the legacy dictionary row if it still exists.
DELETE FROM equipment_types
WHERE code = 'OTHER';

COMMIT;
