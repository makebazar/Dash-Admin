WITH ranked_active AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY equipment_id, task_type
            ORDER BY
                CASE status
                    WHEN 'IN_PROGRESS' THEN 0
                    WHEN 'REWORK' THEN 1
                    ELSE 2
                END,
                due_date ASC,
                created_at ASC,
                id ASC
        ) AS rn
    FROM equipment_maintenance_tasks
    WHERE status IN ('PENDING', 'IN_PROGRESS', 'REWORK')
)
DELETE FROM equipment_maintenance_tasks
WHERE id IN (
    SELECT id
    FROM ranked_active
    WHERE rn > 1
);

DROP INDEX IF EXISTS idx_unique_active_maintenance_task;

CREATE UNIQUE INDEX idx_unique_active_maintenance_task
ON equipment_maintenance_tasks (equipment_id, task_type)
WHERE status IN ('PENDING', 'IN_PROGRESS', 'REWORK');
