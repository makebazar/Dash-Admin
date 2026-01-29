import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET /api/clubs/[clubId]/finance/recurring
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
        const isActive = searchParams.get('is_active');

        let queryStr = `
            SELECT 
                rp.*,
                fc.name as category_name,
                fc.icon as category_icon,
                fc.color as category_color
            FROM recurring_payments rp
            JOIN finance_categories fc ON rp.category_id = fc.id
            WHERE rp.club_id = $1
        `;

        const values: any[] = [clubId];

        if (isActive !== null) {
            queryStr += ` AND rp.is_active = $2`;
            values.push(isActive === 'true');
        }

        queryStr += ` ORDER BY rp.next_generation_date ASC NULLS LAST, rp.name ASC`;

        const result = await query(queryStr, values);

        return NextResponse.json({
            recurring_payments: result.rows
        });
    } catch (error) {
        console.error('Error fetching recurring payments:', error);
        return NextResponse.json({ error: 'Failed to fetch recurring payments' }, { status: 500 });
    }
}

// POST /api/clubs/[clubId]/finance/recurring
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
            type,
            frequency,
            interval = 1,
            day_of_month,
            day_of_week,
            has_split,
            split_config,
            payment_method = 'cash',
            start_date,
            end_date,
            description,
            account_id
        } = body;

        // Validation
        if (!category_id || !name || !amount || !type || !frequency || !start_date) {
            return NextResponse.json(
                { error: 'category_id, name, amount, type, frequency, and start_date are required' },
                { status: 400 }
            );
        }

        // Calculate next generation date
        const startDateObj = new Date(start_date);
        let nextGenerationDate = startDateObj;

        const result = await query(
            `INSERT INTO recurring_payments 
                (club_id, category_id, name, amount, type, frequency, interval, 
                 day_of_month, day_of_week, has_split, split_config, payment_method, 
                 start_date, end_date, next_generation_date, description, created_by, account_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
             RETURNING *`,
            [
                clubId, category_id, name, amount, type, frequency, interval,
                day_of_month || null, day_of_week || null, has_split,
                split_config ? JSON.stringify(split_config) : null,
                payment_method, start_date, end_date || null, nextGenerationDate, description, userId, account_id
            ]
        );

        return NextResponse.json({
            recurring_payment: result.rows[0]
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating recurring payment:', error);
        return NextResponse.json({ error: 'Failed to create recurring payment' }, { status: 500 });
    }
}

// PUT /api/clubs/[clubId]/finance/recurring
export async function PUT(
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

        const { id, name, amount, is_active, end_date, description, account_id } = body;

        if (!id) {
            return NextResponse.json({ error: 'Recurring payment ID is required' }, { status: 400 });
        }

        const result = await query(
            `UPDATE recurring_payments 
             SET name = COALESCE($1, name),
                 amount = COALESCE($2, amount),
                 is_active = COALESCE($3, is_active),
                 end_date = COALESCE($4, end_date),
                 description = COALESCE($5, description),
                 account_id = COALESCE($6, account_id)
             WHERE id = $7 AND club_id = $8
             RETURNING *`,
            [name, amount, is_active, end_date || null, description, account_id, id, clubId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Recurring payment not found' }, { status: 404 });
        }

        return NextResponse.json({
            recurring_payment: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating recurring payment:', error);
        return NextResponse.json({ error: 'Failed to update recurring payment' }, { status: 500 });
    }
}

// DELETE /api/clubs/[clubId]/finance/recurring
export async function DELETE(
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
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Recurring payment ID is required' }, { status: 400 });
        }

        // Soft delete by setting is_active to false
        const result = await query(
            `UPDATE recurring_payments 
             SET is_active = false 
             WHERE id = $1 AND club_id = $2
             RETURNING id`,
            [id, clubId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Recurring payment not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting recurring payment:', error);
        return NextResponse.json({ error: 'Failed to delete recurring payment' }, { status: 500 });
    }
}
