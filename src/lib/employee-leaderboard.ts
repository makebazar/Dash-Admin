import { getClient, query } from '@/db';

export interface EmployeeLeaderboardMetrics {
    user_id: string;
    full_name: string;
    completed_shifts: number;
    planned_shifts: number;
    total_revenue: number;
    total_hours: number;
    evaluation_score: number;
    maintenance_tasks_assigned: number;
    maintenance_tasks_completed: number;
    maintenance_overdue_open_tasks: number;
    maintenance_rework_open_tasks: number;
    maintenance_stale_rework_tasks: number;
    maintenance_overdue_completed_tasks: number;
    maintenance_overdue_completed_days: number;
}

export interface EmployeeLeaderboardEntry extends EmployeeLeaderboardMetrics {
    rank: number;
    score: number;
    revenue_score: number;
    checklist_score: number;
    maintenance_score: number;
    schedule_score: number;
    discipline_score: number;
    revenue_per_shift: number;
}

export interface EmployeeLeaderboardSnapshotMeta {
    is_frozen: boolean;
    finalized_at: string | null;
    entries_count: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getMonthRange = (year: number, month: number) => {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
};

const inferMetricCategories = (templateSchema: any) => {
    const fields = Array.isArray(templateSchema) ? templateSchema : (templateSchema?.fields || []);
    const metricCategories: Record<string, string> = {};

    fields.forEach((field: any) => {
        const key = field.metric_key || field.key;
        if (!key) return;

        let category = field.field_type || field.calculation_category;
        if (!category) {
            if (key.includes('income') || key.includes('revenue') || key === 'cash' || key === 'card') {
                category = 'INCOME';
            } else if (key.includes('expense') || key === 'expenses') {
                category = 'EXPENSE';
            } else {
                category = 'OTHER';
            }
        }

        metricCategories[key] = category;
    });

    return metricCategories;
};

const calculateShiftIncome = (shift: any, metricCategories: Record<string, string>) => {
    let total = 0;
    const cash = Number(shift.cash_income ?? shift.cash_revenue ?? 0);
    const card = Number(shift.card_income ?? shift.card_revenue ?? 0);

    if (metricCategories['cash_income'] === 'INCOME' || !metricCategories['cash_income']) {
        total += cash;
    }
    if (metricCategories['card_income'] === 'INCOME' || !metricCategories['card_income']) {
        total += card;
    }

    if (shift.report_data) {
        const data = typeof shift.report_data === 'string' ? JSON.parse(shift.report_data) : shift.report_data;
        Object.keys(data || {}).forEach(key => {
            if (metricCategories[key] === 'INCOME' && key !== 'cash_income' && key !== 'card_income') {
                total += Number(data[key] || 0);
            }
        });
    }

    return total;
};

const sortLeaderboardEntries = (entries: EmployeeLeaderboardEntry[]) => {
    return [...entries].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.checklist_score !== a.checklist_score) return b.checklist_score - a.checklist_score;
        if (b.maintenance_score !== a.maintenance_score) return b.maintenance_score - a.maintenance_score;
        if (b.revenue_per_shift !== a.revenue_per_shift) return b.revenue_per_shift - a.revenue_per_shift;
        if (b.completed_shifts !== a.completed_shifts) return b.completed_shifts - a.completed_shifts;
        return a.full_name.localeCompare(b.full_name, 'ru');
    });
};

const rankScheduledLeaderboardEntries = (entries: EmployeeLeaderboardEntry[]) => {
    const scheduledEntries = entries.filter(entry => Number(entry.planned_shifts || 0) > 0);
    return sortLeaderboardEntries(scheduledEntries).map((entry, index) => ({
        ...entry,
        rank: index + 1
    }));
};

export function buildEmployeeLeaderboard(entries: EmployeeLeaderboardMetrics[]) {
    const scheduledEntries = entries.filter(entry => Number(entry.planned_shifts || 0) > 0);
    const eligibleEntries = scheduledEntries.filter(entry => entry.completed_shifts > 0);
    const maxRevenuePerShift = Math.max(
        ...eligibleEntries.map(entry => entry.total_revenue / Math.max(entry.completed_shifts, 1)),
        1
    );

    const scored = scheduledEntries.map(entry => {
        const completedShifts = Number(entry.completed_shifts || 0);
        const revenuePerShift = completedShifts > 0
            ? Number(entry.total_revenue || 0) / completedShifts
            : 0;

        const revenueScore = completedShifts > 0
            ? clamp((revenuePerShift / maxRevenuePerShift) * 10, 0, 10)
            : 0;

        const checklistScore = completedShifts > 0
            ? (entry.evaluation_score > 0 ? clamp(entry.evaluation_score / 10, 0, 10) : 7)
            : 0;

        const maintenanceAssigned = Number(entry.maintenance_tasks_assigned || 0);
        const maintenanceCompleted = Number(entry.maintenance_tasks_completed || 0);
        const maintenanceBaseScore = completedShifts === 0
            ? 0
            : maintenanceAssigned > 0
                ? clamp((maintenanceCompleted / Math.max(maintenanceAssigned, 1)) * 10, 0, 10)
                : 10;
        const maintenancePenalty =
            Number(entry.maintenance_overdue_open_tasks || 0) * 0.8 +
            Number(entry.maintenance_rework_open_tasks || 0) * 0.6 +
            Number(entry.maintenance_stale_rework_tasks || 0) * 1 +
            Number(entry.maintenance_overdue_completed_tasks || 0) * 0.35 +
            Number(entry.maintenance_overdue_completed_days || 0) * 0.08;
        const maintenanceScore = clamp(maintenanceBaseScore - maintenancePenalty, 0, 10);

        const scheduleScore = completedShifts === 0
            ? 0
            : Number(entry.planned_shifts || 0) > 0
                ? clamp((completedShifts / Math.max(Number(entry.planned_shifts || 0), 1)) * 10, 0, 10)
                : 10;

        const disciplinePenalty =
            Number(entry.maintenance_overdue_open_tasks || 0) * 1.1 +
            Number(entry.maintenance_rework_open_tasks || 0) * 1 +
            Number(entry.maintenance_stale_rework_tasks || 0) * 1.5 +
            Number(entry.maintenance_overdue_completed_tasks || 0) * 0.5 +
            Number(entry.maintenance_overdue_completed_days || 0) * 0.12;
        const disciplineScore = completedShifts > 0
            ? clamp(10 - disciplinePenalty, 0, 10)
            : 0;

        const score = completedShifts > 0
            ? (
                revenueScore * 0.35 +
                checklistScore * 0.25 +
                maintenanceScore * 0.2 +
                scheduleScore * 0.1 +
                disciplineScore * 0.1
            )
            : 0;

        return {
            ...entry,
            rank: 0,
            score: Number(score.toFixed(1)),
            revenue_score: Number(revenueScore.toFixed(1)),
            checklist_score: Number(checklistScore.toFixed(1)),
            maintenance_score: Number(maintenanceScore.toFixed(1)),
            schedule_score: Number(scheduleScore.toFixed(1)),
            discipline_score: Number(disciplineScore.toFixed(1)),
            revenue_per_shift: Number(revenuePerShift.toFixed(2))
        };
    });

    return rankScheduledLeaderboardEntries(scored);
}

export function getLeaderboardBonusAmount(bonus: any, rank: number | null | undefined) {
    if (!rank || bonus?.type !== 'leaderboard_rank') {
        return 0;
    }

    const rankFrom = Number(bonus.rank_from ?? bonus.rank ?? 1) || 1;
    const rankTo = Number(bonus.rank_to ?? rankFrom) || rankFrom;

    if (rank < rankFrom || rank > rankTo) {
        return 0;
    }

    return Number(bonus.amount) || 0;
}

async function getLeaderboardSnapshotMeta(clubId: string | number, year: number, month: number): Promise<EmployeeLeaderboardSnapshotMeta> {
    const result = await query(
        `SELECT
            COUNT(*) FILTER (WHERE planned_shifts > 0)::int as entries_count,
            MAX(finalized_at) as finalized_at
         FROM employee_leaderboard_snapshots
         WHERE club_id = $1
           AND year = $2
           AND month = $3`,
        [clubId, year, month]
    );

    const row = result.rows[0];
    const entriesCount = Number(row?.entries_count || 0);

    return {
        is_frozen: entriesCount > 0,
        finalized_at: row?.finalized_at ? new Date(row.finalized_at).toISOString() : null,
        entries_count: entriesCount
    };
}

async function getFrozenLeaderboard(clubId: string | number, year: number, month: number): Promise<EmployeeLeaderboardEntry[]> {
    const result = await query(
        `SELECT
            user_id,
            full_name,
            completed_shifts,
            planned_shifts,
            total_revenue,
            total_hours,
            evaluation_score,
            maintenance_tasks_assigned,
            maintenance_tasks_completed,
            maintenance_overdue_open_tasks,
            maintenance_rework_open_tasks,
            maintenance_stale_rework_tasks,
            maintenance_overdue_completed_tasks,
            maintenance_overdue_completed_days,
            rank,
            score,
            revenue_score,
            checklist_score,
            maintenance_score,
            schedule_score,
            discipline_score,
            revenue_per_shift
         FROM employee_leaderboard_snapshots
         WHERE club_id = $1
           AND year = $2
           AND month = $3
         ORDER BY rank ASC, score DESC, full_name ASC`,
        [clubId, year, month]
    );

    const entries = result.rows.map((row: any) => ({
        user_id: String(row.user_id),
        full_name: row.full_name,
        completed_shifts: Number(row.completed_shifts || 0),
        planned_shifts: Number(row.planned_shifts || 0),
        total_revenue: Number(row.total_revenue || 0),
        total_hours: Number(row.total_hours || 0),
        evaluation_score: Number(row.evaluation_score || 0),
        maintenance_tasks_assigned: Number(row.maintenance_tasks_assigned || 0),
        maintenance_tasks_completed: Number(row.maintenance_tasks_completed || 0),
        maintenance_overdue_open_tasks: Number(row.maintenance_overdue_open_tasks || 0),
        maintenance_rework_open_tasks: Number(row.maintenance_rework_open_tasks || 0),
        maintenance_stale_rework_tasks: Number(row.maintenance_stale_rework_tasks || 0),
        maintenance_overdue_completed_tasks: Number(row.maintenance_overdue_completed_tasks || 0),
        maintenance_overdue_completed_days: Number(row.maintenance_overdue_completed_days || 0),
        rank: Number(row.rank || 0),
        score: Number(row.score || 0),
        revenue_score: Number(row.revenue_score || 0),
        checklist_score: Number(row.checklist_score || 0),
        maintenance_score: Number(row.maintenance_score || 0),
        schedule_score: Number(row.schedule_score || 0),
        discipline_score: Number(row.discipline_score || 0),
        revenue_per_shift: Number(row.revenue_per_shift || 0)
    }));

    return rankScheduledLeaderboardEntries(entries);
}

async function getLiveClubEmployeeLeaderboard(clubId: string | number, year: number, month: number) {
    const { start, end } = getMonthRange(year, month);
    const monthStr = month.toString().padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();

    const [
        employeesRes,
        templateRes,
        shiftsRes,
        plannedRes,
        evaluationsRes,
        maintenanceRes
    ] = await Promise.all([
        query(
            `SELECT ce.user_id, u.full_name
             FROM club_employees ce
             JOIN users u ON u.id = ce.user_id
             WHERE ce.club_id = $1
               AND ce.is_active = TRUE
               AND ce.dismissed_at IS NULL
               AND NOT u.phone_number LIKE '__system_%'`,
            [clubId]
        ),
        query(
            `SELECT schema
             FROM club_report_templates
             WHERE club_id = $1 AND is_active = TRUE
             ORDER BY created_at DESC
             LIMIT 1`,
            [clubId]
        ),
        query(
            `SELECT
                user_id,
                COALESCE(cash_income, cash_revenue, 0) as cash_income,
                COALESCE(card_income, card_revenue, 0) as card_income,
                total_hours,
                report_data
             FROM shifts
             WHERE club_id = $1
               AND check_in >= $2
               AND check_in <= $3
               AND status IN ('CLOSED', 'PAID', 'VERIFIED')`,
            [clubId, start, end]
        ),
        query(
            `SELECT user_id, COUNT(*)::int as planned_shifts
             FROM work_schedules
             WHERE club_id = $1
               AND date >= $2 AND date <= $3
             GROUP BY user_id`,
            [clubId, `${year}-${monthStr}-01`, `${year}-${monthStr}-${lastDay}`]
        ),
        query(
            `SELECT
                employee_id,
                AVG((total_score / NULLIF(max_score, 0)) * 100) as avg_score
             FROM evaluations
             WHERE club_id = $1
               AND evaluation_date >= $2
               AND evaluation_date <= $3
               AND max_score > 0
             GROUP BY employee_id`,
            [clubId, start, end]
        ),
        query(
            `WITH scoped_tasks AS (
                SELECT
                    mt.status,
                    mt.due_date,
                    mt.completed_by,
                    mt.completed_at,
                    mt.verification_status,
                    mt.verified_at,
                    mt.responsible_user_id_at_completion,
                    mt.overdue_days_at_completion,
                    mt.was_overdue,
                    COALESCE(
                        mt.assigned_user_id,
                        CASE
                            WHEN e.assignment_mode = 'DIRECT' THEN e.assigned_user_id
                            WHEN e.assignment_mode = 'FREE_POOL' THEN NULL
                            ELSE COALESCE(w.assigned_user_id, z.assigned_user_id)
                        END
                    ) AS effective_assignee
                FROM equipment_maintenance_tasks mt
                JOIN equipment e ON mt.equipment_id = e.id
                LEFT JOIN club_workstations w ON e.workstation_id = w.id
                LEFT JOIN club_zones z ON z.club_id = e.club_id AND z.name = w.zone
                WHERE e.club_id = $1
                  AND (
                    (mt.due_date >= $2 AND mt.due_date <= $3)
                    OR
                    (mt.status = 'COMPLETED' AND mt.completed_at >= $2 AND mt.completed_at <= $3)
                  )
            )
            SELECT *
            FROM scoped_tasks`,
            [clubId, start, end]
        )
    ]);

    const metricCategories = inferMetricCategories(templateRes.rows[0]?.schema);
    const shiftsByUser = new Map<string, any[]>();
    shiftsRes.rows.forEach((shift: any) => {
        const key = String(shift.user_id);
        const current = shiftsByUser.get(key) || [];
        current.push(shift);
        shiftsByUser.set(key, current);
    });

    const plannedMap = new Map<string, number>();
    plannedRes.rows.forEach((row: any) => {
        plannedMap.set(String(row.user_id), Number(row.planned_shifts || 0));
    });

    const evalMap = new Map<string, number>();
    evaluationsRes.rows.forEach((row: any) => {
        evalMap.set(String(row.employee_id), Number(row.avg_score || 0));
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maintenanceMap = new Map<string, {
        assigned: number;
        completed: number;
        overdueOpen: number;
        reworkOpen: number;
        staleRework: number;
        overdueCompleted: number;
        overdueDays: number;
    }>();

    const ensureMaintenanceBucket = (userId: string) => {
        if (!maintenanceMap.has(userId)) {
            maintenanceMap.set(userId, {
                assigned: 0,
                completed: 0,
                overdueOpen: 0,
                reworkOpen: 0,
                staleRework: 0,
                overdueCompleted: 0,
                overdueDays: 0
            });
        }
        return maintenanceMap.get(userId)!;
    };

    maintenanceRes.rows.forEach((task: any) => {
        const effectiveAssignee = task.effective_assignee ? String(task.effective_assignee) : null;
        const completedBy = task.completed_by ? String(task.completed_by) : null;
        const responsibleAtCompletion = task.responsible_user_id_at_completion ? String(task.responsible_user_id_at_completion) : null;
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        const completedAt = task.completed_at ? new Date(task.completed_at) : null;
        const isDueThisMonth = !!(dueDate && dueDate >= start && dueDate <= end);
        const isCompletedThisMonth = !!(completedAt && completedAt >= start && completedAt <= end);
        const isOverdueOpen = ['PENDING', 'IN_PROGRESS'].includes(task.status) && dueDate && dueDate < today;
        const isReworkOpen = task.status === 'IN_PROGRESS' && task.verification_status === 'REJECTED';
        const verifiedAtDate = task.verified_at ? new Date(task.verified_at) : today;
        const isStaleRework = isReworkOpen && verifiedAtDate <= new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);

        if (isDueThisMonth && task.status !== 'CANCELLED') {
            if (effectiveAssignee) {
                ensureMaintenanceBucket(effectiveAssignee).assigned += 1;
            } else if (completedBy) {
                ensureMaintenanceBucket(completedBy).assigned += 1;
            }
        }

        if (task.status === 'COMPLETED' && isCompletedThisMonth && completedBy) {
            ensureMaintenanceBucket(completedBy).completed += 1;
        }

        if (effectiveAssignee && isOverdueOpen) {
            ensureMaintenanceBucket(effectiveAssignee).overdueOpen += 1;
        }

        if (effectiveAssignee && isReworkOpen) {
            ensureMaintenanceBucket(effectiveAssignee).reworkOpen += 1;
        }

        if (effectiveAssignee && isStaleRework) {
            ensureMaintenanceBucket(effectiveAssignee).staleRework += 1;
        }

        if (responsibleAtCompletion && task.was_overdue && isCompletedThisMonth && isDueThisMonth) {
            const bucket = ensureMaintenanceBucket(responsibleAtCompletion);
            bucket.overdueCompleted += 1;
            bucket.overdueDays += Number(task.overdue_days_at_completion || 0);
        }
    });

    const metrics: EmployeeLeaderboardMetrics[] = employeesRes.rows.map((employee: any) => {
        const userId = String(employee.user_id);
        const userShifts = shiftsByUser.get(userId) || [];
        const totalRevenue = userShifts.reduce((sum, shift) => sum + calculateShiftIncome(shift, metricCategories), 0);
        const totalHours = userShifts.reduce((sum, shift) => sum + Number(shift.total_hours || 0), 0);
        const maintenance = maintenanceMap.get(userId);

        return {
            user_id: userId,
            full_name: employee.full_name,
            completed_shifts: userShifts.length,
            planned_shifts: plannedMap.get(userId) || 0,
            total_revenue: Number(totalRevenue.toFixed(2)),
            total_hours: Number(totalHours.toFixed(2)),
            evaluation_score: Number((evalMap.get(userId) || 0).toFixed(2)),
            maintenance_tasks_assigned: maintenance?.assigned || 0,
            maintenance_tasks_completed: maintenance?.completed || 0,
            maintenance_overdue_open_tasks: maintenance?.overdueOpen || 0,
            maintenance_rework_open_tasks: maintenance?.reworkOpen || 0,
            maintenance_stale_rework_tasks: maintenance?.staleRework || 0,
            maintenance_overdue_completed_tasks: maintenance?.overdueCompleted || 0,
            maintenance_overdue_completed_days: maintenance?.overdueDays || 0
        };
    });

    return buildEmployeeLeaderboard(metrics);
}

export async function getClubEmployeeLeaderboard(
    clubId: string | number,
    year: number,
    month: number,
    options?: { preferFrozen?: boolean }
) {
    const preferFrozen = options?.preferFrozen !== false;

    if (preferFrozen) {
        const meta = await getLeaderboardSnapshotMeta(clubId, year, month);
        if (meta.is_frozen) {
            return getFrozenLeaderboard(clubId, year, month);
        }
    }

    return getLiveClubEmployeeLeaderboard(clubId, year, month);
}

export async function getClubEmployeeLeaderboardState(clubId: string | number, year: number, month: number) {
    const meta = await getLeaderboardSnapshotMeta(clubId, year, month);
    const leaderboard = meta.is_frozen
        ? await getFrozenLeaderboard(clubId, year, month)
        : await getLiveClubEmployeeLeaderboard(clubId, year, month);

    return {
        leaderboard,
        meta
    };
}

export async function freezeClubEmployeeLeaderboard(clubId: string | number, year: number, month: number) {
    const leaderboard = await getLiveClubEmployeeLeaderboard(clubId, year, month);
    const client = await getClient();

    try {
        await client.query('BEGIN');
        await client.query(
            `DELETE FROM employee_leaderboard_snapshots
             WHERE club_id = $1
               AND year = $2
               AND month = $3`,
            [clubId, year, month]
        );

        for (const entry of leaderboard) {
            await client.query(
                `INSERT INTO employee_leaderboard_snapshots (
                    club_id,
                    user_id,
                    full_name,
                    year,
                    month,
                    rank,
                    score,
                    revenue_score,
                    checklist_score,
                    maintenance_score,
                    schedule_score,
                    discipline_score,
                    revenue_per_shift,
                    completed_shifts,
                    planned_shifts,
                    total_revenue,
                    total_hours,
                    evaluation_score,
                    maintenance_tasks_assigned,
                    maintenance_tasks_completed,
                    maintenance_overdue_open_tasks,
                    maintenance_rework_open_tasks,
                    maintenance_stale_rework_tasks,
                    maintenance_overdue_completed_tasks,
                    maintenance_overdue_completed_days,
                    finalized_at
                 ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17, $18,
                    $19, $20, $21, $22, $23, $24, $25, NOW()
                 )`,
                [
                    clubId,
                    entry.user_id,
                    entry.full_name,
                    year,
                    month,
                    entry.rank,
                    entry.score,
                    entry.revenue_score,
                    entry.checklist_score,
                    entry.maintenance_score,
                    entry.schedule_score,
                    entry.discipline_score,
                    entry.revenue_per_shift,
                    entry.completed_shifts,
                    entry.planned_shifts,
                    entry.total_revenue,
                    entry.total_hours,
                    entry.evaluation_score,
                    entry.maintenance_tasks_assigned,
                    entry.maintenance_tasks_completed,
                    entry.maintenance_overdue_open_tasks,
                    entry.maintenance_rework_open_tasks,
                    entry.maintenance_stale_rework_tasks,
                    entry.maintenance_overdue_completed_tasks,
                    entry.maintenance_overdue_completed_days
                ]
            );
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    return {
        leaderboard,
        meta: await getLeaderboardSnapshotMeta(clubId, year, month)
    };
}
