-- Migration: Add parent_equipment_id and new component types
-- Allows for hierarchical equipment (e.g., PC components)

-- 1. Add parent_equipment_id and purchase_price to equipment table
ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS parent_equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(12, 2);

-- Create index for performance when querying components
CREATE INDEX IF NOT EXISTS idx_equipment_parent ON equipment(parent_equipment_id);
-- 2. Insert new component types into equipment_types
INSERT INTO equipment_types (code, name, name_ru, default_cleaning_interval, icon, sort_order)
VALUES
    ('CPU', 'CPU', 'Процессор', 365, 'cpu', 12),
    ('GPU', 'GPU', 'Видеокарта', 365, 'cpu', 13),
    ('RAM', 'RAM', 'Оперативная память', 0, 'memory-stick', 14),
    ('MOTHERBOARD', 'Motherboard', 'Материнская плата', 0, 'circuit-board', 15),
    ('PSU', 'Power Supply', 'Блок питания', 365, 'zap', 16),
    ('STORAGE', 'Storage (SSD/HDD)', 'Накопитель', 0, 'hard-drive', 17),
    ('COOLING', 'Cooling System', 'Система охлаждения', 180, 'fan', 18)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ru = EXCLUDED.name_ru,
    default_cleaning_interval = EXCLUDED.default_cleaning_interval,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order;
