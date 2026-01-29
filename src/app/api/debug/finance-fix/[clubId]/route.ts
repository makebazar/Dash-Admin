import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';

// DEBUG ENDPOINT - TEMPORARY
// Access: /api/debug/finance-fix/1
export async function GET(
    request: NextRequest,
    { params }: { params: { clubId: string } }
) {
    const { clubId } = params;
    const report: any = {
        timestamp: new Date().toISOString(),
        clubId,
        steps: []
    };

    try {
        // Step 1: Get all accounts
        report.steps.push('📊 Fetching accounts...');
        const accountsResult = await query(
            `SELECT id, name, account_type, current_balance, initial_balance 
             FROM finance_accounts 
             WHERE club_id = $1 
             ORDER BY id`,
            [clubId]
        );
        report.accounts = accountsResult.rows;
        report.steps.push(`✅ Found ${accountsResult.rows.length} accounts`);

        // Step 2: Get active report template
        report.steps.push('📋 Fetching active report template...');
        const templateResult = await query(
            `SELECT id, schema FROM club_report_templates 
             WHERE club_id = $1 AND is_active = TRUE 
             ORDER BY created_at DESC LIMIT 1`,
            [clubId]
        );

        if (templateResult.rows.length > 0) {
            const schema = templateResult.rows[0].schema;
            const incomeFields = schema.filter((f: any) => f.field_type === 'INCOME');
            report.template = {
                id: templateResult.rows[0].id,
                incomeFields: incomeFields.map((f: any) => ({
                    metric_key: f.metric_key,
                    custom_label: f.custom_label,
                    account_id: f.account_id
                }))
            };
            report.steps.push(`✅ Template has ${incomeFields.length} income fields`);
        } else {
            report.template = null;
            report.steps.push('⚠️ No active template found');
        }

        // Step 3: Transaction statistics
        report.steps.push('💰 Analyzing transactions...');
        const transStats = await query(
            `SELECT 
                account_id,
                payment_method,
                type,
                COUNT(*) as count,
                SUM(amount) as total
             FROM finance_transactions
             WHERE club_id = $1 AND status = 'completed'
             GROUP BY account_id, payment_method, type
             ORDER BY account_id NULLS FIRST, type, payment_method`,
            [clubId]
        );
        report.transactionStats = transStats.rows;

        // Step 4: Find unlinked transactions
        const unlinked = await query(
            `SELECT id, amount, type, payment_method, description, transaction_date
             FROM finance_transactions
             WHERE club_id = $1 AND account_id IS NULL AND status = 'completed'
             ORDER BY transaction_date DESC
             LIMIT 20`,
            [clubId]
        );
        report.unlinkedTransactions = unlinked.rows;
        report.steps.push(`⚠️ Found ${unlinked.rows.length} unlinked transactions`);

        // Step 5: FORCE RE-SYNC
        report.steps.push('🔄 Starting forced re-synchronization...');

        if (report.template && report.template.incomeFields.length > 0) {
            for (const field of report.template.incomeFields) {
                if (!field.account_id) continue;

                const metricKeys = [field.metric_key];
                if (field.metric_key === 'cash_income') metricKeys.push('cash');
                if (field.metric_key === 'card_income') metricKeys.push('card', 'terminal');

                const descriptionMatch = field.custom_label ? `%${field.custom_label}%` : null;

                // FORCE update - remove the IS NULL condition
                const updateResult = await query(
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

                report.steps.push(`✅ Synced ${updateResult.rowCount} transactions for "${field.custom_label}" to account #${field.account_id}`);
            }
        }

        // Step 6: Recalculate ALL balances
        report.steps.push('🧮 Recalculating all account balances...');
        const recalcResult = await query(
            `UPDATE finance_accounts fa
             SET current_balance = fa.initial_balance + COALESCE((
                SELECT SUM(CASE WHEN ft.type = 'income' THEN ft.amount ELSE -ft.amount END)
                FROM finance_transactions ft
                WHERE ft.account_id = fa.id AND ft.status = 'completed'
             ), 0),
             updated_at = NOW()
             WHERE fa.club_id = $1
             RETURNING id, name, current_balance`,
            [clubId]
        );
        report.updatedBalances = recalcResult.rows;
        report.steps.push(`✅ Recalculated ${recalcResult.rows.length} account balances`);

        // Step 7: Final verification
        report.steps.push('✅ Verification...');
        const finalStats = await query(
            `SELECT 
                account_id,
                COUNT(*) as count,
                SUM(amount) as total
             FROM finance_transactions
             WHERE club_id = $1 AND status = 'completed' AND type = 'income'
             GROUP BY account_id
             ORDER BY account_id NULLS FIRST`,
            [clubId]
        );
        report.finalIncomeStats = finalStats.rows;

        report.success = true;
        report.message = '✅ Finance fix completed successfully!';

    } catch (error: any) {
        report.success = false;
        report.error = error.message;
        report.stack = error.stack;
    }

    return NextResponse.json(report, {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        }
    });
}
