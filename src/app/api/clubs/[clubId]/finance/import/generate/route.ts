import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// POST /api/clubs/[clubId]/finance/import/generate
export async function POST(
    request: NextRequest,
    { params }: { params: { clubId: string } }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId } = params;
        const body = await request.json();
        const { start_date, end_date, preview = false } = body;

        if (!start_date || !end_date) {
            return NextResponse.json(
                { error: 'start_date and end_date are required' },
                { status: 400 }
            );
        }

        // Get "Выручка клуба" category
        const categoryResult = await query(
            `SELECT id FROM finance_categories 
             WHERE name = 'Выручка клуба' AND type = 'income' 
             AND (club_id = $1 OR club_id IS NULL)
             ORDER BY club_id DESC NULLS LAST
             LIMIT 1`,
            [clubId]
        );

        if (categoryResult.rows.length === 0) {
            return NextResponse.json({ error: 'Revenue category not found' }, { status: 404 });
        }

        const categoryId = categoryResult.rows[0].id;

        // Get report template to determine which fields are income
        const templateResult = await query(
            `SELECT schema FROM club_report_templates 
             WHERE club_id = $1 AND is_active = true 
             ORDER BY created_at DESC LIMIT 1`,
            [clubId]
        );

        let incomeFields: { key: string; label: string }[] = [];

        if (templateResult.rows.length > 0) {
            const schema = templateResult.rows[0].schema;
            // Extract fields where field_type is INCOME
            // Exclude cash_income and card_income as they're handled separately
            incomeFields = schema
                .filter((field: any) =>
                    field.field_type === 'INCOME' &&
                    field.metric_key !== 'cash_income' &&
                    field.metric_key !== 'card_income'
                )
                .map((field: any) => ({
                    key: field.metric_key,
                    label: field.custom_label || field.metric_key
                }));

            console.log('Found income fields:', incomeFields);
        } else {
            console.log('No report template found for club:', clubId);
        }

        // Get payment method mappings from database
        const mappingsResult = await query(
            `SELECT 
                pm.code,
                pm.id as payment_method_id,
                fam.account_id
             FROM finance_account_mappings fam
             JOIN payment_methods pm ON pm.id = fam.payment_method_id
             WHERE fam.club_id = $1`,
            [clubId]
        );

        // Map payment method codes to {payment_method_id, account_id}
        const paymentMap = new Map<string, { paymentMethodId: number, accountId: number }>();
        mappingsResult.rows.forEach(row => {
            paymentMap.set(row.code, {
                paymentMethodId: row.payment_method_id,
                accountId: row.account_id
            });
        });

        console.log('Payment method mapping:',
            Object.fromEntries(
                Array.from(paymentMap.entries()).map(([k, v]) => [k, v.accountId])
            )
        );

        // Get shifts within date range that haven't been imported yet
        const shiftsResult = await query(
            `SELECT 
                s.id,
                s.check_in,
                s.cash_income,
                s.card_income,
                s.report_data,
                COUNT(ft.id) as import_count
             FROM shifts s
             LEFT JOIN finance_transactions ft ON ft.related_shift_report_id = s.id
             WHERE s.club_id = $1
             AND s.check_in >= $2
             AND s.check_in <= $3
             AND s.check_out IS NOT NULL
             GROUP BY s.id, s.check_in, s.cash_income, s.card_income, s.report_data`,
            [clubId, start_date, end_date]
        );

        const shifts = shiftsResult.rows;
        let totalCash = 0;
        let totalCard = 0;
        const customTotals: Record<string, number> = {};
        let importedCount = 0;
        let skippedCount = 0;
        const skippedReasons: string[] = [];
        const transactionIds: number[] = [];

        for (const shift of shifts) {
            // Skip if already imported
            if (shift.import_count > 0) {
                skippedCount++;
                skippedReasons.push(`Смена #${shift.id}: уже импортирована`);
                continue;
            }

            const cashIncome = parseFloat(shift.cash_income) || 0;
            const cardIncome = parseFloat(shift.card_income) || 0;

            totalCash += cashIncome;
            totalCard += cardIncome;

            if (!preview) {
                // Create transaction for cash income
                if (cashIncome > 0) {
                    const mapping = paymentMap.get('cash');
                    if (mapping) {
                        const result = await query(
                            `INSERT INTO finance_transactions 
                                (club_id, category_id, amount, type, payment_method_id, status, 
                                 transaction_date, description, related_shift_report_id, created_by, account_id)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                             RETURNING id`,
                            [
                                clubId, categoryId, cashIncome, 'income', mapping.paymentMethodId, 'completed',
                                shift.check_in, `Выручка смены (наличные)`,
                                shift.id, userId, mapping.accountId
                            ]
                        );
                        transactionIds.push(result.rows[0].id);
                        importedCount++;
                    }
                }

                // Create transaction for card income
                if (cardIncome > 0) {
                    const mapping = paymentMap.get('card');
                    if (mapping) {
                        const result = await query(
                            `INSERT INTO finance_transactions 
                                (club_id, category_id, amount, type, payment_method_id, status, 
                                 transaction_date, description, related_shift_report_id, created_by, account_id)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                             RETURNING id`,
                            [
                                clubId, categoryId, cardIncome, 'income', mapping.paymentMethodId, 'completed',
                                shift.check_in, `Выручка смены (безнал)`,
                                shift.id, userId, mapping.accountId
                            ]
                        );
                        transactionIds.push(result.rows[0].id);
                        importedCount++;
                    }

                    // Create transactions for custom income fields from report template
                    for (const field of incomeFields) {
                        const fieldValue = shift.report_data?.[field.key];
                        if (!fieldValue) continue;

                        const amount = parseFloat(fieldValue) || 0;
                        if (amount <= 0) continue;

                        // Track totals
                        if (!customTotals[field.key]) {
                            customTotals[field.key] = 0;
                        }
                        customTotals[field.key] += amount;

                        // Determine payment method from field name
                        const keyLower = field.key.toLowerCase();
                        let paymentMethodCode = 'card'; // default

                        if (keyLower.includes('cash') || keyLower.includes('наличн')) {
                            paymentMethodCode = 'cash';
                        } else if (keyLower.includes('sbp') || keyLower.includes('сбп')) {
                            paymentMethodCode = 'sbp';
                        } else if (keyLower.includes('bank') || keyLower.includes('банк') || keyLower.includes('transfer') || keyLower.includes('перевод')) {
                            paymentMethodCode = 'bank_transfer';
                        } else if (keyLower.includes('card') || keyLower.includes('карт')) {
                            paymentMethodCode = 'card';
                        }

                        // Get mapping for payment method
                        const mapping = paymentMap.get(paymentMethodCode);

                        if (mapping) {
                            const result = await query(
                                `INSERT INTO finance_transactions 
                                (club_id, category_id, amount, type, payment_method_id, status, 
                                 transaction_date, description, related_shift_report_id, created_by, account_id)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                             RETURNING id`,
                                [
                                    clubId, categoryId, amount, 'income', mapping.paymentMethodId, 'completed',
                                    shift.check_in, `Выручка смены (${field.label})`,
                                    shift.id, userId, mapping.accountId
                                ]
                            );
                            transactionIds.push(result.rows[0].id);
                            importedCount++;
                        }
                    }
                } else {
                    // In preview mode, just count what would be imported
                    if (cashIncome > 0) importedCount++;
                    if (cardIncome > 0) importedCount++;

                    // Count custom fields
                    for (const field of incomeFields) {
                        const fieldValue = shift.report_data?.[field.key];
                        if (!fieldValue) continue;

                        const amount = parseFloat(fieldValue) || 0;
                        if (amount > 0) {
                            if (!customTotals[field.key]) {
                                customTotals[field.key] = 0;
                            }
                            customTotals[field.key] += amount;
                            importedCount++;
                        }
                    }
                }
            }

            const totalRevenue = totalCash + totalCard + Object.values(customTotals).reduce((sum, val) => sum + val, 0);

            return NextResponse.json({
                preview,
                imported_count: importedCount,
                transaction_ids: transactionIds,
                total_cash: totalCash,
                total_card: totalCard,
                custom_fields: customTotals,
                total_revenue: totalRevenue,
                shifts_processed: shifts.length - skippedCount,
                skipped_count: skippedCount,
                skipped_reasons: skippedReasons
            });

        } catch (error) {
            console.error('Error importing revenue:', error);
            return NextResponse.json({
                error: 'Failed to import revenue'
            }, { status: 500 });
        }
    }
