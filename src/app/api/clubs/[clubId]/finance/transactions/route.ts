import { NextRequest, NextResponse } from "next/server";
import { query } from "@/db";
import { requireModuleAccess } from "@/lib/club-api-access";

// GET /api/clubs/[clubId]/finance/transactions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    await requireModuleAccess(clubId, "finance", "view");
    const { searchParams } = new URL(request.url);

    const type = searchParams.get("type"); // 'income' or 'expense'
    const categoryId = searchParams.get("category_id");
    const status = searchParams.get("status");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "1000");
    const offset = parseInt(searchParams.get("offset") || "0");

    let queryStr = `
            SELECT
                ft.*,
                fc.name as category_name,
                fc.icon as category_icon,
                fc.color as category_color,
                fa.name as account_name,
                u.full_name as created_by_name
            FROM finance_transactions ft
            LEFT JOIN finance_categories fc ON ft.category_id = fc.id
            LEFT JOIN finance_accounts fa ON ft.account_id = fa.id
            LEFT JOIN users u ON ft.created_by = u.id
            WHERE ft.club_id = $1
        `;

    const values: any[] = [clubId];
    let paramCount = 1;

    if (type) {
      paramCount++;
      queryStr += ` AND ft.type = $${paramCount}`;
      values.push(type);
    }

    if (categoryId) {
      paramCount++;
      queryStr += ` AND ft.category_id = $${paramCount}`;
      values.push(categoryId);
    }

    if (status) {
      paramCount++;
      queryStr += ` AND ft.status = $${paramCount}`;
      values.push(status);
    }

    if (startDate && startDate !== "all" && startDate !== "all_time") {
      paramCount++;
      queryStr += ` AND ft.transaction_date >= $${paramCount}`;
      values.push(startDate);
    }

    if (endDate && startDate !== "all" && startDate !== "all_time") {
      paramCount++;
      queryStr += ` AND ft.transaction_date <= $${paramCount}`;
      values.push(endDate);
    }

    if (search) {
      paramCount++;
      queryStr += ` AND (ft.description ILIKE $${paramCount} OR ft.notes ILIKE $${paramCount})`;
      values.push(`%${search}%`);
    }

    queryStr += ` ORDER BY ft.transaction_date DESC, ft.created_at DESC`;
    queryStr += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);

    const result = await query(queryStr, values);

    // Get totals
    let totalsQuery = `
            SELECT
                SUM(CASE WHEN type = 'income' AND status = 'completed' AND (is_transfer = false OR is_transfer IS NULL) THEN amount ELSE 0 END) as total_income,
                SUM(CASE WHEN type = 'expense' AND status = 'completed' AND (is_transfer = false OR is_transfer IS NULL) THEN amount ELSE 0 END) as total_expense,
                COUNT(*) as total_count
            FROM finance_transactions
            WHERE club_id = $1
        `;

    const totalsValues: any[] = [clubId];
    let totalsParamCount = 1;

    if (type) {
      totalsParamCount++;
      totalsQuery += ` AND type = $${totalsParamCount}`;
      totalsValues.push(type);
    }

    if (categoryId) {
      totalsParamCount++;
      totalsQuery += ` AND category_id = $${totalsParamCount}`;
      totalsValues.push(categoryId);
    }

    if (status) {
      totalsParamCount++;
      totalsQuery += ` AND status = $${totalsParamCount}`;
      totalsValues.push(status);
    }

    if (startDate && startDate !== "all" && startDate !== "all_time") {
      totalsParamCount++;
      totalsQuery += ` AND transaction_date >= $${totalsParamCount}`;
      totalsValues.push(startDate);
    }

    if (endDate && startDate !== "all" && startDate !== "all_time") {
      totalsParamCount++;
      totalsQuery += ` AND transaction_date <= $${totalsParamCount}`;
      totalsValues.push(endDate);
    }

    if (search) {
      totalsParamCount++;
      totalsQuery += ` AND (description ILIKE $${totalsParamCount} OR notes ILIKE $${totalsParamCount})`;
      totalsValues.push(`%${search}%`);
    }

    const totalsResult = await query(totalsQuery, totalsValues);
    const totals = totalsResult.rows[0];

    return NextResponse.json({
      transactions: result.rows,
      totals: {
        income: parseFloat(totals.total_income || 0),
        expense: parseFloat(totals.total_expense || 0),
        profit:
          parseFloat(totals.total_income || 0) -
          parseFloat(totals.total_expense || 0),
        count: parseInt(totals.total_count || 0),
      },
      pagination: {
        limit,
        offset,
        total: parseInt(totals.total_count || 0),
      },
    });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status) {
      return NextResponse.json(
        { error: status === 401 ? "Unauthorized" : "Forbidden" },
        { status },
      );
    }
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 },
    );
  }
}

// POST /api/clubs/[clubId]/finance/transactions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    const accessResult = await requireModuleAccess(clubId, "finance", "edit");
    const currentUserId = typeof accessResult === 'string' ? accessResult : (accessResult?.userId || null);
    const body = await request.json();

    const {
      category_id,
      amount,
      type,
      payment_method = "cash",
      status = "completed",
      transaction_date,
      description,
      notes,
      attachment_url,
      account_id,
      is_transfer = false,
      transfer_pair_id
    } = body;

    let finalCategoryId = category_id ? parseInt(category_id) : null;
    if (!finalCategoryId || isNaN(finalCategoryId)) {
      const defaultCatRes = await query(
        `SELECT id FROM finance_categories WHERE type = $1 AND is_active = true LIMIT 1`,
        [type === "income" ? "income" : "expense"]
      );
      finalCategoryId = defaultCatRes.rows[0]?.id || (type === "income" ? 2 : 10);
    }

    if (!amount || !type || !transaction_date) {
      return NextResponse.json(
        { error: "amount, type, and transaction_date are required" },
        { status: 400 },
      );
    }

    const result = await query(
      `INSERT INTO finance_transactions
                (club_id, category_id, amount, type, payment_method, status,
                 transaction_date, description, notes, attachment_url, created_by, account_id, is_transfer, transfer_pair_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING *`,
      [
        clubId,
        finalCategoryId,
        amount,
        type,
        payment_method,
        status,
        transaction_date,
        description,
        notes,
        attachment_url,
        currentUserId,
        account_id,
        is_transfer,
        transfer_pair_id
      ],
    );

    const fullTransaction = await query(
      `SELECT
                ft.*,
                fc.name as category_name,
                fc.icon as category_icon,
                fc.color as category_color
            FROM finance_transactions ft
            LEFT JOIN finance_categories fc ON ft.category_id = fc.id
            WHERE ft.id = $1`,
      [result.rows[0].id],
    );

    return NextResponse.json(
      { transaction: fullTransaction.rows[0] },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 },
    );
  }
}

// DELETE /api/clubs/[clubId]/finance/transactions
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    await requireModuleAccess(clubId, "finance", "edit");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const txIdNum = parseInt(id);
    const clubIdNum = parseInt(clubId);

    // Delete transaction and paired transfer if applicable
    await query(
      `DELETE FROM finance_transactions WHERE (id = $1 OR transfer_pair_id = $1) AND club_id = $2`,
      [txIdNum, clubIdNum]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
