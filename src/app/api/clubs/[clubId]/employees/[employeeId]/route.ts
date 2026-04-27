import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';
import { normalizePhone } from '@/lib/phone-utils';
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard';
import { hasColumn } from '@/lib/db-compat';

const SALT_ROUNDS = 10;

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string; employeeId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, employeeId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const guard = await ensureOwnerSubscriptionActive(clubId, userId)
        if (!guard.ok) return guard.response

        const hasIsActiveColumn = await hasColumn('club_employees', 'is_active')
        const hasShowInScheduleColumn = await hasColumn('club_employees', 'show_in_schedule')
        if (!hasIsActiveColumn || !hasShowInScheduleColumn) {
            await query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='club_employees' AND column_name='is_active') THEN
                        ALTER TABLE club_employees ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='club_employees' AND column_name='show_in_schedule') THEN
                        ALTER TABLE club_employees ADD COLUMN show_in_schedule BOOLEAN DEFAULT TRUE;
                    END IF;
                END $$;
            `);
        }

        const { full_name, role_id, password, phone_number, dismissed_at, is_active, show_in_schedule } = await request.json();
        console.log('[API] Updating employee:', { employeeId, full_name, role_id, phone_number, dismissed_at, is_active, show_in_schedule });

        // Verify employee belongs to this club
        const employeeCheck = await query(
            `SELECT id FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, employeeId]
        );

        if (employeeCheck.rowCount === 0) {
            const clubRes = await query(`SELECT owner_id FROM clubs WHERE id = $1`, [clubId])
            const ownerId = clubRes.rows[0]?.owner_id
            const isTargetOwner = ownerId && String(ownerId) === String(employeeId)

            if (!isTargetOwner) {
                return NextResponse.json({ error: 'Employee not found in this club' }, { status: 404 });
            }

            await query(
                `
                INSERT INTO club_employees (club_id, user_id, role, is_active, dismissed_at, show_in_schedule)
                VALUES ($1, $2, 'Владелец', TRUE, NULL, $3)
                ON CONFLICT (club_id, user_id) DO NOTHING
                `,
                [clubId, employeeId, show_in_schedule ?? true]
            )
        }

        // 1. Update USERS table
        const userUpdates = [];
        const userValues = [];
        
        if (full_name !== undefined) {
            userUpdates.push(`full_name = $${userUpdates.length + 1}`);
            userValues.push(full_name);
        }

        if (phone_number !== undefined) {
            const normalizedPhone = normalizePhone(phone_number);
            const phoneCheck = await query(
                `SELECT id FROM users WHERE phone_number = $1 AND id != $2`,
                [normalizedPhone, employeeId]
            );
            if ((phoneCheck.rowCount ?? 0) > 0) {
                return NextResponse.json({ error: 'Phone number already in use' }, { status: 400 });
            }
            userUpdates.push(`phone_number = $${userUpdates.length + 1}`);
            userValues.push(normalizedPhone);
        }

        if (role_id !== undefined) {
            userUpdates.push(`role_id = $${userUpdates.length + 1}`);
            userValues.push(role_id);
        }

        if (password) {
            const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
            userUpdates.push(`password_hash = $${userUpdates.length + 1}`);
            userValues.push(password_hash);
            userUpdates.push(`password_set_at = NOW()`);
        }

        // Also update users.is_active if explicitly restoring
        if (is_active === true) {
            userUpdates.push(`is_active = TRUE`);
        }

        if (userUpdates.length > 0) {
            userValues.push(employeeId);
            const queryText = `UPDATE users SET ${userUpdates.join(', ')} WHERE id = $${userValues.length}`;
            console.log('[API] Executing user update:', { queryText, values: userValues });
            await query(queryText, userValues);
        }

        if (role_id !== undefined) {
            let roleName = 'Сотрудник';
            if (role_id !== null) {
                const roleRes = await query(`SELECT name FROM roles WHERE id = $1`, [role_id]);
                if ((roleRes.rowCount || 0) > 0 && roleRes.rows[0]?.name) {
                    roleName = String(roleRes.rows[0].name);
                }
            }

            await query(
                `UPDATE club_employees
                 SET role = $1
                 WHERE club_id = $2 AND user_id = $3`,
                [roleName, clubId, employeeId]
            );
        }

        // 2. Update CLUB_EMPLOYEES table (Dismissal / Activation)
        const empUpdates = [];
        const empValues = [];

        // Special handling for restoration to avoid duplicate dismissed_at in SET clause
        if (is_active === true) {
            empUpdates.push(`is_active = $${empUpdates.length + 1}`);
            empValues.push(true);
            empUpdates.push(`dismissed_at = NULL`);
        } else {
            if (dismissed_at !== undefined) {
                empUpdates.push(`dismissed_at = $${empUpdates.length + 1}`);
                empValues.push(dismissed_at);
            }

            if (is_active !== undefined) {
                empUpdates.push(`is_active = $${empUpdates.length + 1}`);
                empValues.push(is_active);
            }
        }

        if (show_in_schedule !== undefined) {
            empUpdates.push(`show_in_schedule = $${empUpdates.length + 1}`);
            empValues.push(show_in_schedule);
        }

        if (empUpdates.length > 0) {
            empValues.push(clubId);
            empValues.push(employeeId);
            const queryText = `UPDATE club_employees SET ${empUpdates.join(', ')} WHERE club_id = $${empValues.length - 1} AND user_id = $${empValues.length}`;
            console.log('[API] Executing club_employee update:', { queryText, values: empValues });
            await query(queryText, empValues);
        }

        if (userUpdates.length === 0 && empUpdates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Update Employee Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
