-- Migration: Add indexes for Promo KPI tracking
-- This migration optimizes queries for registrations and top-ups during shift closures.

-- Index for counting new player registrations by time
CREATE INDEX IF NOT EXISTS idx_promo_players_created_at ON promo_players(created_at);

-- Index for counting top-ups and service awards by club, type and time
-- Using a composite index for optimal performance on the filters used in shift-logic
CREATE INDEX IF NOT EXISTS idx_promo_history_kpi_lookup ON promo_history(club_id, game_type, created_at);
