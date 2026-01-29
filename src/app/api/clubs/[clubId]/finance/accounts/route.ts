import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET /api/clubs/[clubId]/finance/accounts
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

        // Get all accounts for the club
        const result = await query(
            `SELECT 
                id,
                club_id,
                name,
                account_type,
                currency,
                initial_balance,
                current_balance,
                icon,
                color,
                bank_name,
                account_number,
                description,
                is_active,
                created_at,
                updated_at
           FROM finance_accounts
            WHERE club_id = $1
            ORDER BY 
                CASE account_type
                    WHEN 'cash' THEN 1
                    WHEN 'bank' THEN 2
                    WHEN 'card' THEN 3
                    ELSE 4
                END,
                created_at ASC`,
            [clubId]
        );

        const accounts = result.rows.map(row => ({
            ...row,
            initial_balance: parseFloat(row.initial_balance),
            current_balance: parseFloat(row.current_balance)
        }));

        return NextResponse.json({ accounts });
    } catch (error) {
        console.error('Error fetching accounts:', error);
        return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }
}

// POST /api/clubs/[clubId]/finance/accounts
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
            name,
            account_type,
            currency = 'RUB',
            initial_balance = 0,
            icon = '💰',
            color = '#3b82f6',
            bank_name,
            account_number,
            description
        } = body;

        if (!name || !account_type) {
            return NextResponse.json(
                { error: 'Name and account_type are required' },
                { status: 400 }
            );
        }

        // Create new account
        const result = await query(
            `INSERT INTO finance_accounts 
                (club_id, name, account_type, currency, initial_balance, current_balance,
                 icon, color, bank_name, account_number, description)
             VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [clubId, name, account_type, currency, initial_balance, icon, color, bank_name, account_number, description]
        );

        const account = {
            ...result.rows[0],
            initial_balance: parseFloat(result.rows[0].initial_balance),
            current_balance: parseFloat(result.rows[0].current_balance)
        };

        return NextResponse.json({ account }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating account:', error);

        if (error.code === '23505') { // Unique violation
            return NextResponse.json({ error: 'Account with this name already exists' }, { status: 409 });
        }

        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }
}

// PUT /api/clubs/[clubId]/finance/accounts
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
        const {
            id,
            name,
            icon,
            color,
            bank_name,
            account_number,
            description,
            is_active
        } = body;

        if (!id) {
            return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
        }

        // Update account (cannot change balance or type directly)
        const result = await query(
            `UPDATE finance_accounts
             SET name = COALESCE($1, name),
                 icon = COALESCE($2, icon),
                 color = COALESCE($3, color),
                 bank_name = $4,
                 account_number = $5,
                 description = $6,
                 is_active = COALESCE($7, is_active),
                 updated_at = NOW()
             WHERE id = $8 AND club_id = $9
             RETURNING *`,
            [name, icon, color, bank_name, account_number, description, is_active, id, clubId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const account = {
            ...result.rows[0],
            initial_balance: parseFloat(result.rows[0].initial_balance),
            current_balance: parseFloat(result.rows[0].current_balance)
        };

        return NextResponse.json({ account });
    } catch (error) {
        console.error('Error updating account:', error);
        return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }
}

// DELETE /api/clubs/[clubId]/finance/accounts
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
        const accountId = searchParams.get('id');

        if (!accountId) {
            return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
        }

        // Check if account has transactions
        const txCheck = await query(
            `SELECT COUNT(*) as count FROM finance_transactions WHERE account_id = $1`,
            [accountId]
        );

        if (parseInt(txCheck.rows[0].count) > 0) {
            // Soft delete - just deactivate
            await query(
                `UPDATE finance_accounts SET is_active = FALSE, updated_at = NOW()
                 WHERE id = $1 AND club_id = $2`,
                [accountId, clubId]
            );

            return NextResponse.json({
                message: 'Account deactivated (has transactions)',
                deleted: false
            });
        } else {
            // Hard delete - no transactions
            await query(
                `DELETE FROM finance_accounts WHERE id = $1 AND club_id = $2`,
                [accountId, clubId]
            );

            return NextResponse.json({
                message: 'Account deleted',
                deleted: true
            });
        }
    } catch (error) {
        console.error('Error deleting account:', error);
        return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }
}
