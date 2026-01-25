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

        const { full_name, role_id, password, phone_number } = await request.json();

        // Build update query dynamically
        const updates = [];
        const values = [];
        let valueIndex = 1;

        if (full_name !== undefined) {
            updates.push(`full_name = $${valueIndex}`);
            values.push(full_name);
            valueIndex++;
        }

        if (phone_number !== undefined) {
            const normalizedPhone = normalizePhone(phone_number);

            // Check if phone number is already taken by another user
            const phoneCheck = await query(
                `SELECT id FROM users WHERE phone_number = $1 AND id != $2`,
                [normalizedPhone, employeeId]
            );

            if ((phoneCheck.rowCount ?? 0) > 0) {
                return NextResponse.json({ error: 'Phone number already in use' }, { status: 400 });
            }

            updates.push(`phone_number = $${valueIndex}`);
            values.push(normalizedPhone);
            valueIndex++;
        }

        if (role_id !== undefined) {
            updates.push(`role_id = $${valueIndex}`);
            values.push(role_id);
            valueIndex++;
        }

        if (password) {
            // Hash password
            const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
            updates.push(`password_hash = $${valueIndex}`);
            values.push(password_hash);
            valueIndex++;
            updates.push(`password_set_at = NOW()`);
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        // Add employee ID to values
        values.push(employeeId);

        await query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${valueIndex}`,
            values
        );

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Update Employee Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
