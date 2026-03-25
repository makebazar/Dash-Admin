
// Update interface to match actual DB JSON structure
interface SalaryScheme {
    id?: number;
    base?: {
        type: 'hourly' | 'fixed' | 'per_shift' | 'percent_revenue' | 'none';
        amount?: number;
        percent?: number;
        full_shift_hours?: number;
        payout_timing?: 'SHIFT' | 'MONTH';
    };
    // Support legacy/flat structure for backward compatibility if needed
    type?: 'hourly' | 'fixed' | 'per_shift' | 'percent_revenue' | 'none';
    amount?: number;
    percent?: number;
    full_shift_hours?: number;

    bonuses?: any[];
    period_bonuses?: any[]; // Added period_bonuses
    // For checklist bonus
    checklist_template_id?: number;
    min_score?: number;
    mode?: 'SHIFT' | 'MONTH';
}

interface ShiftData {
    id: string;
    total_hours: number;
    report_data?: any;
    evaluations?: any[]; // Added to support checklist bonuses
    bar_purchases?: number; // Added to support bar deductions
}

export async function calculateSalary(
    shift: ShiftData,
    scheme: SalaryScheme,
    reportMetrics: Record<string, number> = {}
) {
    let baseAmount = 0;
    const breakdown: any = { 
        base: 0, 
        bonuses: [], 
        deductions: [], // Added for bar purchases
        total: 0,  // Только REAL_MONEY (для зарплаты)
        virtual_balance_total: 0,  // Только VIRTUAL_BALANCE (отдельно)
        instant_payout: 0, // К выдаче сразу (ежедневно)
        accrued_payout: 0 // В накопление (зарплата)
    };

    // ... (existing base normalization) ...
    const type = scheme.base?.type || scheme.type || 'hourly';
    const amount = scheme.base?.amount ?? scheme.amount ?? 0;
    const percent = scheme.base?.percent ?? scheme.percent ?? 0;
    const fullShiftHours = scheme.base?.full_shift_hours ?? scheme.full_shift_hours ?? 12;
    const basePayoutTiming = scheme.base?.payout_timing || 'MONTH';

    // 1. Base Salary (всегда REAL_MONEY)
    if (type === 'hourly') {
        baseAmount = amount * (shift.total_hours || 0);
    } else if (type === 'fixed' || type === 'per_shift') {
        const hours = shift.total_hours || 0;

        if (hours >= fullShiftHours) {
            baseAmount = amount;
        } else {
            // Proportional
            baseAmount = (amount / fullShiftHours) * hours;
        }
    } else if (type === 'percent_revenue') {
        const sourceValue = reportMetrics['total_revenue'] || 0;
        baseAmount = sourceValue * (percent / 100);
    }

    breakdown.base = parseFloat(baseAmount.toFixed(2));
    let total = baseAmount;  // Зарплата (REAL_MONEY)
    let virtualBalanceTotal = 0;  // Виртуальный баланс (отдельно)
    
    // Distribute base amount
    if (basePayoutTiming === 'SHIFT') {
        breakdown.instant_payout += breakdown.base;
    } else {
        breakdown.accrued_payout += breakdown.base;
    }

    // 2. Per-Shift Bonuses (from scheme.bonuses)
    if (scheme.bonuses && Array.isArray(scheme.bonuses)) {
        for (const bonus of scheme.bonuses) {
            let bonusAmount = 0;
            const sourceKey = bonus.source || 'total';
            let metricValue = 0;
            if (sourceKey === 'total') metricValue = reportMetrics['total_revenue'] || 0;
            else if (sourceKey === 'cash') metricValue = reportMetrics['revenue_cash'] || 0;
            else if (sourceKey === 'card') metricValue = reportMetrics['revenue_card'] || 0;
            else metricValue = reportMetrics[sourceKey] || 0;

            if (bonus.type === 'fixed') {
                bonusAmount = Number(bonus.amount) || 0;
            } else if (bonus.type === 'percent_revenue') {
                bonusAmount = metricValue * ((Number(bonus.percent) || 0) / 100);

            } else if (bonus.type === 'progressive_percent') {
                if (bonus.mode === 'MONTH') {
                    // Handle as period bonus contribution (if reward value is provided)
                    const rewardValue = bonus.current_reward_value ?? 0;
                    const rewardType = bonus.current_reward_type ?? 'PERCENT';
                    
                    if (rewardType === 'PERCENT') {
                        bonusAmount = metricValue * (rewardValue / 100);
                    }
                    // For FIXED monthly bonuses, we don't add per-shift contribution usually
                } else if (bonus.thresholds) {
                    // Daily progressive logic
                    const sorted = [...bonus.thresholds].sort((a, b) => (Number(b.from) || 0) - (Number(a.from) || 0));
                    for (const t of sorted) {
                        if (metricValue >= (Number(t.from) || 0)) {
                            if (bonus.reward_type === 'FIXED') {
                                bonusAmount = Number(t.amount) || 0;
                            } else {
                                bonusAmount = metricValue * ((Number(t.percent) || 0) / 100);
                            }
                            break;
                        }
                    }
                }
            } else if (bonus.type === 'checklist') {
                // Handle checklist bonus (Per Shift mode)
                if (bonus.mode !== 'MONTH' && shift.evaluations && Array.isArray(shift.evaluations)) {
                    // Find matching evaluation
                    const evaluation = shift.evaluations.find(e => Number(e.template_id) === Number(bonus.checklist_template_id));
                    
                    if (evaluation) {
                        const score = Number(evaluation.score_percent) || 0;
                        
                        // Check if we use thresholds (new logic) or simple min_score (old logic)
                        if (bonus.checklist_thresholds && Array.isArray(bonus.checklist_thresholds) && bonus.checklist_thresholds.length > 0) {
                            // Sort descending by score to find the highest met threshold
                            const sorted = [...bonus.checklist_thresholds].sort((a, b) => (Number(b.min_score) || 0) - (Number(a.min_score) || 0));
                            const metThreshold = sorted.find(t => score >= (Number(t.min_score) || 0));
                            
                            if (metThreshold) {
                                bonusAmount = Number(metThreshold.amount) || 0;
                            }
                        } else {
                            // Legacy simple logic
                            const minScore = Number(bonus.min_score) || 0;
                            if (score >= minScore) {
                                bonusAmount = Number(bonus.amount) || 0;
                            }
                        }
                        
                        if (bonusAmount > 0) {
                            const payoutType = bonus.payout_type || 'REAL_MONEY';

                            // Add metadata to breakdown for UI to show which checklist triggered this
                            breakdown.bonuses.push({
                                name: bonus.name || 'Бонус за чек-лист',
                                type: 'CHECKLIST_BONUS',
                                amount: parseFloat(bonusAmount.toFixed(2)),
                                source_key: 'checklist_score',
                                source_value: score,
                                template_id: bonus.checklist_template_id,
                                payout_type: payoutType
                            });
                            
                            // Разделяем по типу выплаты
                            if (payoutType === 'VIRTUAL_BALANCE') {
                                virtualBalanceTotal += bonusAmount;
                            } else {
                                total += bonusAmount;
                                const payoutTiming = bonus.payout_timing || 'MONTH';
                                if (payoutTiming === 'SHIFT') {
                                    breakdown.instant_payout += bonusAmount;
                                } else {
                                    breakdown.accrued_payout += bonusAmount;
                                }
                            }
                            continue; // Skip the default push below
                        }
                    }
                }
            } else if (bonus.type === 'maintenance_kpi') {
                // Handle maintenance bonus
                // 1. Get raw task counts and sums from reportMetrics
                // reportMetrics['maintenance_tasks_completed'] should be passed by caller
                // reportMetrics['maintenance_tasks_assigned'] should be passed by caller
                // reportMetrics['maintenance_raw_sum'] should be passed by caller (sum of bonuses calculated at completion time)

                const rawSum = reportMetrics['maintenance_raw_sum'] || 0;
                
                if (rawSum > 0) {
                    let finalAmount = rawSum;
                    let efficiencyMultiplier = 1.0;

                    // Calculate efficiency if thresholds exist
                    if (bonus.efficiency_thresholds && bonus.efficiency_thresholds.length > 0) {
                        const completed = reportMetrics['maintenance_tasks_completed'] || 0;
                        const assigned = reportMetrics['maintenance_tasks_assigned'] || 0;
                        
                        // If assigned is 0 but we completed tasks (e.g. from free pool), efficiency is effectively 100%+
                        let efficiencyPercent = 100;
                        if (assigned > 0) {
                            efficiencyPercent = (completed / assigned) * 100;
                        }

                        // Find matching threshold
                        // Sort descending by percent
                        const sortedThresholds = [...bonus.efficiency_thresholds].sort((a, b) => b.from_percent - a.from_percent);
                        
                        let matchedThreshold = null;
                        for (const t of sortedThresholds) {
                            if (efficiencyPercent >= t.from_percent) {
                                matchedThreshold = t;
                                efficiencyMultiplier = Number(t.multiplier);
                                break;
                            }
                        }

                        if (bonus.reward_type === 'FIXED' && matchedThreshold) {
                            const fixedAmount = Number(matchedThreshold.amount) || 0;
                            const monthBase = reportMetrics['maintenance_month_base'] || rawSum;
                            
                            // Distribute fixed amount proportional to this shift's raw contribution
                            if (monthBase > 0) {
                                finalAmount = fixedAmount * (rawSum / monthBase);
                            } else {
                                finalAmount = 0;
                            }
                            
                            // For fixed rewards, we don't really use multiplier, but we can store it for debug
                            efficiencyMultiplier = 0; 
                        } else {
                            // Default Multiplier Logic
                            finalAmount = rawSum * efficiencyMultiplier;
                        }
                    } else {
                         // No thresholds, just base (x1.0)
                         finalAmount = rawSum * 1.0;
                    }

                    if (finalAmount > 0) {
                        const payoutType = bonus.payout_type || 'REAL_MONEY';
                        
                        breakdown.bonuses.push({
                            name: bonus.name || 'KPI Обслуживания',
                            type: 'MAINTENANCE_KPI',
                            amount: parseFloat(finalAmount.toFixed(2)),
                            source_key: 'maintenance_tasks',
                            source_value: rawSum,
                            multiplier: bonus.reward_type === 'FIXED' ? undefined : efficiencyMultiplier,
                            reward_type: bonus.reward_type,
                            payout_type: payoutType
                        });
                        
                        // Разделяем по типу выплаты
                        if (payoutType === 'VIRTUAL_BALANCE') {
                            virtualBalanceTotal += finalAmount;
                        } else {
                            total += finalAmount;
                            const payoutTiming = bonus.payout_timing || 'MONTH';
                            if (payoutTiming === 'SHIFT') {
                                breakdown.instant_payout += finalAmount;
                            } else {
                                breakdown.accrued_payout += finalAmount;
                            }
                        }
                    }
                }
            }

            if (bonus.type !== 'checklist' && bonus.type !== 'maintenance_kpi') {
                const payoutType = bonus.payout_type || 'REAL_MONEY';
                const isMonthly = bonus.mode === 'MONTH';
                
                breakdown.bonuses.push({
                    name: bonus.name || bonus.type,
                    type: isMonthly ? 'PERIOD_BONUS_CONTRIBUTION' : 'SHIFT_BONUS',
                    amount: parseFloat(bonusAmount.toFixed(2)),
                    source_key: sourceKey,
                    source_value: metricValue,
                    payout_type: payoutType,
                    mode: bonus.mode
                });
                
                // Разделяем по типу выплаты
                if (payoutType === 'VIRTUAL_BALANCE') {
                    virtualBalanceTotal += bonusAmount;
                } else {
                    total += bonusAmount;
                    const payoutTiming = bonus.payout_timing || 'MONTH';
                    if (payoutTiming === 'SHIFT') {
                        breakdown.instant_payout += bonusAmount;
                    } else {
                        breakdown.accrued_payout += bonusAmount;
                    }
                }
            }
        }
    }

    // 3. Period-based Bonuses contribution (passed as reportMetrics keys or periodKPILevels)
    // If the caller (route.ts) has pre-calculated the percentage/reward level, they can pass it 
    // in reportMetrics with keys starting with 'kpi_reward_' or we can process period_bonuses if reward info is attached.
    if (scheme.period_bonuses && Array.isArray(scheme.period_bonuses)) {
        for (const bonus of scheme.period_bonuses) {
            const rewardValue = bonus.current_reward_value ?? 0;
            const rewardType = bonus.current_reward_type ?? 'PERCENT';
            const metricKey = bonus.metric_key || 'total_revenue';
            const metricValue = reportMetrics[metricKey] || 0;

            let bonusAmount = 0;
            if (rewardType === 'PERCENT') {
                bonusAmount = metricValue * (rewardValue / 100);
            } else if (rewardType === 'FIXED' && bonus.target_per_shift) {
                // If it's a fixed bonus per target, we can show a portion or the full amount 
                // if the shift met some local target. But usually fixed monthly are just one-off.
                // However, "per-shift" targets might be different.
                // For now, only apply percentage-based period bonuses per shift as they are clearly tied to metric value.
            }

            if (bonusAmount > 0) {
                const payoutType = bonus.payout_type || 'REAL_MONEY';
                
                breakdown.bonuses.push({
                    name: bonus.name || 'KPI',
                    type: 'PERIOD_BONUS_CONTRIBUTION',
                    amount: parseFloat(bonusAmount.toFixed(2)),
                    source_key: metricKey,
                    source_value: metricValue,
                    reward_value: rewardValue,
                    reward_type: rewardType,
                    payout_type: payoutType
                });
                
                // Разделяем по типу выплаты
                if (payoutType === 'VIRTUAL_BALANCE') {
                    virtualBalanceTotal += bonusAmount;
                } else {
                    total += bonusAmount;
                    const payoutTiming = bonus.payout_timing || 'MONTH';
                    if (payoutTiming === 'SHIFT') {
                        breakdown.instant_payout += bonusAmount;
                    } else {
                        breakdown.accrued_payout += bonusAmount;
                    }
                }
            }
        }
    }

    // 4. Equipment Maintenance & Issue Bonuses
    // Legacy support: if 'maintenance_bonus' is passed directly but NO maintenance_kpi bonus is configured in the scheme
    // This prevents double counting if we switched to the new system
    const hasNewKpiBonus = scheme.bonuses?.some(b => b.type === 'maintenance_kpi');

    if (!hasNewKpiBonus && reportMetrics['maintenance_bonus'] && reportMetrics['maintenance_bonus'] > 0) {
        let amount = reportMetrics['maintenance_bonus'];
        amount = parseFloat(amount.toFixed(2));

        breakdown.bonuses.push({
            name: 'Обслуживание оборудования',
            type: 'EQUIPMENT_MAINTENANCE',
            amount: amount,
            source_key: 'maintenance_bonus',
            payout_type: 'REAL_MONEY'  // Legacy bonus всегда REAL_MONEY
        });

        // Добавляем только к зарплате (REAL_MONEY)
        total += amount;
        breakdown.accrued_payout += amount;
    }

    const maintenancePenalty = Number(
        reportMetrics['maintenance_overdue_penalty_applied'] ??
        reportMetrics['maintenance_overdue_penalty'] ??
        0
    );
    if (maintenancePenalty > 0) {
        const deduction = parseFloat(maintenancePenalty.toFixed(2));
        breakdown.deductions.push({
            name: 'Штраф за просрочку обслуживания',
            amount: deduction
        });
        total -= deduction;
        breakdown.accrued_payout -= deduction;
    }

    // 5. Bar Deductions (from shift.bar_purchases)
    if (shift.bar_purchases && shift.bar_purchases > 0) {
        const deduction = parseFloat(shift.bar_purchases.toFixed(2));
        breakdown.deductions.push({
            name: 'Покупка бара',
            amount: deduction
        });
        total -= deduction;
        breakdown.accrued_payout -= deduction;
    }

    breakdown.total = parseFloat(total.toFixed(2));
    breakdown.virtual_balance_total = parseFloat(virtualBalanceTotal.toFixed(2));
    breakdown.instant_payout = parseFloat(breakdown.instant_payout.toFixed(2));
    breakdown.accrued_payout = parseFloat(breakdown.accrued_payout.toFixed(2));

    return {
        total: breakdown.total,
        instant_payout: breakdown.instant_payout,
        accrued_payout: breakdown.accrued_payout,
        breakdown
    };
}
