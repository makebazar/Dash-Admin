-- Recruitment (candidate applications)
CREATE TABLE IF NOT EXISTS recruitment_form_templates (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    position VARCHAR(80),
    schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    public_token VARCHAR(64) UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_form_templates_club ON recruitment_form_templates(club_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_form_templates_token ON recruitment_form_templates(public_token);

CREATE TABLE IF NOT EXISTS recruitment_applications (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES recruitment_form_templates(id) ON DELETE CASCADE,
    candidate_name TEXT,
    candidate_phone TEXT,
    candidate_email TEXT,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    auto_score INTEGER,
    manual_score INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_applications_club ON recruitment_applications(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recruitment_applications_template ON recruitment_applications(template_id, created_at DESC);
