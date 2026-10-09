-- Migration: Add ip_address column to clubs table for DashFrag Agent network verification
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
COMMENT ON COLUMN clubs.ip_address IS 'Public WAN IP address of the club router used by DashFrag Agent for network verification';
