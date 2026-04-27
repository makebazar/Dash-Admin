import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { calculateMaintenanceOverduePenalty } from '@/lib/maintenance-penalties';
import { calculateMaintenanceQualityMetrics } from '@/lib/maintenance-kpi-quality';
import { getClubEmployeeLeaderboardState, getLeaderboardBonusAmount } from '@/lib/employee-leaderboard';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify employee belongs to club
        const employeeCheck = await query(
            `SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if (employeeCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get current month/year
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);
        const startOfMonthIso = startOfMonth.toISOString();
        const endOfMonthIso = endOfMonth.toISOString();

        // 1. Fetch metric categories to correctly calculate "Total Income"
        const templateRes = await query(
            `SELECT schema FROM club_report_templates 
             WHERE club_id = $1 AND is_active = TRUE 
             ORDER BY created_at DESC LIMIT 1`,
            [clubId]
        );
        const templateSchema = templateRes.rows[0]?.schema;
        const fields = Array.isArray(templateSchema) ? templateSchema : (templateSchema?.fields || []);
        const metricCategories: Record<string, string> = {};
        fields.forEach((f: any) => {
            const key = f.metric_key || f.key;
            if (key) {
                let category = f.field_type || f.calculation_category;
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
            }
        });

        // 2. Get scheme for KPI
        await query(`
            CREATE TABLE IF NOT EXISTS club_employee_roles (
                club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
                priority INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(club_id, user_id, role_id)
            );
            CREATE INDEX IF NOT EXISTS idx_club_employee_roles_club_user ON club_employee_roles(club_id, user_id);
        `);
        await query(`
            CREATE TABLE IF NOT EXISTS club_employee_role_preferences (
                club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                active_role_id INTEGER NULL REFERENCES roles(id) ON DELETE SET NULL,
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(club_id, user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_club_employee_role_preferences_club_user ON club_employee_role_preferences(club_id, user_id);
        `);
        await query(`
            CREATE TABLE IF NOT EXISTS employee_role_salary_assignments (
                club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
                scheme_id INTEGER NULL REFERENCES salary_schemes(id) ON DELETE SET NULL,
                assigned_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(club_id, user_id, role_id)
            );
            CREATE INDEX IF NOT EXISTS idx_employee_role_salary_assignments_club_user ON employee_role_salary_assignments(club_id, user_id);
        `);

        const prefRes = await query(
            `SELECT active_role_id FROM club_employee_role_preferences WHERE club_id = $1 AND user_id = $2 LIMIT 1`,
            [clubId, userId]
        );
        const preferredRoleId = prefRes.rows[0]?.active_role_id ? Number(prefRes.rows[0].active_role_id) : null;

        const roleListRes = await query(
            `SELECT role_id FROM club_employee_roles WHERE club_id = $1 AND user_id = $2 ORDER BY priority ASC LIMIT 1`,
            [clubId, userId]
        );
        const defaultRoleId = roleListRes.rows[0]?.role_id ? Number(roleListRes.rows[0].role_id) : null;

        const fallbackUserRoleRes = await query(`SELECT role_id FROM users WHERE id = $1 LIMIT 1`, [userId]);
        const fallbackUserRoleId = fallbackUserRoleRes.rows[0]?.role_id ? Number(fallbackUserRoleRes.rows[0].role_id) : null;

        const effectiveRoleId = Number.isFinite(preferredRoleId as any)
            ? preferredRoleId
            : Number.isFinite(defaultRoleId as any)
                ? defaultRoleId
                : Number.isFinite(fallbackUserRoleId as any)
                    ? fallbackUserRoleId
                    : null;

        const schemeRes = await query(
            `
            SELECT 
                ss.*,
                v.formula as scheme_formula
            FROM salary_schemes ss
            LEFT JOIN LATERAL (
                SELECT formula 
                FROM salary_scheme_versions 
                WHERE scheme_id = ss.id 
                ORDER BY version DESC 
                LIMIT 1
            ) v ON true
            WHERE ss.id = COALESCE(
                (SELECT scheme_id FROM employee_role_salary_assignments WHERE club_id = $2 AND user_id = $1 AND role_id = $3),
                (SELECT scheme_id FROM employee_salary_assignments WHERE club_id = $2 AND user_id = $1)
            )
              AND ss.club_id = $2
            LIMIT 1
            `,
            [userId, clubId, effectiveRoleId]
        );

        const rawScheme = schemeRes.rows[0];
        const formula = rawScheme?.scheme_formula || {};
        
        // Use formula bonuses if legacy ones are empty
        const period_bonuses_config = (Array.isArray(rawScheme?.period_bonuses) && rawScheme.period_bonuses.length > 0) 
            ? rawScheme.period_bonuses 
            : (formula.period_bonuses || []);

        const scheme = rawScheme
            ? { ...rawScheme, ...formula, period_bonuses: period_bonuses_config }
            : { amount: 0, standard_monthly_shifts: 15, period_bonuses: [] as any[] };
        
        const hourlyRate = parseFloat(scheme?.amount || '0');
        const standard_monthly_shifts = scheme?.standard_monthly_shifts || 15;
        const leaderboardState = await getClubEmployeeLeaderboardState(clubId, year, month);
        const leaderboard = leaderboardState.leaderboard;
        const leaderboardEntry = leaderboard.find(entry => entry.user_id === userId) || null;
        const leaderboardTop = leaderboard.slice(0, 5).map(entry => ({
            rank: entry.rank,
            user_id: entry.user_id,
            full_name: entry.full_name,
            score: entry.score
        }));
        const leaderboardLeader = leaderboardTop[0] || null;

        // 3. Get shifts data
        const shiftsRes = await query(
            `SELECT 
                id, cash_revenue, card_revenue, total_hours, report_data, calculated_salary, check_in, salary_snapshot, status
             FROM shifts
             WHERE user_id = $1 AND club_id = $2
               AND check_in >= $3 AND check_in <= $4
               AND status IN ('CLOSED', 'PAID', 'VERIFIED', 'ACTIVE')`,
            [userId, clubId, startOfMonthIso, endOfMonthIso]
        );

        const finishedShifts = shiftsRes.rows;

        // Get evaluations for checklist bonus
        const evalRes = await query(
            `SELECT AVG((total_score/max_score)*100) as avg_score 
             FROM evaluations 
             WHERE employee_id = $1 AND evaluation_date >= $2 AND evaluation_date <= $3`,
            [userId, startOfMonthIso, endOfMonthIso]
        );
        const avgScore = parseFloat(evalRes.rows[0]?.avg_score || '0');

        // Get maintenance stats (Sync with summary logic)
        const maintRes = await query(
            `WITH scoped_tasks AS (
                SELECT
                    mt.*,
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
                WHERE (
                    (
                        mt.due_date >= $2
                        AND mt.due_date <= $3
                    )
                    OR
                    (
                        mt.completed_by = $1
                        AND mt.status = 'COMPLETED'
                        AND mt.completed_at >= $2
                        AND mt.completed_at <= $3
                        AND mt.due_date < $2
                    )
                )
                AND (COALESCE(
                        mt.assigned_user_id,
                        CASE
                            WHEN e.assignment_mode = 'DIRECT' THEN e.assigned_user_id
                            WHEN e.assignment_mode = 'FREE_POOL' THEN NULL
                            ELSE COALESCE(w.assigned_user_id, z.assigned_user_id)
                        END
                    ) = $1 OR mt.completed_by = $1)
             )
             SELECT 
                COUNT(*) FILTER (WHERE due_date >= $2 AND due_date <= $3 AND status != 'CANCELLED' AND (effective_assignee = $1 OR status = 'COMPLETED')) as total_tasks,
                COUNT(*) FILTER (WHERE due_date >= $2 AND due_date <= $3 AND status = 'COMPLETED' AND completed_at >= $2 AND completed_at <= $3) as completed_tasks,
                COUNT(*) FILTER (WHERE status IN ('PENDING', 'IN_PROGRESS') AND due_date < CURRENT_DATE AND effective_assignee = $1) as overdue_open_tasks,
                COUNT(*) FILTER (WHERE status = 'IN_PROGRESS' AND verification_status = 'REJECTED' AND effective_assignee = $1) as rework_open_tasks,
                COUNT(*) FILTER (
                    WHERE status = 'IN_PROGRESS'
                      AND verification_status = 'REJECTED'
                      AND effective_assignee = $1
                      AND COALESCE(verified_at::date, CURRENT_DATE) <= CURRENT_DATE - 3
                ) as stale_rework_tasks,
                COALESCE(SUM(bonus_earned) FILTER (WHERE status = 'COMPLETED' AND completed_at >= $2 AND completed_at <= $3), 0) as bonus
             FROM scoped_tasks`,
            [userId, startOfMonthIso, endOfMonthIso]
        );
        const maintTasksTotal = parseInt(maintRes.rows[0]?.total_tasks || '0');
        const maintTasksCompleted = parseInt(maintRes.rows[0]?.completed_tasks || '0');
        const maintOverdueOpen = parseInt(maintRes.rows[0]?.overdue_open_tasks || '0');
        const maintReworkOpen = parseInt(maintRes.rows[0]?.rework_open_tasks || '0');
        const maintStaleRework = parseInt(maintRes.rows[0]?.stale_rework_tasks || '0');
        const maintQualityMetrics = calculateMaintenanceQualityMetrics({
            assigned: maintTasksTotal,
            completed: maintTasksCompleted,
            dueByNow: maintTasksTotal,
            completedDueByNow: maintTasksCompleted,
            overdueOpenTasks: maintOverdueOpen,
            reworkOpenTasks: maintReworkOpen,
            staleReworkTasks: maintStaleRework
        });
        const maintEfficiency = maintQualityMetrics.efficiency;

        const overdueHistoryRes = await query(
            `SELECT overdue_days_at_completion, was_overdue, bonus_earned
             FROM equipment_maintenance_tasks
             WHERE responsible_user_id_at_completion = $1
               AND status = 'COMPLETED'
               AND completed_at >= $2
               AND completed_at <= $3`,
            [userId, startOfMonthIso, endOfMonthIso]
        );

        const monthlyBonusRes = await query(
            `SELECT COALESCE(SUM(bonus_amount), 0) as total_monthly_bonus
             FROM maintenance_monthly_bonuses
             WHERE club_id = $1 AND user_id = $2 AND year = $3 AND month = $4`,
            [clubId, userId, year, month]
        );
        const totalManualMaintBonus = parseFloat(monthlyBonusRes.rows[0]?.total_monthly_bonus || '0');

        const barDeductionsRes = await query(
            `SELECT COALESCE(SUM(i.quantity * i.selling_price_snapshot), 0) as total
             FROM shift_receipts r
             JOIN shift_receipt_items i ON i.receipt_id = r.id
             WHERE r.club_id = $1
               AND r.salary_target_user_id = $2
               AND r.payment_type = 'salary'
               AND r.voided_at IS NULL
               AND r.created_at >= $3
               AND r.created_at <= $4`,
            [clubId, userId, startOfMonthIso, endOfMonthIso]
        );
        const totalBarDeductions = parseFloat(barDeductionsRes.rows[0]?.total || '0');

        let totalCalculatedSalary = 0;
        let totalHours = 0;
        let todayHours = 0;
        let weekHours = 0;
        let totalBaseSalary = 0;
        let totalShiftBonuses = 0;
        let completed_shifts_count = 0;
        const monthlyMetrics: Record<string, number> = { total_revenue: 0, total_hours: 0 };
        const activeShiftMetrics: Record<string, number> = { total_revenue: 0, total_hours: 0 };

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // Monday
        startOfWeek.setHours(0, 0, 0, 0);

        finishedShifts.forEach(s => {
            const hours = parseFloat(s.total_hours || 0);
            const isActive = s.status === 'ACTIVE';
            if (!isActive) completed_shifts_count++;

            totalHours += hours;
            
            // USE CALCULATED SALARY FROM SHIFT (WHICH USES THE TEMPLATE)
            totalCalculatedSalary += parseFloat(s.calculated_salary || 0);

            // Extract breakdown from snapshot for more accuracy if available
            const snapshot = typeof s.salary_snapshot === 'string' ? JSON.parse(s.salary_snapshot) : s.salary_snapshot || {};
            const base = parseFloat(snapshot.breakdown?.base || snapshot.base || 0);
            const bonuses = snapshot.breakdown?.bonuses || snapshot.bonuses || [];
            
            // If we have a snapshot, use it, otherwise fallback to calculated_salary (which is base + bonuses)
            if (snapshot.breakdown || snapshot.base) {
                totalBaseSalary += base;
                totalShiftBonuses += bonuses
                    .filter((b: any) => b.type === 'SHIFT_BONUS' || b.type === 'CHECKLIST_BONUS')
                    .reduce((bSum: number, b: any) => bSum + (parseFloat(b.amount) || 0), 0);
            } else {
                // Legacy or active shifts might not have full snapshot yet
                totalBaseSalary += parseFloat(s.calculated_salary || 0); 
            }

            const shiftDate = new Date(s.check_in);
            if (shiftDate.toDateString() === now.toDateString()) {
                todayHours += hours;
            }
            if (shiftDate >= startOfWeek) {
                weekHours += hours;
            }

            // Metric tracking for KPI
            let shiftIncome = 0;
            const cash = parseFloat(s.cash_revenue || 0);
            const card = parseFloat(s.card_revenue || 0);

            if (metricCategories['cash_income'] === 'INCOME' || !metricCategories['cash_income']) shiftIncome += cash;
            if (metricCategories['card_income'] === 'INCOME' || !metricCategories['card_income']) shiftIncome += card;

            if (s.report_data) {
                const data = typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data;
                Object.keys(data).forEach(key => {
                    const val = parseFloat(data[key] || 0);
                    if (metricCategories[key] === 'INCOME' && key !== 'cash_income' && key !== 'card_income') {
                        shiftIncome += val;
                    }
                    monthlyMetrics[key] = (monthlyMetrics[key] || 0) + val;
                    if (isActive) activeShiftMetrics[key] = (activeShiftMetrics[key] || 0) + val;
                });
            }
            monthlyMetrics.total_revenue += shiftIncome;
            if (isActive) activeShiftMetrics.total_revenue += shiftIncome;
        });

        // 4. Calculate All Bonuses Separately
        const revenueKpiBreakdown: any[] = [];
        
        let checklistMonthlyBonusVirtual = 0;
        let checklistMonthlyBonusReal = 0;
        let maintenanceBonusVirtual = 0;
        let maintenanceBonusReal = 0;
        let maintenancePenaltyVirtual = 0;
        let maintenancePenaltyReal = 0;
        let leaderboardBonusVirtual = 0;
        let leaderboardBonusReal = 0;
        const leaderboardBonusBreakdown: Array<{
            name: string;
            amount: number;
            rank: number;
            score: number;
            is_virtual: boolean;
        }> = [];

        // 4.1. Revenue KPI Bonuses (legacy + formula)
        const all_progressive_bonuses = [
            ...(Array.isArray(period_bonuses_config) ? period_bonuses_config : []),
            ...((scheme.bonuses || []).filter((b: any) =>
                b.type === 'progressive_bonus' || b.type === 'progressive_percent' || b.type === 'PROGRESSIVE'
            ))
        ]

        all_progressive_bonuses.forEach((bonus: any) => {
                const metric_key = bonus.metric_key || bonus.source || 'total_revenue';

                // SYNC WITH KPI: Use revenue from CLOSED shifts only for scaling bonuses
                const value_for_scaling_bonus = metric_key === 'total_revenue' ? (monthlyMetrics.total_revenue - (activeShiftMetrics.total_revenue || 0)) : 
                                              ((monthlyMetrics[metric_key] || 0) - (activeShiftMetrics[metric_key] || 0));

                let is_met = false;
                let metPercent = 0;
                let earned = 0;

                const mode = bonus.bonus_mode || bonus.mode || 'MONTH';

                if ((bonus.type === 'PROGRESSIVE' || bonus.type === 'progressive_percent' || bonus.type === 'progressive_bonus') && bonus.thresholds?.length) {
                    const sorted = [...bonus.thresholds].sort((a: any, b: any) => (a.from || 0) - (b.from || 0));
                    
                    for (let i = sorted.length - 1; i >= 0; i--) {
                        const scaled_threshold = mode === 'SHIFT'
                            ? sorted[i].from * completed_shifts_count
                            : (sorted[i].from / standard_monthly_shifts) * completed_shifts_count;

                        if (completed_shifts_count > 0 && value_for_scaling_bonus >= scaled_threshold) {
                            metPercent = sorted[i].percent;
                            is_met = true;
                            break;
                        }
                    }
                    if (is_met && metPercent > 0) {
                        earned = value_for_scaling_bonus * (metPercent / 100);
                    }
                } else {
                    const target_value = mode === 'SHIFT' 
                        ? (bonus.target_per_shift || 0) * completed_shifts_count 
                        : (bonus.target_value || 0) / standard_monthly_shifts * completed_shifts_count;
                    
                    is_met = completed_shifts_count > 0 && value_for_scaling_bonus >= target_value;
                    if (is_met) {
                        if (bonus.reward_type === 'PERCENT') {
                            earned = value_for_scaling_bonus * (bonus.reward_value / 100);
                            metPercent = bonus.reward_value;
                        } else {
                            earned = bonus.reward_value;
                            metPercent = 100; 
                        }
                    }
                }

                if (earned > 0) {
                    revenueKpiBreakdown.push({
                        name: bonus.name || 'KPI Выручка',
                        amount: earned,
                        metPercent: metPercent,
                        is_virtual: bonus.payout_type === 'VIRTUAL_BALANCE'
                    });
                }
            });

        // 4.2. Checklist Bonuses (Monthly)
        const allChecklistConfigs = (scheme.bonuses || []).filter((b: any) => b.type === 'checklist');
        allChecklistConfigs.forEach((b: any) => {
            let earned = 0;
            if (b.use_thresholds && b.checklist_thresholds?.length) {
                const sorted = [...b.checklist_thresholds].sort((x, y) => (Number(y.min_score) || 0) - (Number(x.min_score) || 0));
                const met = sorted.find(t => avgScore >= (Number(t.min_score) || 0));
                if (met) earned = Number(met.amount) || 0;
            } else if (avgScore >= (Number(b.min_score) || 0)) {
                earned = Number(b.amount) || 0;
            }

            if (earned > 0) {
                if (b.mode === 'MONTH') {
                    if (b.payout_type === 'VIRTUAL_BALANCE') {
                        checklistMonthlyBonusVirtual += earned;
                    } else {
                        checklistMonthlyBonusReal += earned;
                    }
                }
            }
        });

        // 4.3. Maintenance Bonuses (Monthly)
        const maintConfig = (scheme.bonuses || []).find((b: any) => b.type === 'maintenance_kpi');
        if (maintConfig) {
            let earned = 0;
            if (maintConfig.calculation_mode === 'MONTHLY' && maintConfig.efficiency_thresholds?.length) {
                const sorted = [...maintConfig.efficiency_thresholds].sort((x, y) => (Number(y.from_percent) || 0) - (Number(x.from_percent) || 0));
                const achievedTier = sorted.find((t: any) => maintEfficiency >= (Number(t.from_percent) || 0));
                if (achievedTier) {
                    earned = Number(achievedTier.amount) || 0;
                }
            } else {
                earned = parseFloat(maintRes.rows[0]?.bonus || '0') + totalManualMaintBonus;
            }

            const penaltyMeta = calculateMaintenanceOverduePenalty(maintConfig, overdueHistoryRes.rows);
            const appliedPenalty = Math.min(earned, penaltyMeta.total);
            const finalEarned = Math.max(0, earned - appliedPenalty);

            if (earned > 0) {
                if (maintConfig.payout_type === 'VIRTUAL_BALANCE') {
                    maintenanceBonusVirtual += finalEarned;
                    maintenancePenaltyVirtual += appliedPenalty;
                } else {
                    maintenanceBonusReal += finalEarned;
                    maintenancePenaltyReal += appliedPenalty;
                }
            }
        }

        const leaderboardConfigs = (scheme.bonuses || []).filter((b: any) => b.type === 'leaderboard_rank');
        leaderboardConfigs.forEach((bonus: any) => {
            if (!leaderboardEntry) return;

            const amount = getLeaderboardBonusAmount(bonus, leaderboardEntry.rank);
            if (amount <= 0) return;

            const isVirtual = bonus.payout_type === 'VIRTUAL_BALANCE';
            if (isVirtual) {
                leaderboardBonusVirtual += amount;
            } else {
                leaderboardBonusReal += amount;
            }

            leaderboardBonusBreakdown.push({
                name: bonus.name || 'Бонус за место в рейтинге',
                amount,
                rank: leaderboardEntry.rank,
                score: leaderboardEntry.score,
                is_virtual: isVirtual
            });
        });

        const revenueKpiBonusReal = revenueKpiBreakdown.filter(b => !b.is_virtual).reduce((sum, b) => sum + b.amount, 0);
        const revenueKpiBonusVirtual = revenueKpiBreakdown.filter(b => b.is_virtual).reduce((sum, b) => sum + b.amount, 0);
        
        const totalKpiBonusReal = revenueKpiBonusReal + checklistMonthlyBonusReal + maintenanceBonusReal + leaderboardBonusReal;
        const totalKpiBonusVirtual = revenueKpiBonusVirtual + checklistMonthlyBonusVirtual + maintenanceBonusVirtual + leaderboardBonusVirtual;
        
        // Month earnings: Sum of calculated salary for closed shifts + ANY monthly bonuses reached so far
        const monthEarnings = totalCalculatedSalary + totalKpiBonusReal - totalBarDeductions;

        // CRITICAL: Ensure we are sending ALL pieces of info needed for the breakdown
        const breakdown = {
            base_salary: totalBaseSalary,
            shift_bonuses: totalShiftBonuses,
            checklist_bonuses: checklistMonthlyBonusReal,
            maintenance_bonuses: maintenanceBonusReal,
            maintenance_penalty: maintenancePenaltyReal,
            leaderboard_bonuses: leaderboardBonusBreakdown,
            revenue_kpi_bonuses: revenueKpiBonusReal,
            bar_deductions: totalBarDeductions,
            revenue_kpi_breakdown: revenueKpiBreakdown, 
            total_kpi_bonuses: totalKpiBonusReal,
            virtual_bonuses: {
                checklist: checklistMonthlyBonusVirtual,
                maintenance: maintenanceBonusVirtual,
                maintenance_penalty: maintenancePenaltyVirtual,
                leaderboard: leaderboardBonusVirtual,
                revenue: revenueKpiBonusVirtual,
                total: totalKpiBonusVirtual
            }
        };

        return NextResponse.json({
            today_hours: todayHours,
            week_hours: weekHours,
            total_hours: totalHours,
            month_earnings: monthEarnings,
            hourly_rate: hourlyRate,
            kpi_bonus: totalKpiBonusReal,
            breakdown: breakdown,
            leaderboard: leaderboardEntry ? {
                rank: leaderboardEntry.rank,
                score: leaderboardEntry.score,
                total_participants: leaderboard.length,
                is_frozen: leaderboardState.meta.is_frozen,
                finalized_at: leaderboardState.meta.finalized_at,
                leader: leaderboardLeader,
                top: leaderboardTop,
                breakdown: {
                    revenue: leaderboardEntry.revenue_score,
                    checklist: leaderboardEntry.checklist_score,
                    maintenance: leaderboardEntry.maintenance_score,
                    schedule: leaderboardEntry.schedule_score,
                    discipline: leaderboardEntry.discipline_score
                }
            } : null
        });

    } catch (error) {
        console.error('Get Employee Stats Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
