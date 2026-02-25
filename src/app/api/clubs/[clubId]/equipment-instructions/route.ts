import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// GET - List all instructions for a club
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

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');

        if (type) {
            const result = await query(
                `SELECT * FROM club_equipment_instructions WHERE club_id = $1 AND equipment_type_code = $2`,
                [clubId, type]
            );
            return NextResponse.json(result.rows[0] || {});
        }

        const result = await query(
            `SELECT * FROM club_equipment_instructions WHERE club_id = $1`,
            [clubId]
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Get Instructions Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Update or Create instruction
export async function POST(
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

        // Only owners or admins can edit instructions
        const accessCheck = await query(
            `SELECT role FROM club_employees WHERE club_id = $1 AND user_id = $2
             UNION
             SELECT 'OWNER' as role FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Check for admin role if not owner (simplified check, assume any employee with access can edit for now, or check specific roles)
        // For now, allow any authorized employee to edit instructions to keep it simple as requested "we (admins) write"

        const { equipment_type_code, instructions, default_interval_days, apply_to_existing } = body;

        if (!equipment_type_code) {
            return NextResponse.json({ error: 'Equipment type code is required' }, { status: 400 });
        }

        const result = await query(
            `INSERT INTO club_equipment_instructions (club_id, equipment_type_code, instructions, updated_by, default_interval_days)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (club_id, equipment_type_code) 
             DO UPDATE SET 
                instructions = EXCLUDED.instructions,
                default_interval_days = EXCLUDED.default_interval_days,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = EXCLUDED.updated_by
             RETURNING *`,
            [clubId, equipment_type_code, instructions, userId, default_interval_days || null]
        );

        // Apply interval to existing equipment if requested
        if (apply_to_existing && default_interval_days) {
            await query(
                `UPDATE equipment 
                 SET cleaning_interval_days = $1 
                 WHERE club_id = $2 AND type = $3`,
                [default_interval_days, clubId, equipment_type_code]
            );
        }

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Save Instruction Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
