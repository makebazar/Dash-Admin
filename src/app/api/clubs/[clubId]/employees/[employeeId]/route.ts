import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';
import { normalizePhone } from '@/lib/phone-utils';

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

        // Verify ownership
        const ownerCheck = await query(
            `SELECT id FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if (ownerCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Verify employee belongs to this club
        const employeeCheck = await query(
            `SELECT id FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, employeeId]
        );

        if (employeeCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Employee not found in this club' }, { status: 404 });
        }

        const { full_name, role_id, password, phone_number, dismissed_at, is_active } = await request.json();

        // 1. Update USERS table
        const userUpdates = [];
        const userValues = [];
        let userValIdx = 1;

        if (full_name !== undefined) {
            userUpdates.push(`full_name = $${userValIdx++}`);
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
            userUpdates.push(`phone_number = $${userValIdx++}`);
            userValues.push(normalizedPhone);
        }

        if (role_id !== undefined) {
            userUpdates.push(`role_id = $${userValIdx++}`);
            userValues.push(role_id);
        }

        if (password) {
            const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
            userUpdates.push(`password_hash = $${userValIdx++}`);
            userValues.push(password_hash);
            userUpdates.push(`password_set_at = NOW()`);
        }

        if (userUpdates.length > 0) {
            userValues.push(employeeId);
            await query(
                `UPDATE users SET ${userUpdates.join(', ')} WHERE id = $${userValIdx}`,
                userValues
            );
        }

        // 2. Update CLUB_EMPLOYEES table (Dismissal / Activation)
        const empUpdates = [];
        const empValues = [];
        let empValIdx = 1;

        if (dismissed_at !== undefined) {
            empUpdates.push(`dismissed_at = $${empValIdx++}`);
            empValues.push(dismissed_at);
        }

        if (is_active !== undefined) {
            empUpdates.push(`is_active = $${empValIdx++}`);
            empValues.push(is_active);
        }

        if (empUpdates.length > 0) {
            empValues.push(clubId);
            empValues.push(employeeId);
            await query(
                `UPDATE club_employees 
                 SET ${empUpdates.join(', ')} 
                 WHERE club_id = $${empValIdx++} AND user_id = $${empValIdx++}`,
                empValues
            );
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
