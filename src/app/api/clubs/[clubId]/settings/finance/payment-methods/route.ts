import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET /api/clubs/[clubId]/settings/finance/payment-methods
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

        // Get all payment methods (system + club-specific)
        const result = await query(
            `SELECT 
                id,
                club_id,
                code,
                label,
                icon,
                color,
                is_system,
                is_active
             FROM payment_methods
             WHERE (club_id = $1 OR club_id IS NULL)
             AND is_active = TRUE
             ORDER BY 
                is_system DESC,
                label ASC`,
            [clubId]
        );

        const paymentMethods = result.rows.map(row => ({
            ...row,
            is_system: row.is_system || false
        }));

        return NextResponse.json({ payment_methods: paymentMethods });
    } catch (error) {
        console.error('Error fetching payment methods:', error);
        return NextResponse.json({ error: 'Failed to fetch payment methods' }, { status: 500 });
    }
}

// POST /api/clubs/[clubId]/settings/finance/payment-methods
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
        const { code, label, icon = '💰', color = '#3b82f6' } = body;

        if (!code || !label) {
            return NextResponse.json(
                { error: 'Code and label are required' },
                { status: 400 }
            );
        }

        // Create new payment method
        const result = await query(
            `INSERT INTO payment_methods 
                (club_id, code, label, icon, color, is_system)
             VALUES ($1, $2, $3, $4, $5, FALSE)
             RETURNING *`,
            [clubId, code, label, icon, color]
        );

        return NextResponse.json({ payment_method: result.rows[0] }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating payment method:', error);

        if (error.code === '23505') { // Unique violation
            return NextResponse.json(
                { error: 'Payment method with this code already exists' },
                { status: 409 }
            );
        }

        return NextResponse.json({ error: 'Failed to create payment method' }, { status: 500 });
    }
}

// DELETE /api/clubs/[clubId]/settings/finance/payment-methods
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
        const paymentMethodId = searchParams.get('id');

        if (!paymentMethodId) {
            return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 });
        }

        // Check if it's a system method
        const checkResult = await query(
            `SELECT is_system FROM payment_methods WHERE id = $1 AND club_id = $2`,
            [paymentMethodId, clubId]
        );

        if (checkResult.rows.length === 0) {
            return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
        }

        if (checkResult.rows[0].is_system) {
            return NextResponse.json(
                { error: 'Cannot delete system payment methods' },
                { status: 403 }
            );
        }

        // Check if used in transactions
        const txCheck = await query(
            `SELECT COUNT(*) as count FROM finance_transactions WHERE payment_method_id = $1`,
            [paymentMethodId]
        );

        if (parseInt(txCheck.rows[0].count) > 0) {
            // Soft delete
            await query(
                `UPDATE payment_methods SET is_active = FALSE WHERE id = $1`,
                [paymentMethodId]
            );

            return NextResponse.json({
                message: 'Payment method deactivated (has transactions)',
                deleted: false
            });
        } else {
            // Hard delete
            await query(
                `DELETE FROM payment_methods WHERE id = $1 AND club_id = $2`,
                [paymentMethodId, clubId]
            );

            return NextResponse.json({
                message: 'Payment method deleted',
                deleted: true
            });
        }
    } catch (error) {
        console.error('Error deleting payment method:', error);
        return NextResponse.json({ error: 'Failed to delete payment method' }, { status: 500 });
    }
}
