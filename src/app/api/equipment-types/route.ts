import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { hasColumn } from '@/lib/db-compat';

export const dynamic = 'force-dynamic';

// GET - Get equipment types list
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const clubId = searchParams.get('clubId');
        const supportsClubTypes = await hasColumn('equipment_types', 'club_id');

        if (!supportsClubTypes) {
            const result = await query(
                `SELECT * FROM equipment_types ORDER BY sort_order, name_ru`
            );

            return NextResponse.json(result.rows);
        }

        if (!clubId) {
            const result = await query(
                `SELECT code, name, name_ru, default_cleaning_interval, icon, sort_order, club_id, is_system, is_active, created_by, base_type_code
                 FROM equipment_types
                 WHERE is_active = TRUE
                   AND club_id IS NULL
                 ORDER BY sort_order, name_ru`
            );

            return NextResponse.json(result.rows);
        }

        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const result = await query(
            `SELECT code, name, name_ru, default_cleaning_interval, icon, sort_order, club_id, is_system, is_active, created_by, base_type_code
             FROM equipment_types
             WHERE is_active = TRUE
               AND (club_id IS NULL OR club_id = $1)
             ORDER BY
                CASE WHEN club_id = $1 THEN 0 ELSE 1 END,
                sort_order,
                name_ru`,
            [clubId]
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Get Equipment Types Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
