import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { calculateSalary } from '@/lib/salary-calculator';

// Helper function to create finance transactions from shift
async function createFinanceTransactionsFromShift(
    shiftId: string,
    clubId: number,
    userId: string,
    shiftData: any
) {
    // Get report template to determine income fields
    const templateResult = await query(
        `SELECT schema FROM club_report_templates 
         WHERE club_id = $1 AND is_active = true 
         ORDER BY created_at DESC LIMIT 1`,
        [clubId]
    );

    if (templateResult.rows.length === 0) {
        console.log('No report template found for club:', clubId);
        return;
    }

    const schema = templateResult.rows[0].schema;
    const incomeFields = schema.filter((field: any) => field.field_type === 'INCOME');

    // Get "Выручка клуба" category
    const categoryResult = await query(
        `SELECT id FROM finance_categories 
         WHERE name = 'Выручка клуба' AND type = 'income'
         AND (club_id = $1 OR club_id IS NULL)
         ORDER BY club_id DESC NULLS LAST LIMIT 1`,
        [clubId]
    );

    if (categoryResult.rows.length === 0) {
        throw new Error('Revenue category not found');
    }

    const categoryId = categoryResult.rows[0].id;

    // Create transactions for each income field
    for (const field of incomeFields) {
        let amount = 0;

        if (field.metric_key === 'cash_income') {
            amount = Number(shiftData.cash_income) || 0;
        } else if (field.metric_key === 'card_income') {
            amount = Number(shiftData.card_income) || 0;
        } else {
            // Custom fields from report_data
            amount = Number(shiftData.report_data?.[field.metric_key]) || 0;
        }

        if (amount > 0) {
            await query(
                `INSERT INTO finance_transactions (
                    club_id, category_id, amount, type, payment_method,
                    account_id, related_shift_report_id, transaction_date,
                    description, status, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                    clubId,
                    categoryId,
                    amount,
                    'income',
                    field.metric_key,
                    field.account_id,
                    shiftId,
                    shiftData.check_in,
                    field.custom_label || field.metric_key,
                    'completed',
                    userId
                ]
            );
        }
    }
}

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
            `SELECT user_id, total_hours, cash_income, card_income, expenses, report_data, check_in, shift_type, status 
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

        // Handle verification workflow
        if (body.status === 'VERIFIED') {
            // Check if shift already has finance transactions
            const existingTransactions = await query(
                'SELECT id FROM finance_transactions WHERE related_shift_report_id = $1',
                [shiftId]
            );

            if (existingTransactions.rows.length > 0) {
                return NextResponse.json(
                    { error: 'Shift already imported to finance' },
                    { status: 400 }
                );
            }

            // Create finance transactions
            await createFinanceTransactionsFromShift(shiftId, Number(clubId), userId, mergedData);

            // Set verification fields
            updates.push(`verified_by = $${paramIndex++}`);
            values.push(userId);
            updates.push(`verified_at = $${paramIndex++}`);
            values.push(new Date());
            updates.push(`status = $${paramIndex++}`);
            values.push('VERIFIED');
        } else if (body.status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            values.push(body.status);
        }

        // Handle owner corrections flag
        if (currentShift.status === 'CLOSED' && body.status !== 'VERIFIED') {
            // If owner is editing a CLOSED shift (not verifying it), mark has_owner_corrections
            if (body.cash_income !== undefined || body.card_income !== undefined ||
                body.expenses !== undefined || body.report_data !== undefined) {
                updates.push(`has_owner_corrections = $${paramIndex++}`);
                values.push(true);
            }
        }

        // Handle owner notes
        if (body.owner_notes !== undefined) {
            updates.push(`owner_notes = $${paramIndex++}`);
            values.push(body.owner_notes);
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
