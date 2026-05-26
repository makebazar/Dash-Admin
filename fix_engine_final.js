const fs = require('fs');
const path = 'src/lib/salary-engine.ts';
let code = fs.readFileSync(path, 'utf8');

// Fix the hardcoded empty arrays in the big loop return
code = code.replace(
  /period_bonuses: \[\], checklist_bonuses: \[\], maintenance_status: null,/,
  'period_bonuses, checklist_bonuses, maintenance_status,'
);

// Also make sure maintenance_status is correctly assigned
// In the code it was:
// maintenance_status: { bonus_amount: totalMaintenanceFinal, is_met: totalMaintenanceFinal > 0, name: "Обслуживание ПК" }
// But wait, the placeholder I replaced was already there.

// Let's do a more precise replacement
const oldReturn = `      return {
        id: emp.id, full_name: emp.full_name, role: emp.role, shifts_count: finishedShifts.length,
        base_salary, total_accrued, total_bar_purchases,
        shift_bonuses_breakdown,
        period_bonuses: [], checklist_bonuses: [], maintenance_status: null,
        breakdown: { base_salary, salary_deduction: salaryPenaltiesMap[emp.id] || 0 },
        metrics: { total_hours: empShifts.reduce((sum, s) => sum + parseFloat(s.total_hours || 0), 0) },
        total_paid: 0, balance: 0, virtual_balance_accrued: 0, total_paid_bonus: 0, virtual_balance: 0,
      };`;

const newReturn = `      return {
        id: emp.id,
        full_name: emp.full_name,
        role: emp.role,
        shifts_count: finishedShifts.length,
        base_salary,
        total_accrued,
        total_bar_purchases,
        shift_bonuses_breakdown,
        period_bonuses,
        checklist_bonuses,
        maintenance_status: {
          bonus_amount: totalMaintenanceFinal,
          is_met: totalMaintenanceFinal > 0,
          name: "Обслуживание ПК",
          type: "maintenance_kpi",
          progress_percent: qualityMetrics.efficiency
        },
        breakdown: {
          base_salary,
          salary_deduction: salaryPenaltiesMap[emp.id] || 0,
          leaderboard_bonuses: [] // Will be populated by leaderboard logic if exists
        },
        metrics: {
          total_hours: empShifts.reduce((sum: number, s: any) => sum + parseFloat(s.total_hours || 0), 0),
          evaluation_score: evalMap[emp.id]?.avg,
          evaluation_count: evalMap[emp.id]?.count,
          maintenance_overdue_penalty: currentMonthPenalty
        },
        total_paid: parseFloat(empPayment?.total_paid || "0"),
        balance: 0,
        virtual_balance_accrued: virtual_kpi_bonus_amount,
        total_paid_bonus: parseFloat(empPayment?.total_paid_bonus || "0"),
        virtual_balance: 0,
      };`;

code = code.replace(oldReturn, newReturn);

fs.writeFileSync(path, code);
console.log('Fixed SalaryEngine return object mapping');
