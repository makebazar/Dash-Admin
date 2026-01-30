import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// PUT /api/clubs/[clubId]/finance/scheduled/[expenseId]
export async function PUT(
    request: NextRequest,
    { params }: { params: { clubId: string; expenseId: string } }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId, expenseId } = params;
        const body = await request.json();

        const {
            name,
            amount,
            due_date,
            description,
            consumption_value,
            unit_price,
            is_consumption_based,
            consumption_unit,
            status
        } = body;

        const result = await query(
            `UPDATE finance_scheduled_expenses 
             SET name = COALESCE($1, name),
                 amount = COALESCE($2, amount),
                 due_date = COALESCE($3, due_date),
                 description = COALESCE($4, description),
                 consumption_value = COALESCE($5, consumption_value),
                 unit_price = COALESCE($6, unit_price),
                 is_consumption_based = COALESCE($7, is_consumption_based),
                 consumption_unit = COALESCE($8, consumption_unit),
                 status = COALESCE($9, status),
                 updated_at = NOW()
             WHERE id = $10 AND club_id = $11
             RETURNING *`,
            [name, amount, due_date, description, consumption_value, unit_price, is_consumption_based, consumption_unit, status, expenseId, clubId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Scheduled expense not found' }, { status: 404 });
        }

        return NextResponse.json({
            scheduled_expense: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating scheduled expense:', error);
        return NextResponse.json({ error: 'Failed to update scheduled expense' }, { status: 500 });
    }
}

// DELETE /api/clubs/[clubId]/finance/scheduled/[expenseId]
export async function DELETE(
    request: NextRequest,
    { params }: { params: { clubId: string; expenseId: string } }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId, expenseId } = params;

        const result = await query(
            `DELETE FROM finance_scheduled_expenses 
             WHERE id = $1 AND club_id = $2
             RETURNING id`,
            [expenseId, clubId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Scheduled expense not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting scheduled expense:', error);
        return NextResponse.json({ error: 'Failed to delete scheduled expense' }, { status: 500 });
    }
}
