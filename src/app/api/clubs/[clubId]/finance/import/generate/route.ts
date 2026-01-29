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
        let totalSbp = 0;
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
            const sbpIncome = shift.report_data?.sbp_income ? parseFloat(shift.report_data.sbp_income) : 0;

            totalCash += cashIncome;
            totalCard += cardIncome;
            totalSbp += sbpIncome;

            if (!preview) {
                // Create transaction for cash income
                if (cashIncome > 0) {
                    const result = await query(
                        `INSERT INTO finance_transactions 
                            (club_id, category_id, amount, type, payment_method, status, 
                             transaction_date, description, related_shift_report_id, created_by)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                         RETURNING id`,
                        [
                            clubId, categoryId, cashIncome, 'income', 'cash', 'completed',
                            shift.check_in, `Выручка смены #${shift.id} (наличные)`,
                            shift.id, userId
                        ]
                    );
                    transactionIds.push(result.rows[0].id);
                    importedCount++;
                }

                // Create transaction for card income
                if (cardIncome > 0) {
                    const result = await query(
                        `INSERT INTO finance_transactions 
                            (club_id, category_id, amount, type, payment_method, status, 
                             transaction_date, description, related_shift_report_id, created_by)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                         RETURNING id`,
                        [
                            clubId, categoryId, cardIncome, 'income', 'card', 'completed',
                            shift.check_in, `Выручка смены #${shift.id} (безнал)`,
                            shift.id, userId
                        ]
                    );
                    transactionIds.push(result.rows[0].id);
                    importedCount++;
                }

                // Create transaction for SBP income
                if (sbpIncome > 0) {
                    const result = await query(
                        `INSERT INTO finance_transactions 
                            (club_id, category_id, amount, type, payment_method, status, 
                             transaction_date, description, related_shift_report_id, created_by)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                         RETURNING id`,
                        [
                            clubId, categoryId, sbpIncome, 'income', 'bank_transfer', 'completed',
                            shift.check_in, `Выручка смены #${shift.id} (СБП)`,
                            shift.id, userId
                        ]
                    );
                    transactionIds.push(result.rows[0].id);
                    importedCount++;
                }
            } else {
                // In preview mode, just count what would be imported
                if (cashIncome > 0) importedCount++;
                if (cardIncome > 0) importedCount++;
                if (sbpIncome > 0) importedCount++;
            }
        }

        return NextResponse.json({
            preview,
            imported_count: importedCount,
            transaction_ids: transactionIds,
            total_cash: totalCash,
            total_card: totalCard,
            total_sbp: totalSbp,
            total_revenue: totalCash + totalCard + totalSbp,
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
