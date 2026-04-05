import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard';
import { requireClubApiAccess } from '@/lib/club-api-access';

// GET: Get current active template and available system metrics
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        await requireClubApiAccess(clubId)

        // 1. Get all available system metrics (return empty if table doesn't exist)
        let systemMetrics: any[] = [];
        try {
            const metricsResult = await query(
                `SELECT
                    sm.id::text as id,
                    sm.key,
                    sm.label,
                    sm.description,
                    sm.type,
                    sm.category,
                    sm.is_required,
                    FALSE as is_custom
                 FROM system_metrics sm
                 UNION ALL
                 SELECT
                    ccm.id::text as id,
                    ccm.key,
                    ccm.label,
                    ccm.description,
                    ccm.type,
                    ccm.category,
                    ccm.is_required,
                    TRUE as is_custom
                 FROM club_custom_metrics ccm
                 WHERE ccm.club_id = $1 AND ccm.is_active = TRUE
                 ORDER BY category, label`,
                [clubId]
            );
            systemMetrics = metricsResult.rows;
        } catch (e) {
            // Table may not exist yet or other query error
            console.warn('Error fetching system_metrics:', e);
        }

        // 2. Get current active template for this club
        const templateResult = await query(
            `SELECT * FROM club_report_templates 
       WHERE club_id = $1 AND is_active = TRUE 
       ORDER BY created_at DESC LIMIT 1`,
            [clubId]
        );

        // 3. Get finance accounts for this club (for mapping)
        const accountsResult = await query(
            `SELECT id, name, icon, color, account_type 
             FROM finance_accounts 
             WHERE club_id = $1 AND is_active = TRUE
             ORDER BY account_type, name`,
            [clubId]
        );

        return NextResponse.json({
            systemMetrics: systemMetrics,
            currentTemplate: templateResult.rows[0] || null,
            accounts: accountsResult.rows
        });

    } catch (error: any) {
        const status = error?.status
        if (status) {
            return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
        }
        console.error('Get Template Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST: Save new template version
export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { schema } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const guard = await ensureOwnerSubscriptionActive(clubId, userId)
        if (!guard.ok) return guard.response

        // Start transaction to archive old template and create new one
        await query('BEGIN');

        // Deactivate old templates
        await query(
            `UPDATE club_report_templates SET is_active = FALSE WHERE club_id = $1`,
            [clubId]
        );

        // Create new template
        const result = await query(
            `INSERT INTO club_report_templates (club_id, schema, is_active)
       VALUES ($1, $2, TRUE)
       RETURNING id, schema, created_at`,
            [clubId, JSON.stringify(schema)]
        );

        await query('COMMIT');

        // --- SYNCHRONIZATION LOGIC ---
        // Update existing finance_transactions that don't have an account_id 
        // using the new mapping from the schema
        try {
            const incomeFields = schema.filter((f: any) => f.field_type === 'INCOME' && f.account_id);

            for (const field of incomeFields) {
                const metricKeys = [field.metric_key];

                // For standard fields, also sync legacy payment methods
                if (field.metric_key === 'cash_income') metricKeys.push('cash');
                if (field.metric_key === 'card_income') metricKeys.push('card', 'terminal');

                // FORCE re-sync: match by payment_method OR description (for custom fields like "СБП")
                // Remove IS NULL condition to update ALL matching transactions
                const descriptionMatch = field.custom_label ? `%${field.custom_label}%` : null;

                await query(
                    `UPDATE finance_transactions 
                     SET account_id = $1 
                     WHERE club_id = $2 
                     AND status = 'completed'
                     AND type = 'income'
                     AND (
                        payment_method = ANY($3)
                        ${descriptionMatch ? 'OR description ILIKE $4' : ''}
                     )`,
                    descriptionMatch
                        ? [field.account_id, clubId, metricKeys, descriptionMatch]
                        : [field.account_id, clubId, metricKeys]
                );
            }

            // Recalculate balances for all accounts of this club to ensure total accuracy
            await query(
                `UPDATE finance_accounts fa
                 SET current_balance = fa.initial_balance + COALESCE((
                    SELECT SUM(CASE WHEN ft.type = 'income' THEN ft.amount ELSE -ft.amount END)
                    FROM finance_transactions ft
                    WHERE ft.account_id = fa.id AND ft.status = 'completed'
                 ), 0),
                 updated_at = NOW()
                 WHERE fa.club_id = $1`,
                [clubId]
            );
        } catch (syncError) {
            console.error('Error synchronizing finance on mapping change:', syncError);
            // We don't fail the whole request if sync fails, but we log it
        }

        return NextResponse.json({ success: true, template: result.rows[0] });

    } catch (error) {
        await query('ROLLBACK');
        console.error('Save Template Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
