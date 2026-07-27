import { NextRequest, NextResponse } from "next/server";
import { query } from "@/db";
import { requireModuleAccess } from "@/lib/club-api-access";

// GET /api/clubs/[clubId]/finance/shift-sync - List shifts pending financial acceptance
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    await requireModuleAccess(clubId, "finance", "view");

    // Fetch closed/verified shifts with full breakdown from report_data
    const pendingShiftsRes = await query(
      `SELECT 
        s.id,
        s.club_id,
        s.check_in as opened_at,
        s.check_out as closed_at,
        COALESCE(s.cash_income, 0) as revenue_cash,
        COALESCE(s.card_income, 0) as revenue_card,
        COALESCE((s.report_data->>'sbp')::numeric, 0) as revenue_sbp,
        COALESCE((s.report_data->>'Bar')::numeric, 0) as bar_sales,
        COALESCE((s.report_data->>'receipts_count')::numeric, 0) as receipts_count,
        s.report_data->'expenses_cash' as expenses_cash_list,
        COALESCE(s.expenses, 0) as total_expenses,
        s.report_comment as admin_comment,
        s.status,
        u.full_name as closed_by_name
       FROM shifts s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.club_id = $1 
         AND s.status IN ('CLOSED', 'VERIFIED')
         AND s.id::text NOT IN (
           SELECT DISTINCT related_shift_report_id::text 
           FROM finance_transactions 
           WHERE club_id = $1 AND related_shift_report_id IS NOT NULL
         )
       ORDER BY s.check_out DESC
       LIMIT 50`,
      [clubId]
    );

    return NextResponse.json({
      pending_shifts: pendingShiftsRes.rows.map(r => {
        const revCash = parseFloat(r.revenue_cash || 0);
        const revCard = parseFloat(r.revenue_card || 0);
        const revSbp = parseFloat(r.revenue_sbp || 0);
        return {
          id: r.id,
          opened_at: r.opened_at,
          closed_at: r.closed_at,
          revenue_cash: revCash,
          revenue_card: revCard,
          revenue_sbp: revSbp,
          total_revenue: revCash + revCard + revSbp,
          bar_sales: parseFloat(r.bar_sales || 0),
          receipts_count: parseInt(r.receipts_count || 0),
          expenses_cash_list: Array.isArray(r.expenses_cash_list) ? r.expenses_cash_list : [],
          total_expenses: parseFloat(r.total_expenses || 0),
          admin_comment: r.admin_comment,
          closed_by_name: r.closed_by_name || 'Администратор'
        };
      })
    });
  } catch (error: any) {
    console.error("Failed to fetch pending shifts for sync:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch pending shifts" },
      { status: 500 }
    );
  }
}

// POST /api/clubs/[clubId]/finance/shift-sync - Accept shift revenue into finance accounts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    const userId = await requireModuleAccess(clubId, "finance", "edit");
    const body = await request.json();

    const {
      shift_report_id, // Shift UUID
      cash_account_id,
      card_account_id,
      sbp_account_id,
      notes = "Приемка выручки со смены"
    } = body;

    if (!shift_report_id || !cash_account_id) {
      return NextResponse.json(
        { error: "shift_report_id and cash_account_id are required" },
        { status: 400 }
      );
    }

    // Get shift details
    const shiftRes = await query(
      `SELECT * FROM shifts WHERE id = $1 AND club_id = $2`,
      [shift_report_id, clubId]
    );

    if (shiftRes.rows.length === 0) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const shift = shiftRes.rows[0];
    const reportData = shift.report_data || {};
    const revCash = parseFloat(shift.cash_income || 0);
    const revCard = parseFloat(shift.card_income || 0);
    const revSbp = parseFloat(reportData.sbp || 0);
    const expenses = parseFloat(shift.expenses || 0);
    const dateStr = new Date(shift.check_out || new Date()).toISOString().split('T')[0];

    // Find default income category
    const catIncomeRes = await query(
      `SELECT id FROM finance_categories WHERE (club_id = $1 OR club_id IS NULL) AND type = 'income' AND is_active = true ORDER BY id ASC LIMIT 1`,
      [clubId]
    );
    const incomeCategoryId = catIncomeRes.rows[0]?.id || 1;

    // Find default expense category
    const catExpenseRes = await query(
      `SELECT id FROM finance_categories WHERE (club_id = $1 OR club_id IS NULL) AND type = 'expense' AND is_active = true ORDER BY id ASC LIMIT 1`,
      [clubId]
    );
    const expenseCategoryId = catExpenseRes.rows[0]?.id || 2;

    const createdTransactions = [];

    // 1. Record Cash Revenue
    if (revCash > 0) {
      const txRes = await query(
        `INSERT INTO finance_transactions
          (club_id, category_id, amount, type, payment_method, status, transaction_date, description, notes, related_shift_report_id, created_by, account_id)
         VALUES ($1, $2, $3, 'income', 'cash', 'completed', $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          clubId,
          incomeCategoryId,
          revCash,
          dateStr,
          `Выручка смены (Наличные)`,
          `${notes} [Shift:${shift_report_id}]`,
          shift_report_id.toString(),
          userId,
          cash_account_id
        ]
      );
      createdTransactions.push(txRes.rows[0]);
    }

    // 2. Record Card/Terminal Revenue
    if (revCard > 0 && card_account_id) {
      const txRes = await query(
        `INSERT INTO finance_transactions
          (club_id, category_id, amount, type, payment_method, status, transaction_date, description, notes, related_shift_report_id, created_by, account_id)
         VALUES ($1, $2, $3, 'income', 'card', 'completed', $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          clubId,
          incomeCategoryId,
          revCard,
          dateStr,
          `Выручка смены (Безналичные / Эквайринг)`,
          `${notes} [Shift:${shift_report_id}]`,
          shift_report_id.toString(),
          userId,
          card_account_id
        ]
      );
      createdTransactions.push(txRes.rows[0]);
    }

    // 3. Record SBP/Transfers Revenue
    if (revSbp > 0) {
      const targetSbpAccountId = sbp_account_id || card_account_id || cash_account_id;
      const txRes = await query(
        `INSERT INTO finance_transactions
          (club_id, category_id, amount, type, payment_method, status, transaction_date, description, notes, related_shift_report_id, created_by, account_id)
         VALUES ($1, $2, $3, 'income', 'bank_transfer', 'completed', $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          clubId,
          incomeCategoryId,
          revSbp,
          dateStr,
          `Выручка смены (СБП / Переводы)`,
          `${notes} [Shift:${shift_report_id}]`,
          shift_report_id.toString(),
          userId,
          targetSbpAccountId
        ]
      );
      createdTransactions.push(txRes.rows[0]);
    }

    // 4. Record Itemized Shift Expenses from Cash
    const expensesList = Array.isArray(reportData.expenses_cash) ? reportData.expenses_cash : [];
    if (expensesList.length > 0) {
      for (const item of expensesList) {
        const itemAmount = parseFloat(item.amount || 0);
        if (itemAmount > 0) {
          const txRes = await query(
            `INSERT INTO finance_transactions
              (club_id, category_id, amount, type, payment_method, status, transaction_date, description, notes, related_shift_report_id, created_by, account_id)
             VALUES ($1, $2, $3, 'expense', 'cash', 'completed', $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
              clubId,
              expenseCategoryId,
              itemAmount,
              dateStr,
              `Расход из кассы смены: ${item.comment || 'Изъятие'}`,
              `${notes} [Shift:${shift_report_id}] ${item.comment || ''}`,
              shift_report_id.toString(),
              userId,
              cash_account_id
            ]
          );
          createdTransactions.push(txRes.rows[0]);
        }
      }
    } else if (expenses > 0) {
      const txRes = await query(
        `INSERT INTO finance_transactions
          (club_id, category_id, amount, type, payment_method, status, transaction_date, description, notes, related_shift_report_id, created_by, account_id)
         VALUES ($1, $2, $3, 'expense', 'cash', 'completed', $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          clubId,
          expenseCategoryId,
          expenses,
          dateStr,
          `Расходы смены`,
          `${notes} [Shift:${shift_report_id}]`,
          shift_report_id.toString(),
          userId,
          cash_account_id
        ]
      );
      createdTransactions.push(txRes.rows[0]);
    }

    return NextResponse.json({
      success: true,
      created_transactions: createdTransactions
    });
  } catch (error: any) {
    console.error("Failed to accept shift revenue:", error);
    return NextResponse.json(
      { error: error.message || "Failed to accept shift revenue" },
      { status: 500 }
    );
  }
}
