import type { ReactNode } from "react"

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
    maintenance_enabled: boolean
    cleaning_interval_days?: number
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
}

export interface Employee {
    id: string
    full_name: string
}

export interface ZoneSectionProps {
    zone: string
    workstations: Workstation[]
    equipmentByWorkstationId: Map<string, Equipment[]>
    activeIssueCountByWorkstationId: Map<string, number>
    activeIssueCountByEquipmentId: Map<string, number>
    zoneIssuesCount: number
    onOpenDetails: (wsId: string) => void
    onEdit: (ws: Workstation) => void
    onDelete: (wsId: string) => void
    onOpenAssignDialog: (wsId: string) => void
    onCreate: (zone?: string) => void
    onUnassignEquipment: (equipmentId: string) => void
    renderEquipmentIcon: (type: string) => ReactNode
}
