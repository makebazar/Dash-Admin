
import { query } from '@/db';

// Update interface to match actual DB JSON structure
interface SalaryScheme {
    id?: number;
    base?: {
        type: 'hourly' | 'fixed' | 'per_shift' | 'percent_revenue';
        amount?: number;
        percent?: number;
        full_shift_hours?: number;
    };
    // Support legacy/flat structure for backward compatibility if needed
    type?: 'hourly' | 'fixed' | 'per_shift' | 'percent_revenue';
    amount?: number;
    percent?: number;
    full_shift_hours?: number;

    bonuses?: any[];
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

    // 2. Bonuses
    if (scheme.bonuses && Array.isArray(scheme.bonuses)) {
        for (const bonus of scheme.bonuses) {
            let bonusAmount = 0;
            const sourceKey = bonus.source || 'total';
            // Map 'total' -> 'total_revenue', 'cash' -> 'revenue_cash', 'card' -> 'revenue_card'
            // Or use metric key directly.
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

            // Always add to breakdown to show configured bonuses, even if 0
            breakdown.bonuses.push({
                name: bonus.name || bonus.type,
                amount: parseFloat(bonusAmount.toFixed(2)),
                source_key: sourceKey,
                source_value: metricValue
            });
            total += bonusAmount;
        }
    }

    breakdown.total = parseFloat(total.toFixed(2));

    return {
        total: breakdown.total,
        breakdown
    };
}
