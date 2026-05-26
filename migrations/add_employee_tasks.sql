-- Create table for Employee Tasks (Assignments)
CREATE TABLE IF NOT EXISTS employee_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    title TEXT NOT NULL,
    description TEXT,

    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, REVIEW, DONE, CANCELLED
    priority TEXT NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL

    due_date TIMESTAMPTZ,

    -- Integration with equipment issues
    linked_issue_id UUID REFERENCES equipment_issues(id) ON DELETE SET NULL,

    -- Completion report
    report_text TEXT,
    report_photos TEXT[],

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_employee_tasks_club ON employee_tasks(club_id);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_assigned_to ON employee_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_status ON employee_tasks(status);

-- Create table for Task Comments
CREATE TABLE IF NOT EXISTS employee_task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES employee_tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    content TEXT NOT NULL,
    is_system_message BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for comments
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON employee_task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON employee_task_comments(created_at);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_employee_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_employee_tasks_updated_at
BEFORE UPDATE ON employee_tasks
FOR EACH ROW
EXECUTE FUNCTION update_employee_tasks_updated_at();

-- Trigger for automatic task creation from equipment_issues assignment
CREATE OR REPLACE FUNCTION create_task_from_issue_assignment()
RETURNS TRIGGER AS $$
DECLARE
    task_id UUID;
BEGIN
    -- Only create task if assigned_to is set and changed (or new)
    IF (TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL) OR
       (TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to)) THEN

        INSERT INTO employee_tasks (
            club_id,
            title,
            description,
            assigned_to,
            created_by,
            linked_issue_id,
            priority,
            status
        ) VALUES (
            NEW.club_id,
            'Устранить инцидент: ' || NEW.title,
            COALESCE(NEW.description, 'Задача создана автоматически на основе инцидента.'),
            NEW.assigned_to,
            NEW.reported_by, -- Assuming reported_by is the creator of the issue
            NEW.id,
            COALESCE(NEW.severity, 'MEDIUM'),
            'OPEN'
        ) RETURNING id INTO task_id;

        -- Add a system comment to the task
        INSERT INTO employee_task_comments (
            task_id,
            content,
            is_system_message
        ) VALUES (
            task_id,
            'Задача создана автоматически из инцидента оборудования.',
            TRUE
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_task_from_issue ON equipment_issues;
CREATE TRIGGER trigger_create_task_from_issue
AFTER INSERT OR UPDATE ON equipment_issues
FOR EACH ROW
EXECUTE FUNCTION create_task_from_issue_assignment();
