import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET /api/clubs/[clubId]/finance/scheduled
export async function GET(
    request: NextRequest,
    { params }: { params: { clubId: string } }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId } = params;
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');

        let queryStr = `
            SELECT 
                fse.*,
                fc.name as category_name,
                fc.icon as category_icon,
                fc.color as category_color,
                COALESCE((
                    SELECT SUM(amount) 
                    FROM finance_transactions 
                    WHERE scheduled_expense_id = fse.id AND status = 'completed'
                ), 0) as amount_paid
            FROM finance_scheduled_expenses fse
            JOIN finance_categories fc ON fse.category_id = fc.id
            WHERE fse.club_id = $1
        `;

        const values: any[] = [clubId];

        if (status) {
            queryStr += ` AND fse.status = $${values.length + 1}`;
            values.push(status);
        }

        if (startDate && endDate) {
            queryStr += ` AND fse.due_date BETWEEN $${values.length + 1} AND $${values.length + 2}`;
            values.push(startDate, endDate);
        }

        queryStr += ` ORDER BY fse.due_date ASC, fse.name ASC`;

        const result = await query(queryStr, values);

        return NextResponse.json({
            scheduled_expenses: result.rows.map(row => ({
                ...row,
                amount: parseFloat(row.amount),
                amount_paid: parseFloat(row.amount_paid),
                consumption_value: row.consumption_value ? parseFloat(row.consumption_value) : null,
                unit_price: row.unit_price ? parseFloat(row.unit_price) : null
            }))
        });
    } catch (error) {
        console.error('Error fetching scheduled expenses:', error);
        return NextResponse.json({ error: 'Failed to fetch scheduled expenses' }, { status: 500 });
    }
}

// POST /api/clubs/[clubId]/finance/scheduled
export async function POST(
    request: NextRequest,
    { params }: { params: { clubId: string } }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId } = params;
        const body = await request.json();

        const {
            category_id,
            name,
            amount,
            due_date,
            description,
            recurring_payment_id,
            consumption_value,
            unit_price,
            is_consumption_based,
            consumption_unit
        } = body;

        if (!category_id || !name || !amount || !due_date) {
            return NextResponse.json(
                { error: 'category_id, name, amount, and due_date are required' },
                { status: 400 }
            );
        }

        const result = await query(
            `INSERT INTO finance_scheduled_expenses 
                (club_id, category_id, name, amount, due_date, description, recurring_payment_id, consumption_value, unit_price, is_consumption_based, consumption_unit)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [clubId, category_id, name, amount, due_date, description, recurring_payment_id || null, consumption_value, unit_price, is_consumption_based || false, consumption_unit || null]
        );

        return NextResponse.json({
            scheduled_expense: result.rows[0]
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating scheduled expense:', error);
        return NextResponse.json({ error: 'Failed to create scheduled expense' }, { status: 500 });
    }
}
