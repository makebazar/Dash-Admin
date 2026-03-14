-- Evaluation Templates
CREATE TABLE IF NOT EXISTS evaluation_templates (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Items within a template
CREATE TABLE IF NOT EXISTS evaluation_template_items (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES evaluation_templates(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    description TEXT,
    weight DECIMAL(3,2) DEFAULT 1.0, -- Relative importance of the item
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Evaluation results
CREATE TABLE IF NOT EXISTS evaluations (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES evaluation_templates(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    evaluator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    total_score DECIMAL(5,2), -- Calculated percentage (e.g., 85.50)
    max_score DECIMAL(5,2),
    comments TEXT,
    evaluation_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Individual responses for each item in an evaluation
CREATE TABLE IF NOT EXISTS evaluation_responses (
    id SERIAL PRIMARY KEY,
    evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES evaluation_template_items(id) ON DELETE CASCADE,
    score INTEGER NOT NULL, -- e.g., 0-1 for Yes/No, or 1-5 for scale
    comment TEXT
);

-- Indexing for faster lookups
CREATE INDEX IF NOT EXISTS idx_eval_templates_club ON evaluation_templates(club_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_club_employee ON evaluations(club_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_date ON evaluations(evaluation_date);
