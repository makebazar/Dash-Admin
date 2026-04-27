import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { hasColumn } from '@/lib/db-compat';

// POST - Start a new shift
export async function POST(request: Request) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        console.log('Start Shift Request:', { userId, body });
        const { club_id, role_id } = body;

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

        const hasShiftRoleIdSnapshot = await hasColumn('shifts', 'shift_role_id_snapshot')
        const hasShiftRoleNameSnapshot = await hasColumn('shifts', 'shift_role_name_snapshot')
        if (!hasShiftRoleIdSnapshot || !hasShiftRoleNameSnapshot) {
            await query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shifts' AND column_name='shift_role_id_snapshot') THEN
                        ALTER TABLE shifts ADD COLUMN shift_role_id_snapshot INTEGER NULL;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shifts' AND column_name='shift_role_name_snapshot') THEN
                        ALTER TABLE shifts ADD COLUMN shift_role_name_snapshot VARCHAR(64) NULL;
                    END IF;
                END $$;
            `);
        }

        await query(`
            CREATE TABLE IF NOT EXISTS club_employee_roles (
                club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
                priority INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(club_id, user_id, role_id)
            );
            CREATE INDEX IF NOT EXISTS idx_club_employee_roles_club_user ON club_employee_roles(club_id, user_id);
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS club_employee_role_preferences (
                club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                active_role_id INTEGER NULL REFERENCES roles(id) ON DELETE SET NULL,
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(club_id, user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_club_employee_role_preferences_club_user ON club_employee_role_preferences(club_id, user_id);
        `);

        const assignedRolesRes = await query(
            `SELECT role_id FROM club_employee_roles WHERE club_id = $1 AND user_id = $2 ORDER BY priority ASC`,
            [club_id, userId]
        );
        const assignedRoleIds = assignedRolesRes.rows.map(r => Number(r.role_id)).filter(v => Number.isFinite(v));

        const prefRes = await query(
            `SELECT active_role_id FROM club_employee_role_preferences WHERE club_id = $1 AND user_id = $2 LIMIT 1`,
            [club_id, userId]
        );
        const preferredRoleId = prefRes.rows[0]?.active_role_id ? Number(prefRes.rows[0].active_role_id) : null;

        const requestedRoleId = role_id === null || role_id === undefined ? null : Number(role_id);
        if (requestedRoleId !== null && !Number.isFinite(requestedRoleId)) {
            return NextResponse.json({ error: 'Invalid role_id' }, { status: 400 });
        }

        let effectiveRoleId: number | null = null;
        if (requestedRoleId !== null) effectiveRoleId = requestedRoleId;
        else if (preferredRoleId !== null) effectiveRoleId = preferredRoleId;
        else if (assignedRoleIds.length > 0) effectiveRoleId = assignedRoleIds[0];
        else {
            const fallbackRoleRes = await query(`SELECT role_id FROM users WHERE id = $1`, [userId]);
            const fallback = fallbackRoleRes.rows[0]?.role_id ? Number(fallbackRoleRes.rows[0].role_id) : null;
            effectiveRoleId = fallback;
        }

        if (effectiveRoleId === null) {
            try {
                const ownerCheck = await query(`SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`, [club_id, userId])
                if ((ownerCheck.rowCount || 0) > 0) {
                    await query(`INSERT INTO roles (name, default_kpi_settings) VALUES ('Владелец', '{}'::jsonb) ON CONFLICT (name) DO NOTHING`)
                    const ownerRoleRes = await query(`SELECT id FROM roles WHERE name = 'Владелец' LIMIT 1`)
                    const ownerRoleId = ownerRoleRes.rows[0]?.id ? Number(ownerRoleRes.rows[0].id) : null
                    if (ownerRoleId) effectiveRoleId = ownerRoleId
                }
            } catch {}
        }

        if (effectiveRoleId !== null && assignedRoleIds.length > 0 && !assignedRoleIds.includes(effectiveRoleId)) {
            return NextResponse.json({ error: 'Role not allowed' }, { status: 403 });
        }

        let effectiveRoleName: string | null = null;
        if (effectiveRoleId !== null) {
            const roleNameRes = await query(`SELECT name FROM roles WHERE id = $1`, [effectiveRoleId]);
            effectiveRoleName = roleNameRes.rows[0]?.name ? String(roleNameRes.rows[0].name) : null;
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
        const timeFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: clubTimezone,
            hour: 'numeric',
            minute: 'numeric',
            hourCycle: 'h23'
        });
        const timeParts = timeFormatter.formatToParts(checkIn);
        const hour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0');
        const minute = parseInt(timeParts.find(p => p.type === 'minute')?.value || '0');
        const hourFloat = hour + (minute / 60);

        // Tolerance in hours (e.g. 1.5 hours). If day starts at 8:00, starting at 6:31 is still DAY.
        const tolerance = 1.5;

        if (!isNaN(hourFloat)) {
            if (dayStartHour < nightStartHour) {
                // Standard day: e.g. 08:00 to 20:00
                const dayStartWithTolerance = dayStartHour - tolerance;
                const nightStartWithTolerance = nightStartHour - tolerance;

                if (hourFloat >= dayStartWithTolerance && hourFloat < nightStartWithTolerance) {
                    shiftType = 'DAY';
                } else {
                    shiftType = 'NIGHT';
                }
            } else {
                // Wrapped day (unlikely but possible): e.g. Day starts 20:00, Night starts 08:00
                const dayStartWithTolerance = dayStartHour - tolerance;
                const nightStartWithTolerance = nightStartHour - tolerance;

                if (hourFloat >= dayStartWithTolerance || hourFloat < nightStartWithTolerance) {
                    shiftType = 'DAY';
                } else {
                    shiftType = 'NIGHT';
                }
            }
        }

        // Create new shift
        const result = await query(
            `INSERT INTO shifts (user_id, club_id, check_in, shift_type, shift_role_id_snapshot, shift_role_name_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
            [userId, club_id, checkIn, shiftType, effectiveRoleId, effectiveRoleName]
        );

        return NextResponse.json({
            success: true,
            shift_id: result.rows[0].id,
            role_id: effectiveRoleId,
            role_name: effectiveRoleName
        });

    } catch (error: any) {
        console.error('Start Shift Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error', details: error.toString() }, { status: 500 });
    }
}
