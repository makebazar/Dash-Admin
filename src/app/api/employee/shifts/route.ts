import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// POST - Start a new shift
export async function POST(request: Request) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        console.log('Start Shift Request:', { userId, body });
        const { club_id } = body;

        if (!club_id) {
            return NextResponse.json({ error: 'Club ID required' }, { status: 400 });
        }

        // Verify user is employee OR owner of this club
        const accessCheck = await query(
            `
            SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2
            UNION
            SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
            `,
            [club_id, userId]
        );

        console.log('Access Check:', accessCheck.rows);

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'You are not an employee of this club' }, { status: 403 });
        }

        // Check if already has active shift in this club
        const activeCheck = await query(
            `SELECT id FROM shifts WHERE user_id = $1 AND club_id = $2 AND check_out IS NULL`,
            [userId, club_id]
        );

        if ((activeCheck.rowCount || 0) > 0) {
            console.log('Active Shift Found:', activeCheck.rows[0]);
            return NextResponse.json({ error: 'You already have an active shift in this club' }, { status: 400 });
        }

        // Get club settings for shift type
        const clubSettings = await query(
            `SELECT timezone, day_start_hour, night_start_hour FROM clubs WHERE id = $1`,
            [club_id]
        );
        
        const clubTimezone = clubSettings.rows[0]?.timezone || 'Europe/Moscow';
        const dayStartHour = clubSettings.rows[0]?.day_start_hour ?? 8;
        const nightStartHour = clubSettings.rows[0]?.night_start_hour ?? 20;

        const checkIn = new Date();
        
        // Determine shift type
        let shiftType = 'DAY';
        const hourInClubTZ = new Intl.DateTimeFormat('en-US', {
            timeZone: clubTimezone,
            hour: 'numeric',
            hourCycle: 'h23'
        }).format(checkIn);
        const hour = parseInt(hourInClubTZ);

        if (!isNaN(hour)) {
            if (dayStartHour < nightStartHour) {
                // Standard day: e.g. 08:00 to 20:00
                if (hour >= dayStartHour && hour < nightStartHour) {
                    shiftType = 'DAY';
                } else {
                    shiftType = 'NIGHT';
                }
            } else {
                // Wrapped day (unlikely but possible): e.g. Day starts 20:00, Night starts 08:00
                if (hour >= dayStartHour || hour < nightStartHour) {
                    shiftType = 'DAY';
                } else {
                    shiftType = 'NIGHT';
                }
            }
        }

        // Create new shift
        const result = await query(
            `INSERT INTO shifts (user_id, club_id, check_in, shift_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
            [userId, club_id, checkIn, shiftType]
        );

        return NextResponse.json({
            success: true,
            shift_id: result.rows[0].id
        });

    } catch (error: any) {
        console.error('Start Shift Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error', details: error.toString() }, { status: 500 });
    }
}
