-- Add receipts_count metric to system_metrics

INSERT INTO system_metrics (key, label, type, category, is_required, description)
VALUES ('receipts_count', 'Количество чеков', 'NUMBER', 'OPERATIONS', false, 'Общее количество чеков за смену для расчета среднего чека')
ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    type = EXCLUDED.type,
    category = EXCLUDED.category,
    description = EXCLUDED.description;
