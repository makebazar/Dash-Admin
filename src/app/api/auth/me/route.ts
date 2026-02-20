import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        console.log('[Auth/Me] Fetching user data for userId:', userId);

        if (!userId) {
            console.log('[Auth/Me] No session_user_id found');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user info
        const userResult = await query(
            `SELECT id, full_name, phone_number FROM users WHERE id = $1`,
            [userId]
        );

        if (userResult.rowCount === 0) {
            console.log('[Auth/Me] User not found in DB:', userId);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const user = userResult.rows[0];
        console.log('[Auth/Me] User found:', user.full_name);

        // Get owned clubs
        const ownedClubsResult = await query(
            `SELECT id, name FROM clubs WHERE owner_id = $1 ORDER BY created_at DESC`,
            [userId]
        );
        console.log('[Auth/Me] Owned clubs count:', ownedClubsResult.rowCount);

        // Get employee clubs with role
        const employeeClubsQuery = `
            SELECT c.id, c.name, c.inventory_required, r.name as role_name, r.id as role_id
            FROM clubs c
            JOIN club_employees ce ON c.id = ce.club_id
            LEFT JOIN users u ON ce.user_id = u.id
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE ce.user_id = $1
            ORDER BY ce.hired_at DESC
        `;
        
        console.log('[Auth/Me] Executing employee clubs query for user:', userId);
        
        const employeeClubsResult = await query(employeeClubsQuery, [userId]);
        
        console.log('[Auth/Me] Employee clubs found:', employeeClubsResult.rowCount);
        if (employeeClubsResult.rowCount === 0) {
            // Debug: check if any entries exist in club_employees for this user
            const debugCheck = await query('SELECT * FROM club_employees WHERE user_id = $1', [userId]);
            console.log('[Auth/Me] DEBUG: Raw club_employees entries for user:', debugCheck.rows);
        } else {
            console.log('[Auth/Me] Employee clubs list:', employeeClubsResult.rows.map(r => r.name));
        }

        const ownedClubs = ownedClubsResult.rows.map(row => ({
            id: row.id,
            name: row.name
        }));

        const employeeClubs = employeeClubsResult.rows.map(row => ({
            id: row.id,
            name: row.name,
            inventory_required: row.inventory_required,
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
