-- Performance optimization indexes for equipment module

-- 1. Index for server-side status filtering
CREATE INDEX IF NOT EXISTS idx_equipment_is_active ON equipment(is_active);

-- 2. Trigram indexes for fast text search (ILIKE)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_equipment_name_trgm ON equipment USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_equipment_identifier_trgm ON equipment USING gin (identifier gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_equipment_brand_trgm ON equipment USING gin (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_equipment_model_trgm ON equipment USING gin (model gin_trgm_ops);

-- 3. Composite index for the CTE in equipment API
CREATE INDEX IF NOT EXISTS idx_issues_equipment_status ON equipment_issues(equipment_id, status);

-- 4. Ensure club_id is indexed for all related tables (already exists for most but good to check)
CREATE INDEX IF NOT EXISTS idx_equipment_club_id_active ON equipment(club_id, is_active);

