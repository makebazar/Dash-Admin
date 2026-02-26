import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Get KPI Config from Active Salary Scheme
        const schemeRes = await query(
            `SELECT sv.formula
             FROM employee_salary_assignments esa
             JOIN salary_schemes ss ON esa.scheme_id = ss.id
             JOIN salary_scheme_versions sv ON sv.scheme_id = ss.id
             WHERE esa.user_id = $1 AND esa.club_id = $2
             ORDER BY sv.version DESC
             LIMIT 1`,
            [userId, clubId]
        );
        
        const schemeFormula = schemeRes.rows[0]?.formula || {};
        const kpiConfig = schemeFormula.maintenance_kpi || null;

        if (!kpiConfig || !kpiConfig.enabled) {
            return NextResponse.json(null);
        }

        // 2. Calculate Stats for Current Month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        // Fetch all tasks for this user in this month (assigned OR completed by them)
        // Including tasks from "Free Pool" that they completed
        const statsRes = await query(
            `SELECT 
                COUNT(*) as total_tasks,
                COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_tasks,
                SUM(bonus_earned) FILTER (WHERE status = 'COMPLETED') as raw_bonus,
                COUNT(*) FILTER (WHERE status = 'COMPLETED' AND applied_kpi_multiplier < 1) as late_tasks
             FROM equipment_maintenance_tasks
             WHERE 
                (assigned_user_id = $1 OR completed_by = $1)
                AND due_date >= $2 AND due_date < $3`,
            [userId, startOfMonth, nextMonth]
        );

        const stats = statsRes.rows[0];
        const total = Number(stats.total_tasks) || 0;
        const completed = Number(stats.completed_tasks) || 0;
        const rawBonus = Number(stats.raw_bonus) || 0;
        
        let efficiencyPercent = total > 0 ? (completed / total) * 100 : 100;
        
        // Determine Rating Multiplier based on efficiency
        let ratingMultiplier = 1.0;
        const target = kpiConfig.target_efficiency_percent || 90;
        const min = kpiConfig.min_efficiency_percent || 50;

        if (efficiencyPercent >= target) {
            ratingMultiplier = 1.2; // Super Bonus
        } else if (efficiencyPercent < min) {
            ratingMultiplier = 0.0; // Penalty
        } else if (efficiencyPercent < 80) {
            ratingMultiplier = 0.8; // Lower
        }

        const projectedBonus = rawBonus * ratingMultiplier;

        return NextResponse.json({
            efficiency_percent: efficiencyPercent,
            rating_multiplier: ratingMultiplier,
            projected_bonus: projectedBonus,
            completed_tasks: completed,
            total_tasks: total
        });

    } catch (error) {
        console.error('Get Equipment Rating Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}