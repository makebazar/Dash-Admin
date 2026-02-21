import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// Force revalidation of this route
export const dynamic = 'force-dynamic';

// Helper to reset query plans
async function resetQueryPlans() {
    try {
        await query('DISCARD PLANS');
    } catch (e) {
        console.warn('Failed to discard plans:', e);
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        await resetQueryPlans();
        
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check access
        const accessCheck = await query(
            `
            SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
            UNION
            SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2
            `,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get templates with items
        const templatesResult = await query(
            `
            SELECT t.*, 
                   COALESCE(
                       JSON_AGG(
                           JSON_BUILD_OBJECT(
                               'id', ti.id,
                               'content', ti.content,
                               'description', ti.description,
                               'weight', ti.weight,
                               'sort_order', ti.sort_order,
                               'is_photo_required', ti.is_photo_required,
                               'min_photos', ti.min_photos,
                               'related_entity_type', ti.related_entity_type,
                               'target_zone', ti.target_zone
                           ) ORDER BY ti.sort_order
                       ) FILTER (WHERE ti.id IS NOT NULL), 
                       '[]'::json
                   ) as items
            FROM evaluation_templates t
            LEFT JOIN evaluation_template_items ti ON t.id = ti.template_id AND ti.is_active = TRUE
            WHERE t.club_id = $1
            GROUP BY t.id
            ORDER BY t.created_at DESC
            `,
            [clubId]
        );

        return NextResponse.json(templatesResult.rows);

    } catch (error) {
        console.error('Get Templates Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        await resetQueryPlans();
        
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { name, description, items, type, settings } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check ownership/manager access (only owners can create templates for now)
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if (ownerCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await query('BEGIN');

        // Insert template
        const templateResult = await query(
            `INSERT INTO evaluation_templates (club_id, name, description, type, settings)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [clubId, name, description, type || 'manager_audit', settings || {}]
        );
        const templateId = templateResult.rows[0].id;

        // Insert items
        if (items && Array.isArray(items)) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                await query(
                    `INSERT INTO evaluation_template_items (template_id, content, description, weight, sort_order, is_photo_required, related_entity_type, min_photos, target_zone)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [templateId, item.content, item.description, item.weight || 1.0, i, item.is_photo_required || false, item.related_entity_type || null, item.min_photos || 0, item.target_zone || null]
                );
            }
        }

        await query('COMMIT');

        return NextResponse.json({ success: true, id: templateId });

    } catch (error) {
        await query('ROLLBACK');
        console.error('Create Template Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
