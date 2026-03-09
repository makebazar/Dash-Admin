import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET /api/clubs/[clubId]/equipment/[equipmentId] - Get single equipment
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string; equipmentId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, equipmentId } = await params;

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

        const result = await query(
            `SELECT 
                e.*,
                w.name as workstation_name,
                w.zone as workstation_zone,
                et.name_ru as type_name,
                et.icon as type_icon
            FROM equipment e
            LEFT JOIN club_workstations w ON e.workstation_id = w.id
            LEFT JOIN equipment_types et ON e.type = et.code
            WHERE e.id = $1 AND e.club_id = $2`,
            [equipmentId, clubId]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
        }

        // Get recent issues
        const issuesResult = await query(
            `SELECT * FROM equipment_issues 
             WHERE equipment_id = $1 
             ORDER BY created_at DESC 
             LIMIT 10`,
            [equipmentId]
        );

        // Get recent maintenance tasks
        const tasksResult = await query(
            `SELECT mt.*, u.full_name as assigned_to_name
             FROM equipment_maintenance_tasks mt
             LEFT JOIN users u ON mt.assigned_user_id = u.id
             WHERE mt.equipment_id = $1 
             ORDER BY mt.due_date DESC 
             LIMIT 10`,
            [equipmentId]
        );

        // Get movement history
        const movesResult = await query(
            `SELECT 
                m.*,
                fw.name as from_workstation_name,
                tw.name as to_workstation_name,
                u.full_name as moved_by_name
             FROM equipment_moves m
             LEFT JOIN club_workstations fw ON m.from_workstation_id = fw.id
             LEFT JOIN club_workstations tw ON m.to_workstation_id = tw.id
             LEFT JOIN users u ON m.moved_by = u.id
             WHERE m.equipment_id = $1 
             ORDER BY m.moved_at DESC 
             LIMIT 20`,
            [equipmentId]
        );

        return NextResponse.json({
            ...result.rows[0],
            issues: issuesResult.rows,
            maintenance_tasks: tasksResult.rows,
            movement_history: movesResult.rows
        });
    } catch (error) {
        console.error('Get Equipment Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH /api/clubs/[clubId]/equipment/[equipmentId] - Update equipment
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string; equipmentId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, equipmentId } = await params;
        const body = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get current equipment state for movement tracking
        const currentEquipment = await query(
            `SELECT workstation_id FROM equipment WHERE id = $1 AND club_id = $2`,
            [equipmentId, clubId]
        );

        if (currentEquipment.rowCount === 0) {
            return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
        }

        const currentWorkstationId = currentEquipment.rows[0].workstation_id;
        const newWorkstationId = body.workstation_id;

        if (newWorkstationId !== undefined && body.assigned_user_id === undefined && newWorkstationId) {
            const inheritedAssignee = await query(
                `SELECT COALESCE(w.assigned_user_id, z.assigned_user_id) AS assigned_user_id
                 FROM club_workstations w
                 LEFT JOIN club_zones z ON z.club_id = w.club_id AND z.name = w.zone
                 WHERE w.id = $1 AND w.club_id = $2
                 LIMIT 1`,
                [newWorkstationId, clubId]
            );

            if ((inheritedAssignee.rowCount || 0) > 0) {
                body.assigned_user_id = inheritedAssignee.rows[0].assigned_user_id ?? null;
                if (body.maintenance_enabled === undefined) {
                    body.maintenance_enabled = !!body.assigned_user_id;
                }
            }
        }

        // Build dynamic update query
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        const allowedFields = [
            'workstation_id', 'type', 'name', 'identifier', 'brand', 'model',
            'purchase_date', 'warranty_expires', 'receipt_url',
            'cleaning_interval_days', 'last_cleaned_at', 'is_active', 'notes',
            'thermal_paste_last_changed_at', 'thermal_paste_interval_days',
            'thermal_paste_type', 'thermal_paste_note', 'maintenance_enabled',
            'assigned_user_id'
        ];

        // Logic: if assigned_user_id is set to a user or free pool, maintenance must be enabled
        if (body.assigned_user_id && body.assigned_user_id !== '') {
            body.maintenance_enabled = true;
        }

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates.push(`${field} = $${paramIndex}`);
                values.push(body[field] === '' ? null : body[field]);
                paramIndex++;
            }
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(equipmentId, clubId);

        const result = await query(
            `UPDATE equipment 
             SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramIndex} AND club_id = $${paramIndex + 1}
             RETURNING *`,
            values
        );

        const updatedEquipment = result.rows[0];

        // SYNC & AUTO-GENERATE: If maintenance is enabled and assigned user is set, ensure task exists
        if (updatedEquipment.maintenance_enabled && updatedEquipment.assigned_user_id) {
            // 1. First, update existing PENDING tasks
            await query(
                `UPDATE equipment_maintenance_tasks 
                 SET assigned_user_id = $1
                 WHERE equipment_id = $2 AND status = 'PENDING'`,
                [updatedEquipment.assigned_user_id, equipmentId]
            );

            // 2. Check if ANY active task exists (PENDING/IN_PROGRESS)
            const activeTaskCheck = await query(
                `SELECT id FROM equipment_maintenance_tasks 
                 WHERE equipment_id = $1 AND status IN ('PENDING', 'IN_PROGRESS')
                 LIMIT 1`,
                [equipmentId]
            );

            // 3. If no active task exists, trigger generation for this specific equipment
            if (activeTaskCheck.rowCount === 0) {
                const today = new Date().toISOString().split('T')[0];
                try {
                    // We call the internal maintenance generation logic via a fetch to our own API
                    // This ensures the "Smart Horizon" logic is applied
                    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/clubs/${clubId}/equipment/maintenance`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Cookie': (await cookies()).toString() // Pass cookies for auth
                        },
                        body: JSON.stringify({
                            date_from: today,
                            date_to: today,
                            equipment_ids: [equipmentId]
                        })
                    });
                } catch (e) {
                    console.error('Auto-generation failed:', e);
                }
            }
        } else if (body.assigned_user_id !== undefined) {
            // Just sync if maintenance_enabled wasn't part of the trigger but assigned_user_id changed
            await query(
                `UPDATE equipment_maintenance_tasks 
                 SET assigned_user_id = $1
                 WHERE equipment_id = $2 AND status = 'PENDING'`,
                [body.assigned_user_id === '' ? null : body.assigned_user_id, equipmentId]
            );
        }

        // Track movement if workstation changed
        if (newWorkstationId !== undefined && newWorkstationId !== currentWorkstationId) {
            await query(
                `INSERT INTO equipment_moves (equipment_id, from_workstation_id, to_workstation_id, moved_by, reason)
                 VALUES ($1, $2, $3, $4, $5)`,
                [equipmentId, currentWorkstationId, newWorkstationId || null, userId, body.move_reason || null]
            );
        }

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Update Equipment Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE /api/clubs/[clubId]/equipment/[equipmentId] - Delete equipment
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string; equipmentId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, equipmentId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const result = await query(
            `DELETE FROM equipment WHERE id = $1 AND club_id = $2 RETURNING id`,
            [equipmentId, clubId]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete Equipment Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
