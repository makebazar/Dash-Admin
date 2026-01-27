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

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch closed/paid/verified shifts for history
        const shiftsRes = await query(
            `SELECT 
                id,
                check_in,
                check_out,
                total_hours,
                calculated_salary as earnings,
                status,
                shift_type
             FROM shifts
             WHERE user_id = $1 
               AND club_id = $2 
               AND status IN ('CLOSED', 'PAID', 'VERIFIED')
             ORDER BY check_in DESC
             LIMIT 50`,
            [userId, clubId]
        );

        return NextResponse.json({ shifts: shiftsRes.rows });

    } catch (error: any) {
        console.error('Shift History Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
