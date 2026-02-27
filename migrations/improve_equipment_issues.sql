-- Add assigned_to column to equipment_issues
ALTER TABLE equipment_issues
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create comments table for issues
CREATE TABLE IF NOT EXISTS equipment_issue_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID REFERENCES equipment_issues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_system_message BOOLEAN DEFAULT FALSE, -- for auto-generated messages like "Status changed to RESOLVED"
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster retrieval
CREATE INDEX IF NOT EXISTS idx_issue_comments_issue_id ON equipment_issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_created_at ON equipment_issue_comments(created_at);
