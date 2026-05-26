-- Drop the trigger that automatically creates tasks from equipment issues
-- This trigger causes duplication when tasks are created manually with linked equipment
DROP TRIGGER IF EXISTS trigger_create_task_from_issue ON equipment_issues;

-- Create table for link between Employee Tasks and Equipment (Many-to-Many) if not exists
CREATE TABLE IF NOT EXISTS employee_task_equipment (
    task_id UUID NOT NULL REFERENCES employee_tasks(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_task_equipment_task ON employee_task_equipment(task_id);
CREATE INDEX IF NOT EXISTS idx_employee_task_equipment_equipment ON employee_task_equipment(equipment_id);

-- Localize existing system comments
UPDATE employee_task_comments SET content = 'Статус изменен на: В работе' WHERE content = 'Статус изменен на: IN_PROGRESS';
UPDATE employee_task_comments SET content = 'Статус изменен на: К выполнению' WHERE content = 'Статус изменен на: OPEN';
UPDATE employee_task_comments SET content = 'Статус изменен на: Проверка' WHERE content = 'Статус изменен на: REVIEW';
UPDATE employee_task_comments SET content = 'Статус изменен на: Готово' WHERE content = 'Статус изменен на: DONE';
UPDATE employee_task_comments SET content = 'Статус изменен на: Отменено' WHERE content = 'Статус изменен на: CANCELLED';
