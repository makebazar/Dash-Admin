import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// Generate random 6-char binding code
function generateBindingCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

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

        // Verify access (owner or employee)
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
            `SELECT w.*, u.full_name as assigned_user_name
             FROM club_workstations w
             LEFT JOIN users u ON w.assigned_user_id = u.id
             WHERE w.club_id = $1
             ORDER BY w.zone, w.name`,
            [clubId]
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Get Workstations Error:', error);
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
        const { name, zone, action } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify ownership (only owner can add PCs)
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Action: generate new binding code
        if (action === 'generate_binding_code') {
            const workstationId = body.workstation_id;
            if (!workstationId) {
                return NextResponse.json({ error: 'workstation_id required' }, { status: 400 });
            }

            let code = generateBindingCode();
            
            // Ensure unique code (rare collision)
            let attempts = 0;
            while (attempts < 10) {
                const existing = await query(
                    `SELECT 1 FROM club_workstations WHERE binding_code = $1`,
                    [code]
                );
                if ((existing.rowCount || 0) === 0) break;
                code = generateBindingCode();
                attempts++;
            }

            const result = await query(
                `UPDATE club_workstations SET binding_code = $1 WHERE id = $2 AND club_id = $3 RETURNING id, name, binding_code`,
                [code, workstationId, clubId]
            );

            if ((result.rowCount || 0) === 0) {
                return NextResponse.json({ error: 'Workstation not found' }, { status: 404 });
            }

            return NextResponse.json(result.rows[0]);
        }

        // Default: create workstation
        let bindingCode = generateBindingCode();
        let attempts = 0;
        while (attempts < 10) {
            const existing = await query(
                `SELECT 1 FROM club_workstations WHERE binding_code = $1`,
                [bindingCode]
            );
            if ((existing.rowCount || 0) === 0) break;
            bindingCode = generateBindingCode();
            attempts++;
        }

        const result = await query(
            `INSERT INTO club_workstations (club_id, name, zone, binding_code)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [clubId, name, zone || 'General', bindingCode]
        );

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Add Workstation Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
