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

        const { clubId } = await params;

        const result = await query(
            `SELECT 
                rp.*,
                fc.name as category_name,
                fc.color as category_color,
                fc.icon as category_icon
             FROM recurring_payments rp
             LEFT JOIN finance_categories fc ON rp.category_id = fc.id
             WHERE rp.club_id = $1 AND rp.is_active = true
             ORDER BY rp.day_of_month ASC, rp.name ASC`,
            [clubId]
        );

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

        const { clubId } = await params;
        const body = await request.json();

        const {
            name,
            category_id,
            amount,
            day_of_month,
            is_consumption_based,
            consumption_unit,
            unit_price
        } = body;

        // Validation
        if (!name || !category_id || !day_of_month) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const result = await query(
            `INSERT INTO recurring_payments 
                (club_id, name, category_id, type, amount, frequency, interval, day_of_month, 
                 is_consumption_based, consumption_unit, default_unit_price, 
                 start_date, is_active, created_by)
             VALUES ($1, $2, $3, 'expense', $4, 'monthly', 1, $5, 
                     $6, $7, $8, 
                     NOW(), true, $9)
             RETURNING *`,
            [
                clubId,
                name,
                category_id,
                amount || 0, // Base amount (0 for pure consumption maybe?)
                day_of_month,
                is_consumption_based || false,
                consumption_unit,
                unit_price,
                userId
            ]
        );

        return NextResponse.json({
            recurring_payment: result.rows[0]
        });

    } catch (error) {
        console.error('Error creating recurring payment:', error);
        return NextResponse.json({ error: 'Failed to create recurring payment' }, { status: 500 });
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

        const { clubId } = await params;
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        await query(
            `UPDATE recurring_payments 
             SET is_active = false 
             WHERE id = $1 AND club_id = $2`,
            [id, clubId]
        );

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting recurring payment:', error);
        return NextResponse.json({ error: 'Failed to delete recurring payment' }, { status: 500 });
    }
}
