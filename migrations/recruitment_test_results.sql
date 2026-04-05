ALTER TABLE recruitment_application_tests
    ADD COLUMN IF NOT EXISTS max_score INTEGER;

ALTER TABLE recruitment_application_tests
    ADD COLUMN IF NOT EXISTS score_percent INTEGER;

ALTER TABLE recruitment_application_tests
    ADD COLUMN IF NOT EXISTS result JSONB;
