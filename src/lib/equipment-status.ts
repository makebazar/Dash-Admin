export const EQUIPMENT_STATUSES = ["ACTIVE", "STORAGE", "REPAIR", "WRITTEN_OFF"] as const

export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number]

export const DEFAULT_EQUIPMENT_STATUS: EquipmentStatus = "STORAGE"

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
    ACTIVE: "В эксплуатации",
    STORAGE: "На складе",
    REPAIR: "В ремонте",
    WRITTEN_OFF: "Списано",
}

const EQUIPMENT_STATUS_SET = new Set<string>(EQUIPMENT_STATUSES)

export const isEquipmentStatus = (value: unknown): value is EquipmentStatus =>
    typeof value === "string" && EQUIPMENT_STATUS_SET.has(value)

export const deriveEquipmentStatus = (input: {
    status?: unknown
    is_active?: boolean | null
    workstation_id?: string | null
}): EquipmentStatus => {
    if (isEquipmentStatus(input.status)) {
        return input.status
    }

    if (input.is_active === false) {
        return "WRITTEN_OFF"
    }

    return input.workstation_id ? "ACTIVE" : "STORAGE"
}

export const isEquipmentOperational = (status: EquipmentStatus) => status !== "WRITTEN_OFF"

export const participatesInCleaningSchedule = (status: EquipmentStatus) => status === "ACTIVE"

export const canAssignEquipmentToWorkstation = (status: EquipmentStatus) => status === "STORAGE"

export const deriveIsEquipmentActive = (input: {
    status?: unknown
    is_active?: boolean | null
    workstation_id?: string | null
}) => isEquipmentOperational(deriveEquipmentStatus(input))

export const normalizeEquipmentRecord = <T extends { status?: unknown; is_active?: boolean | null; workstation_id?: string | null }>(
    row: T
) => {
    const status = deriveEquipmentStatus(row)

    return {
        ...row,
        status,
        is_active: isEquipmentOperational(status),
    }
}

export const resolveEquipmentStateForPersistence = (input: {
    currentStatus?: unknown
    currentIsActive?: boolean | null
    currentWorkstationId?: string | null
    requestedStatus?: unknown
    requestedIsActive?: boolean | null
    requestedWorkstationId?: string | null
    hasRequestedStatus?: boolean
    hasRequestedIsActive?: boolean
    hasRequestedWorkstation?: boolean
}) => {
    const currentStatus = deriveEquipmentStatus({
        status: input.currentStatus,
        is_active: input.currentIsActive,
        workstation_id: input.currentWorkstationId,
    })

    let nextWorkstationId = input.hasRequestedWorkstation
        ? (input.requestedWorkstationId ?? null)
        : (input.currentWorkstationId ?? null)

    let nextStatus = currentStatus

    if (input.hasRequestedStatus || input.hasRequestedIsActive) {
        nextStatus = deriveEquipmentStatus({
            status: input.requestedStatus,
            is_active: input.requestedIsActive,
            workstation_id: nextWorkstationId,
        })
    } else if (input.hasRequestedWorkstation) {
        if (nextWorkstationId) {
            nextStatus = currentStatus === "STORAGE" ? "ACTIVE" : currentStatus
        } else {
            nextStatus = currentStatus === "WRITTEN_OFF" ? "WRITTEN_OFF" : "STORAGE"
        }
    }

    if (nextStatus === "STORAGE" || nextStatus === "WRITTEN_OFF") {
        nextWorkstationId = null
    }

    if (nextStatus === "ACTIVE" && !nextWorkstationId) {
        nextStatus = "STORAGE"
    }

    return {
        status: nextStatus,
        is_active: isEquipmentOperational(nextStatus),
        workstation_id: nextWorkstationId,
    }
}
