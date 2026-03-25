type MaintenancePenaltyMode = 'NONE' | 'FIXED_PER_TASK' | 'FIXED_PER_DAY' | 'PERCENT_OF_REWARD'

interface MaintenancePenaltyConfig {
    overdue_tolerance_days?: number
    overdue_penalty_mode?: MaintenancePenaltyMode
    overdue_penalty_amount?: number
    late_penalty_multiplier?: number
}

interface MaintenancePenaltyTask {
    overdue_days_at_completion?: number | string | null
    bonus_earned?: number | string | null
    was_overdue?: boolean | null
}

export function calculateMaintenanceOverduePenalty(
    config: MaintenancePenaltyConfig | null | undefined,
    tasks: MaintenancePenaltyTask[]
) {
    const tolerance = Math.max(0, Number(config?.overdue_tolerance_days) || 0)
    const explicitMode = (config?.overdue_penalty_mode || 'NONE') as MaintenancePenaltyMode
    const explicitAmount = Math.max(0, Number(config?.overdue_penalty_amount) || 0)
    const legacyMultiplier = Number(config?.late_penalty_multiplier)

    let total = 0
    let incidents = 0
    let overdueDays = 0

    for (const task of tasks) {
        const rawOverdueDays = Math.max(0, Number(task.overdue_days_at_completion) || 0)
        const effectiveOverdueDays = Math.max(0, rawOverdueDays - tolerance)
        const isOverdue = task.was_overdue === true || rawOverdueDays > 0

        if (!isOverdue || effectiveOverdueDays <= 0) {
            continue
        }

        incidents++
        overdueDays += effectiveOverdueDays

        const reward = Math.max(0, Number(task.bonus_earned) || 0)
        let penalty = 0

        if (explicitMode === 'FIXED_PER_TASK') {
            penalty = explicitAmount
        } else if (explicitMode === 'FIXED_PER_DAY') {
            penalty = explicitAmount * effectiveOverdueDays
        } else if (explicitMode === 'PERCENT_OF_REWARD') {
            penalty = reward * (explicitAmount / 100)
        } else if (!Number.isNaN(legacyMultiplier) && legacyMultiplier < 1) {
            penalty = reward * (1 - Math.max(0, legacyMultiplier))
        }

        total += penalty
    }

    return {
        total: Number(total.toFixed(2)),
        incidents,
        overdue_days: overdueDays
    }
}
