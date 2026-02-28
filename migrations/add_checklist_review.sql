-- Добавляем статусы и поля для проверки (Review) в таблицу evaluations
ALTER TABLE evaluations 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS reviewer_note TEXT,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);

-- Добавляем поля для проверки конкретных пунктов в таблицу evaluation_responses
ALTER TABLE evaluation_responses
ADD COLUMN IF NOT EXISTS is_accepted BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS admin_comment TEXT;

-- Индекс для ускорения выборки по статусу (например, показать все непроверенные)
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status);
