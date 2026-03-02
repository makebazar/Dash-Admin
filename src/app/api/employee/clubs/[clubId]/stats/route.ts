import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

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

        // 2. Get hourly rate and scheme for KPI
        const schemeRes = await query(
            `SELECT 
                ss.*, 
                (r.default_kpi_settings->>'base_rate')::numeric as role_rate,
                v.formula as scheme_formula
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.id
             LEFT JOIN employee_salary_assignments esa ON u.id = esa.user_id AND esa.club_id = $2
             LEFT JOIN salary_schemes ss ON ss.id = esa.scheme_id
             LEFT JOIN LATERAL (
                 SELECT formula 
                 FROM salary_scheme_versions 
                 WHERE scheme_id = ss.id 
                 ORDER BY version DESC 
                 LIMIT 1
             ) v ON true
             WHERE u.id = $1
             ORDER BY esa.assigned_at DESC LIMIT 1`,
            [userId, clubId]
        );

        const rawScheme = schemeRes.rows[0];
        const formula = rawScheme?.scheme_formula || {};
        const scheme = { ...rawScheme, ...formula };
        
        const hourlyRate = parseFloat(scheme?.role_rate || scheme?.amount || '150');
        const period_bonuses = scheme?.period_bonuses || [];
        const standard_monthly_shifts = scheme?.standard_monthly_shifts || 15;

        // 3. Get shifts data
        const shiftsRes = await query(
            `SELECT 
                id, cash_revenue, card_revenue, total_hours, report_data, calculated_salary, check_in, salary_snapshot
             FROM shifts
             WHERE user_id = $1 AND club_id = $2
               AND check_in >= $3 AND check_in <= $4
               AND status IN ('CLOSED', 'PAID', 'VERIFIED', 'ACTIVE')`,
            [userId, clubId, startOfMonth, endOfMonth]
        );

        const finishedShifts = shiftsRes.rows;
        const total_shifts_count = finishedShifts.length;

        // Get evaluations for checklist bonus
        const evalRes = await query(
            `SELECT AVG((total_score/max_score)*100) as avg_score 
             FROM evaluations 
             WHERE employee_id = $1 AND evaluation_date >= $2 AND evaluation_date <= $3`,
            [userId, startOfMonth, endOfMonth]
        );
        const avgScore = parseFloat(evalRes.rows[0]?.avg_score || '0');

        // Get maintenance stats (Sync with summary logic)
        const maintRes = await query(
            `SELECT 
                COUNT(*) as total_tasks,
                COUNT(*) FILTER (WHERE status = 'COMPLETED' AND completed_at >= $2 AND completed_at <= $3) as completed_tasks,
                COALESCE(SUM(bonus_earned) FILTER (WHERE status = 'COMPLETED' AND completed_at >= $2 AND completed_at <= $3), 0) as bonus
             FROM equipment_maintenance_tasks
             WHERE 
                (
                    ((assigned_user_id = $1 OR completed_by = $1) AND due_date >= $2 AND due_date <= $3)
                    OR
                    (completed_by = $1 AND status = 'COMPLETED' AND completed_at >= $2 AND completed_at <= $3 AND due_date < $2)
                )`,
            [userId, startOfMonth, endOfMonth]
        );
        const maintTasksTotal = parseInt(maintRes.rows[0]?.total_tasks || '0');
        const maintTasksCompleted = parseInt(maintRes.rows[0]?.completed_tasks || '0');
        const maintEfficiency = maintTasksTotal > 0 ? (maintTasksCompleted / maintTasksTotal) * 100 : (maintTasksCompleted > 0 ? 100 : 0);

        const monthlyBonusRes = await query(
            `SELECT COALESCE(SUM(bonus_amount), 0) as total_monthly_bonus
             FROM maintenance_monthly_bonuses
             WHERE club_id = $1 AND user_id = $2 AND year = $3 AND month = $4`,
            [clubId, userId, year, month]
        );
        const totalManualMaintBonus = parseFloat(monthlyBonusRes.rows[0]?.total_monthly_bonus || '0');

        let totalCalculatedSalary = 0;
        let totalHours = 0;
        let todayHours = 0;
        let weekHours = 0;
        let totalBaseSalary = 0;
        let totalShiftBonuses = 0;
        const monthlyMetrics: Record<string, number> = { total_revenue: 0, total_hours: 0 };

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // Monday
        startOfWeek.setHours(0, 0, 0, 0);

        finishedShifts.forEach(s => {
            const hours = parseFloat(s.total_hours || 0);
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
                });
            }
            monthlyMetrics.total_revenue += shiftIncome;
        });

        // 4. Calculate All Bonuses Separately
        let revenueKpiBonus = 0;
        let checklistMonthlyBonus = 0;
        let maintenanceBonus = 0;
        
        let revenueKpiBonusVirtual = 0;
        let checklistMonthlyBonusVirtual = 0;
        let maintenanceBonusVirtual = 0;
        
        // 4.1. Period Revenue Bonuses
        if (Array.isArray(period_bonuses)) {
            period_bonuses.forEach((bonus: any) => {
                const metric_key = bonus.metric_key || 'total_revenue';
                const current_value = monthlyMetrics[metric_key] ||
                    (metric_key === 'total_revenue' ? monthlyMetrics.total_revenue : 0);

                if (bonus.type === 'PROGRESSIVE' && bonus.thresholds?.length) {
                    const sorted = [...bonus.thresholds].sort((a: any, b: any) => (a.from || 0) - (b.from || 0));
                    const mode = bonus.bonus_mode || 'MONTH';

                    let metPercent = 0;
                    for (let i = sorted.length - 1; i >= 0; i--) {
                        const scaled_threshold = mode === 'SHIFT'
                            ? sorted[i].from * total_shifts_count
                            : (sorted[i].from / standard_monthly_shifts) * total_shifts_count;

                        if (total_shifts_count > 0 && current_value >= scaled_threshold) {
                            metPercent = sorted[i].percent;
                            break;
                        }
                    }
                    if (metPercent > 0) {
                        const earned = current_value * (metPercent / 100);
                        if (bonus.payout_type === 'VIRTUAL_BALANCE') {
                            revenueKpiBonusVirtual += earned;
                        } else {
                            revenueKpiBonus += earned;
                        }
                    }
                }
            });
        }

        // 4.2. Checklist Bonuses (Monthly)
        const checklistBonuses = (scheme.bonuses || []).filter((b: any) => b.type === 'checklist' && b.mode === 'MONTH');
        checklistBonuses.forEach((b: any) => {
            let earned = 0;
            if (b.use_thresholds && b.checklist_thresholds?.length) {
                const sorted = [...b.checklist_thresholds].sort((x, y) => (Number(y.min_score) || 0) - (Number(x.min_score) || 0));
                const met = sorted.find(t => avgScore >= (Number(t.min_score) || 0));
                if (met) earned = Number(met.amount) || 0;
            } else if (avgScore >= (Number(b.min_score) || 0)) {
                earned = Number(b.amount) || 0;
            }

            if (earned > 0) {
                if (b.payout_type === 'VIRTUAL_BALANCE') {
                    checklistMonthlyBonusVirtual += earned;
                } else {
                    checklistMonthlyBonus += earned;
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

            if (earned > 0) {
                if (maintConfig.payout_type === 'VIRTUAL_BALANCE') {
                    maintenanceBonusVirtual += earned;
                } else {
                    maintenanceBonus += earned;
                }
            }
        }

        const totalKpiBonusReal = revenueKpiBonus + checklistMonthlyBonus + maintenanceBonus;
        const totalKpiBonusVirtual = revenueKpiBonusVirtual + checklistMonthlyBonusVirtual + maintenanceBonusVirtual;
        const monthEarnings = totalCalculatedSalary + totalKpiBonusReal;

        // Calculate breakdown
        const breakdown = {
            base_salary: totalBaseSalary,
            shift_bonuses: totalShiftBonuses,
            checklist_bonuses: checklistMonthlyBonus,
            maintenance_bonuses: maintenanceBonus,
            revenue_kpi_bonuses: revenueKpiBonus,
            total_kpi_bonuses: totalKpiBonusReal,
            virtual_bonuses: {
                checklist: checklistMonthlyBonusVirtual,
                maintenance: maintenanceBonusVirtual,
                revenue: revenueKpiBonusVirtual,
                total: totalKpiBonusVirtual
            }
        };

        return NextResponse.json({
            today_hours: todayHours,
            week_hours: weekHours,
            total_hours: totalHours,
            week_earnings: weekHours * hourlyRate, 
            month_earnings: monthEarnings,
            hourly_rate: hourlyRate,
            kpi_bonus: totalKpiBonusReal,
            breakdown
        });

    } catch (error) {
        console.error('Get Employee Stats Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
