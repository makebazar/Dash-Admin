interface MaintenanceQualityInput {
    assigned: number
    completed: number
    dueByNow: number
    completedDueByNow: number
    overdueOpenTasks: number
    reworkOpenTasks: number
    staleReworkTasks: number
}

export function calculateMaintenanceQualityMetrics(input: MaintenanceQualityInput) {
    const assigned = Math.max(0, Number(input.assigned) || 0)
    const completed = Math.max(0, Number(input.completed) || 0)
    const dueByNow = Math.max(0, Number(input.dueByNow) || 0)
    const completedDueByNow = Math.max(0, Number(input.completedDueByNow) || 0)
    const overdueOpenTasks = Math.max(0, Number(input.overdueOpenTasks) || 0)
    const reworkOpenTasks = Math.max(0, Number(input.reworkOpenTasks) || 0)
    const staleReworkTasks = Math.max(0, Number(input.staleReworkTasks) || 0)

    const penaltyUnits =
        overdueOpenTasks +
        (reworkOpenTasks * 2) +
        staleReworkTasks

    const adjustedCompleted = completed
    const adjustedCompletedDueByNow = completedDueByNow

    const efficiency = assigned > 0
        ? (adjustedCompleted / assigned) * 100
        : (adjustedCompleted > 0 ? 100 : 0)

    const liveEfficiency = dueByNow > 0
        ? (adjustedCompletedDueByNow / dueByNow) * 100
        : (adjustedCompletedDueByNow > 0 ? 100 : 0)

    return {
        penalty_units: penaltyUnits,
        adjusted_completed: adjustedCompleted,
        adjusted_completed_due_by_now: adjustedCompletedDueByNow,
        efficiency,
        live_efficiency: liveEfficiency
    }
}
