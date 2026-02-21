import { NextResponse } from 'next/server'
import { query } from '@/db'
import { cookies } from 'next/headers'

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string, templateId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value
        const { clubId, templateId } = await params
        const { name, description, items, type, settings } = await request.json()

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check ownership/manager access
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        )

        if (ownerCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        await query('BEGIN')

        // Update template fields
        await query(
            `UPDATE evaluation_templates 
             SET name = $1, description = $2, type = $3, settings = $4, updated_at = NOW()
             WHERE id = $5 AND club_id = $6`,
            [name, description, type || 'manager_audit', settings || {}, templateId, clubId]
        )

        // Handle items
        if (items && Array.isArray(items)) {
            // Get current active items to track deletions
            const currentItemsRes = await query(
                `SELECT id FROM evaluation_template_items WHERE template_id = $1 AND is_active = TRUE`,
                [templateId]
            )
            const currentIds = new Set(currentItemsRes.rows.map(r => r.id))
            const updatedIds = new Set()

            for (let i = 0; i < items.length; i++) {
                const item = items[i]
                
                if (item.id) {
                    // Update existing
                    await query(
                        `UPDATE evaluation_template_items 
                         SET content = $1, description = $2, weight = $3, sort_order = $4, is_photo_required = $5, related_entity_type = $6, min_photos = $7, target_zone = $8, is_active = TRUE
                         WHERE id = $9 AND template_id = $10`,
                        [item.content, item.description, item.weight || 1.0, i, item.is_photo_required || false, item.related_entity_type || null, item.min_photos || 0, item.target_zone || null, item.id, templateId]
                    )
                    updatedIds.add(item.id)
                } else {
                    // Insert new
                    await query(
                        `INSERT INTO evaluation_template_items (template_id, content, description, weight, sort_order, is_photo_required, related_entity_type, min_photos, target_zone, is_active)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)`,
                        [templateId, item.content, item.description, item.weight || 1.0, i, item.is_photo_required || false, item.related_entity_type || null, item.min_photos || 0, item.target_zone || null]
                    )
                }
            }

            // Soft delete missing items
            for (const id of currentIds) {
                if (!updatedIds.has(id)) {
                    await query(
                        `UPDATE evaluation_template_items SET is_active = FALSE WHERE id = $1`,
                        [id]
                    )
                }
            }
        }

        await query('COMMIT')

        return NextResponse.json({ success: true })

    } catch (error) {
        await query('ROLLBACK')
        console.error('Update Template Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string, templateId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value
        const { clubId, templateId } = await params

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check ownership/manager access (only owners can delete templates for now)
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        )

        if (ownerCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Delete template (cascade will handle items)
        await query(
            `DELETE FROM evaluation_templates WHERE id = $1 AND club_id = $2`,
            [templateId, clubId]
        )

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Delete Template Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
