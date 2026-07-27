import { NextRequest, NextResponse } from "next/server";
import { query } from "@/db";
import { requireModuleAccess } from "@/lib/club-api-access";
import { formatLocalDate } from "@/lib/utils";

// GET /api/clubs/[clubId]/finance/analytics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    await requireModuleAccess(clubId, "finance", "view");
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const period = searchParams.get("period");

    // Determine date range
    let dateCondition = "";
    const values: any[] = [clubId];

    if (period === "all" || startDate === "all" || startDate === "all_time" || (!startDate && !endDate && period !== "month")) {
      dateCondition = "";
    } else if (startDate && endDate) {
      dateCondition = `AND transaction_date BETWEEN $2 AND $3`;
      values.push(startDate, endDate);
    } else {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      dateCondition = `AND transaction_date BETWEEN $2 AND $3`;
      values.push(formatLocalDate(firstDay), formatLocalDate(lastDay));
    }

    // 1. INCOME AND EXPENSES SUMMARY (excluding internal transfers!)
    const summaryResult = await query(
      `SELECT
                SUM(CASE WHEN type = 'income' AND status = 'completed' AND (is_transfer = false OR is_transfer IS NULL) THEN amount ELSE 0 END) as total_income,
                SUM(CASE WHEN type = 'expense' AND status = 'completed' AND (is_transfer = false OR is_transfer IS NULL) THEN amount ELSE 0 END) as total_expense,
                COUNT(CASE WHEN type = 'income' AND status = 'completed' AND (is_transfer = false OR is_transfer IS NULL) THEN 1 END) as income_count,
                COUNT(CASE WHEN type = 'expense' AND status = 'completed' AND (is_transfer = false OR is_transfer IS NULL) THEN 1 END) as expense_count
            FROM finance_transactions
            WHERE club_id = $1 ${dateCondition}`,
      values,
    );

    const summary = summaryResult.rows[0];
    const totalIncome = parseFloat(summary.total_income || 0);
    const totalExpense = parseFloat(summary.total_expense || 0);
    const operatingProfit = totalIncome - totalExpense;
    const profitability = totalIncome > 0 ? (operatingProfit / totalIncome) * 100 : 0;

    // Fetch club tax settings from DB
    const settingsRes = await query(
      `SELECT * FROM club_finance_settings WHERE club_id = $1`,
      [clubId]
    );
    
    const settings = settingsRes.rows[0] || {
      tax_regime: 'patent_usn6',
      custom_tax_rate: 6.0,
      patent_cost: 12500.0,
      limit_exceeded: false,
      usn_categories: []
    };

    const taxRegime = settings.tax_regime || 'patent_usn6';
    const customTaxRate = parseFloat(settings.custom_tax_rate || 6);
    const patentCost = parseFloat(settings.patent_cost || 12500);
    const limitExceeded = Boolean(settings.limit_exceeded);

    // Tax Engine Calculation
    let calculatedTax = 0;
    let taxBaseText = "";

    if (taxRegime === 'usn6') {
      calculatedTax = totalIncome * (customTaxRate / 100);
      taxBaseText = `УСН Доходы ${customTaxRate}% от всей выручки (${Math.round(totalIncome)} ₽)`;
    } else if (taxRegime === 'usn15') {
      const profitBase = Math.max(0, operatingProfit);
      calculatedTax = profitBase * (customTaxRate / 100);
      taxBaseText = `УСН Доходы-Расходы ${customTaxRate}% от операционной прибыли (${Math.round(profitBase)} ₽)`;
    } else if (taxRegime === 'patent_usn6') {
      calculatedTax = patentCost + (totalIncome * (customTaxRate / 100));
      taxBaseText = `Совмещение: Патент (${patentCost} ₽/мес) + УСН Доходы ${customTaxRate}% (${Math.round(totalIncome)} ₽)`;
    } else if (taxRegime === 'patent_usn15') {
      const profitBase = Math.max(0, operatingProfit);
      calculatedTax = patentCost + (profitBase * (customTaxRate / 100));
      taxBaseText = `Совмещение: Патент (${patentCost} ₽/мес) + УСН Доходы-Расходы ${customTaxRate}% (${Math.round(profitBase)} ₽)`;
    }

    if (limitExceeded) {
      const vatAmount = totalIncome * 0.05;
      calculatedTax += vatAmount;
      taxBaseText += ` + НДС 5% (${Math.round(vatAmount)} ₽)`;
    }

    const netProfit = operatingProfit - calculatedTax;

    // 2. BREAKDOWN BY CATEGORY
    const categoryBreakdown = await query(
      `SELECT
                fc.id,
                fc.name,
                fc.type,
                fc.icon,
                fc.color,
                SUM(ft.amount) as total_amount,
                COUNT(ft.id) as transaction_count,
                ROUND((SUM(ft.amount) / NULLIF(
                    (SELECT SUM(amount) FROM finance_transactions
                     WHERE club_id = $1 ${dateCondition} AND type = fc.type AND status = 'completed' AND (is_transfer = false OR is_transfer IS NULL)),
                    0
                ) * 100), 2) as percentage
            FROM finance_transactions ft
            JOIN finance_categories fc ON ft.category_id = fc.id
            WHERE ft.club_id = $1 ${dateCondition} AND ft.status = 'completed' AND (ft.is_transfer = false OR ft.is_transfer IS NULL)
            GROUP BY fc.id, fc.name, fc.type, fc.icon, fc.color
            ORDER BY total_amount DESC`,
      values,
    );

    // 3. MONTHLY TREND (last 12 months)
    const monthlyTrend = await query(
      `SELECT
                DATE_TRUNC('month', transaction_date) as month,
                SUM(CASE WHEN type = 'income' AND status = 'completed' AND (is_transfer = false OR is_transfer IS NULL) THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' AND status = 'completed' AND (is_transfer = false OR is_transfer IS NULL) THEN amount ELSE 0 END) as expense
            FROM finance_transactions
            WHERE club_id = $1
                AND status = 'completed'
            GROUP BY DATE_TRUNC('month', transaction_date)
            ORDER BY month ASC`,
      [clubId],
    );

    const trend = monthlyTrend.rows.map((row) => ({
      month: row.month ? new Date(row.month).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }) : '',
      income: parseFloat(row.income || 0),
      expense: parseFloat(row.expense || 0),
      profit: parseFloat(row.income || 0) - parseFloat(row.expense || 0),
    }));

    // 4. TOP EXPENSES
    const topExpenses = await query(
      `SELECT
                fc.name as category_name,
                fc.icon,
                SUM(ft.amount) as total_amount,
                COUNT(ft.id) as transaction_count
            FROM finance_transactions ft
            JOIN finance_categories fc ON ft.category_id = fc.id
            WHERE ft.club_id = $1 ${dateCondition}
                AND ft.type = 'expense'
                AND ft.status = 'completed'
                AND (ft.is_transfer = false OR ft.is_transfer IS NULL)
            GROUP BY fc.id, fc.name, fc.icon
            ORDER BY total_amount DESC
            LIMIT 5`,
      values,
    );

    // 5. DDS BREAKDOWN (Cash Flow Statement)
    const ddsBreakdown = await query(
      `SELECT
                fc.activity_type,
                ft.type,
                SUM(ft.amount) as total_amount
            FROM finance_transactions ft
            JOIN finance_categories fc ON ft.category_id = fc.id
            WHERE ft.club_id = $1 ${dateCondition} AND ft.status = 'completed'
            GROUP BY fc.activity_type, ft.type
            ORDER BY fc.activity_type, ft.type`,
      values,
    );

    const dds = {
      operating: { income: 0, expense: 0, net: 0 },
      investing: { income: 0, expense: 0, net: 0 },
      financing: { income: 0, expense: 0, net: 0 },
    };

    ddsBreakdown.rows.forEach((row) => {
      const type = (row.activity_type || 'operating') as keyof typeof dds;
      if (dds[type]) {
        if (row.type === "income") {
          dds[type].income = parseFloat(row.total_amount || 0);
        } else {
          dds[type].expense = parseFloat(row.total_amount || 0);
        }
        dds[type].net = dds[type].income - dds[type].expense;
      }
    });

    // Calculate Bar Sales and True COGS (Cost of Goods Sold)
    const barSalesRes = await query(
      `SELECT COALESCE(SUM((report_data->>'Bar')::numeric), 0) as total_bar_sales FROM shifts WHERE club_id = $1 ${dateCondition.replace(/transaction_date/g, 'check_out')}`,
      values
    );
    const barSales = parseFloat(barSalesRes.rows[0]?.total_bar_sales || 0);

    const costRatioRes = await query(
      `SELECT COALESCE(AVG(CASE WHEN selling_price > 0 THEN cost_price / selling_price ELSE NULL END), 0.46) as cost_ratio
       FROM warehouse_products 
       WHERE club_id = $1 AND is_active = true AND cost_price > 0 AND selling_price > 0`,
      [clubId]
    );
    const costRatio = parseFloat(costRatioRes.rows[0]?.cost_ratio || 0.46);
    const barCogs = Math.round(barSales * costRatio);
    const barGrossMargin = barSales - barCogs;
    const barMarginPercent = barSales > 0 ? Math.round((barGrossMargin / barSales) * 100) : 0;

    return NextResponse.json({
      summary: {
        total_income: totalIncome,
        total_expense: totalExpense,
        profit: operatingProfit,
        calculated_tax: Math.round(calculatedTax),
        net_profit: Math.round(netProfit),
        tax_base_text: taxBaseText,
        profitability: Math.round(profitability * 100) / 100,
        income_count: parseInt(summary.income_count || 0),
        expense_count: parseInt(summary.expense_count || 0),
        bar_sales: barSales,
        bar_cogs: barCogs,
        bar_gross_margin: barGrossMargin,
        bar_margin_percent: barMarginPercent
      },
      category_breakdown: {
        income: categoryBreakdown.rows
          .filter((r) => r.type === "income")
          .map((r) => ({
            ...r,
            total_amount: parseFloat(r.total_amount),
            percentage: parseFloat(r.percentage || 0),
          })),
        expense: categoryBreakdown.rows
          .filter((r) => r.type === "expense")
          .map((r) => ({
            ...r,
            total_amount: parseFloat(r.total_amount),
            percentage: parseFloat(r.percentage || 0),
          })),
      },
      monthly_trend: trend,
      top_expenses: topExpenses.rows.map((r) => ({
        ...r,
        total_amount: parseFloat(r.total_amount),
      })),
      dds_breakdown: dds,
      tax_settings: settings
    });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status) {
      return NextResponse.json(
        { error: status === 401 ? "Unauthorized" : "Forbidden" },
        { status },
      );
    }
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
