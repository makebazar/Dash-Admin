import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { calculateMaintenanceOverduePenalty } from '@/lib/maintenance-penalties';
import { requireClubFullAccess } from '@/lib/club-api-access';

export const dynamic = 'force-dynamic';

// POST /api/clubs/[clubId]/equipment/maintenance/recalculate-bonuses
export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const adminUserId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!adminUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await requireClubFullAccess(clubId);

        const { searchParams } = new URL(request.url);
        const now = new Date();
        const month = parseInt(searchParams.get('month') || (now.getMonth() + 1).toString());
        const year = parseInt(searchParams.get('year') || now.getFullYear().toString());

        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        // 1. Get all completed tasks for the month
        const tasksToRecalculate = await query(
            `SELECT 
                mt.id as task_id,
                mt.completed_by as user_id,
                mt.completed_at,
                mt.due_date,
                e.type as equipment_type
             FROM equipment_maintenance_tasks mt
             JOIN equipment e ON mt.equipment_id = e.id
             WHERE e.club_id = $1
               AND mt.status = 'COMPLETED'
               AND mt.completed_at >= $2
               AND mt.completed_at <= $3`,
            [clubId, startOfMonth, endOfMonth]
        );

        if (tasksToRecalculate.rows.length === 0) {
            return NextResponse.json({ 
                success: true, 
                message: 'Нет выполненных задач для перерасчета в этом месяце.', 
                updated_count: 0 
            });
        }

        let updatedCount = 0;

        // 2. Group tasks by user to fetch salary scheme only once per user
        const tasksByUser = tasksToRecalculate.rows.reduce((acc, task) => {
            if (!acc[task.user_id]) {
                acc[task.user_id] = [];
            }
            acc[task.user_id].push(task);
            return acc;
        }, {} as Record<string, any[]>);


        // 3. Iterate over users and recalculate bonuses for their tasks
        for (const userId in tasksByUser) {
            const userTasks = tasksByUser[userId];

            // Find the correct salary scheme for the user (role-based or direct)
            const rolesRes = await query(
                `SELECT role_id FROM club_employee_roles WHERE club_id = $1 AND user_id = $2 ORDER BY priority ASC`,
                [clubId, userId]
            );
    
            let schemeFormula: any = null;
    
            if (rolesRes.rows.length > 0) {
                for (const role of rolesRes.rows) {
                    const roleSchemeRes = await query(
                        `SELECT sv.formula
                         FROM employee_role_salary_assignments ersa
                         JOIN salary_schemes ss ON ersa.scheme_id = ss.id
                         JOIN salary_scheme_versions sv ON sv.scheme_id = ss.id
                         WHERE ersa.user_id = $1 AND ersa.club_id = $2 AND ersa.role_id = $3 AND ss.id IS NOT NULL
                         ORDER BY sv.version DESC
                         LIMIT 1`,
                        [userId, clubId, role.role_id]
                    );
                    if (roleSchemeRes.rows.length > 0) {
                        schemeFormula = roleSchemeRes.rows[0]?.formula;
                        break; 
                    }
                }
            }
    
            if (!schemeFormula) {
                const userSchemeRes = await query(
                    `SELECT sv.formula
                     FROM employee_salary_assignments esa
                     JOIN salary_schemes ss ON esa.scheme_id = ss.id
                     JOIN salary_scheme_versions sv ON sv.scheme_id = ss.id
                     WHERE esa.user_id = $1 AND esa.club_id = $2 AND ss.id IS NOT NULL
                     ORDER BY sv.version DESC
                     LIMIT 1`,
                    [userId, clubId]
                );
                if (userSchemeRes.rows.length > 0) {
                    schemeFormula = userSchemeRes.rows[0]?.formula;
                }
            }

            const finalSchemeFormula = schemeFormula || {};
            const bonuses = finalSchemeFormula.bonuses || [];
            const kpiBonus = bonuses.find((b: any) => b.type === 'maintenance_kpi' || b.type === 'MAINTENANCE_KPI');

            if (!kpiBonus) {
                continue;
            }

            // 4. Recalculate for each task of this user
            for (const task of userTasks) {
                const perTypeRewards = kpiBonus.per_equipment_type_rewards || kpiBonus.equipment_type_rewards || kpiBonus.equipment_types || [];
                const equipmentTypeCode = task.equipment_type;
                
                const typeReward = perTypeRewards.find((r: any) => {
                    const rewardCode = (r.equipment_type_code || r.type_code || r.code || r.type || '').trim().toLowerCase();
                    const eqCode = (equipmentTypeCode || '').trim().toLowerCase();
                    return rewardCode === eqCode;
                });
                
                const baseValue = typeReward 
                    ? Number(typeReward.amount || typeReward.reward || typeReward.value || typeReward.bonus || 0) 
                    : Number(kpiBonus.amount) || 0;
    
                const bonusEarned = baseValue;

                const overdueDaysAtCompletion = Math.max(0, Math.floor(
                    (new Date(new Date(task.completed_at).toDateString()).getTime() - new Date(new Date(task.due_date).toDateString()).getTime()) / (1000 * 60 * 60 * 24)
                ));
                const wasOverdue = overdueDaysAtCompletion > 0;

                const overduePenaltyPreview = calculateMaintenanceOverduePenalty(
                    {
                        overdue_tolerance_days: kpiBonus?.overdue_tolerance_days,
                        overdue_penalty_mode: kpiBonus?.overdue_penalty_mode,
                        overdue_penalty_amount: kpiBonus?.overdue_penalty_amount,
                        late_penalty_multiplier: kpiBonus?.late_penalty_multiplier
                    },
                    [{ overdue_days_at_completion: overdueDaysAtCompletion, bonus_earned: bonusEarned, was_overdue: wasOverdue }]
                );
        
                const overduePenalty = overduePenaltyPreview.total;

                // Save full rate (bonusEarned) and penalty separately
                await query(
                    `UPDATE equipment_maintenance_tasks
                     SET bonus_earned = $1, overdue_penalty = $2, overdue_days_at_completion = $3, was_overdue = $4
                     WHERE id = $5`,
                    [bonusEarned, overduePenalty, overdueDaysAtCompletion, wasOverdue, task.task_id]
                );
                updatedCount++;
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Перерасчет завершен. Обновлено задач: ${updatedCount}.`, 
            updated_count: updatedCount 
        });

    } catch (error: any) {
        console.error('Recalculate Bonuses Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
