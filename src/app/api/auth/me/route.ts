import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user info
        const userResult = await query(
            `SELECT id, full_name, phone_number FROM users WHERE id = $1`,
            [userId]
        );

        if (userResult.rowCount === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const user = userResult.rows[0];

        // Get owned clubs
        const ownedClubsResult = await query(
            `SELECT id, name FROM clubs WHERE owner_id = $1 ORDER BY created_at DESC`,
            [userId]
        );

        // Get employee clubs with role
        // We use IS NOT FALSE to handle potential NULLs in is_active
        const employeeClubsResult = await query(
            `SELECT c.id, c.name, r.name as role_name, r.id as role_id, c.inventory_required
       FROM clubs c
       JOIN club_employees ce ON c.id = ce.club_id
       LEFT JOIN users u ON ce.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE ce.user_id = $1 AND ce.is_active IS NOT FALSE
       ORDER BY ce.hired_at DESC`,
            [userId]
        );

        console.log(`[API/ME] User ${userId} has ${employeeClubsResult.rowCount} active employee clubs`)

        const ownedClubs = ownedClubsResult.rows.map(row => ({
            id: row.id,
            name: row.name
        }));

        const employeeClubs = employeeClubsResult.rows.map(row => ({
            id: row.id,
            name: row.name,
            inventory_required: row.inventory_required, // Migration ensures this column exists
            role: row.role_name || 'Сотрудник',
            role_id: row.role_id
        }));

        return NextResponse.json({
            user: {
                id: user.id,
                full_name: user.full_name,
                phone_number: user.phone_number
            },
            ownedClubs,
            employeeClubs
        });

    } catch (error) {
        console.error('Get Me Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
