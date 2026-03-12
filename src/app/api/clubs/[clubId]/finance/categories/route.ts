import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET /api/clubs/[clubId]/finance/categories
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId } = await params;
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // 'income' or 'expense'

        let queryStr = `
            SELECT 
                fc.id,
                fc.club_id,
                fc.name,
                fc.type,
                fc.icon,
                fc.color,
                fc.is_system,
                fc.activity_type,
                fc.is_active,
                fc.created_at,
                COUNT(ft.id) as transaction_count,
                COALESCE(SUM(ft.amount), 0) as total_amount
            FROM finance_categories fc
            LEFT JOIN finance_transactions ft ON ft.category_id = fc.id AND ft.status = 'completed'
            WHERE (fc.club_id = $1 OR fc.club_id IS NULL)
                AND fc.is_active = true
        `;

        const values: any[] = [clubId];

        if (type) {
            queryStr += ` AND fc.type = $${values.length + 1}`;
            values.push(type);
        }

        queryStr += `
            GROUP BY fc.id
            ORDER BY fc.is_system DESC, fc.name ASC
        `;

        const result = await query(queryStr, values);

        return NextResponse.json({
            categories: result.rows
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }
}

// POST /api/clubs/[clubId]/finance/categories
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId } = await params;
        const body = await request.json();
        const { name, type, icon = '💰', color = '#3b82f6', activity_type = 'operating' } = body;

        if (!name || !type) {
            return NextResponse.json(
                { error: 'Name and type are required' },
                { status: 400 }
            );
        }

        if (!['income', 'expense'].includes(type)) {
            return NextResponse.json(
                { error: 'Type must be income or expense' },
                { status: 400 }
            );
        }

        if (!['operating', 'investing', 'financing'].includes(activity_type)) {
            return NextResponse.json(
                { error: 'Invalid activity type' },
                { status: 400 }
            );
        }

        const result = await query(
            `INSERT INTO finance_categories 
                (club_id, name, type, icon, color, is_system, activity_type, is_active)
             VALUES ($1, $2, $3, $4, $5, false, $6, true)
             RETURNING *`,
            [clubId, name, type, icon, color, activity_type]
        );

        return NextResponse.json({
            category: result.rows[0]
        });
    } catch (error: any) {
        console.error('Error creating category:', error);

        if (error.code === '23505') { // Unique violation
            return NextResponse.json(
                { error: 'Category with this name already exists' },
                { status: 409 }
            );
        }

        return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
    }
}

// PUT /api/clubs/[clubId]/finance/categories/[categoryId]
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId } = await params;
        const body = await request.json();
        const { id, name, icon, color, is_active, activity_type } = body;

        if (!id) {
            return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
        }

        // Check if category belongs to club or is system
        const checkResult = await query(
            `SELECT is_system FROM finance_categories 
             WHERE id = $1 AND (club_id = $2 OR club_id IS NULL)`,
            [id, clubId]
        );

        if (checkResult.rows.length === 0) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        // Allow system categories to be updated with activity_type only if needed, 
        // but generally users shouldn't change system category names/icons.
        // For now, let's keep it simple: only non-system categories can be updated by user.
        if (checkResult.rows[0].is_system && (name || icon || color)) {
            return NextResponse.json(
                { error: 'Cannot modify core system category properties' },
                { status: 403 }
            );
        }

        const result = await query(
            `UPDATE finance_categories 
             SET name = COALESCE($1, name),
                 icon = COALESCE($2, icon),
                 color = COALESCE($3, color),
                 is_active = COALESCE($4, is_active),
                 activity_type = COALESCE($5, activity_type)
             WHERE id = $6 AND (club_id = $7 OR club_id IS NULL)
             RETURNING *`,
            [name, icon, color, is_active, activity_type, id, clubId]
        );

        return NextResponse.json({
            category: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating category:', error);
        return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
    }
}

// DELETE /api/clubs/[clubId]/finance/categories/[categoryId]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId } = await params;
        const { searchParams } = new URL(request.url);
        const categoryId = searchParams.get('id');

        if (!categoryId) {
            return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
        }

        // Check if category can be deleted
        const checkResult = await query(
            `SELECT is_system FROM finance_categories 
             WHERE id = $1 AND club_id = $2`,
            [categoryId, clubId]
        );

        if (checkResult.rows.length === 0) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        if (checkResult.rows[0].is_system) {
            return NextResponse.json(
                { error: 'Cannot delete system categories' },
                { status: 403 }
            );
        }

        // Soft delete by setting is_active to false
        await query(
            `UPDATE finance_categories 
             SET is_active = false 
             WHERE id = $1 AND club_id = $2`,
            [categoryId, clubId]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting category:', error);
        return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
    }
}
