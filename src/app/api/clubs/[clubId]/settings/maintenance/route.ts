import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard';

const DEFAULT_SETTINGS = {
    require_photos_on_completion: true,
    min_photos: 1,
    require_notes_on_completion: false,
};

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
            `SELECT require_photos_on_completion, min_photos, require_notes_on_completion
             FROM club_maintenance_settings
             WHERE club_id = $1`,
            [clubId]
        );

        if ((result.rowCount || 0) === 0) {
            return NextResponse.json(DEFAULT_SETTINGS);
        }

        const row = result.rows[0];
        return NextResponse.json({
            require_photos_on_completion: row.require_photos_on_completion !== false,
            min_photos: Math.max(0, Number(row.min_photos) || 0),
            require_notes_on_completion: row.require_notes_on_completion === true,
        });
    } catch (error) {
        console.error('Get Maintenance Settings Error:', error);
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

        const requirePhotos = body.require_photos_on_completion !== false;
        const minPhotosRaw = Number(body.min_photos);
        const minPhotos = Math.max(0, Math.min(10, Number.isFinite(minPhotosRaw) ? Math.floor(minPhotosRaw) : 0));
        const requireNotes = body.require_notes_on_completion === true;

        const normalizedMinPhotos = requirePhotos ? Math.max(1, minPhotos) : 0;

        const result = await query(
            `INSERT INTO club_maintenance_settings (
                club_id, require_photos_on_completion, min_photos, require_notes_on_completion
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (club_id) DO UPDATE SET
                require_photos_on_completion = EXCLUDED.require_photos_on_completion,
                min_photos = EXCLUDED.min_photos,
                require_notes_on_completion = EXCLUDED.require_notes_on_completion,
                updated_at = NOW()
            RETURNING require_photos_on_completion, min_photos, require_notes_on_completion`,
            [clubId, requirePhotos, normalizedMinPhotos, requireNotes]
        );

        return NextResponse.json(result.rows[0] || {
            require_photos_on_completion: requirePhotos,
            min_photos: normalizedMinPhotos,
            require_notes_on_completion: requireNotes,
        });
    } catch (error) {
        console.error('Update Maintenance Settings Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

