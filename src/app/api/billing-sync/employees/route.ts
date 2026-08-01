import { NextResponse } from 'next/server';
import { query } from '@/db';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const xClubId = request.headers.get('X-Club-Id');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const apiKey = authHeader.substring(7);
        const targetClubId = xClubId ? parseInt(xClubId) : null;

        if (!targetClubId) {
            return NextResponse.json({ error: 'X-Club-Id is required' }, { status: 400 });
        }

        // Fetch club details to verify API Key
        const clubRes = await query(
            `SELECT inventory_settings FROM clubs WHERE id = $1`,
            [targetClubId]
        );

        if (!clubRes.rows || clubRes.rows.length === 0) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }

        const club = clubRes.rows[0];
        const clubApiKey = club.inventory_settings?.api_key || process.env.DASHADMIN_SYNC_KEY;

        // Verify API key
        if (clubApiKey && apiKey !== clubApiKey && apiKey !== process.env.DASHADMIN_SYNC_KEY) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Query employees from postgres
        const employeesRes = await query(
            `SELECT u.id, u.full_name, u.phone_number, u.password_hash, ce.role 
             FROM club_employees ce
             JOIN users u ON ce.user_id = u.id
             WHERE ce.club_id = $1 AND ce.is_active = TRUE AND ce.dismissed_at IS NULL`,
            [targetClubId]
        );

        return NextResponse.json({
            success: true,
            employees: employeesRes.rows.map(row => {
                const r = (row.role || '').toUpperCase().trim();
                let mappedRole = 'ADMIN';
                if (r === 'ВЛАДЕЛЕЦ' || r === 'OWNER') mappedRole = 'OWNER';
                else if (r === 'СТАРШИЙ АДМИН' || r === 'СТ. АДМИН' || r === 'SENIOR_ADMIN' || r === 'УПРАВЛЯЮЩИЙ') mappedRole = 'SENIOR_ADMIN';

                return {
                    id: row.id,
                    full_name: row.full_name,
                    phone: row.phone_number,
                    password_hash: row.password_hash,
                    role: mappedRole
                };
            })
        });

    } catch (error) {
        console.error('Employees sync API error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
