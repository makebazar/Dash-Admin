import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard'
import { getClient, query } from '@/db'
import { hasColumn } from '@/lib/db-compat'

export const dynamic = 'force-dynamic'

type CloneRequestBody = {
    source_workstation_id: string
    target_workstation_ids: string[]
    dry_run?: boolean
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    const userId = (await cookies()).get('session_user_id')?.value
    const { clubId } = await params

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const guard = await ensureOwnerSubscriptionActive(clubId, userId)
    if (!guard.ok) return guard.response

    let body: CloneRequestBody
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const sourceId = String(body.source_workstation_id || '').trim()
    const targetIdsRaw = Array.isArray(body.target_workstation_ids) ? body.target_workstation_ids : []
    const targetIds = Array.from(new Set(targetIdsRaw.map((id) => String(id).trim()).filter(Boolean))).filter((id) => id !== sourceId)
    const dryRun = Boolean(body.dry_run)

    if (!sourceId || targetIds.length === 0) {
        return NextResponse.json({ error: 'Source workstation and target workstations are required' }, { status: 400 })
    }

    const workstationsRes = await query(
        `SELECT id, name
         FROM club_workstations
         WHERE club_id = $1
           AND id = ANY($2::uuid[])`,
        [clubId, [sourceId, ...targetIds]]
    )

    const wsById = new Map<string, { id: string; name: string }>()
    for (const ws of workstationsRes.rows) {
        wsById.set(String(ws.id), { id: String(ws.id), name: String(ws.name) })
    }

    if (!wsById.has(sourceId)) {
        return NextResponse.json({ error: 'Source workstation not found' }, { status: 404 })
    }

    const missingTargets = targetIds.filter((id) => !wsById.has(id))
    if (missingTargets.length > 0) {
        return NextResponse.json({ error: 'Some target workstations not found' }, { status: 404 })
    }

    const sourceCountRes = await query(
        `SELECT COUNT(*)::integer as count
         FROM equipment
         WHERE club_id = $1
           AND workstation_id = $2
           AND is_active = TRUE`,
        [clubId, sourceId]
    )
    const sourceCount = Number(sourceCountRes.rows[0]?.count || 0)

    const targetsCountRes = await query(
        `SELECT workstation_id, COUNT(*)::integer as count
         FROM equipment
         WHERE club_id = $1
           AND workstation_id = ANY($2::uuid[])
           AND is_active = TRUE
         GROUP BY workstation_id`,
        [clubId, targetIds]
    )

    const targetCounts: Record<string, number> = {}
    for (const row of targetsCountRes.rows) {
        targetCounts[String(row.workstation_id)] = Number(row.count || 0)
    }

    if (dryRun) {
        return NextResponse.json({
            source: { id: sourceId, name: wsById.get(sourceId)!.name, items: sourceCount },
            targets: targetIds.map((id) => ({
                id,
                name: wsById.get(id)!.name,
                existing_items: targetCounts[id] || 0,
            })),
            will_create: sourceCount * targetIds.length,
            will_clear: targetIds.reduce((acc, id) => acc + (targetCounts[id] || 0), 0),
        })
    }

    const hasStatus = await hasColumn('equipment', 'status')
    const hasMaintenanceEnabled = await hasColumn('equipment', 'maintenance_enabled')
    const hasAssignmentMode = await hasColumn('equipment', 'assignment_mode')
    const hasAssignedUserId = await hasColumn('equipment', 'assigned_user_id')

    const client = await getClient()
    try {
        await client.query('BEGIN')

        const sourceItemsRes = await client.query(
            `SELECT type, name, brand, model, purchase_date, warranty_expires, receipt_url, cleaning_interval_days, notes
             ${hasMaintenanceEnabled ? ', maintenance_enabled' : ''}
             FROM equipment
             WHERE club_id = $1
               AND workstation_id = $2
               AND is_active = TRUE
             ORDER BY type, name`,
            [clubId, sourceId]
        )
        const sourceItems = sourceItemsRes.rows

        const toClearRes = await client.query(
            `SELECT id, workstation_id
             FROM equipment
             WHERE club_id = $1
               AND workstation_id = ANY($2::uuid[])
               AND is_active = TRUE`,
            [clubId, targetIds]
        )

        const toClear = toClearRes.rows.map((row: any) => ({
            id: String(row.id),
            from_workstation_id: String(row.workstation_id),
        }))

        if (toClear.length > 0) {
            const updateSql = hasStatus
                ? `UPDATE equipment SET workstation_id = NULL, status = 'STORAGE' WHERE id = ANY($1::uuid[])`
                : `UPDATE equipment SET workstation_id = NULL WHERE id = ANY($1::uuid[])`
            await client.query(updateSql, [toClear.map((row) => row.id)])

            for (const row of toClear) {
                await client.query(
                    `INSERT INTO equipment_moves (equipment_id, from_workstation_id, to_workstation_id, moved_by, reason)
                     VALUES ($1, $2, NULL, $3, $4)`,
                    [row.id, row.from_workstation_id, userId, `Cleared before cloning from ${wsById.get(sourceId)!.name}`]
                )
            }
        }

        const insertColumns = [
            'club_id',
            'workstation_id',
            'type',
            'name',
            'identifier',
            'brand',
            'model',
            'purchase_date',
            'warranty_expires',
            'receipt_url',
            'cleaning_interval_days',
            'notes',
            'is_active',
        ]

        if (hasStatus) insertColumns.push('status')
        if (hasMaintenanceEnabled) insertColumns.push('maintenance_enabled')
        if (hasAssignedUserId) insertColumns.push('assigned_user_id')
        if (hasAssignmentMode) insertColumns.push('assignment_mode')

        let createdCount = 0
        for (const targetId of targetIds) {
            for (const item of sourceItems) {
                const values: any[] = [
                    clubId,
                    targetId,
                    item.type,
                    item.name,
                    null,
                    item.brand || null,
                    item.model || null,
                    item.purchase_date || null,
                    item.warranty_expires || null,
                    item.receipt_url || null,
                    item.cleaning_interval_days || null,
                    item.notes || null,
                    true,
                ]
                if (hasStatus) values.push('ACTIVE')
                if (hasMaintenanceEnabled) values.push(item.maintenance_enabled !== false)
                if (hasAssignedUserId) values.push(null)
                if (hasAssignmentMode) values.push('FREE_POOL')

                const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(', ')
                const inserted = await client.query(
                    `INSERT INTO equipment (${insertColumns.join(', ')})
                     VALUES (${placeholders})
                     RETURNING id`,
                    values
                )

                const newId = String(inserted.rows[0].id)
                await client.query(
                    `INSERT INTO equipment_moves (equipment_id, from_workstation_id, to_workstation_id, moved_by, reason)
                     VALUES ($1, NULL, $2, $3, $4)`,
                    [newId, targetId, userId, `Cloned from ${wsById.get(sourceId)!.name}`]
                )

                createdCount += 1
            }
        }

        await client.query('COMMIT')

        return NextResponse.json({
            source: { id: sourceId, name: wsById.get(sourceId)!.name, items: sourceItems.length },
            targets: targetIds.map((id) => ({
                id,
                name: wsById.get(id)!.name,
                cleared_items: targetCounts[id] || 0,
                created_items: sourceItems.length,
            })),
            cleared: toClear.length,
            created: createdCount,
        })
    } catch (error) {
        await client.query('ROLLBACK')
        console.error('Clone equipment error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    } finally {
        client.release()
    }
}

