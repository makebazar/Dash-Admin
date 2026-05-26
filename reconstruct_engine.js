const fs = require("fs");

const summaryPath = "src/app/api/clubs/[clubId]/salaries/summary/route.ts";
let code = fs.readFileSync(summaryPath, "utf8");

const logicStartStr = `const startOfMonth = new Date(year, month - 1, 1);`;
const logicEndStr = `return NextResponse.json({`;

const startIdx = code.indexOf(logicStartStr);
const endIdx = code.lastIndexOf(logicEndStr);

if (startIdx === -1 || endIdx === -1) {
  console.error("Markers not found");
  process.exit(1);
}

let coreLogic = code.substring(startIdx, endIdx);

// Clean up coreLogic carefully
// Remove HTTP/Auth checks
coreLogic = coreLogic.replace(/if \(!userId\)[\s\S]*?view"\);/m, "");

// Fix early returns (REPLACE with local variable assignments)
coreLogic = coreLogic.replace(
  /return NextResponse\.json\(\{\s*summary: filteredSummary,\s*leaderboard: null,\s*\}\);/g,
  "return;",
);

const engineCode = `import { query } from "@/db";
import { calculateSalary } from "@/lib/salary-calculator";
import { calculateMaintenanceOverduePenalty } from "@/lib/maintenance-penalties";
import { calculateMaintenanceQualityMetrics } from "@/lib/maintenance-kpi-quality";
import {
  getClubEmployeeLeaderboardState,
  getLeaderboardBonusAmount,
} from "@/lib/employee-leaderboard";

export interface SalaryComponent {
  name: string;
  amount: number;
  type: string;
  original_type?: string;
  payout_type: "REAL_MONEY" | "VIRTUAL_BALANCE";
  is_met?: boolean;
  progress_percent?: number;
  club_id?: number;
  rank?: number;
  score?: number;
}

export interface MonthlySalaryReport {
  employee_id: string;
  full_name?: string;
  role?: string;
  month: number;
  year: number;
  metrics: {
    total_hours: number;
    completed_shifts: number;
    planned_shifts: number;
    evaluation_score?: number;
    evaluation_count?: number;
    leaderboard_score?: number;
    leaderboard_rank?: number;
    maintenance_overdue_penalty?: number;
  };
  breakdown: {
    base_salary: number;
    bonuses: SalaryComponent[];
    deductions: SalaryComponent[];
  };
  totals: {
    accrued_real: number;
    accrued_virtual: number;
    paid_real: number;
    paid_virtual: number;
    balance_real: number;
    balance_virtual: number;
  };
  leaderboard?: any;
  _legacy_summary_format?: any;
}

function mapToMonthlySalaryReport(emp: any, month: number, year: number): MonthlySalaryReport {
  const bonuses: SalaryComponent[] = [];
  const deductions: SalaryComponent[] = [];

  // 1. Shift Bonuses Breakdown
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

  // 2. Period / KPI Bonuses
  if (Array.isArray(emp.period_bonuses)) {
    emp.period_bonuses.forEach((b: any) => {
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

  // 3. Checklist Bonuses
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

  // 4. Maintenance Bonuses
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

  // 5. Leaderboard Bonuses
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

  // 6. Deductions
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

  return {
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
  };
}

export async function generateMonthlySalaryReport(
  clubId: string | number,
  month: number,
  year: number
) {
    const now = new Date();
    // Hoist variables that were used in the original route's try block
    let filteredSummary: any[] = [];
    let leaderboardState: any = null;
    let leaderboardTop: any[] = [];

    // CORE LOGIC START
    ${coreLogic}
    // CORE LOGIC END

    // Ensure filteredSummary is populated if early return wasn't triggered
    if (filteredSummary.length === 0 && typeof summary !== 'undefined') {
        filteredSummary = (typeof summaryWithLeaderboard !== 'undefined') ? summaryWithLeaderboard : summary;
    }

    const reports = filteredSummary.map(emp => mapToMonthlySalaryReport(emp, month, year));
    return { reports, leaderboardState, leaderboardTop };
}
`;

fs.writeFileSync("src/lib/salary-engine.ts", engineCode);
console.log("SalaryEngine reconstructed successfully.");
