-- Recruitment tests (separate from form)
CREATE TABLE IF NOT EXISTS recruitment_test_templates (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_test_templates_club ON recruitment_test_templates(club_id);

CREATE TABLE IF NOT EXISTS recruitment_form_template_tests (
    template_id INTEGER NOT NULL REFERENCES recruitment_form_templates(id) ON DELETE CASCADE,
    test_id INTEGER NOT NULL REFERENCES recruitment_test_templates(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (template_id, test_id)
);

CREATE INDEX IF NOT EXISTS idx_recruitment_form_template_tests_template ON recruitment_form_template_tests(template_id, sort_order);

CREATE TABLE IF NOT EXISTS recruitment_application_tests (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES recruitment_applications(id) ON DELETE CASCADE,
    test_id INTEGER NOT NULL REFERENCES recruitment_test_templates(id) ON DELETE CASCADE,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    auto_score INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(application_id, test_id)
);

CREATE INDEX IF NOT EXISTS idx_recruitment_application_tests_application ON recruitment_application_tests(application_id, created_at DESC);

ALTER TABLE recruitment_applications
    ALTER COLUMN status SET DEFAULT 'in_progress';
