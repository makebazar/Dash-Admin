import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/db';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { clubId } = await params;
        const { searchParams } = new URL(request.url);
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

        // Verify club ownership
        const clubCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if (clubCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get saved schedules
        const result = await query(
            `SELECT user_id, planned_shifts 
             FROM employee_shift_schedules 
             WHERE club_id = $1 AND month = $2 AND year = $3`,
            [clubId, month, year]
        );

        return NextResponse.json({
            schedules: result.rows,
            period: { month, year },
            default_shifts: 20
        });

    } catch (error: any) {
        console.error('Shift Schedules GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { clubId } = await params;
        const body = await request.json();
        const { month, year, schedules } = body;

        console.log('=== SAVE SCHEDULES ===');
        console.log('Club ID:', clubId);
        console.log('Month:', month, 'Year:', year);
        console.log('Schedules:', JSON.stringify(schedules, null, 2));

        // Verify club ownership
        const clubCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if (clubCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Update or insert schedules
        for (const schedule of schedules) {
            console.log('Saving schedule for user:', schedule.user_id, 'planned_shifts:', schedule.planned_shifts);

            await query(
                `INSERT INTO employee_shift_schedules 
                    (club_id, user_id, month, year, planned_shifts, updated_at)
                 VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                 ON CONFLICT (club_id, user_id, month, year)
                 DO UPDATE SET 
                    planned_shifts = EXCLUDED.planned_shifts,
                    updated_at = CURRENT_TIMESTAMP`,
                [clubId, schedule.user_id, month, year, schedule.planned_shifts]
            );
        }

        console.log('Schedules saved successfully');
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Update Shift Schedules Error:', error);
        console.error('Error stack:', error.stack);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
