import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { freezeClubEmployeeLeaderboard } from '@/lib/employee-leaderboard';
import { calculateSalary } from '@/lib/salary-calculator';

export async function POST(request: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
    try {
        const { clubId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const ownerCheck = await query(`SELECT 1 FROM clubs WHERE id=$1 AND owner_id=$2`, [clubId, userId]);
        if (ownerCheck.rowCount === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();
        const { employee_id, amount, payment_method = 'CASH', month, year, notes, payment_type = 'salary' } = body;

        if (!employee_id || !amount || !month || !year) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Record payment with type
        const paymentRes = await query(
            `INSERT INTO payments (club_id, user_id, amount, payment_method, month, year, notes, created_by, payment_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, created_at`,
            [clubId, employee_id, amount, payment_method, month, year, notes, userId, payment_type]
        );

        const payment = paymentRes.rows[0];

        // For advances or bonus (virtual balance) payouts, skip salary snapshot (don't freeze KPI)
        if (payment_type === 'advance' || payment_type === 'bonus') {
            return NextResponse.json({
                payment_id: payment.id,
                payment_type: payment_type,
                snapshot_created: false,
                message: payment_type === 'advance' ? 'Advance payment recorded. KPI not frozen.' : 'Bonus payment recorded from virtual balance. KPI not frozen.'
            });
        }

        // 2. For full salary payment, get employee's salary scheme and its latest version
        const schemeRes = await query(
            `SELECT ss.*, v.formula as versioned_formula
             FROM employee_salary_assignments esa
             JOIN salary_schemes ss ON ss.id = esa.scheme_id
             LEFT JOIN LATERAL (
                 SELECT formula 
                 FROM salary_scheme_versions 
                 WHERE scheme_id = ss.id 
                 ORDER BY version DESC 
                 LIMIT 1
             ) v ON true
             WHERE esa.user_id = $1 AND esa.club_id = $2
             ORDER BY esa.assigned_at DESC
             LIMIT 1`,
            [employee_id, clubId]
        );

        const schemeRow = schemeRes.rows[0];
        if (!schemeRow) {
            return NextResponse.json({ error: 'No salary scheme found for employee' }, { status: 400 });
        }

        // Merge formula from version into the scheme object
        const formula = schemeRow.versioned_formula || {};
        const scheme = {
            ...schemeRow,
            ...formula,
            period_bonuses: schemeRow.period_bonuses || formula.period_bonuses || []
        };

        // 3. Get planned shifts for the period
        const plannedShiftsRes = await query(
            `SELECT planned_shifts 
             FROM employee_shift_schedules 
             WHERE club_id = $1 AND user_id = $2 AND month = $3 AND year = $4`,
            [clubId, employee_id, month, year]
        );
        const planned_shifts = plannedShiftsRes.rows[0]?.planned_shifts || 20;

        // 4. Create salary snapshot for unpaid shifts
        // We include EVERYTHING from the scheme to freeze it "ironclad"
        const snapshot = {
            paid_at: payment.created_at,
            scheme_id: scheme.id,
            scheme_name: scheme.name,
            // Freeze all base settings
            base: scheme.base || {
                type: scheme.type || 'hourly',
                amount: scheme.amount || 0,
                percent: scheme.percent || 0,
                full_shift_hours: scheme.full_shift_hours || 12
            },
            bonuses: scheme.bonuses || [],
            period_bonuses: scheme.period_bonuses || [],
            planned_shifts: planned_shifts,
            standard_monthly_shifts: scheme.standard_monthly_shifts || 15
        };

        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        const baseRateTiers = (snapshot.base as any)?.rate_tiers;
        if (baseRateTiers && (baseRateTiers.period || 'SHIFT') === 'MONTH') {
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
                if (!key) return;
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
            });

            const calculateShiftIncome = (shift: any) => {
                let total = 0;
                if (metricCategories['cash_income'] === 'INCOME' || !metricCategories['cash_income']) {
                    total += parseFloat(shift.cash_income || 0);
                }
                if (metricCategories['card_income'] === 'INCOME' || !metricCategories['card_income']) {
                    total += parseFloat(shift.card_income || 0);
                }
                if (shift.report_data) {
                    const data = typeof shift.report_data === 'string' ? JSON.parse(shift.report_data) : shift.report_data;
                    Object.keys(data).forEach(key => {
                        if (metricCategories[key] === 'INCOME' && key !== 'cash_income' && key !== 'card_income') {
                            total += parseFloat(data[key] || 0);
                        }
                    });
                }
                return total;
            };

            const metricKey = String(baseRateTiers.metric_key || 'total_revenue');

            const employeeShiftsRes = await query(
                `SELECT id, user_id, check_in, check_out, total_hours, cash_income, card_income, expenses, report_data, bar_purchases, shift_type, salary_snapshot, status
                 FROM shifts
                 WHERE club_id = $1
                   AND user_id = $2
                   AND check_in >= $3 AND check_in <= $4
                   AND status != 'ACTIVE'
                   AND COALESCE(salary_snapshot->>'type','') != 'PERIOD_BONUS'
                   AND (salary_snapshot IS NULL OR salary_snapshot->>'paid_at' IS NULL)`,
                [clubId, employee_id, startOfMonth.toISOString(), endOfMonth.toISOString()]
            );

            const clubShiftsRes = await query(
                `SELECT id, user_id, check_in, check_out, total_hours, cash_income, card_income, expenses, report_data, bar_purchases, shift_type, salary_snapshot, status
                 FROM shifts
                 WHERE club_id = $1
                   AND check_in >= $2 AND check_in <= $3
                   AND status != 'ACTIVE'
                   AND COALESCE(salary_snapshot->>'type','') != 'PERIOD_BONUS'`,
                [clubId, startOfMonth.toISOString(), endOfMonth.toISOString()]
            );

            const shiftEvalsRes = await query(
                `SELECT 
                    shift_id,
                    template_id,
                    ((total_score / NULLIF(max_score, 0)) * 100) as score_percent
                 FROM evaluations
                 WHERE club_id = $1
                   AND evaluation_date >= $2
                   AND evaluation_date <= $3
                   AND shift_id IS NOT NULL
                   AND max_score > 0`,
                [clubId, startOfMonth.toISOString(), endOfMonth.toISOString()]
            );
            const shiftEvalsMap: Record<string, any[]> = {};
            shiftEvalsRes.rows.forEach(r => {
                const sid = String(r.shift_id);
                if (!shiftEvalsMap[sid]) shiftEvalsMap[sid] = [];
                shiftEvalsMap[sid].push({ template_id: r.template_id, score_percent: parseFloat(r.score_percent) });
            });

            const resolveMetricSum = (shifts: any[]) => {
                if (metricKey === 'total_revenue') return shifts.reduce((sum, s) => sum + calculateShiftIncome(s), 0);
                if (metricKey === 'revenue_cash') return shifts.reduce((sum, s) => sum + parseFloat(s.cash_income || 0), 0);
                if (metricKey === 'revenue_card') return shifts.reduce((sum, s) => sum + parseFloat(s.card_income || 0), 0);
                return shifts.reduce((sum, s) => {
                    const data = typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data;
                    const val = data?.[metricKey];
                    return sum + (typeof val === 'number' ? val : parseFloat(val || '0'));
                }, 0);
            };

            const monthEmployeeValue = resolveMetricSum(employeeShiftsRes.rows);
            const monthClubValue = resolveMetricSum(clubShiftsRes.rows);

            for (const s of employeeShiftsRes.rows) {
                const reportMetrics: Record<string, number> = {
                    total_revenue: calculateShiftIncome(s),
                    revenue_cash: parseFloat(s.cash_income || 0),
                    revenue_card: parseFloat(s.card_income || 0),
                    expenses: parseFloat(s.expenses || 0),
                    [`month_employee_${metricKey}`]: monthEmployeeValue,
                    [`month_club_${metricKey}`]: monthClubValue
                };

                if (s.report_data) {
                    const data = typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data;
                    Object.keys(data).forEach(key => { reportMetrics[key] = parseFloat(data[key] || 0); });
                }

                const jsDow = new Date(s.check_in).getDay()
                const dayOfWeek =
                    jsDow === 0
                        ? 'SUN'
                        : jsDow === 1
                            ? 'MON'
                            : jsDow === 2
                                ? 'TUE'
                                : jsDow === 3
                                    ? 'WED'
                                    : jsDow === 4
                                        ? 'THU'
                                        : jsDow === 5
                                            ? 'FRI'
                                            : 'SAT'

                const result = await calculateSalary(
                    {
                        id: s.id,
                        total_hours: parseFloat(s.total_hours || 0),
                        report_data: s.report_data,
                        evaluations: shiftEvalsMap[String(s.id)] || [],
                        bar_purchases: parseFloat(s.bar_purchases || 0),
                        shift_type: String(s.shift_type || 'DAY').toUpperCase() === 'NIGHT' ? 'NIGHT' : 'DAY',
                        day_of_week: dayOfWeek
                    },
                    { ...(scheme as any), standard_monthly_shifts: scheme.standard_monthly_shifts || 15 },
                    reportMetrics
                );

                await query(
                    `UPDATE shifts
                     SET calculated_salary = $1,
                         salary_breakdown = $2
                     WHERE id = $3`,
                    [result.total, JSON.stringify(result.breakdown), s.id]
                );
            }
        }

        // 5. Update shifts to freeze salary with snapshot
        await query(
            `UPDATE shifts
             SET salary_snapshot = $1
             WHERE user_id = $2 
                AND club_id = $3
                AND check_in >= $4 
                AND check_in <= $5
                AND (salary_snapshot IS NULL OR salary_snapshot->>'paid_at' IS NULL)`,
            [JSON.stringify(snapshot), employee_id, clubId, startOfMonth, endOfMonth]
        );

        // 6. Check if ALL employees for this club/period are paid
        // If they are, auto-freeze the leaderboard
        const unpaidCheckRes = await query(
            `SELECT u.id, u.full_name
             FROM club_employees ce
             JOIN users u ON u.id = ce.user_id
             WHERE ce.club_id = $1
               AND NOT EXISTS (
                   SELECT 1 FROM payments p 
                   WHERE p.user_id = u.id 
                     AND p.club_id = $1 
                     AND p.month = $2 
                     AND p.year = $3 
                     AND p.payment_type = 'salary'
               )`,
            [clubId, month, year]
        );

        let leaderboardFrozen = false;
        if (unpaidCheckRes.rowCount === 0) {
            // Check if already frozen
            const frozenCheck = await query(
                `SELECT 1 FROM employee_leaderboard_snapshots 
                 WHERE club_id = $1 AND month = $2 AND year = $3 LIMIT 1`,
                [clubId, month, year]
            );
            
            if (frozenCheck.rowCount === 0) {
                await freezeClubEmployeeLeaderboard(clubId, year, month);
                leaderboardFrozen = true;
            }
        }

        return NextResponse.json({
            payment_id: payment.id,
            payment_type: 'salary',
            snapshot_created: true,
            leaderboard_frozen: leaderboardFrozen,
            message: leaderboardFrozen 
                ? 'Payment recorded, salary frozen and leaderboard auto-finalized (all employees paid)' 
                : 'Payment recorded and salary frozen'
        });

    } catch (error) {
        console.error('Error recording payment:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET - List payments for a period
export async function GET(request: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
    try {
        const { clubId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;
        const { searchParams } = new URL(request.url);
        const month = parseInt(searchParams.get('month') || '0');
        const year = parseInt(searchParams.get('year') || '0');

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const ownerCheck = await query(`SELECT 1 FROM clubs WHERE id=$1 AND owner_id=$2`, [clubId, userId]);
        if (ownerCheck.rowCount === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const paymentsRes = await query(
            `SELECT 
                p.*,
                u.full_name as employee_name
             FROM payments p
             JOIN users u ON u.id = p.user_id
             WHERE p.club_id = $1
                ${month && year ? 'AND p.month = $2 AND p.year = $3' : ''}
             ORDER BY p.created_at DESC`,
            month && year ? [clubId, month, year] : [clubId]
        );

        return NextResponse.json({ payments: paymentsRes.rows });

    } catch (error) {
        console.error('Error fetching payments:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
