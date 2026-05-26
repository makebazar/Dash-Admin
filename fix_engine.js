const fs = require('fs');

const path = 'src/lib/salary-engine.ts';
let code = fs.readFileSync(path, 'utf8');

// Fix the bad replacements
code = code.replace(/leader\(board as any\)/g, 'leaderboard');
code = code.replace(/summaryWithLeader\(board as any\)/g, 'summaryWithLeaderboard');

// Remove the remaining NextResponse block at line ~1919
// It looks like:
/*
    const hasAnyLeaderboardBonusConfig = summary.some(
      (employee: any) =>
        Array.isArray(employee?._leaderboard_bonus_configs) &&
        employee._leaderboard_bonus_configs.length > 0,
    );

    if (!hasAnyLeaderboardBonusConfig) {
      const cleanedSummary = summary.map((employee: any) => {
        const { _leaderboard_bonus_configs, ...cleanEmployee } = employee;
        return cleanEmployee;
      });

      const filteredSummary = cleanedSummary.filter(
        (emp: any) =>
          emp.shifts_count > 0 ||
          emp.total_accrued !== 0 ||
          emp.total_paid !== 0,
      );

      return NextResponse.json({
        summary: filteredSummary,
        leaderboard: null,
      });
    }
*/
// Let's replace the inner return with just assigning filteredSummary and continuing, or since it returns early, we should handle it better.
// Actually, if there is no leaderboard config, it returns `NextResponse`. In our engine, we shouldn't return HTTP responses.
// We should just `filteredSummary = cleanedSummary` and `leaderboardState = null`, `leaderboardTop = null` and return from the engine function? No, we still need to map the output to `MonthlySalaryReport`.

// Let's manually replace the early return block.
const earlyReturnRegex = /if \(!hasAnyLeaderboardBonusConfig\) \{([\s\S]*?)return NextResponse\.json\(\{([\s\S]*?)summary: filteredSummary,\n\s*leaderboard: null,\n\s*\}\);\n\s*\}/m;

code = code.replace(earlyReturnRegex, `if (!hasAnyLeaderboardBonusConfig) {
      const cleanedSummary = summary.map((employee: any) => {
        const { _leaderboard_bonus_configs, ...cleanEmployee } = employee;
        return cleanEmployee;
      });

      filteredSummary = cleanedSummary.filter(
        (emp: any) =>
          emp.shifts_count > 0 ||
          emp.total_accrued !== 0 ||
          emp.total_paid !== 0,
      );
      // Skip leaderboard calculation
      leaderboardState = { meta: {} };
      leaderboardTop = [];
    } else {
`);

// The above will require us to close the `} else {` block.
// Where does the leaderboard logic end?
// Right before `const filteredSummary = summaryWithLeaderboard.filter(`

// To make it simpler, let's just let it run the leaderboard logic even if there are no configs, or write a simpler regex.

code = fs.readFileSync(path, 'utf8');
code = code.replace(/leader\(board as any\)/g, 'leaderboard');
code = code.replace(/summaryWithLeader\(board as any\)/g, 'summaryWithLeaderboard');

const oldReturn = `      return NextResponse.json({
        summary: filteredSummary,
        leaderboard: null,
      });`;

const newReturn = `      leaderboardState = { meta: { is_frozen: false, finalized_at: null }, leaderboard: [] };
      leaderboardTop = [];
      const reports = filteredSummary.map((emp: any) => {
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
            maintenance_overdue_penalty: emp.metrics?.maintenance_overdue_penalty || 0,
          },
          breakdown: {
            base_salary: emp.breakdown?.base_salary || 0,
            bonuses: [],
            deductions: []
          },
          totals: {
            accrued_real: emp.total_accrued || 0,
            accrued_virtual: emp.virtual_balance_accrued || 0,
            paid_real: emp.total_paid || 0,
            paid_virtual: emp.total_paid_bonus || 0,
            balance_real: emp.balance || 0,
            balance_virtual: emp.virtual_balance || 0,
          },
          _legacy_summary_format: emp
        };
      });
      return { reports, leaderboardState, leaderboardTop };`;

code = code.replace(oldReturn, newReturn);

// Also need to pre-declare let filteredSummary; if it's not.
// In the original code, `const filteredSummary = ...` is inside the if block, and also at the very end.
// We don't need to overcomplicate. Let's just fix the `NextResponse` issue.

fs.writeFileSync(path, code);
console.log('Fixed leaderboard typos and NextResponse');
