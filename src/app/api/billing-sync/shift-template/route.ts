import { NextResponse } from 'next/server';
import { query } from '@/db';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const xClubId = request.headers.get('X-Club-Id');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const apiKey = authHeader.substring(7);
        const targetClubId = xClubId ? parseInt(xClubId) : null;

        if (!targetClubId) {
            return NextResponse.json({ error: 'X-Club-Id is required' }, { status: 400 });
        }

        // Fetch club details to verify API Key
        const clubRes = await query(
            `SELECT inventory_settings FROM clubs WHERE id = $1`,
            [targetClubId]
        );

        if (!clubRes.rows || clubRes.rows.length === 0) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }

        const club = clubRes.rows[0];
        const clubApiKey = club.inventory_settings?.api_key || process.env.DASHADMIN_SYNC_KEY;

        // Verify API key
        if (clubApiKey && apiKey !== clubApiKey && apiKey !== process.env.DASHADMIN_SYNC_KEY) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 1. Get template schema
        const templateResult = await query(
            `SELECT schema FROM club_report_templates
             WHERE club_id = $1 AND is_active = TRUE
             ORDER BY created_at DESC LIMIT 1`,
            [targetClubId]
        );

        // 2. Get available metrics to match descriptions/types if needed
        let systemMetrics: any[] = [];
        try {
            const metricsResult = await query(
                `SELECT key, label, description, type, category, is_required FROM system_metrics
                 UNION ALL
                 SELECT key, label, description, type, category, is_required FROM club_custom_metrics
                 WHERE club_id = $1 AND is_active = TRUE`,
                [targetClubId]
            );
            systemMetrics = metricsResult.rows;
        } catch (e) {
            console.warn("Error fetching system_metrics for template sync:", e);
        }

        let activeTemplate = templateResult.rows[0];
        let schema = activeTemplate ? (typeof activeTemplate.schema === 'string' ? JSON.parse(activeTemplate.schema) : activeTemplate.schema) : [];

        // Check if Bar metric is in schema, if not: auto-create in custom metrics and active template
        let hasBarField = schema.some((field: any) => 
            field.metric_key.toLowerCase() === 'bar' || 
            field.metric_key.toLowerCase() === 'bar_revenue' || 
            field.metric_key.toLowerCase() === 'total_bar_sales'
        );

        if (!hasBarField) {
            console.log(`Auto-creating 'Bar' metric for club ${targetClubId}...`);
            // Check if Bar metric exists in custom metrics
            const metricCheck = await query(
                `SELECT id FROM club_custom_metrics WHERE club_id = $1 AND key = 'Bar'`,
                [targetClubId]
            );

            if (!metricCheck.rows || metricCheck.rows.length === 0) {
                await query(
                    `INSERT INTO club_custom_metrics (club_id, key, label, category, type, is_required, is_active, description)
                     VALUES ($1, 'Bar', 'Выручка бар', 'FINANCE', 'MONEY', false, true, 'Автоматически созданная выручка бара из локального DashLock')`,
                    [targetClubId]
                );
            }

            // Add Bar field to template schema
            const newBarField = {
                metric_key: 'Bar',
                custom_label: 'Выручка бар',
                is_required: false,
                field_type: 'INCOME',
                show_in_stats: true,
                id: `Bar-auto-${Math.random().toString(36).substring(2, 9)}`
            };

            const updatedSchema = [...schema, newBarField];

            if (activeTemplate) {
                // Update active template
                await query(
                    `UPDATE club_report_templates SET schema = $1 WHERE id = $2`,
                    [JSON.stringify(updatedSchema), activeTemplate.id]
                );
            } else {
                // Create a default active template
                await query(
                    `INSERT INTO club_report_templates (club_id, schema, is_active) VALUES ($1, $2, true)`,
                    [targetClubId, JSON.stringify(updatedSchema)]
                );
            }

            // Refresh systemMetrics
            try {
                const metricsResult = await query(
                    `SELECT key, label, description, type, category, is_required FROM system_metrics
                     UNION ALL
                     SELECT key, label, description, type, category, is_required FROM club_custom_metrics
                     WHERE club_id = $1 AND is_active = TRUE`,
                    [targetClubId]
                );
                systemMetrics = metricsResult.rows;
            } catch (e) {
                console.warn("Error refetching system_metrics after auto-creation:", e);
            }

            schema = updatedSchema;
        }

        // Enrich schema fields with metric info (e.g. type: MONEY/NUMBER/TEXT/BOOLEAN)
        const enrichedSchema = schema.map((field: any) => {
            const metric = systemMetrics.find((m: any) => m.key === field.metric_key);
            return {
                ...field,
                type: metric ? metric.type : 'MONEY',
                category: metric ? metric.category : 'FINANCE',
                description: metric ? metric.description : '',
            };
        });

        return NextResponse.json({
            success: true,
            schema: enrichedSchema
        });

    } catch (error) {
        console.error('Shift template sync API error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const xClubId = request.headers.get('X-Club-Id');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const apiKey = authHeader.substring(7);
        const targetClubId = xClubId ? parseInt(xClubId) : null;

        if (!targetClubId) {
            return NextResponse.json({ error: 'X-Club-Id is required' }, { status: 400 });
        }

        // Fetch club details to verify API Key
        const clubRes = await query(
            `SELECT inventory_settings FROM clubs WHERE id = $1`,
            [targetClubId]
        );

        if (!clubRes.rows || clubRes.rows.length === 0) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }

        const club = clubRes.rows[0];
        const clubApiKey = club.inventory_settings?.api_key || process.env.DASHADMIN_SYNC_KEY;

        // Verify API key
        if (clubApiKey && apiKey !== clubApiKey && apiKey !== process.env.DASHADMIN_SYNC_KEY) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const localMethods = Array.isArray(body.local_methods) ? body.local_methods : [];

        // 1. Get current active template for this club
        const templateResult = await query(
            `SELECT * FROM club_report_templates
             WHERE club_id = $1 AND is_active = TRUE
             ORDER BY created_at DESC LIMIT 1`,
            [targetClubId]
        );
        const activeTemplate = templateResult.rows[0];
        let schema = activeTemplate ? (typeof activeTemplate.schema === 'string' ? JSON.parse(activeTemplate.schema) : activeTemplate.schema) : [];

        // Cleanup: remove raw 'cash' and 'card' fields from custom metrics and active template schema
        await query(
            `DELETE FROM club_custom_metrics WHERE club_id = $1 AND key IN ('cash', 'card')`,
            [targetClubId]
        );
        const originalSchemaLength = schema.length;
        schema = schema.filter((f: any) => f.metric_key !== 'cash' && f.metric_key !== 'card');
        let schemaChanged = schema.length !== originalSchemaLength;

        // Sync custom payment methods from DashLock (excluding cash and card defaults)
        const customLocalMethods = localMethods.filter((m: any) => m.slug !== 'cash' && m.slug !== 'card');
        const hasCustomLocalMethods = customLocalMethods.some((m: any) => m.isActive);

        if (hasCustomLocalMethods) {
            console.log(`Syncing custom payment methods from DashLock to DashAdmin for club ${targetClubId}...`);

            for (const method of customLocalMethods) {
                const slug = method.slug;
                const name = method.name;
                const isActive = method.isActive;

                // Check if metric exists
                const metricCheck = await query(
                    `SELECT id FROM club_custom_metrics WHERE club_id = $1 AND key = $2`,
                    [targetClubId, slug]
                );

                if (!metricCheck.rows || metricCheck.rows.length === 0) {
                    await query(
                        `INSERT INTO club_custom_metrics (club_id, key, label, category, type, is_required, is_active, description)
                         VALUES ($1, $2, $3, 'FINANCE', 'MONEY', false, $4, 'Создано из локального DashLock')`,
                        [targetClubId, slug, name, isActive]
                    );
                    schemaChanged = true;
                } else {
                    await query(
                        `UPDATE club_custom_metrics SET label = $1, is_active = $2 WHERE club_id = $3 AND key = $4`,
                        [name, isActive, targetClubId, slug]
                    );
                }

                // Check if this method is in the active template schema
                const fieldIndex = schema.findIndex((f: any) => f.metric_key === slug);

                if (isActive) {
                    if (fieldIndex === -1) {
                        schema.push({
                            metric_key: slug,
                            custom_label: name,
                            is_required: false,
                            field_type: 'INCOME',
                            show_in_stats: true,
                            id: `${slug}-sync-${Math.random().toString(36).substring(2, 9)}`
                        });
                        schemaChanged = true;
                    }
                } else {
                    if (fieldIndex !== -1) {
                        schema.splice(fieldIndex, 1);
                        schemaChanged = true;
                    }
                }
            }
        }

        // Ensure Bar metric exists
        let hasBarField = schema.some((field: any) => 
            field.metric_key.toLowerCase() === 'bar' || 
            field.metric_key.toLowerCase() === 'bar_revenue' || 
            field.metric_key.toLowerCase() === 'total_bar_sales'
        );

        if (!hasBarField) {
            const metricCheck = await query(
                `SELECT id FROM club_custom_metrics WHERE club_id = $1 AND key = 'Bar'`,
                [targetClubId]
            );

            if (!metricCheck.rows || metricCheck.rows.length === 0) {
                await query(
                    `INSERT INTO club_custom_metrics (club_id, key, label, category, type, is_required, is_active, description)
                     VALUES ($1, 'Bar', 'Выручка бар', 'FINANCE', 'MONEY', false, true, 'Автоматически созданная выручка бара из локального DashLock')`,
                    [targetClubId]
                );
            }

            schema.push({
                metric_key: 'Bar',
                custom_label: 'Выручка бар',
                is_required: false,
                field_type: 'INCOME',
                show_in_stats: true,
                id: `Bar-auto-${Math.random().toString(36).substring(2, 9)}`
            });
            schemaChanged = true;
        }

        if (schemaChanged) {
            if (activeTemplate) {
                await query(
                    `UPDATE club_report_templates SET schema = $1 WHERE id = $2`,
                    [JSON.stringify(schema), activeTemplate.id]
                );
            } else {
                await query(
                    `INSERT INTO club_report_templates (club_id, schema, is_active) VALUES ($1, $2, true)`,
                    [targetClubId, JSON.stringify(schema)]
                );
            }
        }

        // Return updated template
        let systemMetrics: any[] = [];
        try {
            const metricsResult = await query(
                `SELECT key, label, description, type, category, is_required FROM system_metrics
                 UNION ALL
                 SELECT key, label, description, type, category, is_required FROM club_custom_metrics
                 WHERE club_id = $1 AND is_active = TRUE`,
                [targetClubId]
            );
            systemMetrics = metricsResult.rows;
        } catch (e) {
            console.warn("Error refetching systemMetrics in POST:", e);
        }

        const enrichedSchema = schema.map((field: any) => {
            const metric = systemMetrics.find((m: any) => m.key === field.metric_key);
            return {
                ...field,
                type: metric ? metric.type : 'MONEY',
                category: metric ? metric.category : 'FINANCE',
                description: metric ? metric.description : '',
            };
        });

        return NextResponse.json({
            success: true,
            schema: enrichedSchema
        });

    } catch (error) {
        console.error('Shift template sync API error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
