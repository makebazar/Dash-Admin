import { NextResponse } from 'next/server';
import { query } from '@/db';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const xClubId = request.headers.get('X-Club-Id');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const apiKey = authHeader.substring(7);
        const body = await request.json();
        const {
            club_id,
            opened_at,
            revenue_cash,
            revenue_card,
            total_expenses,
            expected_cash,
            report_data,
            deposits,
            bonuses,
            expenses_list
        } = body;

        const targetClubId = xClubId ? parseInt(xClubId) : club_id;

        if (!targetClubId) {
            return NextResponse.json({ error: 'club_id is required' }, { status: 400 });
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

        // Automatically ensure the 'bonuses' field exists in the club's active report template
        const templateRes = await query(
            `SELECT id, schema FROM club_report_templates WHERE club_id = $1 AND is_active = true`,
            [targetClubId]
        );

        if (templateRes.rows && templateRes.rows.length > 0) {
            const template = templateRes.rows[0];
            let schema = Array.isArray(template.schema) ? template.schema : [];
            let schemaChanged = false;

            const hasBonuses = schema.some((f: any) => f.metric_key === 'bonuses');
            if (!hasBonuses) {
                schema.push({
                    id: `bonuses-sync-auto-${Math.random().toString(36).substring(2, 9)}`,
                    account_id: null,
                    field_type: "OTHER",
                    metric_key: "bonuses",
                    is_required: false,
                    custom_label: "Бонусы",
                    show_in_stats: true
                });
                schemaChanged = true;
            }

            const hasReceiptsCount = schema.some((f: any) => f.metric_key === 'receipts_count');
            if (!hasReceiptsCount) {
                schema.push({
                    id: `receipts_count-sync-auto-${Math.random().toString(36).substring(2, 9)}`,
                    account_id: null,
                    field_type: "OTHER",
                    metric_key: "receipts_count",
                    is_required: false,
                    custom_label: "Количество чеков",
                    show_in_stats: true
                });
                schemaChanged = true;
            }

            if (schemaChanged) {
                await query(
                    `UPDATE club_report_templates SET schema = $1 WHERE id = $2`,
                    [JSON.stringify(schema), template.id]
                );
            }
        }

        const incomingReportData = typeof report_data === 'string'
            ? JSON.parse(report_data)
            : (report_data || {});

        const mergedReportData = {
            cash_income: revenue_cash || 0,
            card_income: revenue_card || 0,
            expenses: total_expenses || 0,
            expected_cash: expected_cash || 0,
            ...incomingReportData
        };

        // Update the ACTIVE shift row in DashAdmin PostgreSQL
        const updateRes = await query(
            `UPDATE shifts
             SET cash_income = $1, card_income = $2, expenses = $3, report_data = $4
             WHERE club_id = $5 AND status = 'ACTIVE'
             RETURNING id`,
            [
                revenue_cash || 0,
                revenue_card || 0,
                total_expenses || 0,
                JSON.stringify(mergedReportData),
                targetClubId
            ]
        );

        if (updateRes.rows.length > 0) {
            for (const row of updateRes.rows) {
                const shiftId = row.id;
                
                // Delete old deposits to avoid duplicates
                await query(
                    `DELETE FROM shift_player_deposits WHERE shift_id = $1`,
                    [shiftId]
                );

                // Insert new deposits
                if (Array.isArray(deposits) && deposits.length > 0) {
                    for (const d of deposits) {
                        await query(
                            `INSERT INTO shift_player_deposits (id, shift_id, player_id, player_name, player_phone, amount, payment_method, created_at)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                             ON CONFLICT (id) DO NOTHING`,
                            [
                                d.id,
                                shiftId,
                                d.player_id || null,
                                d.player_name || 'Игрок',
                                d.player_phone || '',
                                d.amount || 0,
                                d.payment_method || 'cash',
                                d.created_at || new Date().toISOString()
                            ]
                        );
                    }
                }

                // Delete old bonuses to avoid duplicates
                await query(
                    `DELETE FROM shift_player_bonuses WHERE shift_id = $1`,
                    [shiftId]
                );

                // Insert new bonuses
                if (Array.isArray(bonuses) && bonuses.length > 0) {
                    for (const b of bonuses) {
                        await query(
                            `INSERT INTO shift_player_bonuses (id, shift_id, player_id, player_name, player_phone, amount, description, created_at)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                             ON CONFLICT (id) DO NOTHING`,
                            [
                                b.id,
                                shiftId,
                                b.player_id || null,
                                b.player_name || 'Игрок',
                                b.player_phone || '',
                                b.amount || 0,
                                b.description || 'Начисление бонусов',
                                b.created_at || new Date().toISOString()
                            ]
                        );
                    }
                }

                // Delete old expenses to avoid duplicates
                await query(
                    `DELETE FROM shift_expenses WHERE shift_id = $1`,
                    [shiftId]
                );

                // Insert new expenses
                if (Array.isArray(expenses_list) && expenses_list.length > 0) {
                    for (const e of expenses_list) {
                        await query(
                            `INSERT INTO shift_expenses (id, shift_id, amount, description, created_at)
                             VALUES ($1, $2, $3, $4, $5)
                             ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, description = EXCLUDED.description`,
                            [
                                e.id,
                                shiftId,
                                e.amount || 0,
                                e.description || '',
                                e.created_at || new Date().toISOString()
                            ]
                        );
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Shift statistics updated in real-time successfully'
        });

    } catch (error) {
        console.error('Shift real-time update error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
