DO $$ 
BEGIN 
    -- Добавляем столбец assigned_user_id, если его нет
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='equipment' AND column_name='assigned_user_id') THEN
        ALTER TABLE equipment ADD COLUMN assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Создаем индекс для быстрого поиска
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'equipment' AND indexname = 'idx_equipment_assigned_user') THEN
        CREATE INDEX idx_equipment_assigned_user ON equipment(assigned_user_id);
    END IF;
END $$;
