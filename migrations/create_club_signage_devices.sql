CREATE TABLE IF NOT EXISTS club_signage_devices (
    id BIGSERIAL PRIMARY KEY,
    club_id BIGINT REFERENCES clubs(id) ON DELETE SET NULL,
    device_id VARCHAR(128) NOT NULL,
    device_token VARCHAR(128),
    pairing_code VARCHAR(32) NOT NULL,
    name VARCHAR(255),
    status VARCHAR(24) NOT NULL DEFAULT 'pending',
    orientation VARCHAR(16) NOT NULL DEFAULT 'landscape',
    selected_display_id VARCHAR(128),
    screen_label VARCHAR(255),
    display_info JSONB NOT NULL DEFAULT '[]'::jsonb,
    layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_seen_at TIMESTAMP,
    paired_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT club_signage_devices_orientation_check CHECK (orientation IN ('landscape', 'portrait')),
    CONSTRAINT club_signage_devices_status_check CHECK (status IN ('pending', 'paired', 'offline'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_signage_devices_device_id_unique
    ON club_signage_devices(device_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_signage_devices_device_token_unique
    ON club_signage_devices(device_token)
    WHERE device_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_signage_devices_pairing_code_unique
    ON club_signage_devices(pairing_code);

CREATE INDEX IF NOT EXISTS idx_club_signage_devices_club_id
    ON club_signage_devices(club_id);

CREATE INDEX IF NOT EXISTS idx_club_signage_devices_last_seen_at
    ON club_signage_devices(last_seen_at DESC);
