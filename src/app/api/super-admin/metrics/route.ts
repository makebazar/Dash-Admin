import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if super admin
        const adminCheck = await query(
            `SELECT is_super_admin FROM users WHERE id = $1`,
            [userId]
        );

        if (!adminCheck.rows[0]?.is_super_admin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch all metrics
        const result = await query(
            `SELECT * FROM system_metrics ORDER BY category, created_at ASC`
        );

        return NextResponse.json({ metrics: result.rows });

    } catch (error) {
        console.error('Get Metrics Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const adminCheck = await query(
            `SELECT is_super_admin FROM users WHERE id = $1`,
            [userId]
        );

        if (!adminCheck.rows[0]?.is_super_admin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { key, label, type, category, description, is_required } = await request.json();

        const result = await query(
            `INSERT INTO system_metrics (key, label, type, category, description, is_required)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [key, label, type, category, description, is_required || false]
        );

        return NextResponse.json({ metric: result.rows[0] });

    } catch (error) {
        console.error('Create Metric Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
