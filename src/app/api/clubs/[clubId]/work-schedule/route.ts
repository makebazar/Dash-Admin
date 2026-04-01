import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { formatDateKeyInTimezone, formatLocalDate, parseDateKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// GET: Get work schedule for a specific month
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { searchParams } = new URL(request.url, `http://${request.headers.get('host') || 'localhost'}`);
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

                    -- Club Employees table additions (show_in_schedule)
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='club_employees' AND column_name='show_in_schedule') THEN
                        ALTER TABLE club_employees ADD COLUMN show_in_schedule BOOLEAN DEFAULT TRUE;
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
        let clubSettings = { day_start_hour: 9, night_start_hour: 21, timezone: 'Europe/Moscow' };
        try {
            const clubRes = await query(`SELECT * FROM clubs WHERE id = $1`, [clubId]);
            if (clubRes.rows[0]) {
                const row = clubRes.rows[0];
                clubSettings = {
                    day_start_hour: row.day_start_hour ?? 9,
                    night_start_hour: row.night_start_hour ?? 21,
                    timezone: row.timezone || 'Europe/Moscow'
                };
            }
        } catch (e: any) {
            console.warn('Failed to fetch club settings (using defaults):', e.message);
        }

        const startOfMonth = `${year}-${month.toString().padStart(2, '0')}-01`;
        const startDate = formatLocalDate(new Date(year, month - 1, -2));
        const endOfMonth = formatLocalDate(new Date(year, month, 0));

        // Get employees
        let employees = [];
        try {
            console.log(`Fetching schedule employees for club ${clubId}, date >= ${startDate}`);
            const employeesRes = await query(
                `SELECT u.id, u.full_name, r.name as role, ce.dismissed_at, ce.display_order, ce.is_active, ce.show_in_schedule
                 FROM club_employees ce
                 JOIN users u ON u.id = ce.user_id
                 LEFT JOIN roles r ON u.role_id = r.id
                 WHERE ce.club_id = $1 
                 AND (
                    (ce.dismissed_at IS NULL AND ce.is_active = TRUE AND ce.show_in_schedule = TRUE)
                    OR 
                    (ce.dismissed_at IS NOT NULL AND ce.dismissed_at >= $2::date)
                 )
                 ORDER BY ce.dismissed_at ASC NULLS FIRST, ce.display_order ASC, u.full_name ASC`,
                [clubId, startDate]
            );
            employees = employeesRes.rows;
            console.log(`Found ${employees.length} employees. Dismissed included if date >= ${startDate}`);
        } catch (err: any) {
            console.error('Failed to fetch employees:', err);
            throw new Error(`Employee query failed: ${err.message}`);
        }

        let schedule = {};
        try {
            const scheduleRes = await query(
                `SELECT user_id, TO_CHAR(date, 'YYYY-MM-DD') as date, shift_type 
                 FROM work_schedules 
                 WHERE club_id = $1 AND date >= $2 AND date <= $3`,
                [clubId, startDate, endOfMonth]
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

        const clubRes = await query(
            `SELECT COALESCE(timezone, 'Europe/Moscow') as timezone
             FROM clubs
             WHERE id = $1`,
            [clubId]
        );
        const clubTimezone = clubRes.rows[0]?.timezone || 'Europe/Moscow';

        if (shiftType === null) {
            await query(`DELETE FROM work_schedules WHERE club_id = $1 AND user_id = $2 AND date = $3`, [clubId, userId, date]);
            
            // --- RESCHEDULE LOGIC START ---
            // If a shift is removed, we must check if any PENDING maintenance tasks were assigned to this user on this date.
            // If so, we need to move them to the NEXT available shift for this user.
            
            // 1. Find affected tasks
            const affectedTasks = await query(
                `SELECT id, equipment_id, due_date FROM equipment_maintenance_tasks 
                 WHERE assigned_user_id = $1 AND due_date = $2 AND status = 'PENDING'`,
                [userId, date]
            );

            if (affectedTasks.rowCount && affectedTasks.rowCount > 0) {
                // 2. Find next available shift for this user starting from tomorrow relative to the deleted date
                const deletedDate = parseDateKey(date);
                const nextDay = new Date(deletedDate);
                nextDay.setDate(nextDay.getDate() + 1);
                const nextDayStr = formatDateKeyInTimezone(nextDay, clubTimezone);

                const nextShiftRes = await query(
                    `SELECT TO_CHAR(date, 'YYYY-MM-DD') as date
                     FROM work_schedules 
                     WHERE club_id = $1 AND user_id = $2 AND date >= $3
                     ORDER BY date ASC LIMIT 1`,
                    [clubId, userId, nextDayStr]
                );

                if (nextShiftRes.rowCount && nextShiftRes.rowCount > 0) {
                    const newDateStr = String(nextShiftRes.rows[0].date);
                    
                    const taskIds = affectedTasks.rows.map((t: any) => t.id);
                    
                    await query(
                        `UPDATE equipment_maintenance_tasks 
                         SET due_date = $1 
                         WHERE id = ANY($2)`,
                        [newDateStr, taskIds]
                    );
                    console.log(`[Schedule] Rescheduled ${taskIds.length} tasks from ${date} to ${newDateStr} for user ${userId}`);
                } else {
                    // No future shifts found! 
                    // Unassign user so tasks become free for others
                    const taskIds = affectedTasks.rows.map((t: any) => t.id);
                    
                    // We need to pass the IDs array directly as a parameter for ANY($1)
                    await query(
                        `UPDATE equipment_maintenance_tasks 
                         SET assigned_user_id = NULL 
                         WHERE id = ANY($1)`,
                        [taskIds]
                    );
                    console.log(`[Schedule] Unassigned ${taskIds.length} tasks from ${date} for user ${userId} (no future shifts)`);
                }
            }
            // --- RESCHEDULE LOGIC END ---

        } else {
            await query(
                `INSERT INTO work_schedules (club_id, user_id, date, shift_type) VALUES ($1, $2, $3, $4)
                 ON CONFLICT (club_id, user_id, date) DO UPDATE SET shift_type = EXCLUDED.shift_type`,
                [clubId, userId, date, shiftType]
            );
            
            // --- OPTIMIZATION LOGIC START ---
            // If a shift is ADDED (or restored), check if there are any PENDING tasks 
            // that could be assigned or moved to this new shift date.
            
            // Find:
            // 1. Tasks already assigned to this user that are scheduled for the FUTURE
            // 2. Tasks already assigned to this user that are scheduled for a day where they DON'T have a shift
            // 3. Tasks currently UNASSIGNED but where this user is the responsible person for the equipment
            const candidateTasks = await query(
                `SELECT t.id, t.equipment_id, t.due_date, e.cleaning_interval_days, e.last_cleaned_at, t.assigned_user_id
                 FROM equipment_maintenance_tasks t
                 JOIN equipment e ON t.equipment_id = e.id
                 WHERE (t.assigned_user_id = $1 OR (t.assigned_user_id IS NULL AND e.assigned_user_id = $1))
                   AND t.status = 'PENDING'
                   AND e.club_id = $2
                 ORDER BY t.due_date ASC`,
                [userId, clubId]
            );

            if (candidateTasks.rowCount && candidateTasks.rowCount > 0) {
                const newShiftDate = new Date(date);
                newShiftDate.setHours(0,0,0,0);
                
                const tasksToMove = [];
                const tasksToAssignAndMove = [];

                for (const task of candidateTasks.rows) {
                    // Skip if task is already on this date
                    const taskDate = new Date(task.due_date);
                    taskDate.setHours(0,0,0,0);
                    if (taskDate.getTime() === newShiftDate.getTime() && task.assigned_user_id === userId) continue;

                    // Check if moving to this new date respects the cleaning interval
                    let canMove = true;
                    
                    if (task.last_cleaned_at) {
                        const lastCleaned = new Date(task.last_cleaned_at);
                        const intervalDays = task.cleaning_interval_days || 30;
                        const minDate = new Date(lastCleaned);
                        minDate.setDate(minDate.getDate() + intervalDays);
                        minDate.setHours(0,0,0,0);
                        
                        if (newShiftDate < minDate) {
                            canMove = false;
                        }
                    }

                    if (canMove) {
                        // Decide if we should move it
                        // - If it's unassigned: YES
                        // - If it's on a non-shift day: YES
                        // - If it's in the future and this date is earlier: YES
                        
                        let shouldMove = false;
                        if (!task.assigned_user_id) {
                            shouldMove = true;
                        } else {
                            // Check if current due date is a shift day
                            const currentShiftCheck = await query(
                                `SELECT 1 FROM work_schedules WHERE club_id = $1 AND user_id = $2 AND date = $3`,
                                [clubId, userId, task.due_date]
                            );
                            if (currentShiftCheck.rowCount === 0) {
                                shouldMove = true;
                            } else if (newShiftDate < taskDate) {
                                shouldMove = true;
                            }
                        }

                        if (shouldMove) {
                            if (!task.assigned_user_id) tasksToAssignAndMove.push(task.id);
                            else tasksToMove.push(task.id);
                        }
                    }
                }

                if (tasksToMove.length > 0) {
                    await query(
                        `UPDATE equipment_maintenance_tasks SET due_date = $1 WHERE id = ANY($2)`,
                        [date, tasksToMove]
                    );
                }
                if (tasksToAssignAndMove.length > 0) {
                    await query(
                        `UPDATE equipment_maintenance_tasks SET due_date = $1, assigned_user_id = $2 WHERE id = ANY($3)`,
                        [date, userId, tasksToAssignAndMove]
                    );
                }
                console.log(`[Schedule] Optimized ${tasksToMove.length + tasksToAssignAndMove.length} tasks for user ${userId} on ${date}`);
            }
            // --- OPTIMIZATION LOGIC END ---
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
