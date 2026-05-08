import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

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
            `SELECT s.*, et.name_ru as type_name
             FROM club_equipment_type_maintenance_settings s
             JOIN equipment_types et ON s.equipment_type_code = et.code
             WHERE s.club_id = $1`,
            [clubId]
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Get Type Maintenance Settings Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const body = await request.json().catch(() => ({}));

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const guard = await ensureOwnerSubscriptionActive(clubId, userId)
        if (!guard.ok) return guard.response

        const {
            equipment_type_code,
            require_photo_before,
            min_photos_before,
            require_photo_after,
            min_photos_after,
            require_comment_mode
        } = body;

        if (!equipment_type_code) {
            return NextResponse.json({ error: 'Equipment type code is required' }, { status: 400 });
        }

        const result = await query(
            `INSERT INTO club_equipment_type_maintenance_settings (
                club_id, equipment_type_code, require_photo_before, min_photos_before,
                require_photo_after, min_photos_after, require_comment_mode
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (club_id, equipment_type_code) DO UPDATE SET
                require_photo_before = EXCLUDED.require_photo_before,
                min_photos_before = EXCLUDED.min_photos_before,
                require_photo_after = EXCLUDED.require_photo_after,
                min_photos_after = EXCLUDED.min_photos_after,
                require_comment_mode = EXCLUDED.require_comment_mode,
                updated_at = NOW()
            RETURNING *`,
            [
                clubId,
                equipment_type_code,
                require_photo_before === true,
                Math.max(0, Number(min_photos_before) || 0),
                require_photo_after !== false,
                Math.max(0, Number(min_photos_after) || 0),
                require_comment_mode || 'ON_ISSUE'
            ]
        );

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Update Type Maintenance Settings Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
