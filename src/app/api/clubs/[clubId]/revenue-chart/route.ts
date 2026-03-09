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
        const rawDays = parseInt(searchParams.get('days') || '7');
        const days = Number.isFinite(rawDays) ? Math.min(90, Math.max(1, rawDays)) : 7;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const result = await query(
            `SELECT 
                DATE(closed_at) as date,
                COALESCE(SUM(total_revenue), 0) as revenue
             FROM shift_reports
             WHERE club_id = $1 
               AND status = 'CLOSED'
               AND closed_at >= CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day'
             GROUP BY DATE(closed_at)
             ORDER BY DATE(closed_at) ASC`,
            [clubId, days]
        );

        const revenueByDate = new Map(
            result.rows.map(row => [
                new Date(row.date).toISOString().split('T')[0],
                parseFloat(row.revenue)
            ])
        );
        const data = Array.from({ length: days }, (_, index) => {
            const day = new Date();
            day.setHours(0, 0, 0, 0);
            day.setDate(day.getDate() - (days - 1 - index));
            const key = day.toISOString().split('T')[0];
            return {
                date: key,
                revenue: revenueByDate.get(key) || 0
            };
        });

        return NextResponse.json({ data });

    } catch (error) {
        console.error('Get Revenue Chart Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
