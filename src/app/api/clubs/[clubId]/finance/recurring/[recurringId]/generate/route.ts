import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// POST /api/clubs/[clubId]/finance/recurring/[recurringId]/generate
export async function POST(
    request: NextRequest,
    { params }: { params: { clubId: string; recurringId: string } }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId, recurringId } = params;
        const body = await request.json();
        const { target_month, target_year, custom_amount, status, payment_date } = body;

        // Get recurring payment template
        const templateResult = await query(
            `SELECT * FROM recurring_payments WHERE id = $1 AND club_id = $2`,
            [recurringId, clubId]
        );

        if (templateResult.rows.length === 0) {
            return NextResponse.json({ error: 'Recurring payment not found' }, { status: 404 });
        }

        const template = templateResult.rows[0];

        if (!template.is_active) {
            return NextResponse.json({ error: 'Recurring payment is not active' }, { status: 400 });
        }

        // Use custom payment date if provided, otherwise calculate based on template
        let transactionDate: Date;
        if (payment_date) {
            transactionDate = new Date(payment_date);
        } else {
            const now = new Date();
            const year = target_year || now.getFullYear();
            const month = target_month !== undefined ? target_month - 1 : now.getMonth();

            if (template.day_of_month) {
                transactionDate = new Date(year, month, template.day_of_month);
            } else {
                transactionDate = new Date(year, month, 1);
            }
        }

        // Use custom amount if provided, otherwise use template amount
        const amount = custom_amount !== undefined ? custom_amount : template.amount;

        // Use custom status if provided, otherwise default to 'completed'
        const transactionStatus = status || 'completed';

        // Check if transaction or scheduled expense for this month already exists
        const existingCheck = await query(
            `SELECT id FROM finance_scheduled_expenses 
             WHERE club_id = $1 
             AND category_id = $2 
             AND EXTRACT(MONTH FROM due_date) = $3
             AND EXTRACT(YEAR FROM due_date) = $4
             LIMIT 1`,
            [clubId, template.category_id, transactionDate.getMonth() + 1, transactionDate.getFullYear()]
        );

        if (existingCheck.rows.length > 0) {
            return NextResponse.json({
                error: 'Scheduled expense for this period already exists',
                existing_expense_id: existingCheck.rows[0].id
            }, { status: 409 });
        }

        // Create scheduled expense from template
        const result = await query(
            `INSERT INTO finance_scheduled_expenses 
                (club_id, category_id, name, amount, due_date, description, recurring_payment_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                clubId,
                template.category_id,
                amount,
                transactionDate,
                `${template.name} (автоматически из шаблона)`,
                template.id
            ]
        );

        // Update last_generated_date on template
        await query(
            `UPDATE recurring_payments 
             SET last_generated_date = $1 
             WHERE id = $2`,
            [transactionDate, recurringId]
        );

        return NextResponse.json({
            scheduled_expense: result.rows[0],
            message: 'Scheduled expense generated successfully'
        }, { status: 201 });

    } catch (error) {
        console.error('Error generating transaction from recurring payment:', error);
        return NextResponse.json({
            error: 'Failed to generate transaction'
        }, { status: 500 });
    }
}
