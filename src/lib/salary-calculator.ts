
import { query } from '@/db';

// Update interface to match actual DB JSON structure
interface SalaryScheme {
    id?: number;
    base?: {
        type: 'hourly' | 'fixed' | 'per_shift' | 'percent_revenue' | 'none';
        amount?: number;
        percent?: number;
        full_shift_hours?: number;
    };
    // Support legacy/flat structure for backward compatibility if needed
    type?: 'hourly' | 'fixed' | 'per_shift' | 'percent_revenue' | 'none';
    amount?: number;
    percent?: number;
    full_shift_hours?: number;

    bonuses?: any[];
    period_bonuses?: any[]; // Added period_bonuses
    penalty_amount?: number;
    penalty_reason?: string;
    version?: number;
}

interface ShiftData {
    id: string;
    total_hours: number;
    report_data?: any;
}

export async function calculateSalary(
    shift: ShiftData,
    scheme: SalaryScheme,
    reportMetrics: Record<string, number> = {}
) {
    let baseAmount = 0;
    const breakdown: any = { base: 0, bonuses: [], penalties: [], total: 0 };

    // Normalize base params
    const type = scheme.base?.type || scheme.type || 'hourly';
    const amount = scheme.base?.amount ?? scheme.amount ?? 0;
    const percent = scheme.base?.percent ?? scheme.percent ?? 0;
    const fullShiftHours = scheme.base?.full_shift_hours ?? scheme.full_shift_hours ?? 12;

    // 1. Base Salary
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
    let total = baseAmount;

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
            } else if (bonus.type === 'tiered') {
                if (bonus.tiers) {
                    for (const tier of bonus.tiers) {
                        const from = Number(tier.from) || 0;
                        const to = tier.to === '∞' || tier.to === null ? Infinity : (Number(tier.to) || Infinity);
                        if (metricValue >= from && metricValue <= to) {
                            bonusAmount = Number(tier.bonus) || Number(tier.amount) || 0;
                            break;
                        }
                    }
                }
            } else if (bonus.type === 'progressive_percent') {
                if (bonus.thresholds) {
                    const sorted = [...bonus.thresholds].sort((a, b) => (Number(b.from) || 0) - (Number(a.from) || 0));
                    for (const t of sorted) {
                        if (metricValue >= (Number(t.from) || 0)) {
                            bonusAmount = metricValue * ((Number(t.percent) || 0) / 100);
                            break;
                        }
                    }
                }
            } else if (bonus.type === 'penalty') {
                bonusAmount = -(Number(bonus.amount) || 0);
            }

            breakdown.bonuses.push({
                name: bonus.name || bonus.type,
                type: 'SHIFT_BONUS',
                amount: parseFloat(bonusAmount.toFixed(2)),
                source_key: sourceKey,
                source_value: metricValue
            });
            total += bonusAmount;
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
                breakdown.bonuses.push({
                    name: bonus.name || 'KPI',
                    type: 'PERIOD_BONUS_CONTRIBUTION',
                    amount: parseFloat(bonusAmount.toFixed(2)),
                    source_key: metricKey,
                    source_value: metricValue,
                    reward_value: rewardValue,
                    reward_type: rewardType
                });
                total += bonusAmount;
            }
        }
    }

    breakdown.total = parseFloat(total.toFixed(2));

    return {
        total: breakdown.total,
        breakdown
    };
}
