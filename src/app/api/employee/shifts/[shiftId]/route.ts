import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { calculateSalary } from '@/lib/salary-calculator';
import { getEmployeeRoleAccess } from '@/lib/employee-role-access';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ shiftId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { shiftId } = await params;

        // Parse JSON body carefully
        let body;
        try {
            body = await request.json();
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        let reportData = body?.reportData;
        let templateId = body?.templateId;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify shift belongs to user
        const shiftCheck = await query(
            `SELECT id, club_id, check_in, user_id FROM shifts WHERE id = $1 AND user_id = $2 AND check_out IS NULL`,
            [shiftId, userId]
        );

        if (shiftCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Shift not found or already ended' }, { status: 404 });
        }

        const clubId = shiftCheck.rows[0].club_id;
        const checkIn = new Date(shiftCheck.rows[0].check_in);
        const shiftUserId = shiftCheck.rows[0].user_id;

        const roleAccess = await getEmployeeRoleAccess(String(clubId))
        if (roleAccess.settings.shift_end_mode === 'NO_REPORT') {
            reportData = {}
            templateId = null
        } else {
            if (!reportData || typeof reportData !== 'object') {
                return NextResponse.json({ error: 'reportData is required' }, { status: 400 });
            }
        }

        const safeReportData = reportData && typeof reportData === 'object' ? reportData : {}
        const reportMode = roleAccess.settings.shift_end_mode === 'NO_REPORT' ? 'NO_REPORT' : 'FULL_REPORT'

        // Calculate hours
        const now = new Date();
        const durationMs = now.getTime() - checkIn.getTime();
        const totalHours = durationMs / (1000 * 60 * 60);

        // Calculate Salary
        let calculatedSalary = 0;
        let salaryBreakdown = null;
        let schemeVersionId = null;

        // Get assigned scheme and its latest formula
        const schemeRes = await query(
            `SELECT ss.id, ss.name, sv.formula
             FROM employee_salary_assignments esa
             JOIN salary_schemes ss ON esa.scheme_id = ss.id
             JOIN salary_scheme_versions sv ON sv.scheme_id = ss.id
             WHERE esa.user_id = $1 AND esa.club_id = $2
             ORDER BY sv.version DESC
             LIMIT 1`,
            [shiftUserId, clubId]
        );

        // Fetch evaluations for this shift
        const evaluationsRes = await query(
            `SELECT template_id, total_score as score_percent FROM evaluations WHERE shift_id = $1`,
            [shiftId]
        );
        const evaluations = evaluationsRes.rows;

        // Helper to sum numeric values from report data (handles numbers, strings, and expense arrays)
        const sumMetric = (val: any) => {
            if (Array.isArray(val)) {
                return val.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0);
            }
            return parseFloat(String(val)) || 0;
        };

        // Extract system metrics for separate columns
        const cashIncome = sumMetric(safeReportData['cash_income']);
        const cardIncome = sumMetric(safeReportData['card_income']);
        const expenses = sumMetric(safeReportData['expenses_cash']);
        const comment = safeReportData['shift_comment'] || '';

        // Prepare metrics for salary calculator (must be flat Record<string, number>)
        const metrics: Record<string, number> = {
            'total_revenue': cashIncome + cardIncome,
            'revenue_cash': cashIncome,
            'revenue_card': cardIncome,
            'expenses': expenses
        };
        
        // Add all other report fields, summing them if they are arrays
        for (const key in safeReportData) {
            metrics[key] = sumMetric(safeReportData[key]);
        }

        if ((schemeRes.rowCount || 0) > 0) {
            const scheme = schemeRes.rows[0];
            const formula = scheme.formula || {};

            // Pass formula directly - calculator now handles normalization
            const calculation = await calculateSalary(
                { id: shiftId, total_hours: totalHours, evaluations },
                formula,
                metrics
            );

            calculatedSalary = calculation.total;
            salaryBreakdown = calculation.breakdown;
        }

        // End shift and save report
        await query(
            `UPDATE shifts
       SET check_out = NOW(),
           status = 'CLOSED',
           total_hours = $8,
           report_data = $1,
           template_id = $2,
           cash_income = $3,
           card_income = $4,
           expenses = $5,
           report_comment = $6,
           report_mode = $11,
           actor_role_id_snapshot = $12,
           actor_role_name_snapshot = $13,
           calculated_salary = $9,
           salary_breakdown = $10
       WHERE id = $7`,
            [
                JSON.stringify(safeReportData),
                templateId,
                cashIncome,
                cardIncome,
                expenses,
                comment,
                shiftId,
                // check_out handled by NOW()
                totalHours.toFixed(2), // $8 total_hours
                calculatedSalary, // $9
                JSON.stringify(salaryBreakdown), // $10
                reportMode, // $11
                roleAccess.roleId, // $12
                roleAccess.roleName // $13
            ]
        );

        // Process Virtual Balance Bonuses
        // Используем breakdown.virtual_balance_total для проверки и общей суммы
        if (salaryBreakdown && salaryBreakdown.virtual_balance_total > 0) {
            const virtualBonuses = salaryBreakdown.bonuses.filter((b: any) => b.payout_type === 'VIRTUAL_BALANCE' && b.amount > 0);

            if (virtualBonuses.length > 0) {
                const client = await (await import('@/db')).queryClient();

                try {
                    await client.query('BEGIN');

                    for (const bonus of virtualBonuses) {
                        // Create transaction record
                        await client.query(
                            `INSERT INTO employee_balance_transactions (
                                club_id, user_id, amount, transaction_type, description,
                                payout_type, bonus_type, shift_id, reference_type, reference_id, created_by
                             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                            [
                                clubId,
                                shiftUserId,
                                bonus.amount,
                                'BONUS',
                                `${bonus.name || 'Бонус за смену'} (${bonus.type})`,
                                'VIRTUAL_BALANCE',
                                bonus.type,
                                shiftId,
                                'shift',
                                shiftId,
                                userId
                            ]
                        );
                    }

                    // Update employee balance
                    // Используем breakdown.virtual_balance_total для точной суммы
                    const totalVirtualBonus = salaryBreakdown.virtual_balance_total;

                    // Get or create balance record
                    const balanceCheck = await client.query(
                        `SELECT balance FROM employee_balances
                         WHERE club_id = $1 AND user_id = $2`,
                        [clubId, shiftUserId]
                    );

                    if (balanceCheck.rows.length > 0) {
                        const currentBalance = parseFloat(balanceCheck.rows[0].balance) || 0;
                        await client.query(
                            `UPDATE employee_balances
                             SET balance = $1, updated_at = NOW()
                             WHERE club_id = $2 AND user_id = $3`,
                            [currentBalance + totalVirtualBonus, clubId, shiftUserId]
                        );
                    } else {
                        await client.query(
                            `INSERT INTO employee_balances (club_id, user_id, balance, currency)
                             VALUES ($1, $2, $3, 'RUB')`,
                            [clubId, shiftUserId, totalVirtualBonus]
                        );
                    }

                    await client.query('COMMIT');
                    
                    console.log(`[Virtual Balance] Accrued ${totalVirtualBonus} to User ${shiftUserId} for Shift ${shiftId}`);
                } catch (error: any) {
                    await client.query('ROLLBACK');
                    console.error('Error processing virtual bonuses:', error);
                    // Don't fail the request, just log the error
                } finally {
                    client.release();
                }
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('End Shift Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error', details: error.toString() }, { status: 500 });
    }
}
