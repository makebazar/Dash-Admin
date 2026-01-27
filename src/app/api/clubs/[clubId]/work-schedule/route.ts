import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET: Get work schedule for a specific month
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { searchParams } = new URL(request.url);
        const monthStr = searchParams.get('month') || (new Date().getMonth() + 1).toString();
        const yearStr = searchParams.get('year') || new Date().getFullYear().toString();

        const month = parseInt(monthStr);
        const year = parseInt(yearStr);

        if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
            return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
        }

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check ownership/access
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );
        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // AUTO-MIGRATION: Ensure database is ready (necessary for prod sync)
        try {
            await query(`
                DO $$ 
                BEGIN 
                    -- Clubs table additions
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clubs' AND column_name='day_start_hour') THEN
                        ALTER TABLE clubs ADD COLUMN day_start_hour INTEGER DEFAULT 9;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clubs' AND column_name='night_start_hour') THEN
                        ALTER TABLE clubs ADD COLUMN night_start_hour INTEGER DEFAULT 21;
                    END IF;
                    
                    -- Club Employees table additions (is_active)
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='club_employees' AND column_name='is_active') THEN
                        ALTER TABLE club_employees ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
                    END IF;
                END $$;
            `);

            await query(`
                CREATE TABLE IF NOT EXISTS work_schedules (
                    id SERIAL PRIMARY KEY,
                    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    date DATE NOT NULL,
                    shift_type VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(club_id, user_id, date)
                );
                CREATE INDEX IF NOT EXISTS idx_work_schedules_club_date ON work_schedules(club_id, date);
            `);
        } catch (dbError: any) {
            console.error('Work Schedule Auto-migration Failure (Non-fatal):', dbError.message);
        }

        // Get club settings safely
        let clubSettings = { day_start_hour: 9, night_start_hour: 21 };
        try {
            const clubRes = await query(`SELECT * FROM clubs WHERE id = $1`, [clubId]);
            if (clubRes.rows[0]) {
                const row = clubRes.rows[0];
                clubSettings = {
                    day_start_hour: row.day_start_hour ?? 9,
                    night_start_hour: row.night_start_hour ?? 21
                };
            }
        } catch (e: any) {
            console.warn('Failed to fetch club settings (using defaults):', e.message);
        }

        // Get employees
        let employees = [];
        try {
            const employeesRes = await query(
                `SELECT u.id, u.full_name, r.name as role 
                 FROM club_employees ce
                 JOIN users u ON u.id = ce.user_id
                 LEFT JOIN roles r ON u.role_id = r.id
                 WHERE ce.club_id = $1 AND u.is_active = TRUE
                 ORDER BY u.full_name ASC`,
                [clubId]
            );
            employees = employeesRes.rows;
        } catch (err: any) {
            console.error('Failed to fetch employees:', err);
            throw new Error(`Employee query failed: ${err.message}`);
        }

        const startOfMonth = `${year}-${month.toString().padStart(2, '0')}-01`;
        const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];

        let schedule = {};
        try {
            const scheduleRes = await query(
                `SELECT user_id, TO_CHAR(date, 'YYYY-MM-DD') as date, shift_type 
                 FROM work_schedules 
                 WHERE club_id = $1 AND date >= $2 AND date <= $3`,
                [clubId, startOfMonth, endOfMonth]
            );

            const scheduleMap: Record<string, Record<string, string>> = {};
            scheduleRes.rows.forEach(row => {
                if (!scheduleMap[row.user_id]) scheduleMap[row.user_id] = {};
                scheduleMap[row.user_id][row.date] = row.shift_type;
            });
            schedule = scheduleMap;
        } catch (err: any) {
            console.error('Failed to fetch schedule:', err);
            // Don't throw here, return empty schedule if table is missing
            schedule = {};
        }

        return NextResponse.json({
            employees,
            schedule,
            clubSettings
        });

    } catch (error: any) {
        console.error('CRITICAL: Work Schedule API Error:', error);
        return NextResponse.json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}

// PATCH: Toggle a shift
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const adminId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const body = await request.json();
        const { userId, date, shiftType } = body;

        if (!adminId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const ownerCheck = await query(`SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`, [clubId, adminId]);
        if ((ownerCheck.rowCount || 0) === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        if (shiftType === null) {
            await query(`DELETE FROM work_schedules WHERE club_id = $1 AND user_id = $2 AND date = $3`, [clubId, userId, date]);
        } else {
            await query(
                `INSERT INTO work_schedules (club_id, user_id, date, shift_type) VALUES ($1, $2, $3, $4)
                 ON CONFLICT (club_id, user_id, date) DO UPDATE SET shift_type = EXCLUDED.shift_type`,
                [clubId, userId, date, shiftType]
            );
        }

        const d = new Date(date);
        const month = d.getMonth() + 1;
        const year = d.getFullYear();

        const countRes = await query(
            `SELECT COUNT(*) FROM work_schedules 
             WHERE club_id = $1 AND user_id = $2 
             AND EXTRACT(MONTH FROM date) = $3 
             AND EXTRACT(YEAR FROM date) = $4`,
            [clubId, userId, month, year]
        );
        const plannedShifts = parseInt(countRes.rows[0].count);

        await query(
            `INSERT INTO employee_shift_schedules (club_id, user_id, month, year, planned_shifts)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (club_id, user_id, month, year) DO UPDATE 
             SET planned_shifts = EXCLUDED.planned_shifts, updated_at = NOW()`,
            [clubId, userId, month, year, plannedShifts]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Update Work Schedule Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Copy schedule from previous month
export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const adminId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { month, year } = await request.json();

        if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear--;
        }

        const copyRes = await query(
            `INSERT INTO work_schedules (club_id, user_id, date, shift_type)
             SELECT 
                club_id, 
                user_id, 
                ($1::text || '-' || $2::text || '-' || LPAD(EXTRACT(DAY FROM date)::text, 2, '0'))::date,
                shift_type
             FROM work_schedules
             WHERE club_id = $3 
               AND EXTRACT(MONTH FROM date) = $4 
               AND EXTRACT(YEAR FROM date) = $5
               AND EXTRACT(DAY FROM date) <= EXTRACT(DAY FROM (DATE_TRUNC('month', ($1::text || '-' || $2::text || '-01')::date) + INTERVAL '1 month - 1 day'))
             ON CONFLICT (club_id, user_id, date) DO UPDATE SET shift_type = EXCLUDED.shift_type`,
            [year, month.toString().padStart(2, '0'), clubId, prevMonth, prevYear]
        );

        await query(
            `INSERT INTO employee_shift_schedules (club_id, user_id, month, year, planned_shifts)
             SELECT club_id, user_id, $1, $2, COUNT(*)
             FROM work_schedules
             WHERE club_id = $3 AND EXTRACT(MONTH FROM date) = $1 AND EXTRACT(YEAR FROM date) = $2
             GROUP BY club_id, user_id
             ON CONFLICT (club_id, user_id, month, year) DO UPDATE 
             SET planned_shifts = EXCLUDED.planned_shifts, updated_at = NOW()`,
            [month, year, clubId]
        );

        return NextResponse.json({ success: true, count: copyRes.rowCount });
    } catch (error: any) {
        console.error('Copy Work Schedule Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
