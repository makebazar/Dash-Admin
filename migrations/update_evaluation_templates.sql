ALTER TABLE evaluation_templates 
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'manager_audit',
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

COMMENT ON COLUMN evaluation_templates.type IS 'Тип чеклиста: shift_handover (для сотрудников) или manager_audit (для управляющих)';
COMMENT ON COLUMN evaluation_templates.settings IS 'Гибкие настройки в формате JSON (блокировка смены, фото-подтверждение и т.д.)';
