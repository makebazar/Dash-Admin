-- Inter-club equipment transfers (audit + employee task flow)

CREATE TABLE IF NOT EXISTS equipment_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    target_club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'CREATED',
    comment TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_by UUID REFERENCES users(id),
    completed_at TIMESTAMP,
    completed_shift_id UUID REFERENCES shifts(id)
);

CREATE INDEX IF NOT EXISTS idx_equipment_transfers_source ON equipment_transfers(source_club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_transfers_target ON equipment_transfers(target_club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_transfers_status ON equipment_transfers(status, created_at DESC);

CREATE TABLE IF NOT EXISTS equipment_transfer_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id UUID NOT NULL REFERENCES equipment_transfers(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    source_workstation_id UUID REFERENCES club_workstations(id) ON DELETE SET NULL,
    target_workstation_id UUID REFERENCES club_workstations(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(transfer_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_equipment_transfer_items_transfer ON equipment_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_equipment_transfer_items_equipment ON equipment_transfer_items(equipment_id);

ALTER TABLE club_tasks
ADD COLUMN IF NOT EXISTS related_entity_uuid UUID;

ALTER TABLE club_tasks
ADD COLUMN IF NOT EXISTS completed_shift_id UUID REFERENCES shifts(id);

CREATE INDEX IF NOT EXISTS idx_club_tasks_related_entity_uuid ON club_tasks(related_entity_uuid);
