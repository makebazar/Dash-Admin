import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { calculateSalary } from '@/lib/salary-calculator';
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard';
import { requireClubApiAccess } from '@/lib/club-api-access';
import { getShiftZoneDiscrepancyReport } from '@/app/clubs/[clubId]/inventory/actions';

type OwnerCorrectionChange = {
    field: string;
    label: string;
    before: any;
    after: any;
};

const SHIFT_CHANGE_LABELS: Record<string, string> = {
    check_in: 'Начало смены',
    check_out: 'Окончание смены',
    total_hours: 'Часы',
    cash_income: 'Наличные',
    card_income: 'Безнал',
    expenses: 'Расходы',
    report_comment: 'Комментарий сотрудника',
    shift_type: 'Тип смены',
};

const REPORT_DATA_LABELS: Record<string, string> = {
    cash_income: 'Наличные',
    card_income: 'Безнал',
    expenses_cash: 'Расходы',
    shift_comment: 'Комментарий сотрудника',
    expenses: 'Расходы',
};

function normalizeForComparison(value: any): any {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') return '';

        const date = new Date(trimmed);
        if (!Number.isNaN(date.getTime()) && (trimmed.includes('T') || trimmed.includes('-') || trimmed.includes(':'))) {
            return date.toISOString();
        }

        const numericValue = Number(trimmed);
        if (!Number.isNaN(numericValue)) {
            return numericValue;
        }

        return trimmed;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => normalizeForComparison(item));
    }
    if (typeof value === 'object') {
        return Object.keys(value)
            .sort()
            .reduce<Record<string, any>>((acc, key) => {
                acc[key] = normalizeForComparison(value[key]);
                return acc;
            }, {});
    }
    return value;
}

function areValuesEqual(before: any, after: any) {
    return JSON.stringify(normalizeForComparison(before)) === JSON.stringify(normalizeForComparison(after));
}

function getReportDataLabel(metricKey: string, reportFieldLabels: Record<string, string>) {
    return reportFieldLabels[metricKey] || REPORT_DATA_LABELS[metricKey] || metricKey;
}

function buildOwnerCorrectionChanges(
    currentShift: any,
    body: any,
    calculatedExpenses: any,
    reportFieldLabels: Record<string, string>
): OwnerCorrectionChange[] {
    const changes: OwnerCorrectionChange[] = [];

    const appendChange = (field: string, label: string, before: any, after: any) => {
        if (!areValuesEqual(before, after)) {
            changes.push({ field, label, before, after });
        }
    };

    const comparableFields = [
        { field: 'check_in', nextValue: body.check_in },
        { field: 'check_out', nextValue: body.check_out },
        { field: 'total_hours', nextValue: body.total_hours },
        { field: 'cash_income', nextValue: body.cash_income },
        { field: 'card_income', nextValue: body.card_income },
        { field: 'expenses', nextValue: calculatedExpenses },
        { field: 'report_comment', nextValue: body.report_comment },
        { field: 'shift_type', nextValue: body.shift_type },
    ];

    comparableFields.forEach(({ field, nextValue }) => {
        if (nextValue === undefined) return;
        appendChange(field, SHIFT_CHANGE_LABELS[field] || field, currentShift[field], nextValue);
    });

    if (body.report_data !== undefined) {
        const currentReportData = currentShift.report_data || {};
        const nextReportData = body.report_data || {};
        const reportKeys = new Set([
            ...Object.keys(currentReportData),
            ...Object.keys(nextReportData),
        ]);

        Array.from(reportKeys)
            .filter((key) => !key.startsWith('_'))
            .sort()
            .forEach((key) => {
                appendChange(
                    `report_data.${key}`,
                    getReportDataLabel(key, reportFieldLabels),
                    currentReportData[key],
                    nextReportData[key]
                );
            });
    }

    return changes;
}

// Helper function to create finance transactions from shift
async function createFinanceTransactionsFromShift(
    shiftId: string,
    clubId: number,
    userId: string,
    shiftData: any
) {
    // Get report template to determine income fields
    const templateResult = await query(
        `SELECT schema FROM club_report_templates 
         WHERE club_id = $1 AND is_active = true 
         ORDER BY created_at DESC LIMIT 1`,
        [clubId]
    );

    if (templateResult.rows.length === 0) {
        console.log('No report template found for club:', clubId);
        return;
    }

    const schema = templateResult.rows[0].schema;
    const incomeFields = schema.filter((field: any) => field.field_type === 'INCOME');
    const expenseFields = schema.filter((field: any) => ['EXPENSE', 'EXPENSE_LIST'].includes(field.field_type));

    // Get "Выручка клуба" category
    const incomeCategoryResult = await query(
        `SELECT id FROM finance_categories 
         WHERE name = 'Выручка клуба' AND type = 'income'
         AND (club_id = $1 OR club_id IS NULL)
         ORDER BY club_id DESC NULLS LAST LIMIT 1`,
        [clubId]
    );

    // Get "Прочие расходы" category for expenses
    const expenseCategoryResult = await query(
        `SELECT id FROM finance_categories 
         WHERE name = 'Прочие расходы' AND type = 'expense'
         AND (club_id = $1 OR club_id IS NULL)
         ORDER BY club_id DESC NULLS LAST LIMIT 1`,
        [clubId]
    );

    if (incomeCategoryResult.rows.length === 0) {
        throw new Error('Revenue category not found');
    }

    const incomeCategoryId = incomeCategoryResult.rows[0].id;
    const expenseCategoryId = expenseCategoryResult.rows[0]?.id || 10; // Fallback to system ID 10

    // Create transactions for each income field
    for (const field of incomeFields) {
        let amount = 0;

        if (field.metric_key === 'cash_income') {
            amount = Number(shiftData.cash_income) || 0;
        } else if (field.metric_key === 'card_income') {
            amount = Number(shiftData.card_income) || 0;
        } else if (field.metric_key === 'Bar') {
            // Bar revenue is already included in cash/card income
            continue;
        } else {
            // Custom fields from report_data
            amount = Number(shiftData.report_data?.[field.metric_key]) || 0;
        }

        if (amount > 0) {
            await query(
                `INSERT INTO finance_transactions (
                    club_id, category_id, amount, type, payment_method,
                    account_id, related_shift_report_id, transaction_date,
                    description, status, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                    clubId,
                    incomeCategoryId,
                    amount,
                    'income',
                    field.metric_key,
                    field.account_id,
                    shiftId,
                    shiftData.check_in,
                    field.custom_label || field.metric_key,
                    'completed',
                    userId
                ]
            );
        }
    }

    // Create transactions for each expense field
    for (const field of expenseFields) {
        const value = shiftData.report_data?.[field.metric_key];
        
        if (Array.isArray(value)) {
            for (const item of value) {
                const amount = Number(item.amount) || 0;
                if (amount > 0) {
                    await query(
                        `INSERT INTO finance_transactions (
                            club_id, category_id, amount, type, payment_method,
                            account_id, related_shift_report_id, transaction_date,
                            description, status, created_by
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                        [
                            clubId,
                            expenseCategoryId,
                            amount,
                            'expense',
                            'cash',
                            field.account_id || 9, // Fallback to Kassa
                            shiftId,
                            shiftData.check_in,
                            item.comment || field.custom_label || field.metric_key,
                            'completed',
                            userId
                        ]
                    );
                }
            }
        } else {
            // Handle both simple number/string and fallback for non-array EXPENSE_LIST
            const amount = Number(value) || 0;

            if (amount > 0) {
                await query(
                    `INSERT INTO finance_transactions (
                        club_id, category_id, amount, type, payment_method,
                        account_id, related_shift_report_id, transaction_date,
                        description, status, created_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [
                        clubId,
                        expenseCategoryId,
                        amount,
                        'expense',
                        'cash', // Expenses from shifts are usually cash
                        field.account_id || 9, // Fallback to Kassa
                        shiftId,
                        shiftData.check_in,
                        field.custom_label || field.metric_key,
                        'completed',
                        userId
                    ]
                );
            }
        }
    }
}

async function getExpenseCategoryId(clubId: string) {
    const expenseCategoryResult = await query(
        `SELECT id
         FROM finance_categories
         WHERE name = 'Прочие расходы'
           AND type = 'expense'
           AND (club_id = $1 OR club_id IS NULL)
         ORDER BY club_id DESC NULLS LAST
         LIMIT 1`,
        [clubId]
    )
    return expenseCategoryResult.rows[0]?.id ? Number(expenseCategoryResult.rows[0].id) : null
}

// GET: Get single shift details
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ clubId: string; shiftId: string }> }
) {
    try {
        const { clubId, shiftId } = await params;
        await requireClubApiAccess(clubId)

        const shiftResult = await query(
            `SELECT s.*, u.full_name as employee_name
             FROM shifts s
             LEFT JOIN users u ON s.user_id = u.id
             WHERE s.id = $1 AND s.club_id = $2`,
            [shiftId, clubId]
        );

        if ((shiftResult.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }

        const shift = shiftResult.rows[0];

        const handoverSourceRes = await query(
            `SELECT DISTINCT ON (ss.shift_id)
                ss.accepted_from_shift_id,
                ss.accepted_from_employee_id,
                prev_u.full_name as accepted_from_employee_name,
                prev_s.check_in as accepted_from_shift_check_in,
                prev_s.check_out as accepted_from_shift_check_out
             FROM shift_zone_snapshots ss
             LEFT JOIN shifts prev_s ON prev_s.id = ss.accepted_from_shift_id
             LEFT JOIN users prev_u ON prev_u.id = ss.accepted_from_employee_id
             WHERE ss.club_id = $1
               AND ss.shift_id = $2
               AND ss.snapshot_type = 'OPEN'
               AND ss.accepted_from_shift_id IS NOT NULL
             ORDER BY ss.shift_id, ss.created_at DESC`,
            [clubId, shiftId]
        )
        const handoverSource = handoverSourceRes.rows[0] || null

        // Fetch related data in parallel
        const [checklistsRes, transactionsRes, inventoryRes, maintenanceRes, metricsRes, productSalesRes, inventoryDiscrepanciesRes, shiftZoneDiscrepancies, shiftZoneResolutionsRes] = await Promise.all([
            // 1. Checklists (by shift_id OR (employee_id + time range))
            query(
                `SELECT e.*, t.name as template_name, u.full_name as evaluator_name
                 FROM evaluations e
                 LEFT JOIN evaluation_templates t ON e.template_id = t.id
                 LEFT JOIN users u ON e.evaluator_id = u.id
                 WHERE e.shift_id = $1
                 OR (
                     e.employee_id = $2
                     AND e.created_at >= $3
                     AND ($4::timestamp IS NULL OR e.created_at <= $4::timestamp)
                 )
                 ORDER BY e.created_at DESC`,
                [shiftId, shift.user_id, shift.check_in, shift.check_out]
            ),
            // 2. Finance Transactions
            query(
                `SELECT t.*, c.name as category_name
                 FROM finance_transactions t
                 LEFT JOIN finance_categories c ON t.category_id = c.id
                 WHERE t.related_shift_report_id = $1
                 ORDER BY t.created_at DESC`,
                [shiftId]
            ),
            // 3. Inventory Checks (by user and time range, linking to warehouse for name)
            query(
                `SELECT wi.*, w.name as warehouse_name 
                 FROM warehouse_inventories wi
                 LEFT JOIN warehouses w ON wi.warehouse_id = w.id
                 WHERE wi.created_by = $1 
                 AND wi.started_at >= $2
                 AND ($3::timestamp IS NULL OR wi.started_at <= $3::timestamp)
                 ORDER BY wi.started_at DESC`,
                [shift.user_id, shift.check_in, shift.check_out]
            ),
            // 4. Maintenance Tasks (by user and time range)
            query(
                `SELECT t.*, e.name as equipment_name, cw.name as workstation_name
                 FROM equipment_maintenance_tasks t
                 JOIN equipment e ON t.equipment_id = e.id
                 LEFT JOIN club_workstations cw ON e.workstation_id = cw.id
                 WHERE t.completed_by = $1
                 AND t.completed_at >= $2
                 AND ($3::timestamp IS NULL OR t.completed_at <= $3::timestamp)
                 ORDER BY t.completed_at DESC`,
                [shift.user_id, shift.check_in, shift.check_out]
            ),
            // 5. System Metrics (for labels)
            query(`SELECT key, label FROM system_metrics`),
            // 6. Product Sales (Warehouse Stock Movements of type SALE)
            query(
                `SELECT sm.*, p.name as product_name
                 FROM warehouse_stock_movements sm
                 JOIN warehouse_products p ON sm.product_id = p.id
                 LEFT JOIN shift_receipts sr ON sm.related_entity_type = 'SHIFT_RECEIPT' AND sm.related_entity_id = sr.id
                 WHERE sm.club_id = $1 
                 AND sm.type = 'SALE'
                 AND COALESCE(sr.counts_in_revenue, true) = true
                 AND (
                     sm.shift_id = $2 
                     OR (
                         sm.user_id = $3 
                         AND sm.created_at >= $4 
                         AND ($5::timestamp IS NULL OR sm.created_at <= $5::timestamp)
                     )
                 )
                 ORDER BY sm.created_at DESC`,
                [clubId, shiftId, shift.user_id, shift.check_in, shift.check_out]
            ),
            // 7. Inventory Discrepancies (items where difference != 0 for relevant inventories)
            query(
                `SELECT ii.*, p.name as product_name, wi.id as inventory_id
                 FROM warehouse_inventory_items ii
                 JOIN warehouse_inventories wi ON ii.inventory_id = wi.id
                 JOIN warehouse_products p ON ii.product_id = p.id
                 WHERE wi.created_by = $1 
                 AND wi.started_at >= $2
                 AND ($3::timestamp IS NULL OR wi.started_at <= $3::timestamp)
                 AND ii.difference != 0
                 ORDER BY ii.difference ASC`,
                [shift.user_id, shift.check_in, shift.check_out]
            ),
            getShiftZoneDiscrepancyReport(String(clubId), String(shiftId)),
            query(
                `SELECT
                    r.*,
                    u.full_name as resolved_by_name
                 FROM shift_zone_discrepancy_resolutions r
                 LEFT JOIN users u ON u.id = r.resolved_by
                 WHERE r.club_id = $1
                   AND r.shift_id = $2`,
                [clubId, shiftId]
            )
        ]);

        const resolutionMap = new Map(
            shiftZoneResolutionsRes.rows.map((row: any) => [
                `${row.warehouse_id}:${row.product_id}`,
                {
                    id: row.id,
                    resolution_type: row.resolution_type,
                    resolution_amount: Number(row.resolution_amount || 0),
                    discrepancy_quantity: Number(row.discrepancy_quantity || 0),
                    unit_price: Number(row.unit_price || 0),
                    notes: row.notes || null,
                    salary_payment_id: row.salary_payment_id || null,
                    finance_transaction_id: row.finance_transaction_id || null,
                    resolved_by: row.resolved_by,
                    resolved_by_name: row.resolved_by_name || null,
                    resolved_at: row.resolved_at,
                }
            ])
        );

        const enrichedShiftZoneDiscrepancies = shiftZoneDiscrepancies.map((row: any) => ({
            ...row,
            resolution: resolutionMap.get(`${row.warehouse_id}:${row.product_id}`) || null,
        }))

        // Create a map of metric key -> label
        const metricLabels: Record<string, string> = {};
        metricsRes.rows.forEach((row: any) => {
            metricLabels[row.key] = row.label;
        });

        // Also fetch club specific report template to get custom labels if any
        const templateRes = await query(
            `SELECT schema FROM club_report_templates WHERE club_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`,
            [clubId]
        );
        
        if (templateRes.rows.length > 0) {
            const schema = templateRes.rows[0].schema;
            if (Array.isArray(schema)) {
                schema.forEach((field: any) => {
                    if (field.metric_key && field.custom_label) {
                        metricLabels[field.metric_key] = field.custom_label;
                    }
                });
            }
        }

        return NextResponse.json({ 
            shift,
            checklists: checklistsRes.rows,
            transactions: transactionsRes.rows,
            inventory_checks: inventoryRes.rows,
            maintenance_tasks: maintenanceRes.rows,
            product_sales: productSalesRes.rows,
            inventory_discrepancies: inventoryDiscrepanciesRes.rows,
            shift_zone_discrepancies: enrichedShiftZoneDiscrepancies,
            metric_labels: metricLabels,
            handover_source: handoverSource
        });

    } catch (error: any) {
        const status = error?.status
        if (status) {
            return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
        }
        console.error('Get Shift Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string; shiftId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, shiftId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const guard = await ensureOwnerSubscriptionActive(clubId, userId)
        if (!guard.ok) return guard.response

        const body = await request.json();
        if (body?.action !== 'resolve_zone_discrepancy') {
            return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
        }

        const warehouseId = Number(body.warehouse_id)
        const productId = Number(body.product_id)
        const resolutionType = String(body.resolution_type || '')
        const note = typeof body.note === 'string' ? body.note.trim() : ''

        if (!Number.isInteger(warehouseId) || warehouseId <= 0 || !Number.isInteger(productId) || productId <= 0) {
            return NextResponse.json({ error: 'Некорректная строка расхождения' }, { status: 400 });
        }
        if (resolutionType !== 'SALARY_DEDUCTION' && resolutionType !== 'LOSS') {
            return NextResponse.json({ error: 'Некорректный тип решения' }, { status: 400 });
        }

        const shiftRes = await query(
            `SELECT id, user_id, check_in, check_out
             FROM shifts
             WHERE id = $1 AND club_id = $2
             LIMIT 1`,
            [shiftId, clubId]
        )
        if ((shiftRes.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }
        const shift = shiftRes.rows[0]

        const existingResolutionRes = await query(
            `SELECT id
             FROM shift_zone_discrepancy_resolutions
             WHERE club_id = $1
               AND shift_id = $2
               AND warehouse_id = $3
               AND product_id = $4
             LIMIT 1`,
            [clubId, shiftId, warehouseId, productId]
        )
        if ((existingResolutionRes.rowCount || 0) > 0) {
            return NextResponse.json({ error: 'Для этой строки уже принято решение' }, { status: 409 });
        }

        const discrepancies = await getShiftZoneDiscrepancyReport(String(clubId), String(shiftId))
        const row = discrepancies.find((item) => Number(item.warehouse_id) === warehouseId && Number(item.product_id) === productId)
        if (!row) {
            return NextResponse.json({ error: 'Расхождение не найдено или уже исчезло после пересчета' }, { status: 404 });
        }

        const rawDifferenceQuantity = Number(row.difference_quantity || 0)
        if (rawDifferenceQuantity >= 0) {
            return NextResponse.json({ error: 'Излишек не удерживается из ЗП и не списывается как потери клуба' }, { status: 400 });
        }

        const discrepancyQuantity = Math.abs(rawDifferenceQuantity)
        const unitPrice = Number(row.selling_price || 0)
        const maxResolutionAmount = Math.max(0, Number((discrepancyQuantity * unitPrice).toFixed(2)))
        if (maxResolutionAmount <= 0) {
            return NextResponse.json({ error: 'Для этой строки нет денежной суммы для обработки' }, { status: 400 });
        }

        let resolutionAmount = maxResolutionAmount
        if (resolutionType === 'SALARY_DEDUCTION') {
            resolutionAmount = Number(body.amount)
            if (!Number.isFinite(resolutionAmount) || resolutionAmount <= 0) {
                return NextResponse.json({ error: 'Сумма удержания должна быть больше 0' }, { status: 400 });
            }
            if (resolutionAmount > maxResolutionAmount) {
                return NextResponse.json({ error: 'Сумма удержания не может быть больше полной суммы расхождения' }, { status: 400 });
            }
            resolutionAmount = Number(resolutionAmount.toFixed(2))
        }

        let salaryPaymentId: number | null = null
        let financeTransactionId: number | null = null

        if (resolutionType === 'SALARY_DEDUCTION') {
            const salaryPaymentRes = await query(
                `INSERT INTO salary_payments
                    (club_id, user_id, amount, payment_type, comment, created_by)
                 VALUES ($1, $2, $3, 'penalty', $4, $5)
                 RETURNING id`,
                [
                    clubId,
                    shift.user_id,
                    resolutionAmount,
                    note || `Удержание по расхождению зоны: ${row.warehouse_name} / ${row.product_name}`,
                    userId
                ]
            )
            salaryPaymentId = Number(salaryPaymentRes.rows[0].id)
        } else if (resolutionType === 'LOSS') {
            const expenseCategoryId = await getExpenseCategoryId(clubId)
            if (!expenseCategoryId) {
                return NextResponse.json({ error: 'Не найдена категория "Прочие расходы" для списания потерь' }, { status: 400 });
            }
            const financeTransactionRes = await query(
                `INSERT INTO finance_transactions
                    (club_id, category_id, amount, type, payment_method, account_id, related_shift_report_id, transaction_date, description, status, created_by, notes)
                 VALUES ($1, $2, $3, 'expense', 'other', NULL, $4, $5, $6, 'completed', $7, $8)
                 RETURNING id`,
                [
                    clubId,
                    expenseCategoryId,
                    resolutionAmount,
                    shiftId,
                    shift.check_out || shift.check_in,
                    `Потери по расхождению зоны: ${row.warehouse_name} / ${row.product_name}`,
                    userId,
                    note || null
                ]
            )
            financeTransactionId = Number(financeTransactionRes.rows[0].id)
        }

        const resolutionRes = await query(
            `INSERT INTO shift_zone_discrepancy_resolutions
                (club_id, shift_id, warehouse_id, product_id, resolution_type, resolution_amount, discrepancy_quantity, unit_price, notes, salary_payment_id, finance_transaction_id, resolved_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id, resolved_at`,
            [
                clubId,
                shiftId,
                warehouseId,
                productId,
                resolutionType,
                resolutionAmount,
                discrepancyQuantity,
                unitPrice,
                note || null,
                salaryPaymentId,
                financeTransactionId,
                userId
            ]
        )

        return NextResponse.json({
            success: true,
            resolution: {
                id: resolutionRes.rows[0].id,
                resolution_type: resolutionType,
                resolution_amount: resolutionAmount,
                discrepancy_quantity: discrepancyQuantity,
                unit_price: unitPrice,
                notes: note || null,
                salary_payment_id: salaryPaymentId,
                finance_transaction_id: financeTransactionId,
                resolved_by: userId,
                resolved_at: resolutionRes.rows[0].resolved_at,
            }
        })
    } catch (error: any) {
        console.error('Resolve Shift Zone Discrepancy Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH: Update shift (owner can edit/verify)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string; shiftId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, shiftId } = await params;
        const body = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const guard = await ensureOwnerSubscriptionActive(clubId, userId)
        if (!guard.ok) return guard.response

        // Fetch current shift data to merge with updates for calculation
        const currentShiftRes = await query(
            `SELECT user_id, total_hours, cash_income, card_income, expenses, report_data, report_comment,
                    check_in, check_out, shift_type, status, verified_by, owner_correction_changes
             FROM shifts WHERE id = $1`,
            [shiftId]
        );

        if ((currentShiftRes.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }

        const currentShift = currentShiftRes.rows[0];
        let reportFieldLabels: Record<string, string> = {};

        if (body.report_data !== undefined) {
            const reportTemplateRes = await query(
                `SELECT schema
                 FROM club_report_templates
                 WHERE club_id = $1 AND is_active = true
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [clubId]
            );

            const schema = reportTemplateRes.rows[0]?.schema;
            if (Array.isArray(schema)) {
                reportFieldLabels = schema.reduce<Record<string, string>>((acc, field: any) => {
                    if (field?.metric_key) {
                        acc[field.metric_key] = field.custom_label || field.label || field.metric_key;
                    }
                    return acc;
                }, {});
            }
        }

        // Helper to sum numeric values from report data (handles numbers, strings, and expense arrays)
        const sumMetric = (val: any) => {
            if (Array.isArray(val)) {
                return val.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0);
            }
            return parseFloat(String(val)) || 0;
        };

        // Prepare merged data for calculation
        const mergedReportData = body.report_data !== undefined ? body.report_data : currentShift.report_data;
        
        // Auto-calculate expenses from report_data if not explicitly provided in body
        let calculatedExpenses = body.expenses !== undefined ? body.expenses : currentShift.expenses;
        if (body.report_data !== undefined && body.report_data['expenses_cash'] !== undefined) {
            calculatedExpenses = sumMetric(body.report_data['expenses_cash']);
        }

        const mergedData = {
            total_hours: body.total_hours !== undefined ? body.total_hours : currentShift.total_hours,
            cash_income: body.cash_income !== undefined ? body.cash_income : currentShift.cash_income,
            card_income: body.card_income !== undefined ? body.card_income : currentShift.card_income,
            expenses: calculatedExpenses,
            report_data: mergedReportData,
            check_in: body.check_in !== undefined ? body.check_in : currentShift.check_in,
            shift_type: body.shift_type !== undefined ? body.shift_type : currentShift.shift_type
        };

        const ownerCorrectionChanges = buildOwnerCorrectionChanges(
            currentShift,
            body,
            calculatedExpenses,
            reportFieldLabels
        );

        // Calculate Salary
        let calculatedSalary = null;
        let salaryBreakdown = null;

        // Get assigned scheme
        const schemeRes = await query(
            `SELECT ss.id, ss.name, sv.formula
             FROM employee_salary_assignments esa
             JOIN salary_schemes ss ON esa.scheme_id = ss.id
             JOIN salary_scheme_versions sv ON sv.scheme_id = ss.id
             WHERE esa.user_id = $1 AND esa.club_id = $2
             ORDER BY sv.version DESC
             LIMIT 1`,
            [currentShift.user_id, clubId]
        );

        // Fetch evaluations for this shift (for checklist bonuses)
        const evaluationsRes = await query(
            `SELECT template_id, total_score as score_percent FROM evaluations WHERE shift_id = $1`,
            [shiftId]
        );
        const evaluations = evaluationsRes.rows;

        if ((schemeRes.rowCount || 0) > 0) {
            const scheme = schemeRes.rows[0];
            const calculation = await calculateSalary({
                id: shiftId,
                total_hours: Number(mergedData.total_hours) || 0,
                report_data: mergedData.report_data || {},
                evaluations: evaluations
            }, scheme.formula, {
                total_revenue: (Number(mergedData.cash_income) || 0) + (Number(mergedData.card_income) || 0),
                revenue_cash: Number(mergedData.cash_income) || 0,
                revenue_card: Number(mergedData.card_income) || 0,
                expenses: Number(mergedData.expenses) || 0,
                ...mergedData.report_data
            });

            calculatedSalary = calculation.total;
            salaryBreakdown = calculation.breakdown;
        }

        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (body.cash_income !== undefined) {
            updates.push(`cash_income = $${paramIndex++}`);
            values.push(body.cash_income);
        }
        if (body.card_income !== undefined) {
            updates.push(`card_income = $${paramIndex++}`);
            values.push(body.card_income);
        }
        
        // Use calculatedExpenses for the expenses column update
        updates.push(`expenses = $${paramIndex++}`);
        values.push(calculatedExpenses);

        if (body.report_comment !== undefined) {
            updates.push(`report_comment = $${paramIndex++}`);
            values.push(body.report_comment);
        }

        // Handle verification workflow
        if (body.status === 'VERIFIED') {
            // Check if shift already has finance transactions
            const existingTransactions = await query(
                'SELECT id FROM finance_transactions WHERE related_shift_report_id = $1',
                [shiftId]
            );

            if (existingTransactions.rows.length > 0) {
                // Transactions already exist, just sync status
                updates.push(`status = $${paramIndex++}`);
                values.push('VERIFIED');
                if (!currentShift.verified_by) {
                    updates.push(`verified_by = $${paramIndex++}`);
                    values.push(userId);
                    updates.push(`verified_at = $${paramIndex++}`);
                    values.push(new Date());
                }
            } else {
                // Create finance transactions
                await createFinanceTransactionsFromShift(shiftId, Number(clubId), userId, mergedData);

                // Set verification fields
                updates.push(`verified_by = $${paramIndex++}`);
                values.push(userId);
                updates.push(`verified_at = $${paramIndex++}`);
                values.push(new Date());
                updates.push(`status = $${paramIndex++}`);
                values.push('VERIFIED');
            }
        } else if (body.status === 'CLOSED' && currentShift.status === 'VERIFIED') {
            // Unverifying - delete finance transactions
            await query(
                'DELETE FROM finance_transactions WHERE related_shift_report_id = $1',
                [shiftId]
            );

            updates.push(`status = $${paramIndex++}`);
            values.push('CLOSED');
            updates.push(`verified_by = $${paramIndex++}`);
            values.push(null);
            updates.push(`verified_at = $${paramIndex++}`);
            values.push(null);
        } else if (body.status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            values.push(body.status);
        }

        // Handle owner corrections flag
        if (currentShift.status === 'CLOSED' && body.status !== 'VERIFIED') {
            if (ownerCorrectionChanges.length > 0) {
                updates.push(`has_owner_corrections = $${paramIndex++}`);
                values.push(true);
                updates.push(`owner_correction_changes = $${paramIndex++}`);
                values.push(JSON.stringify(ownerCorrectionChanges));
            }
        }

        // Handle owner notes
        if (body.owner_notes !== undefined) {
            updates.push(`owner_notes = $${paramIndex++}`);
            values.push(body.owner_notes);
        }
        if (body.report_data !== undefined) {
            updates.push(`report_data = $${paramIndex++}`);
            values.push(JSON.stringify(body.report_data));
        }
        if (body.check_in !== undefined) {
            updates.push(`check_in = $${paramIndex++}`);
            values.push(body.check_in);
        }
        if (body.check_out !== undefined) {
            updates.push(`check_out = $${paramIndex++}`);
            values.push(body.check_out);
        }
        if (body.total_hours !== undefined) {
            updates.push(`total_hours = $${paramIndex++}`);
            values.push(body.total_hours);
        }
        if (body.shift_type !== undefined) {
            updates.push(`shift_type = $${paramIndex++}`);
            values.push(body.shift_type);
        }

        // Update salary fields
        if (calculatedSalary !== null) {
            updates.push(`calculated_salary = $${paramIndex++}`);
            values.push(calculatedSalary);

            // Handle declined payout: If user chose NOT to take money (auto_payout_amount === 0),
            // we must move instant_payout to accrued_payout in breakdown
            if (mergedData.report_data?.auto_payout_amount === 0 && salaryBreakdown?.instant_payout > 0) {
                salaryBreakdown.accrued_payout = (salaryBreakdown.accrued_payout || 0) + salaryBreakdown.instant_payout;
                salaryBreakdown.instant_payout = 0;
            }

            updates.push(`salary_breakdown = $${paramIndex++}`);
            values.push(JSON.stringify(salaryBreakdown));
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(shiftId, clubId);

        const result = await query(
            `UPDATE shifts 
             SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND club_id = $${paramIndex}
             RETURNING *`,
            values
        );

        if ((result.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, shift: result.rows[0] });

    } catch (error: any) {
        console.error('Update Shift Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Remove shift (owner only)
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ clubId: string; shiftId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, shiftId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const guard = await ensureOwnerSubscriptionActive(clubId, userId)
        if (!guard.ok) return guard.response

        // Delete shift
        const deleteResult = await query(
            `DELETE FROM shifts 
             WHERE id = $1 AND club_id = $2
             RETURNING id`,
            [shiftId, clubId]
        );

        if ((deleteResult.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Shift deleted successfully' });

    } catch (error: any) {
        console.error('Delete Shift Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
