CREATE TABLE IF NOT EXISTS equipment_laundry_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    maintenance_task_id UUID REFERENCES equipment_maintenance_tasks(id) ON DELETE SET NULL,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'EMPLOYEE_SERVICE',
    status TEXT NOT NULL DEFAULT 'NEW',
    title TEXT NOT NULL,
    description TEXT,
    photos TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT equipment_laundry_requests_source_check CHECK (source IN ('EMPLOYEE_SERVICE', 'INSPECTION_CENTER')),
    CONSTRAINT equipment_laundry_requests_status_check CHECK (status IN ('NEW', 'SENT_TO_LAUNDRY', 'READY_FOR_RETURN', 'RETURNED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_equipment_laundry_requests_club_id ON equipment_laundry_requests(club_id);
CREATE INDEX IF NOT EXISTS idx_equipment_laundry_requests_equipment_id ON equipment_laundry_requests(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_laundry_requests_status ON equipment_laundry_requests(status);
CREATE INDEX IF NOT EXISTS idx_equipment_laundry_requests_created_at ON equipment_laundry_requests(created_at DESC);

DROP TRIGGER IF EXISTS update_equipment_laundry_requests_updated_at ON equipment_laundry_requests;
CREATE TRIGGER update_equipment_laundry_requests_updated_at
    BEFORE UPDATE ON equipment_laundry_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
