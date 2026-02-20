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
            `SELECT id, name, address, timezone, day_start_hour, night_start_hour, inventory_required, inventory_settings FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((result.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch additional data for settings UI
        const warehousesRes = await query(`SELECT id, name FROM warehouses WHERE club_id = $1 ORDER BY name`, [clubId]);
        const metricsRes = await query(`SELECT key, label FROM system_metrics WHERE type = 'MONEY' ORDER BY label`);

        return NextResponse.json({ 
            club: result.rows[0],
            warehouses: warehousesRes.rows,
            metrics: metricsRes.rows
        });

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
        if (body.inventory_required !== undefined) {
            updates.push(`inventory_required = $${idx++}`);
            values.push(body.inventory_required);
        }
        if (body.inventory_settings !== undefined) {
            updates.push(`inventory_settings = $${idx++}`);
            values.push(body.inventory_settings);
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(clubId);

        const result = await query(
            `UPDATE clubs SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, address, timezone, day_start_hour, night_start_hour, inventory_required, inventory_settings`,
            values
        );

        return NextResponse.json({ success: true, club: result.rows[0] });

    } catch (error: any) {
        console.error('Update Club Settings Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
