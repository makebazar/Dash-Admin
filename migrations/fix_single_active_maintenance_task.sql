WITH ranked_active AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY equipment_id, task_type
            ORDER BY
                CASE status WHEN 'IN_PROGRESS' THEN 0 ELSE 1 END,
                due_date ASC,
                created_at ASC,
                id ASC
        ) AS rn
    FROM equipment_maintenance_tasks
    WHERE status IN ('PENDING', 'IN_PROGRESS')
)
DELETE FROM equipment_maintenance_tasks
WHERE id IN (
    SELECT id
    FROM ranked_active
    WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_maintenance_task
ON equipment_maintenance_tasks (equipment_id, task_type)
WHERE status IN ('PENDING', 'IN_PROGRESS');
