import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '7');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify ownership
        const ownerCheck = await query(
            `SELECT id FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if (ownerCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get revenue by day
        const result = await query(
            `SELECT 
        DATE(closed_at) as date,
        COALESCE(SUM(total_revenue), 0) as revenue
       FROM shift_reports
       WHERE club_id = $1 
         AND status = 'CLOSED'
         AND closed_at >= CURRENT_DATE - INTERVAL '${days} days'
       GROUP BY DATE(closed_at)
       ORDER BY DATE(closed_at) ASC`,
            [clubId]
        );

        const data = result.rows.map(row => ({
            date: row.date,
            revenue: parseFloat(row.revenue)
        }));

        return NextResponse.json({ data });

    } catch (error) {
        console.error('Get Revenue Chart Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
