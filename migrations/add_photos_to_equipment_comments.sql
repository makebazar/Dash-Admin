-- Add photos support to equipment_issue_comments
ALTER TABLE equipment_issue_comments ADD COLUMN IF NOT EXISTS photos TEXT[];

-- Ensure bidirectional comment visibility:
-- We don't necessarily need to move data, but we need to make sure
-- that linked_issue_id is used in both directions in the APIs.
