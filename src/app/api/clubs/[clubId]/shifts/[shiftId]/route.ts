import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { calculateSalary } from '@/lib/salary-calculator';

// GET: Get single shift details
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string; shiftId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, shiftId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const shiftResult = await query(
            `SELECT s.*, u.full_name as employee_name
             FROM shifts s
             LEFT JOIN users u ON s.user_id = u.id
             WHERE s.id = $1 AND s.club_id = $2`,
            [shiftId, clubId]
        );

        if ((shiftResult.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }

        return NextResponse.json({ shift: shiftResult.rows[0] });

    } catch (error: any) {
        console.error('Get Shift Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Update shift (owner can edit/verify)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string; shiftId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, shiftId } = await params;
        const body = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch current shift data to merge with updates for calculation
        const currentShiftRes = await query(
            `SELECT user_id, total_hours, cash_income, card_income, expenses, report_data, check_in, shift_type 
             FROM shifts WHERE id = $1`,
            [shiftId]
        );

        if ((currentShiftRes.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }

        const currentShift = currentShiftRes.rows[0];

        // Prepare merged data for calculation
        const mergedData = {
            total_hours: body.total_hours !== undefined ? body.total_hours : currentShift.total_hours,
            cash_income: body.cash_income !== undefined ? body.cash_income : currentShift.cash_income,
            card_income: body.card_income !== undefined ? body.card_income : currentShift.card_income,
            expenses: body.expenses !== undefined ? body.expenses : currentShift.expenses,
            report_data: body.report_data !== undefined ? body.report_data : currentShift.report_data,
            check_in: body.check_in !== undefined ? body.check_in : currentShift.check_in,
            shift_type: body.shift_type !== undefined ? body.shift_type : currentShift.shift_type
        };

        // Calculate Salary
        let calculatedSalary = null;
        let salaryBreakdown = null;

        // Get assigned scheme
        const schemeRes = await query(
            `SELECT ss.id, ss.name, sv.formula
             FROM employee_salary_assignments esa
             JOIN salary_schemes ss ON esa.scheme_id = ss.id
             JOIN salary_scheme_versions sv ON sv.scheme_id = ss.id
             WHERE esa.user_id = $1 AND esa.club_id = $2
             ORDER BY sv.version DESC
             LIMIT 1`,
            [currentShift.user_id, clubId]
        );

        if ((schemeRes.rowCount || 0) > 0) {
            const scheme = schemeRes.rows[0];
            const calculation = await calculateSalary({
                id: shiftId,
                total_hours: Number(mergedData.total_hours) || 0,
                report_data: mergedData.report_data || {}
            }, scheme.formula, {
                total_revenue: (Number(mergedData.cash_income) || 0) + (Number(mergedData.card_income) || 0),
                revenue_cash: Number(mergedData.cash_income) || 0,
                revenue_card: Number(mergedData.card_income) || 0,
                expenses: Number(mergedData.expenses) || 0,
                ...mergedData.report_data
            });

            calculatedSalary = calculation.total;
            salaryBreakdown = calculation.breakdown;
        }

        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (body.cash_income !== undefined) {
            updates.push(`cash_income = $${paramIndex++}`);
            values.push(body.cash_income);
        }
        if (body.card_income !== undefined) {
            updates.push(`card_income = $${paramIndex++}`);
            values.push(body.card_income);
        }
        if (body.expenses !== undefined) {
            updates.push(`expenses = $${paramIndex++}`);
            values.push(body.expenses);
        }
        if (body.report_comment !== undefined) {
            updates.push(`report_comment = $${paramIndex++}`);
            values.push(body.report_comment);
        }
        if (body.status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            values.push(body.status);
        }
        if (body.report_data !== undefined) {
            updates.push(`report_data = $${paramIndex++}`);
            values.push(JSON.stringify(body.report_data));
        }
        if (body.check_in !== undefined) {
            updates.push(`check_in = $${paramIndex++}`);
            values.push(body.check_in);
        }
        if (body.check_out !== undefined) {
            updates.push(`check_out = $${paramIndex++}`);
            values.push(body.check_out);
        }
        if (body.total_hours !== undefined) {
            updates.push(`total_hours = $${paramIndex++}`);
            values.push(body.total_hours);
        }
        if (body.shift_type !== undefined) {
            updates.push(`shift_type = $${paramIndex++}`);
            values.push(body.shift_type);
        }

        // Update salary fields
        if (calculatedSalary !== null) {
            updates.push(`calculated_salary = $${paramIndex++}`);
            values.push(calculatedSalary);

            updates.push(`salary_breakdown = $${paramIndex++}`);
            values.push(JSON.stringify(salaryBreakdown));
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(shiftId, clubId);

        const result = await query(
            `UPDATE shifts 
             SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND club_id = $${paramIndex}
             RETURNING *`,
            values
        );

        if ((result.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, shift: result.rows[0] });

    } catch (error: any) {
        console.error('Update Shift Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Remove shift (owner only)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string; shiftId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, shiftId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Delete shift
        const deleteResult = await query(
            `DELETE FROM shifts 
             WHERE id = $1 AND club_id = $2
             RETURNING id`,
            [shiftId, clubId]
        );

        if ((deleteResult.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Shift deleted successfully' });

    } catch (error: any) {
        console.error('Delete Shift Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
