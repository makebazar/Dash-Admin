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
        const { target_month, target_year } = body;

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

        // Calculate transaction date based on template
        let transactionDate: Date;
        const now = new Date();
        const year = target_year || now.getFullYear();
        const month = target_month !== undefined ? target_month - 1 : now.getMonth();

        if (template.day_of_month) {
            // Use specific day of month (e.g., 10th)
            transactionDate = new Date(year, month, template.day_of_month);
        } else {
            // Use first day of month as fallback
            transactionDate = new Date(year, month, 1);
        }

        // Check if transaction for this month already exists
        const existingCheck = await query(
            `SELECT id FROM finance_transactions 
             WHERE club_id = $1 
             AND category_id = $2 
             AND EXTRACT(MONTH FROM transaction_date) = $3
             AND EXTRACT(YEAR FROM transaction_date) = $4
             LIMIT 1`,
            [clubId, template.category_id, month + 1, year]
        );

        if (existingCheck.rows.length > 0) {
            return NextResponse.json({
                error: 'Transaction for this period already exists',
                existing_transaction_id: existingCheck.rows[0].id
            }, { status: 409 });
        }

        // Create transaction from template
        const result = await query(
            `INSERT INTO finance_transactions 
                (club_id, category_id, amount, type, payment_method, status, 
                 transaction_date, description, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                clubId,
                template.category_id,
                template.amount,
                template.type,
                template.payment_method,
                'completed',
                transactionDate,
                `${template.name} (автоматически из шаблона)`,
                userId
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
            transaction: result.rows[0],
            message: 'Transaction generated successfully'
        }, { status: 201 });

    } catch (error) {
        console.error('Error generating transaction from recurring payment:', error);
        return NextResponse.json({
            error: 'Failed to generate transaction'
        }, { status: 500 });
    }
}
