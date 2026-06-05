import { NextRequest, NextResponse } from "next/server";
import { query } from "@/db";
import { requireModuleAccess } from "@/lib/club-api-access";

// GET /api/clubs/[clubId]/finance/credits
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    await requireModuleAccess(clubId, "finance", "view");

    const result = await query(
      `SELECT id, club_id, name, creditor, total_amount, remaining_amount, 
              interest_rate, start_date, end_date, payment_day, monthly_payment, 
              status, description, notes, contract_number, created_at, updated_at
       FROM finance_credits
       WHERE club_id = $1 AND status = 'active'
       ORDER BY created_at DESC`,
      [clubId]
    );

    const credits = result.rows.map((row) => ({
      ...row,
      total_amount: parseFloat(row.total_amount || 0),
      remaining_amount: parseFloat(row.remaining_amount || 0),
      interest_rate: parseFloat(row.interest_rate || 0),
      monthly_payment: parseFloat(row.monthly_payment || 0),
    }));

    return NextResponse.json({ credits });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status) {
      return NextResponse.json(
        { error: status === 401 ? "Unauthorized" : "Forbidden" },
        { status },
      );
    }
    console.error("Error fetching credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 },
    );
  }
}

// POST /api/clubs/[clubId]/finance/credits
// Records a payment for a credit
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    const userId = await requireModuleAccess(clubId, "finance", "edit");
    const body = await request.json();

    const {
      credit_id,
      amount,
      payment_date,
      account_id,
      notes = "",
      principal_amount,
      interest_amount = 0
    } = body;

    if (!credit_id || !amount || !payment_date || !account_id) {
      return NextResponse.json(
        { error: "credit_id, amount, payment_date, and account_id are required" },
        { status: 400 }
      );
    }

    // 1. Fetch current credit details
    const creditRes = await query(
      `SELECT * FROM finance_credits WHERE id = $1 AND club_id = $2 AND status = 'active'`,
      [credit_id, clubId]
    );

    if (creditRes.rows.length === 0) {
      return NextResponse.json({ error: "Active credit not found" }, { status: 404 });
    }

    const credit = creditRes.rows[0];
    const currentRemaining = parseFloat(credit.remaining_amount || 0);
    const payAmount = parseFloat(amount);

    // If principal is not specified, assume the full payment reduces the principal
    const resolvedPrincipal = principal_amount !== undefined ? parseFloat(principal_amount) : payAmount;
    const resolvedInterest = parseFloat(interest_amount);

    const newRemaining = Math.max(0, currentRemaining - resolvedPrincipal);
    const newStatus = newRemaining <= 0 ? "paid" : "active";

    // 2. Resolve Category for transaction (Taxes & Fees or Other Expenses)
    const categoryRes = await query(
      `SELECT id FROM finance_categories 
       WHERE club_id = $1 AND name = 'Налоги и сборы' AND type = 'expense' AND is_active = true
       UNION ALL
       SELECT id FROM finance_categories 
       WHERE club_id IS NULL AND name = 'Налоги и сборы' AND type = 'expense' AND is_active = true
       UNION ALL
       SELECT id FROM finance_categories 
       WHERE club_id = $1 AND name = 'Прочие расходы' AND type = 'expense' AND is_active = true
       UNION ALL
       SELECT id FROM finance_categories 
       WHERE club_id IS NULL AND name = 'Прочие расходы' AND type = 'expense' AND is_active = true
       LIMIT 1`,
      [clubId]
    );

    if (categoryRes.rows.length === 0) {
      return NextResponse.json({ error: "No suitable transaction category found" }, { status: 500 });
    }
    const categoryId = categoryRes.rows[0].id;

    // 3. Create finance transaction
    const txDescription = `Погашение кредита: ${credit.name}. ${notes}`.trim();
    const txRes = await query(
      `INSERT INTO finance_transactions
        (club_id, category_id, amount, type, payment_method, status,
         transaction_date, description, notes, created_by, account_id)
       VALUES ($1, $2, $3, 'expense', 'bank_transfer', 'completed', $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        clubId,
        categoryId,
        payAmount,
        payment_date,
        txDescription,
        `[CreditPayment:${credit_id}]`,
        userId,
        account_id
      ]
    );

    const transactionId = txRes.rows[0].id;

    // 4. Record credit payment details
    await query(
      `INSERT INTO finance_credit_payments
        (credit_id, transaction_id, payment_date, principal_amount, interest_amount, total_amount, remaining_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        credit_id,
        transactionId,
        payment_date,
        resolvedPrincipal,
        resolvedInterest,
        payAmount,
        newRemaining
      ]
    );

    // 5. Update remaining amount in credit
    const updatedCredit = await query(
      `UPDATE finance_credits
       SET remaining_amount = $1,
           status = $2,
           updated_at = NOW()
       WHERE id = $3 AND club_id = $4
       RETURNING *`,
      [newRemaining, newStatus, credit_id, clubId]
    );

    return NextResponse.json({
      success: true,
      remaining_amount: newRemaining,
      status: newStatus,
      credit: updatedCredit.rows[0]
    });

  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status) {
      return NextResponse.json(
        { error: status === 401 ? "Unauthorized" : "Forbidden" },
        { status },
      );
    }
    console.error("Error paying credit:", error);
    return NextResponse.json(
      { error: "Failed to process credit payment" },
      { status: 500 },
    );
  }
}
