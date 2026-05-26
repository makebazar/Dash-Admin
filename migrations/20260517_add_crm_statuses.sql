-- Create crm_statuses table
CREATE TABLE IF NOT EXISTS crm_statuses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    color TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default statuses
INSERT INTO crm_statuses (id, title, color, "position") VALUES
('new', 'Новые', 'bg-slate-100 text-slate-700', 0),
('working', 'В работе', 'bg-blue-100 text-blue-700', 1),
('negotiation', 'Переговоры', 'bg-purple-100 text-purple-700', 2),
('decision', 'Думают', 'bg-amber-100 text-amber-700', 3),
('success', 'Клиент', 'bg-emerald-100 text-emerald-700', 4),
('rejected', 'Отказ', 'bg-rose-100 text-rose-700', 5)
ON CONFLICT (id) DO NOTHING;
