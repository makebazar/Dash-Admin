import type { EquipmentStatus } from "@/lib/equipment-status"

export interface Workstation {
    id: string
    name: string
    zone: string
    assigned_user_id?: string | null
    assigned_user_name?: string | null
    equipment_count?: number
}

export interface Equipment {
    id: string
    name: string
    type: string
    type_name: string
    type_icon: string
    identifier?: string | null
    brand: string | null
    model: string | null
    workstation_id: string | null
    is_active: boolean
    status: EquipmentStatus
    maintenance_enabled: boolean
    cleaning_interval_days?: number
    cleaning_interval_override_days?: number | null
    last_cleaned_at?: string | null
    thermal_paste_last_changed_at?: string | null
    thermal_paste_interval_days?: number | null
    thermal_paste_type?: string | null
    thermal_paste_note?: string | null
    cpu_thermal_paste_last_changed_at?: string | null
    cpu_thermal_paste_interval_days?: number | null
    cpu_thermal_paste_type?: string | null
    cpu_thermal_paste_note?: string | null
    gpu_thermal_paste_last_changed_at?: string | null
    gpu_thermal_paste_interval_days?: number | null
    gpu_thermal_paste_type?: string | null
    gpu_thermal_paste_note?: string | null
    open_issues_count?: number
    assigned_user_id?: string | null
    assignment_mode?: string | null
}

export interface EquipmentType {
    code: string
    name_ru: string
    icon: string
    default_cleaning_interval?: number | null
}

export interface Employee {
    id: string
    full_name: string
}

export interface ZoneSectionProps {
    zone: string
    workstations: Workstation[]
    zoneAssignedUserName?: string | null
    equipmentByWorkstationId: Map<string, Equipment[]>
    activeIssueCountByWorkstationId: Map<string, number>
    activeIssueCountByEquipmentId: Map<string, number>
    maintenanceStatusByEquipmentId: Map<string, "overdue" | "serviced" | "disabled" | "unknown">
    overdueDaysByEquipmentId: Map<string, number>
    overdueMaintenanceCountByWorkstationId: Map<string, number>
    servicedMaintenanceCountByWorkstationId: Map<string, number>
    disabledMaintenanceCountByWorkstationId: Map<string, number>
    zoneIssuesCount: number
    zoneRepairCount: number
    zoneEmptyCount: number
    zoneUnassignedCount: number
    zoneOverdueMaintenanceCount: number
    zoneServicedMaintenanceCount: number
    zoneDisabledMaintenanceCount: number
    onOpenDetails: (wsId: string) => void
    onOpenAssignDialog: (wsId: string) => void
    onCreate: (zone?: string) => void
    onUnassignEquipment: (equipmentId: string) => void
}
