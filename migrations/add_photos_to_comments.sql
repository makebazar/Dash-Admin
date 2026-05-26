-- Add photos column to task comments
ALTER TABLE employee_task_comments ADD COLUMN IF NOT EXISTS photos TEXT[];

-- Add photos column to equipment issue comments for consistency and union support
ALTER TABLE equipment_issue_comments ADD COLUMN IF NOT EXISTS photos TEXT[];
