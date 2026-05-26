const fs = require('fs');

const summaryPath = 'src/app/api/clubs/[clubId]/salaries/summary/route.ts';
let code = fs.readFileSync(summaryPath, 'utf8');

// 1. Add promoPlayersRes and promoHistoryRes before clubFinishedShifts
if (!code.includes('promoPlayersRes = await query')) {
  const target = `    // Process each employee
    const clubFinishedShifts = shiftsRes.rows.filter(`;
  const insert = `    // Fetch Promo Data for the club/month to calculate bonuses
    const promoPlayersRes = await query(
      \`SELECT p.id, p.created_at
       FROM promo_players p
       JOIN promo_player_balances b ON b.player_id = p.id
       WHERE b.club_id = $1 AND p.created_at >= $2 AND p.created_at <= $3\`,
      [clubId, startOfMonth.toISOString(), endOfMonth.toISOString()],
    );

    const promoHistoryRes = await query(
      \`SELECT h.player_id, h.created_at, h.game_type, (h.result_data->>'amount')::numeric as amount
       FROM promo_history h
       WHERE h.club_id = $1 AND h.created_at >= $2 AND h.created_at <= $3
         AND h.game_type IN ('TOPUP', 'SERVICE_AWARD')\`,
      [clubId, startOfMonth.toISOString(), endOfMonth.toISOString()],
    );

`;
  code = code.replace(target, insert + target);
}

// 2. Add monthly promo calculation
if (!code.includes('empPromoPlayers = promoPlayersRes.rows')) {
  const target2 = `        // Add evaluation score to metrics
        const empEval = evalMap[emp.id];`;
  const insert2 = `        // Calculate promo metrics for this employee (based on their shifts)
        const empShiftsForPromo = empShifts.map((s: any) => ({
          start: new Date(s.check_in),
          end: s.check_out ? new Date(s.check_out) : new Date(),
        }));

        const empPromoPlayers = promoPlayersRes.rows.filter((p: any) => {
          const d = new Date(p.created_at);
          return empShiftsForPromo.some((s: any) => d >= s.start && d <= s.end);
        });

        const empPromoHistory = promoHistoryRes.rows.filter((h: any) => {
          const d = new Date(h.created_at);
          return empShiftsForPromo.some((s: any) => d >= s.start && d <= s.end);
        });

        const empPromoTopups = empPromoHistory.filter(
          (h: any) => h.game_type === "TOPUP",
        );
        const empPromoServiceCount = empPromoHistory.filter(
          (h: any) => h.game_type === "SERVICE_AWARD",
        ).length;
        const empPromoNewPayingPlayersCount = empPromoPlayers.filter((p: any) =>
          empPromoTopups.some((h: any) => h.player_id === p.id),
        ).length;
        const empPromoTopupSum = empPromoTopups.reduce(
          (sum: number, h: any) => sum + Number(h.amount || 0),
          0,
        );

        monthlyMetrics["promo_new_players"] = empPromoPlayers.length;
        monthlyMetrics["promo_new_paying_players"] =
          empPromoNewPayingPlayersCount;
        monthlyMetrics["promo_topup_total_sum"] = empPromoTopupSum;
        monthlyMetrics["promo_service_count"] = empPromoServiceCount;

`;
  code = code.replace(target2, insert2 + target2);
}

// 3. Add shift promo calculation
if (!code.includes('shiftPromoPlayers = promoPlayersRes.rows')) {
  const target3 = `            // Inject monthly evaluation metrics into shift metrics so bonuses can use them
            if (empEval) {`;
  const insert3 = `            // Inject promo metrics for this shift
            const shiftStart = new Date(s.check_in);
            const shiftEnd = s.check_out ? new Date(s.check_out) : new Date();

            const shiftPromoPlayers = promoPlayersRes.rows.filter((p: any) => {
              const d = new Date(p.created_at);
              return d >= shiftStart && d <= shiftEnd;
            });

            const shiftPromoHistory = promoHistoryRes.rows.filter((h: any) => {
              const d = new Date(h.created_at);
              return d >= shiftStart && d <= shiftEnd;
            });

            const shiftTopups = shiftPromoHistory.filter(
              (h: any) => h.game_type === "TOPUP",
            );
            const shiftServiceCount = shiftPromoHistory.filter(
              (h: any) => h.game_type === "SERVICE_AWARD",
            ).length;
            const shiftNewPayingPlayersCount = shiftPromoPlayers.filter((p: any) =>
              shiftTopups.some((h: any) => h.player_id === p.id),
            ).length;
            const shiftTopupSum = shiftTopups.reduce(
              (sum: number, h: any) => sum + Number(h.amount || 0),
              0,
            );

            reportMetricsForShift["promo_new_players"] =
              shiftPromoPlayers.length;
            reportMetricsForShift["promo_new_paying_players"] =
              shiftNewPayingPlayersCount;
            reportMetricsForShift["promo_topup_total_sum"] = shiftTopupSum;
            reportMetricsForShift["promo_service_count"] = shiftServiceCount;

`;
  code = code.replace(target3, insert3 + target3);
}

fs.writeFileSync(summaryPath, code);
console.log("Promo logic patched successfully.");
