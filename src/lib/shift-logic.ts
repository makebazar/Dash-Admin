import { NextResponse } from "next/server";
import { query } from "@/db";
import { calculateSalary } from "@/lib/salary-calculator";
import { getEmployeeRoleAccess } from "@/lib/employee-role-access";
import { hasColumn } from "@/lib/db-compat";

export async function executeShiftClose(
  request: Request,
  shiftId: string,
  userId: string,
) {
  try {
    // Parse JSON body carefully
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    let reportData = body?.reportData;
    let templateId = body?.templateId;
    let checklistId = body?.checklistId;
    let checklistResponses = body?.checklistResponses;

    // Verify shift belongs to user
    const hasShiftRoleIdSnapshot = await hasColumn(
      "shifts",
      "shift_role_id_snapshot",
    );
    if (!hasShiftRoleIdSnapshot) {
      await query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shifts' AND column_name='shift_role_id_snapshot') THEN
                        ALTER TABLE shifts ADD COLUMN shift_role_id_snapshot INTEGER NULL;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shifts' AND column_name='shift_role_name_snapshot') THEN
                        ALTER TABLE shifts ADD COLUMN shift_role_name_snapshot VARCHAR(64) NULL;
                    END IF;
                END $$;
            `);
    }

    await query(`
            CREATE TABLE IF NOT EXISTS employee_role_salary_assignments (
                club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
                scheme_id INTEGER NULL REFERENCES salary_schemes(id) ON DELETE SET NULL,
                assigned_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(club_id, user_id, role_id)
            );
            CREATE INDEX IF NOT EXISTS idx_employee_role_salary_assignments_club_user ON employee_role_salary_assignments(club_id, user_id);
        `);

    const shiftCheck = await query(
      `SELECT id, club_id, check_in, user_id, shift_type, shift_role_id_snapshot,
              close_draft_data, report_data, template_id, cash_income, card_income,
              expenses, calculated_salary, salary_breakdown
       FROM shifts WHERE id = $1 AND user_id = $2 AND check_out IS NULL`,
      [shiftId, userId],
    );

    if (shiftCheck.rowCount === 0) {
      return NextResponse.json(
        { error: "Shift not found or already ended" },
        { status: 404 },
      );
    }

    const currentShiftRow = shiftCheck.rows[0];

    // Use draft data if direct data is missing (multi-device flow)
    const draftData = currentShiftRow.close_draft_data;
    if (draftData && typeof draftData === "object") {
      const parsedDraft = draftData as any;

      // If reportData is missing in request, use the one from draft
      if (!reportData || Object.keys(reportData).length === 0) {
        const {
          checklistResponses: draftChecklistResponses,
          checklistId: draftChecklistId,
          templateId: draftTemplateId,
          ...cleanReportData
        } = parsedDraft;

        reportData = cleanReportData;
        if (!checklistId) checklistId = draftChecklistId;
        if (!checklistResponses) checklistResponses = draftChecklistResponses;
        if (!templateId) templateId = draftTemplateId;
      } else {
        // If reportData exists in request, still try to fill missing IDs from draft
        if (!checklistId) checklistId = parsedDraft.checklistId;
        if (!checklistResponses)
          checklistResponses = parsedDraft.checklistResponses;
        if (!templateId) templateId = parsedDraft.templateId;
      }
    }

    // Ensure reportData is an object.
    // Fallback: If still empty, try to use already saved data from 'Hot Save'
    if (!reportData || Object.keys(reportData).length === 0) {
      reportData = currentShiftRow.report_data || {};
      if (!templateId) templateId = currentShiftRow.template_id;
    }

    const clubId = currentShiftRow.club_id;
    const checkIn = new Date(currentShiftRow.check_in);
    const shiftUserId = currentShiftRow.user_id;
    const shiftType = currentShiftRow.shift_type || "DAY";
    const shiftRoleId = currentShiftRow.shift_role_id_snapshot
      ? Number(currentShiftRow.shift_role_id_snapshot)
      : null;

    // Process Checklist if provided
    if (checklistId && checklistResponses) {
      try {
        const itemsResult = await query(
          `SELECT id, weight FROM evaluation_template_items WHERE template_id = $1`,
          [checklistId],
        );
        const itemsMap = new Map(itemsResult.rows.map((i) => [i.id, i.weight]));

        let totalPoints = 0;
        let maxPossiblePoints = 0;

        const responses = Object.entries(checklistResponses).map(
          ([k, v]: any) => ({
            item_id: parseInt(k),
            score: v.score,
            comment: v.comment,
            photo_urls: v.photo_urls,
            selected_workstations: v.selected_workstations,
          }),
        );

        for (const resp of responses) {
          const weight = Number(itemsMap.get(resp.item_id)) || 1;
          totalPoints += Number(resp.score) || 0;
          maxPossiblePoints += weight;
        }

        await query("BEGIN");

        const evalResult = await query(
          `INSERT INTO evaluations (club_id, template_id, employee_id, evaluator_id, total_score, max_score, comments, shift_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id`,
          [
            clubId,
            checklistId,
            shiftUserId,
            userId,
            totalPoints,
            maxPossiblePoints,
            "",
            shiftId,
          ],
        );
        const evaluationId = evalResult.rows[0].id;

        const normalizeSelectedWorkstations = (value: any) => {
          if (Array.isArray(value)) return value;
          if (typeof value === "string") {
            try {
              const parsed = JSON.parse(value);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          }
          return [];
        };

        for (const resp of responses) {
          await query(
            `INSERT INTO evaluation_responses (evaluation_id, item_id, score, comment, photo_url, photo_urls, selected_workstations)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              evaluationId,
              resp.item_id,
              resp.score,
              resp.comment,
              resp.photo_urls && resp.photo_urls.length > 0
                ? resp.photo_urls[0]
                : null,
              resp.photo_urls || [],
              JSON.stringify(
                normalizeSelectedWorkstations(resp.selected_workstations),
              ),
            ],
          );
        }

        await query("COMMIT");
      } catch (e) {
        await query("ROLLBACK");
        console.error("Checklist processing error:", e);
        // Continue shift closure anyway? For now, yes, but log it.
      }
    }

    const jsDow = checkIn.getDay();
    const dayOfWeek =
      jsDow === 0
        ? "SUN"
        : jsDow === 1
          ? "MON"
          : jsDow === 2
            ? "TUE"
            : jsDow === 3
              ? "WED"
              : jsDow === 4
                ? "THU"
                : jsDow === 5
                  ? "FRI"
                  : "SAT";

    const roleAccess = await getEmployeeRoleAccess(String(clubId), userId);
    if (roleAccess.settings.shift_end_mode === "NO_REPORT") {
      reportData = {};
      templateId = null;
    } else {
      if (!reportData || typeof reportData !== "object") {
        return NextResponse.json(
          { error: "reportData is required" },
          { status: 400 },
        );
      }
    }

    const safeReportData =
      reportData && typeof reportData === "object" ? reportData : {};
    const reportMode =
      roleAccess.settings.shift_end_mode === "NO_REPORT"
        ? "NO_REPORT"
        : "FULL_REPORT";

    // Calculate hours
    const now = new Date();
    const durationMs = now.getTime() - checkIn.getTime();
    const totalHours = durationMs / (1000 * 60 * 60);

    // Calculate Salary
    let calculatedSalary = 0;
    let salaryBreakdown = null;

    // Get assigned scheme and its latest formula
    const schemeRes = await query(
      `
            SELECT ss.id, ss.name, ss.standard_monthly_shifts, sv.formula
            FROM salary_schemes ss
            JOIN salary_scheme_versions sv ON sv.scheme_id = ss.id
            WHERE ss.id = (
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM employee_role_salary_assignments
                        WHERE club_id = $2 AND user_id = $1 AND role_id = $3
                    )
                    THEN (
                        SELECT scheme_id FROM employee_role_salary_assignments
                        WHERE club_id = $2 AND user_id = $1 AND role_id = $3
                        LIMIT 1
                    )
                    ELSE (SELECT scheme_id FROM employee_salary_assignments WHERE user_id = $1 AND club_id = $2)
                END
            )
              AND ss.club_id = $2
            ORDER BY sv.version DESC
            LIMIT 1
            `,
      [shiftUserId, clubId, shiftRoleId],
    );

    // Fetch evaluations for this shift
    const evaluationsRes = await query(
      `SELECT template_id, total_score as score_percent FROM evaluations WHERE shift_id = $1`,
      [shiftId],
    );
    const evaluations = evaluationsRes.rows;

    // Helper to sum numeric values from report data (handles numbers, strings, and expense arrays)
    const sumMetric = (val: any) => {
      if (val === null || val === undefined || val === "") return 0;
      if (Array.isArray(val)) {
        return val.reduce(
          (sum, item: any) => sum + (Number(item?.amount) || 0),
          0,
        );
      }
      const parsed = parseFloat(String(val).replace(",", "."));
      return isNaN(parsed) ? 0 : parsed;
    };

    // Extract system metrics for separate columns
    const cashIncome = sumMetric(safeReportData["cash_income"]);
    const cardIncome = sumMetric(safeReportData["card_income"]);
    const expenses = sumMetric(safeReportData["expenses_cash"]);
    const comment = safeReportData["shift_comment"] || "";

    const templateRes = await query(
      `SELECT schema FROM club_report_templates
             WHERE club_id = $1 AND is_active = TRUE
             ORDER BY created_at DESC LIMIT 1`,
      [clubId],
    );
    const templateSchema = templateRes.rows[0]?.schema;
    const fields = Array.isArray(templateSchema)
      ? templateSchema
      : templateSchema?.fields || [];
    const metricCategories: Record<string, string> = {};
    fields.forEach((f: any) => {
      const key = f.metric_key || f.key;
      if (!key) return;
      let category = f.field_type || f.calculation_category;
      if (!category) {
        if (
          key.includes("income") ||
          key.includes("revenue") ||
          key === "cash" ||
          key === "card"
        ) {
          category = "INCOME";
        } else if (key.includes("expense") || key === "expenses") {
          category = "EXPENSE";
        } else {
          category = "OTHER";
        }
      }
      metricCategories[key] = category;
    });

    let totalRevenue = 0;
    if (
      metricCategories["cash_income"] === "INCOME" ||
      !metricCategories["cash_income"]
    ) {
      totalRevenue += cashIncome;
    }
    if (
      metricCategories["card_income"] === "INCOME" ||
      !metricCategories["card_income"]
    ) {
      totalRevenue += cardIncome;
    }
    for (const key in safeReportData) {
      if (key === "cash_income" || key === "card_income") continue;
      if (metricCategories[key] === "INCOME") {
        totalRevenue += sumMetric(safeReportData[key]);
      }
    }

    // Prepare metrics for salary calculator (must be flat Record<string, number>)
    const metrics: Record<string, number> = {
      total_revenue: totalRevenue,
      revenue_cash: cashIncome,
      revenue_card: cardIncome,
      expenses: expenses,
    };

    // Add all other report fields, summing them if they are arrays
    for (const key in safeReportData) {
      metrics[key] = sumMetric(safeReportData[key]);
    }

    if ((schemeRes.rowCount || 0) > 0) {
      const scheme = schemeRes.rows[0];
      const formula = scheme.formula || {};

      // Pass formula directly - calculator now handles normalization
      const calculation = await calculateSalary(
        {
          id: shiftId,
          total_hours: totalHours,
          evaluations,
          shift_type: shiftType,
          day_of_week: dayOfWeek,
        },
        { ...formula, standard_monthly_shifts: scheme.standard_monthly_shifts },
        metrics,
      );

      calculatedSalary = calculation.total;
      salaryBreakdown = calculation.breakdown;
    }

    const isPartial = body?.partial === true;

    // End shift and save report
    await query(
      `UPDATE shifts
       SET check_out = CASE WHEN $14 = TRUE THEN check_out ELSE NOW() END,
           status = CASE WHEN $14 = TRUE THEN status ELSE 'CLOSED' END,
           total_hours = $8,
           report_data = $1,
           template_id = $2,
           cash_income = $3,
           card_income = $4,
           expenses = $5,
           report_comment = $6,
           report_mode = $11,
           actor_role_id_snapshot = $12,
           actor_role_name_snapshot = $13,
           calculated_salary = $9,
           salary_breakdown = $10
       WHERE id = $7`,
      [
        JSON.stringify(safeReportData),
        templateId,
        cashIncome,
        cardIncome,
        expenses,
        comment,
        shiftId,
        totalHours.toFixed(2),
        calculatedSalary,
        JSON.stringify(salaryBreakdown),
        reportMode,
        roleAccess.roleId,
        roleAccess.roleName,
        isPartial,
      ],
    );

    // Process Virtual Balance Bonuses
    if (salaryBreakdown && salaryBreakdown.virtual_balance_total > 0) {
      const virtualBonuses = salaryBreakdown.bonuses.filter(
        (b: any) => b.payout_type === "VIRTUAL_BALANCE" && b.amount > 0,
      );

      if (virtualBonuses.length > 0) {
        const client = await (await import("@/db")).queryClient();

        try {
          await client.query("BEGIN");

          for (const bonus of virtualBonuses) {
            // Create transaction record
            await client.query(
              `INSERT INTO employee_balance_transactions (
                                club_id, user_id, amount, transaction_type, description,
                                payout_type, bonus_type, shift_id, reference_type, reference_id, created_by
                             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                clubId,
                shiftUserId,
                bonus.amount,
                "BONUS",
                `${bonus.name || "Бонус за смену"} (${bonus.type})`,
                "VIRTUAL_BALANCE",
                bonus.type,
                shiftId,
                "shift",
                shiftId,
                userId,
              ],
            );
          }

          const totalVirtualBonus = salaryBreakdown.virtual_balance_total;

          // Get or create balance record
          const balanceCheck = await client.query(
            `SELECT balance FROM employee_balances
                         WHERE club_id = $1 AND user_id = $2`,
            [clubId, shiftUserId],
          );

          if (balanceCheck.rows.length > 0) {
            const currentBalance =
              parseFloat(balanceCheck.rows[0].balance) || 0;
            await client.query(
              `UPDATE employee_balances
                             SET balance = $1, updated_at = NOW()
                             WHERE club_id = $2 AND user_id = $3`,
              [currentBalance + totalVirtualBonus, clubId, shiftUserId],
            );
          } else {
            await client.query(
              `INSERT INTO employee_balances (club_id, user_id, balance, currency)
                             VALUES ($1, $2, $3, 'RUB')`,
              [clubId, shiftUserId, totalVirtualBonus],
            );
          }

          await client.query("COMMIT");
        } catch (error: any) {
          await client.query("ROLLBACK");
          console.error("Error processing virtual bonuses:", error);
        } finally {
          client.release();
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Internal End Shift Error:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal Server Error",
        details: error.toString(),
      },
      { status: 500 },
    );
  }
}
