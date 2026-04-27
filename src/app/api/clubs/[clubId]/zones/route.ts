import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { requireClubFullAccess } from '@/lib/club-api-access';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='club_zones' AND column_name='display_order') THEN
                    ALTER TABLE club_zones ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
                END IF;
            END $$;
        `);

        // Verify access
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Auto-create missing zones from workstations to ensure they appear in the list
        await query(
            `INSERT INTO club_zones (club_id, name)
             SELECT DISTINCT w.club_id, w.zone
             FROM club_workstations w
             WHERE w.club_id = $1
             AND w.zone IS NOT NULL
             AND w.zone != ''
             AND NOT EXISTS (
                 SELECT 1 FROM club_zones z 
                 WHERE z.club_id = w.club_id 
                 AND z.name = w.zone
             )`,
            [clubId]
        );

        await query(
            `
            WITH ranked AS (
                SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) as rn
                FROM club_zones
                WHERE club_id = $1
            )
            UPDATE club_zones z
            SET display_order = ranked.rn
            FROM ranked
            WHERE z.id = ranked.id
              AND z.club_id = $1
              AND z.display_order = 0
            `,
            [clubId]
        );

        const result = await query(
            `SELECT 
                z.id,
                z.name,
                z.display_order,
                z.assigned_user_id,
                u.full_name as assigned_user_name,
                (SELECT COUNT(*) FROM club_workstations w WHERE w.club_id = z.club_id AND w.zone = z.name) as workstation_count
             FROM club_zones z
             LEFT JOIN users u ON z.assigned_user_id = u.id
             WHERE z.club_id = $1
             ORDER BY z.display_order ASC, z.name ASC`,
            [clubId]
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Get Zones Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const body = await request.json();
        const { name, assigned_user_id } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!name) {
            return NextResponse.json({ error: 'Zone name is required' }, { status: 400 });
        }

        await requireClubFullAccess(clubId)

        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='club_zones' AND column_name='display_order') THEN
                    ALTER TABLE club_zones ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
                END IF;
            END $$;
        `);

        const result = await query(
            `INSERT INTO club_zones (club_id, name, assigned_user_id, display_order)
             VALUES (
                $1,
                $2,
                $3,
                COALESCE((SELECT MAX(display_order) FROM club_zones WHERE club_id = $1), 0) + 1
             )
             RETURNING id, name, assigned_user_id, display_order`,
            [clubId, name, assigned_user_id || null]
        );

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        const status = (error as any)?.status
        if (status === 401 || status === 403) {
            return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
        }
        console.error('Create Zone Error:', error);
        if ((error as any).code === '23505') { // Unique violation
            return NextResponse.json({ error: 'Zone already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
