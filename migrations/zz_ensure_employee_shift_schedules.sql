-- Ensure employee_shift_schedules matches current API expectations without dropping data.

CREATE TABLE IF NOT EXISTS employee_shift_schedules (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    planned_shifts INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, user_id, month, year)
);

ALTER TABLE employee_shift_schedules
  ADD COLUMN IF NOT EXISTS planned_shifts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

UPDATE employee_shift_schedules
SET updated_at = NOW()
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ess_club_period
  ON employee_shift_schedules (club_id, month, year);

DO $$
DECLARE
  cols_missing TEXT[];
  has_required_cols BOOLEAN;
  has_unique BOOLEAN;
BEGIN
  cols_missing := ARRAY(
    SELECT c
    FROM unnest(ARRAY['club_id','user_id','month','year']) AS c
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns ic
      WHERE ic.table_schema = 'public'
        AND ic.table_name = 'employee_shift_schedules'
        AND ic.column_name = c
    )
  );

  has_required_cols := (array_length(cols_missing, 1) IS NULL);
  IF NOT has_required_cols THEN
    RAISE EXCEPTION 'employee_shift_schedules is missing required columns: %', cols_missing;
  END IF;

  -- Ensure a unique index/constraint exists for (club_id, user_id, month, year) so ON CONFLICT works reliably.
  SELECT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    WHERE t.relname = 'employee_shift_schedules'
      AND i.indisunique
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname::text)
        FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      ) = ARRAY['club_id','month','user_id','year']::text[]
  ) INTO has_unique;

  IF NOT has_unique THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS employee_shift_schedules_uniq_club_user_month_year ON employee_shift_schedules (club_id, user_id, month, year)';
  END IF;
END $$;
