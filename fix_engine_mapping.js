const fs = require('fs');

const path = 'src/lib/salary-engine.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Extract the complex mapping logic into a reusable function string
const mappingLogic = `
  const bonuses: SalaryComponent[] = [];
  const deductions: SalaryComponent[] = [];

  // Shift Bonuses Breakdown
  if (Array.isArray(emp.shift_bonuses_breakdown)) {
    emp.shift_bonuses_breakdown.forEach((b: any) => {
      bonuses.push({
        name: b.name || "Бонус за смену",
        amount: b.amount || 0,
        type: "SHIFT_BONUS",
        original_type: b.original_type || b.type,
        payout_type: b.payout_type || "REAL_MONEY",
      });
    });
  }

  // Period / KPI Bonuses
  if (Array.isArray(emp.period_bonuses)) {
    emp.period_bonuses.forEach((b: any) => {
      // Skip per_unit/promo bonuses in period_bonuses if they are already accounted for in shift_bonuses_breakdown
      if (b.type === "per_unit" || b.type === "promo") return;

      if (b.is_met && b.bonus_amount > 0) {
        bonuses.push({
          name: b.name || b.type || "KPI",
          amount: b.bonus_amount || 0,
          type: "PERIOD_BONUS",
          original_type: b.type,
          payout_type: b.payout_type || "REAL_MONEY",
          is_met: b.is_met,
          progress_percent: b.progress_percent,
        });
      }
    });
  }

  // Checklist Bonuses
  if (Array.isArray(emp.checklist_bonuses)) {
    emp.checklist_bonuses.forEach((b: any) => {
      if (b.is_met && b.bonus_amount > 0) {
        bonuses.push({
          name: b.name || "Чек-лист",
          amount: b.bonus_amount || 0,
          type: "CHECKLIST_BONUS",
          original_type: b.type,
          payout_type: b.payout_type || "REAL_MONEY",
          is_met: b.is_met,
          progress_percent: b.progress_percent,
        });
      }
    });
  }

  // Maintenance Bonuses
  if (emp.maintenance_status && emp.maintenance_status.is_met && emp.maintenance_status.bonus_amount > 0) {
    bonuses.push({
      name: emp.maintenance_status.name || "Обслуживание ПК",
      amount: emp.maintenance_status.bonus_amount || 0,
      type: "MAINTENANCE_BONUS",
      original_type: emp.maintenance_status.type,
      payout_type: emp.maintenance_status.payout_type || "REAL_MONEY",
      is_met: emp.maintenance_status.is_met,
      progress_percent: emp.maintenance_status.progress_percent,
    });
  }

  // Leaderboard Bonuses
  if (emp.breakdown && Array.isArray(emp.breakdown.leaderboard_bonuses)) {
    emp.breakdown.leaderboard_bonuses.forEach((lb: any) => {
      bonuses.push({
        name: lb.name || "Рейтинг",
        amount: lb.bonus_amount || lb.amount || 0,
        type: "LEADERBOARD_BONUS",
        original_type: "leaderboard_rank",
        payout_type: lb.payout_type || "REAL_MONEY",
        rank: lb.rank,
        score: lb.score,
      });
    });
  }

  // Deductions
  if (emp.total_bar_purchases > 0) {
    deductions.push({
      name: "Покупки в баре",
      amount: emp.total_bar_purchases,
      type: "BAR_PURCHASE",
      payout_type: "REAL_MONEY",
    });
  }

  if (emp.breakdown && emp.breakdown.salary_deduction > 0) {
    deductions.push({
      name: "Штрафы и недостачи",
      amount: emp.breakdown.salary_deduction,
      type: "ZONE_DISCREPANCY",
      payout_type: "REAL_MONEY",
    });
  }

  if (emp.metrics && emp.metrics.maintenance_overdue_penalty > 0) {
    deductions.push({
      name: "Штраф за просроченное ТО",
      amount: emp.metrics.maintenance_overdue_penalty,
      type: "MAINTENANCE_PENALTY",
      payout_type: "REAL_MONEY",
    });
  }
`;

const resultObject = `
    {
      employee_id: String(emp.id),
      full_name: emp.full_name,
      role: emp.role,
      month,
      year,
      metrics: {
        total_hours: emp.metrics?.total_hours || 0,
        completed_shifts: emp.shifts_count || 0,
        planned_shifts: emp.planned_shifts || 15,
        evaluation_score: emp.metrics?.evaluation_score,
        evaluation_count: emp.metrics?.evaluation_count,
        leaderboard_score: emp.metrics?.leaderboard_score,
        leaderboard_rank: emp.metrics?.leaderboard_rank,
        maintenance_overdue_penalty: emp.metrics?.maintenance_overdue_penalty || 0,
      },
      breakdown: {
        base_salary: emp.breakdown?.base_salary || 0,
        bonuses,
        deductions,
      },
      totals: {
        accrued_real: emp.total_accrued || 0,
        accrued_virtual: emp.virtual_balance_accrued || 0,
        paid_real: emp.total_paid || 0,
        paid_virtual: emp.total_paid_bonus || 0,
        balance_real: emp.balance || 0,
        balance_virtual: emp.virtual_balance || 0,
      },
      leaderboard: emp.leaderboard,
      _legacy_summary_format: emp,
    }
`;

// Find the first map and fix it
const firstMapRegex = /const reports = filteredSummary\.map\(\(emp: any\) => \{[\s\S]*?return \{([\s\S]*?)\};\n\s*\}\);/m;
code = code.replace(firstMapRegex, `const reports = filteredSummary.map((emp: any) => {
    ${mappingLogic}
    return ${resultObject};
  });`);

fs.writeFileSync(path, code);
console.log('Fixed SalaryEngine reports mapping');
