import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET: Get club settings
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

        // Check ownership
        const result = await query(
            `SELECT id, name, address, timezone, day_start_hour, night_start_hour FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((result.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({ club: result.rows[0] });

    } catch (error: any) {
        console.error('Get Club Settings Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Update club settings
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const body = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Build update query
        const updates: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (body.name !== undefined) {
            updates.push(`name = $${idx++}`);
            values.push(body.name);
        }
        if (body.address !== undefined) {
            updates.push(`address = $${idx++}`);
            values.push(body.address);
        }
        if (body.timezone !== undefined) {
            updates.push(`timezone = $${idx++}`);
            values.push(body.timezone);
        }
        if (body.day_start_hour !== undefined) {
            updates.push(`day_start_hour = $${idx++}`);
            values.push(body.day_start_hour);
        }
        if (body.night_start_hour !== undefined) {
            updates.push(`night_start_hour = $${idx++}`);
            values.push(body.night_start_hour);
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(clubId);

        const result = await query(
            `UPDATE clubs SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, address, timezone, day_start_hour, night_start_hour`,
            values
        );

        return NextResponse.json({ success: true, club: result.rows[0] });

    } catch (error: any) {
        console.error('Update Club Settings Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
