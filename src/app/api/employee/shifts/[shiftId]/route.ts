import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { calculateSalary } from '@/lib/salary-calculator';

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

        const { reportData, templateId } = body;

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

        if ((schemeRes.rowCount || 0) > 0) {
            const scheme = schemeRes.rows[0];
            const formula = scheme.formula || {};

            // Prepare metrics map
            const metrics: Record<string, number> = {
                'total_revenue': reportData['total_revenue'] ? parseFloat(reportData['total_revenue']) :
                    ((reportData['cash_income'] ? parseFloat(reportData['cash_income']) : 0) +
                        (reportData['card_income'] ? parseFloat(reportData['card_income']) : 0)),
                'revenue_cash': reportData['cash_income'] ? parseFloat(reportData['cash_income']) : 0,
                'revenue_card': reportData['card_income'] ? parseFloat(reportData['card_income']) : 0
            };
            // Add all other report fields
            for (const key in reportData) {
                if (typeof reportData[key] === 'number') metrics[key] = reportData[key];
                else if (typeof reportData[key] === 'string' && !isNaN(parseFloat(reportData[key]))) metrics[key] = parseFloat(reportData[key]);
            }

            // Pass formula directly - calculator now handles normalization
            const calculation = await calculateSalary(
                { id: shiftId, total_hours: totalHours, evaluations },
                formula,
                metrics
            );

            calculatedSalary = calculation.total;
            salaryBreakdown = calculation.breakdown;
        }

        // Extract system metrics for separate columns
        const cashIncome = reportData['cash_income'] ? parseFloat(reportData['cash_income']) : 0;
        const cardIncome = reportData['card_income'] ? parseFloat(reportData['card_income']) : 0;
        const expenses = reportData['expenses_cash'] ? parseFloat(reportData['expenses_cash']) : 0;
        const comment = reportData['shift_comment'] || '';

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
           calculated_salary = $9,
           salary_breakdown = $10
       WHERE id = $7`,
            [
                JSON.stringify(reportData),
                templateId,
                cashIncome,
                cardIncome,
                expenses,
                comment,
                shiftId,
                // check_out handled by NOW()
                totalHours.toFixed(2), // $8 total_hours
                calculatedSalary, // $9
                JSON.stringify(salaryBreakdown) // $10
            ]
        );

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('End Shift Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error', details: error.toString() }, { status: 500 });
    }
}
