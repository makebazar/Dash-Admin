import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';

// GET /api/clubs/[clubId]/finance/transactions
export async function GET(
    request: NextRequest,
    { params }: { params: { clubId: string } }
) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId } = params;
        const { searchParams } = new URL(request.url);

        const type = searchParams.get('type'); // 'income' or 'expense'
        const categoryId = searchParams.get('category_id');
        const status = searchParams.get('status');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');
        const search = searchParams.get('search');
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');

        let query = `
            SELECT 
                ft.*,
                fc.name as category_name,
                fc.icon as category_icon,
                fc.color as category_color,
                u.full_name as created_by_name
            FROM finance_transactions ft
            JOIN finance_categories fc ON ft.category_id = fc.id
            LEFT JOIN users u ON ft.created_by = u.id
            WHERE ft.club_id = $1
        `;

        const values: any[] = [clubId];
        let paramCount = 1;

        if (type) {
            paramCount++;
            query += ` AND ft.type = $${paramCount}`;
            values.push(type);
        }

        if (categoryId) {
            paramCount++;
            query += ` AND ft.category_id = $${paramCount}`;
            values.push(categoryId);
        }

        if (status) {
            paramCount++;
            query += ` AND ft.status = $${paramCount}`;
            values.push(status);
        }

        if (startDate) {
            paramCount++;
            query += ` AND ft.transaction_date >= $${paramCount}`;
            values.push(startDate);
        }

        if (endDate) {
            paramCount++;
            query += ` AND ft.transaction_date <= $${paramCount}`;
            values.push(endDate);
        }

        if (search) {
            paramCount++;
            query += ` AND (ft.description ILIKE $${paramCount} OR ft.notes ILIKE $${paramCount})`;
            values.push(`%${search}%`);
        }

        query += ` ORDER BY ft.transaction_date DESC, ft.created_at DESC`;
        query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);

        // Get totals
        let totalsQuery = `
            SELECT 
                SUM(CASE WHEN type = 'income' AND status = 'completed' THEN amount ELSE 0 END) as total_income,
                SUM(CASE WHEN type = 'expense' AND status = 'completed' THEN amount ELSE 0 END) as total_expense,
                COUNT(*) as total_count
            FROM finance_transactions
            WHERE club_id = $1
        `;

        const totalsValues: any[] = [clubId];
        let totalsParamCount = 1;

        if (startDate) {
            totalsParamCount++;
            totalsQuery += ` AND transaction_date >= $${totalsParamCount}`;
            totalsValues.push(startDate);
        }

        if (endDate) {
            totalsParamCount++;
            totalsQuery += ` AND transaction_date <= $${totalsParamCount}`;
            totalsValues.push(endDate);
        }

        const totalsResult = await pool.query(totalsQuery, totalsValues);
        const totals = totalsResult.rows[0];

        return NextResponse.json({
            transactions: result.rows,
            totals: {
                income: parseFloat(totals.total_income || 0),
                expense: parseFloat(totals.total_expense || 0),
                profit: parseFloat(totals.total_income || 0) - parseFloat(totals.total_expense || 0),
                count: parseInt(totals.total_count || 0)
            },
            pagination: {
                limit,
                offset,
                total: parseInt(totals.total_count || 0)
            }
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}

// POST /api/clubs/[clubId]/finance/transactions
export async function POST(
    request: NextRequest,
    { params }: { params: { clubId: string } }
) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId } = params;
        const body = await request.json();

        const {
            category_id,
            amount,
            type,
            payment_method = 'cash',
            status = 'completed',
            transaction_date,
            description,
            notes,
            attachment_url
        } = body;

        // Validation
        if (!category_id || !amount || !type || !transaction_date) {
            return NextResponse.json(
                { error: 'category_id, amount, type, and transaction_date are required' },
                { status: 400 }
            );
        }

        if (!['income', 'expense'].includes(type)) {
            return NextResponse.json(
                { error: 'Type must be income or expense' },
                { status: 400 }
            );
        }

        if (parseFloat(amount) <= 0) {
            return NextResponse.json(
                { error: 'Amount must be positive' },
                { status: 400 }
            );
        }

        // Verify category exists and belongs to club
        const categoryCheck = await pool.query(
            `SELECT id FROM finance_categories 
             WHERE id = $1 AND (club_id = $2 OR club_id IS NULL) AND is_active = true`,
            [category_id, clubId]
        );

        if (categoryCheck.rows.length === 0) {
            return NextResponse.json(
                { error: 'Invalid category' },
                { status: 400 }
            );
        }

        const result = await pool.query(
            `INSERT INTO finance_transactions 
                (club_id, category_id, amount, type, payment_method, status, 
                 transaction_date, description, notes, attachment_url, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                clubId, category_id, amount, type, payment_method, status,
                transaction_date, description, notes, attachment_url, user.id
            ]
        );

        // Fetch full transaction details
        const fullTransaction = await pool.query(
            `SELECT 
                ft.*,
                fc.name as category_name,
                fc.icon as category_icon,
                fc.color as category_color
            FROM finance_transactions ft
            JOIN finance_categories fc ON ft.category_id = fc.id
            WHERE ft.id = $1`,
            [result.rows[0].id]
        );

        return NextResponse.json({
            transaction: fullTransaction.rows[0]
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating transaction:', error);
        return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }
}

// PUT /api/clubs/[clubId]/finance/transactions
export async function PUT(
    request: NextRequest,
    { params }: { params: { clubId: string } }
) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId } = params;
        const body = await request.json();

        const {
            id,
            category_id,
            amount,
            payment_method,
            status,
            transaction_date,
            description,
            notes,
            attachment_url
        } = body;

        if (!id) {
            return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
        }

        // Check if transaction belongs to club
        const checkResult = await pool.query(
            `SELECT id FROM finance_transactions WHERE id = $1 AND club_id = $2`,
            [id, clubId]
        );

        if (checkResult.rows.length === 0) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        const result = await pool.query(
            `UPDATE finance_transactions 
             SET category_id = COALESCE($1, category_id),
                 amount = COALESCE($2, amount),
                 payment_method = COALESCE($3, payment_method),
                 status = COALESCE($4, status),
                 transaction_date = COALESCE($5, transaction_date),
                 description = COALESCE($6, description),
                 notes = COALESCE($7, notes),
                 attachment_url = COALESCE($8, attachment_url)
             WHERE id = $9 AND club_id = $10
             RETURNING *`,
            [
                category_id, amount, payment_method, status, transaction_date,
                description, notes, attachment_url, id, clubId
            ]
        );

        // Fetch full transaction details
        const fullTransaction = await pool.query(
            `SELECT 
                ft.*,
                fc.name as category_name,
                fc.icon as category_icon,
                fc.color as category_color
            FROM finance_transactions ft
            JOIN finance_categories fc ON ft.category_id = fc.id
            WHERE ft.id = $1`,
            [id]
        );

        return NextResponse.json({
            transaction: fullTransaction.rows[0]
        });
    } catch (error) {
        console.error('Error updating transaction:', error);
        return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }
}

// DELETE /api/clubs/[clubId]/finance/transactions
export async function DELETE(
    request: NextRequest,
    { params }: { params: { clubId: string } }
) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId } = params;
        const { searchParams } = new URL(request.url);
        const transactionId = searchParams.get('id');

        if (!transactionId) {
            return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
        }

        const result = await pool.query(
            `DELETE FROM finance_transactions 
             WHERE id = $1 AND club_id = $2
             RETURNING id`,
            [transactionId, clubId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
    }
}
