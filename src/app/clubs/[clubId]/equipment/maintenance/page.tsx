"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import {
    Monitor,
    Calendar,
    ChevronLeft,
    ChevronRight,
    UserPlus,
    Loader2,
    Plus,
    Shirt,
    Search
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface MaintenanceTask {
    id: string
    equipment_id: string
    equipment_name: string
    equipment_type: string
    equipment_type_name: string
    equipment_icon: string
    last_cleaned_at: string | null
    workstation_id: string | null
    workstation_name: string | null
    workstation_zone: string | null
    equipment_assignment_mode?: "DIRECT" | "INHERIT" | "FREE_POOL"
    equipment_assigned_user_id?: string | null
    workstation_assigned_user_id?: string | null
    workstation_assigned_to_name?: string | null
    assigned_user_id: string | null
    assigned_to_name: string | null
    due_date: string
    overdue_days?: number
    rework_days?: number
    verification_status?: "PENDING" | "APPROVED" | "REJECTED" | null
    verified_at?: string | null
    rejection_reason?: string | null
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
    completed_at: string | null
    completed_by_name: string | null
    task_type: string
}

interface Employee {
    id: string
    full_name: string
}

interface EquipmentListItem {
    id: string
    workstation_id: string | null
    workstation_name: string | null
    workstation_zone: string | null
    workstation_assigned_user_id?: string | null
    workstation_assigned_to_name?: string | null
    type: string
    name: string
    type_name: string | null
    last_cleaned_at: string | null
    cleaning_interval_days: number | null
    maintenance_enabled: boolean | null
    assigned_user_id: string | null
    assigned_to_name?: string | null
    assignment_mode?: "DIRECT" | "INHERIT" | "FREE_POOL" | null
}

interface PlaceGroup {
    key: string
    workstationId: string | null
    zone: string
    name: string
    assignedUserId: string | null
    assignedToName: string | null
    devices: DeviceGroup[]
    overdue: number
    today: number
    inProgress: number
    rework: number
    future: number
    completed: number
}

interface DeviceGroup {
    key: string
    equipmentId: string
    equipmentName: string
    equipmentTypeName: string
    lastCleanedAt: string | null
    assignmentMode: "DIRECT" | "INHERIT" | "FREE_POOL"
    assignedUserId: string | null
    assignedToName: string | null
    effectiveAssignedUserId: string | null
    effectiveAssignedToName: string | null
    inheritedAssignedUserId: string | null
    inheritedAssignedToName: string | null
    activeTasks: MaintenanceTask[]
    overdue: number
    today: number
    inProgress: number
    rework: number
    future: number
    completed: number
    nextDueDate: string | null
}

interface ZoneGroup {
    key: string
    name: string
    overdue: number
    today: number
    inProgress: number
    rework: number
    future: number
    responsibles: string[]
    places: PlaceGroup[]
}

const getLocalDateKey = (date: Date = new Date()) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

const formatDay = (value?: string | null) => {
    if (!value) return "—"

    const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}T00:00:00`
        : value

    const parsed = new Date(normalizedValue)

    if (Number.isNaN(parsed.getTime())) {
        return "—"
    }

    return parsed.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
}

const matchesSearchTerm = (term: string, values: Array<string | null | undefined>) => {
    if (!term) return true
    return values.some(value => value?.toLowerCase().includes(term))
}

const normalizeAssignmentMode = (mode?: "DIRECT" | "INHERIT" | "FREE_POOL" | null) => {
    if (mode === "DIRECT" || mode === "FREE_POOL") return mode
    return "INHERIT"
}

const calculateNextDueDate = (lastCleanedAt?: string | null, intervalDays?: number | null) => {
    if (!intervalDays || intervalDays < 1) return null

    if (!lastCleanedAt) return null

    const parsed = new Date(lastCleanedAt)
    if (Number.isNaN(parsed.getTime())) return null

    parsed.setHours(0, 0, 0, 0)
    parsed.setDate(parsed.getDate() + intervalDays)

    return getLocalDateKey(parsed)
}

export default function MaintenanceSchedule() {
    const { clubId } = useParams()
    const [tasks, setTasks] = useState<MaintenanceTask[]>([])
    const [equipment, setEquipment] = useState<EquipmentListItem[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isGenerating, setIsGenerating] = useState(false)
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [searchQuery, setSearchQuery] = useState("")
    const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set())
    const [expandedPlaces, setExpandedPlaces] = useState<Set<string>>(new Set())

    const monthNames = useMemo(() => [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ], [])

    const ensurePlan = useCallback(async (firstDay: string, lastDay: string) => {
        setIsGenerating(true)
        try {
            await fetch(`/api/clubs/${clubId}/equipment/maintenance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date_from: firstDay,
                    date_to: lastDay,
                    task_type: "CLEANING"
                })
            })
        } finally {
            setIsGenerating(false)
        }
    }, [clubId])

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const firstDay = getLocalDateKey(new Date(selectedYear, selectedMonth - 1, 1))
            const lastDay = getLocalDateKey(new Date(selectedYear, selectedMonth, 0))

            await ensurePlan(firstDay, lastDay)

            const [tasksRes, employeesRes, equipmentRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/equipment/maintenance?date_from=${firstDay}&date_to=${lastDay}&include_overdue=true`),
                fetch(`/api/clubs/${clubId}/employees`),
                fetch(`/api/clubs/${clubId}/equipment?limit=5000`)
            ])

            const tasksData = await tasksRes.json()
            const employeesData = await employeesRes.json()
            const equipmentData = await equipmentRes.json()

            if (tasksRes.ok) setTasks(tasksData.tasks || [])
            if (employeesRes.ok) setEmployees(employeesData.employees || [])
            if (equipmentRes.ok) setEquipment(equipmentData.equipment || [])
        } catch (error) {
            console.error("Error fetching maintenance data:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId, ensurePlan, selectedMonth, selectedYear])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleGenerateTasks = async () => {
        try {
            fetchData()
        } catch (error) {
            console.error("Error generating tasks:", error)
        }
    }

    const handleAssignEquipment = async (equipmentId: string, value: string) => {
        const assignmentMode =
            value === "inherit" ? "INHERIT" :
            value === "free_pool" ? "FREE_POOL" :
            "DIRECT"

        const assignedUserId = assignmentMode === "DIRECT" ? value : null
        const assignedToName = assignedUserId
            ? employees.find(employee => employee.id === assignedUserId)?.full_name || null
            : null

        setTasks(prev => prev.map(task => (
            task.equipment_id === equipmentId
                ? {
                    ...task,
                    equipment_assignment_mode: assignmentMode,
                    equipment_assigned_user_id: assignedUserId,
                    assigned_user_id: assignmentMode === "DIRECT" ? assignedUserId : (assignmentMode === "FREE_POOL" ? null : task.workstation_assigned_user_id || null),
                    assigned_to_name: assignmentMode === "DIRECT" ? assignedToName : (assignmentMode === "FREE_POOL" ? null : task.workstation_assigned_to_name || null)
                }
                : task
        )))

        setEquipment(prev => prev.map(item => (
            item.id === equipmentId
                ? {
                    ...item,
                    assignment_mode: assignmentMode,
                    assigned_user_id: assignedUserId,
                    assigned_to_name: assignedToName
                }
                : item
        )))

        try {
            await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    assignment_mode: assignmentMode,
                    assigned_user_id: assignedUserId,
                    maintenance_enabled: true
                })
            })
            fetchData()
        } catch (error) {
            console.error("Error assigning equipment owner:", error)
            fetchData()
        }
    }

    const stats = useMemo(() => {
        const todayKey = getLocalDateKey()

        return {
            open: tasks.filter(task => task.status !== "COMPLETED" && task.status !== "SKIPPED").length,
            overdue: tasks.filter(task => task.status === "PENDING" && task.due_date < todayKey).length,
            today: tasks.filter(task => task.status === "PENDING" && task.due_date === todayKey).length,
            inProgress: tasks.filter(task => task.status === "IN_PROGRESS").length,
            rework: tasks.filter(task => task.status === "IN_PROGRESS" && task.verification_status === "REJECTED").length,
            unassigned: tasks.filter(task => task.status !== "COMPLETED" && !task.assigned_user_id).length,
            future: tasks.filter(task => task.status === "PENDING" && task.due_date > todayKey).length
        }
    }, [tasks])

    const summaryItems = useMemo(() => ([
        { label: "Просрочено", value: stats.overdue, tone: "text-rose-600 bg-rose-50 border-rose-100" },
        { label: "Сегодня", value: stats.today, tone: "text-amber-700 bg-amber-50 border-amber-100" },
        { label: "В работе", value: stats.inProgress, tone: "text-blue-700 bg-blue-50 border-blue-100" },
        { label: "На доработке", value: stats.rework, tone: "text-fuchsia-700 bg-fuchsia-50 border-fuchsia-100" },
        { label: "Свободный пул", value: stats.unassigned, tone: "text-slate-700 bg-slate-50 border-slate-100" },
        { label: "Будущие", value: stats.future, tone: "text-indigo-700 bg-indigo-50 border-indigo-100" }
    ]), [stats])

    const filteredEquipment = useMemo(() => {
        const term = searchQuery.trim().toLowerCase()

        return equipment.filter(item => {
            if (item.maintenance_enabled === false) return false

            return matchesSearchTerm(term, [
                item.name,
                item.type_name,
                item.workstation_name,
                item.workstation_zone,
                item.assigned_to_name,
                item.workstation_assigned_to_name
            ])
        })
    }, [equipment, searchQuery])

    const filteredEquipmentIds = useMemo(
        () => new Set(filteredEquipment.map(item => item.id)),
        [filteredEquipment]
    )

    const filteredTasks = useMemo(() => {
        const term = searchQuery.trim().toLowerCase()

        return tasks.filter(task => {
            if (filteredEquipmentIds.has(task.equipment_id)) return true

            return matchesSearchTerm(term, [
                task.equipment_name,
                task.equipment_type_name,
                task.workstation_name,
                task.workstation_zone,
                task.assigned_to_name,
                task.completed_by_name
            ])
        })
    }, [filteredEquipmentIds, searchQuery, tasks])

    const employeeDistribution = useMemo(() => {
        const workload = new Map<string, {
            id: string
            fullName: string
            places: Set<string>
            devices: Set<string>
        }>()

        filteredEquipment.forEach(item => {
            const assignmentMode = normalizeAssignmentMode(item.assignment_mode)
            const effectiveAssignedUserId =
                assignmentMode === "DIRECT"
                    ? item.assigned_user_id
                    : assignmentMode === "FREE_POOL"
                        ? null
                        : item.workstation_assigned_user_id || null

            if (!effectiveAssignedUserId) return

            const fullName =
                (assignmentMode === "DIRECT" ? item.assigned_to_name : item.workstation_assigned_to_name) ||
                employees.find(employee => employee.id === effectiveAssignedUserId)?.full_name ||
                "Без имени"

            if (!workload.has(effectiveAssignedUserId)) {
                workload.set(effectiveAssignedUserId, {
                    id: effectiveAssignedUserId,
                    fullName,
                    places: new Set<string>(),
                    devices: new Set<string>()
                })
            }

            const employeeLoad = workload.get(effectiveAssignedUserId)!
            employeeLoad.places.add(`${item.workstation_id || "storage"}::${item.workstation_zone || "Без зоны"}::${item.workstation_name || "Склад"}`)
            employeeLoad.devices.add(item.id)
        })

        return Array.from(workload.values())
            .map(employee => ({
                id: employee.id,
                fullName: employee.fullName,
                placesCount: employee.places.size,
                devicesCount: employee.devices.size
            }))
            .sort((a, b) => {
                const devicesDiff = b.devicesCount - a.devicesCount
                if (devicesDiff !== 0) return devicesDiff
                const placesDiff = b.placesCount - a.placesCount
                if (placesDiff !== 0) return placesDiff
                return a.fullName.localeCompare(b.fullName)
            })
    }, [employees, filteredEquipment])

    const freePoolDistribution = useMemo(() => {
        const places = new Set<string>()
        const devices = new Set<string>()

        filteredEquipment.forEach(item => {
            const assignmentMode = normalizeAssignmentMode(item.assignment_mode)
            const effectiveAssignedUserId =
                assignmentMode === "DIRECT"
                    ? item.assigned_user_id
                    : assignmentMode === "FREE_POOL"
                        ? null
                        : item.workstation_assigned_user_id || null

            const placeKey = `${item.workstation_id || "storage"}::${item.workstation_zone || "Без зоны"}::${item.workstation_name || "Склад"}`

            if (!item.workstation_assigned_user_id) {
                places.add(placeKey)
            }

            if (!effectiveAssignedUserId) {
                devices.add(item.id)
            }
        })

        return {
            placesCount: places.size,
            devicesCount: devices.size
        }
    }, [filteredEquipment])

    const zones = useMemo(() => {
        const todayKey = getLocalDateKey()
        const zoneMap = new Map<string, ZoneGroup>()

        filteredEquipment.forEach(item => {
            const zoneName = item.workstation_zone || "Без зоны"
            const placeName = item.workstation_name || "Склад"
            const zoneKey = zoneName
            const placeKey = `${zoneName}::${placeName}`

            if (!zoneMap.has(zoneKey)) {
                zoneMap.set(zoneKey, {
                    key: zoneKey,
                    name: zoneName,
                    overdue: 0,
                    today: 0,
                    inProgress: 0,
                    rework: 0,
                    future: 0,
                    responsibles: [],
                    places: []
                })
            }

            const zone = zoneMap.get(zoneKey)!

            const assignmentMode = normalizeAssignmentMode(item.assignment_mode)
            const effectiveAssignedUserId =
                assignmentMode === "DIRECT"
                    ? item.assigned_user_id
                    : assignmentMode === "FREE_POOL"
                        ? null
                        : item.workstation_assigned_user_id || null
            const effectiveAssignedToName =
                assignmentMode === "DIRECT"
                    ? item.assigned_to_name || null
                    : assignmentMode === "FREE_POOL"
                        ? null
                        : item.workstation_assigned_to_name || null

            if (effectiveAssignedToName && !zone.responsibles.includes(effectiveAssignedToName)) {
                zone.responsibles.push(effectiveAssignedToName)
            }

            let place = zone.places.find(existingPlace => existingPlace.key === placeKey)

            if (!place) {
                place = {
                    key: placeKey,
                    workstationId: item.workstation_id,
                    zone: zoneName,
                    name: placeName,
                    assignedUserId: item.workstation_assigned_user_id || null,
                    assignedToName: item.workstation_assigned_to_name || null,
                    devices: [],
                    overdue: 0,
                    today: 0,
                    inProgress: 0,
                    rework: 0,
                    future: 0,
                    completed: 0
                }
                zone.places.push(place)
            }

            place.devices.push({
                key: `${placeKey}::${item.id}`,
                equipmentId: item.id,
                equipmentName: item.name,
                equipmentTypeName: item.type_name || item.type,
                lastCleanedAt: item.last_cleaned_at,
                assignmentMode,
                assignedUserId: item.assigned_user_id,
                assignedToName: assignmentMode === "DIRECT" ? item.assigned_to_name || null : null,
                effectiveAssignedUserId,
                effectiveAssignedToName,
                inheritedAssignedUserId: item.workstation_assigned_user_id || null,
                inheritedAssignedToName: item.workstation_assigned_to_name || null,
                activeTasks: [],
                overdue: 0,
                today: 0,
                inProgress: 0,
                rework: 0,
                future: 0,
                completed: 0,
                nextDueDate: calculateNextDueDate(item.last_cleaned_at, item.cleaning_interval_days)
            })
        })

        filteredTasks.forEach(task => {
            const zoneName = task.workstation_zone || "Без зоны"
            const placeName = task.workstation_name || "Склад"
            const zoneKey = zoneName
            const placeKey = `${zoneName}::${placeName}`

            if (!zoneMap.has(zoneKey)) {
                zoneMap.set(zoneKey, {
                    key: zoneKey,
                    name: zoneName,
                    overdue: 0,
                    today: 0,
                    inProgress: 0,
                    rework: 0,
                    future: 0,
                    responsibles: [],
                    places: []
                })
            }

            const zone = zoneMap.get(zoneKey)!
            if (task.assigned_to_name && !zone.responsibles.includes(task.assigned_to_name)) {
                zone.responsibles.push(task.assigned_to_name)
            }
            let place = zone.places.find(item => item.key === placeKey)

            if (!place) {
                place = {
                    key: placeKey,
                    workstationId: task.workstation_id,
                    zone: zoneName,
                    name: placeName,
                    assignedUserId: task.workstation_assigned_user_id || null,
                    assignedToName: task.workstation_assigned_to_name || null,
                    devices: [],
                    overdue: 0,
                    today: 0,
                    inProgress: 0,
                    rework: 0,
                    future: 0,
                    completed: 0
                }
                zone.places.push(place)
            } else if (task.workstation_assigned_user_id || task.workstation_assigned_to_name) {
                place.assignedUserId = task.workstation_assigned_user_id || null
                place.assignedToName = task.workstation_assigned_to_name || null
            }

            let device = place.devices.find(item => item.equipmentId === task.equipment_id)

            if (!device) {
                device = {
                    key: `${placeKey}::${task.equipment_id}`,
                    equipmentId: task.equipment_id,
                    equipmentName: task.equipment_name,
                    equipmentTypeName: task.equipment_type_name,
                    lastCleanedAt: task.last_cleaned_at,
                    assignmentMode: (task.equipment_assignment_mode || "DIRECT") as "DIRECT" | "INHERIT" | "FREE_POOL",
                    assignedUserId: task.equipment_assigned_user_id || null,
                    assignedToName: task.equipment_assignment_mode === "DIRECT" ? task.assigned_to_name : null,
                    effectiveAssignedUserId: task.assigned_user_id,
                    effectiveAssignedToName: task.assigned_to_name,
                    inheritedAssignedUserId: task.workstation_assigned_user_id || null,
                    inheritedAssignedToName: task.workstation_assigned_to_name || null,
                    activeTasks: [],
                    overdue: 0,
                    today: 0,
                    inProgress: 0,
                    rework: 0,
                    future: 0,
                    completed: 0,
                    nextDueDate: task.due_date
                }
                place.devices.push(device)
            } else if (task.assigned_user_id || task.assigned_to_name || task.workstation_assigned_user_id || task.workstation_assigned_to_name) {
                device.assignmentMode = (task.equipment_assignment_mode || device.assignmentMode) as "DIRECT" | "INHERIT" | "FREE_POOL"
                device.assignedUserId = task.equipment_assigned_user_id || null
                device.assignedToName = task.equipment_assignment_mode === "DIRECT" ? task.assigned_to_name : null
                device.effectiveAssignedUserId = task.assigned_user_id
                device.effectiveAssignedToName = task.assigned_to_name
                device.inheritedAssignedUserId = task.workstation_assigned_user_id || null
                device.inheritedAssignedToName = task.workstation_assigned_to_name || null
            }

            if (!device.nextDueDate || task.due_date < device.nextDueDate) {
                device.nextDueDate = task.due_date
            }

            if (task.status === "IN_PROGRESS" && task.verification_status === "REJECTED") {
                zone.rework++
                place.rework++
                device.rework++
            }

            if (task.status === "IN_PROGRESS") {
                zone.inProgress++
                place.inProgress++
                device.inProgress++
                device.activeTasks.push(task)
                return
            }

            if (task.status === "COMPLETED") {
                place.completed++
                device.completed++
                return
            }

            if (task.due_date < todayKey) {
                zone.overdue++
                place.overdue++
                device.overdue++
                device.activeTasks.push(task)
                return
            }

            if (task.due_date === todayKey) {
                zone.today++
                place.today++
                device.today++
                device.activeTasks.push(task)
                return
            }

            zone.future++
            place.future++
            device.future++
        })

        return Array.from(zoneMap.values())
            .map(zone => ({
                ...zone,
                places: zone.places
                    .map(place => ({
                        ...place,
                        devices: place.devices.sort((a, b) => {
                            const activeDiff = (b.overdue + b.today + b.inProgress) - (a.overdue + a.today + a.inProgress)
                            if (activeDiff !== 0) return activeDiff
                            const futureDiff = b.future - a.future
                            if (futureDiff !== 0) return futureDiff
                            return a.equipmentName.localeCompare(b.equipmentName)
                        })
                    }))
                    .sort((a, b) => {
                        const activeDiff = (b.overdue + b.today + b.inProgress) - (a.overdue + a.today + a.inProgress)
                        if (activeDiff !== 0) return activeDiff
                        const futureDiff = b.future - a.future
                        if (futureDiff !== 0) return futureDiff
                        return a.name.localeCompare(b.name)
                    })
            }))
            .sort((a, b) => {
                const activeDiff = (b.overdue + b.today + b.inProgress) - (a.overdue + a.today + a.inProgress)
                if (activeDiff !== 0) return activeDiff
                const futureDiff = b.future - a.future
                if (futureDiff !== 0) return futureDiff
                return a.name.localeCompare(b.name)
            })
    }, [filteredEquipment, filteredTasks])

    const toggleZone = (zoneKey: string) => {
        setExpandedZones(prev => {
            const next = new Set(prev)
            if (next.has(zoneKey)) next.delete(zoneKey)
            else next.add(zoneKey)
            return next
        })
    }

    const togglePlace = (placeKey: string) => {
        setExpandedPlaces(prev => {
            const next = new Set(prev)
            if (next.has(placeKey)) next.delete(placeKey)
            else next.add(placeKey)
            return next
        })
    }

    const handleAssignPlace = async (workstationId: string | null, userId: string) => {
        if (!workstationId) return

        const assignedUserId = userId === "none" ? null : userId
        const assignedToName = assignedUserId
            ? employees.find(employee => employee.id === assignedUserId)?.full_name || null
            : null

        setTasks(prev => prev.map(task => (
            task.workstation_id === workstationId
                ? {
                    ...task,
                    workstation_assigned_user_id: assignedUserId,
                    workstation_assigned_to_name: assignedToName,
                    assigned_user_id: task.equipment_assignment_mode === "DIRECT"
                        ? task.equipment_assigned_user_id || null
                        : task.equipment_assignment_mode === "FREE_POOL"
                            ? null
                            : assignedUserId,
                    assigned_to_name: task.equipment_assignment_mode === "DIRECT"
                        ? task.assigned_to_name
                        : task.equipment_assignment_mode === "FREE_POOL"
                            ? null
                            : assignedToName
                }
                : task
        )))

        setEquipment(prev => prev.map(item => (
            item.workstation_id === workstationId
                ? {
                    ...item,
                    workstation_assigned_user_id: assignedUserId,
                    workstation_assigned_to_name: assignedToName
                }
                : item
        )))

        try {
            await fetch(`/api/clubs/${clubId}/workstations/${workstationId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assigned_user_id: assignedUserId, free_pool: assignedUserId === null })
            })
            fetchData()
        } catch (error) {
            console.error("Error assigning place owner:", error)
            fetchData()
        }
    }

    const getDeviceAssignmentMeta = (device: DeviceGroup, place: PlaceGroup) => {
        if (device.assignmentMode === "FREE_POOL") {
            return {
                selectValue: "free_pool",
                badgeLabel: "без ответственного",
                badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
                ownerLabel: "Свободный пул"
            }
        }

        if (device.assignmentMode === "INHERIT") {
            return {
                selectValue: "inherit",
                badgeLabel: "как у места",
                badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
                ownerLabel: place.assignedToName || "Свободный пул"
            }
        }

        if (place.assignedUserId && device.assignedUserId && place.assignedUserId !== device.assignedUserId) {
            return {
                selectValue: device.assignedUserId,
                badgeLabel: "свой ответственный",
                badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
                ownerLabel: device.assignedToName || "Свободный пул"
            }
        }

        return {
            selectValue: device.assignedUserId || "free_pool",
            badgeLabel: "ответственный задан",
            badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
            ownerLabel: device.assignedToName || "Свободный пул"
        }
    }

    const getDeviceStatusMeta = (device: DeviceGroup) => {
        const primaryTask = [...device.activeTasks].sort((a, b) => {
            if ((a.verification_status === "REJECTED") !== (b.verification_status === "REJECTED")) {
                return a.verification_status === "REJECTED" ? -1 : 1
            }
            if (a.status !== b.status) {
                return a.status === "IN_PROGRESS" ? -1 : 1
            }
            return a.due_date.localeCompare(b.due_date)
        })[0]

        if (primaryTask?.verification_status === "REJECTED") {
            return {
                label: `На доработке ${primaryTask.rework_days || 0} дн.`,
                badgeClass: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
                detail: primaryTask.rejection_reason || "Центр проверок вернул задачу",
                detailClass: "text-fuchsia-700"
            }
        }

        if (primaryTask?.status === "IN_PROGRESS") {
            return {
                label: "В работе",
                badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
                detail: `Срок: ${formatDay(primaryTask.due_date)}`,
                detailClass: "text-slate-600"
            }
        }

        if (primaryTask?.status === "PENDING" && (primaryTask.overdue_days || 0) > 0) {
            return {
                label: `Просрочено на ${primaryTask.overdue_days} дн.`,
                badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
                detail: `Плановая дата: ${formatDay(primaryTask.due_date)}`,
                detailClass: "text-rose-700"
            }
        }

        if (primaryTask?.status === "PENDING") {
            return {
                label: "На сегодня",
                badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
                detail: `Плановая дата: ${formatDay(primaryTask.due_date)}`,
                detailClass: "text-slate-600"
            }
        }

        if (device.nextDueDate) {
            return {
                label: "Обслужено",
                badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
                detail: `Следующая чистка: ${formatDay(device.nextDueDate)}`,
                detailClass: "text-slate-600"
            }
        }

        return {
            label: "Без графика",
            badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
            detail: "Нет плановой даты",
            detailClass: "text-slate-600"
        }
    }

    return (
        <div className="p-6 space-y-4 max-w-7xl mx-auto">
            <div className="flex flex-col gap-3">
                <Link href={`/clubs/${clubId}/equipment`} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    К обзору
                </Link>

                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                    <h1 className="text-2xl font-bold tracking-tight">🧹 График обслуживания</h1>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Поиск по месту, зоне, устройству"
                                className="pl-9 rounded-xl h-9 w-[260px]"
                            />
                        </div>

                        <Link href={`/clubs/${clubId}/laundry`}>
                            <Button variant="outline" className="rounded-xl h-9">
                                <Shirt className="mr-2 h-4 w-4" />
                                Стирка
                            </Button>
                        </Link>

                        <Button
                            onClick={handleGenerateTasks}
                            disabled={isGenerating}
                            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 h-9"
                        >
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Пересчитать
                        </Button>

                        <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-500"
                                onClick={() => {
                                    if (selectedMonth === 1) {
                                        setSelectedMonth(12)
                                        setSelectedYear(prev => prev - 1)
                                    } else {
                                        setSelectedMonth(prev => prev - 1)
                                    }
                                }}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="px-3 text-sm font-bold min-w-[150px] text-center">
                                {monthNames[selectedMonth - 1]} {selectedYear}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-500"
                                onClick={() => {
                                    if (selectedMonth === 12) {
                                        setSelectedMonth(1)
                                        setSelectedYear(prev => prev + 1)
                                    } else {
                                        setSelectedMonth(prev => prev + 1)
                                    }
                                }}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
                <Card className="shadow-none">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Сводка по чистке</div>
                                <div className="mt-1 text-sm text-muted-foreground">Текущий месяц и просрочка одним блоком</div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold">{stats.open}</div>
                                <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Активно</div>
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                            {summaryItems.map(item => (
                                <div key={item.label} className={cn("rounded-xl border px-3 py-2", item.tone)}>
                                    <div className="text-[10px] uppercase tracking-widest font-bold opacity-70">{item.label}</div>
                                    <div className="mt-1 text-xl font-bold leading-none">{item.value}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Сотрудники</div>
                                <div className="mt-1 text-sm text-muted-foreground">Распределение мест и оборудования по чистке</div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold">{employeeDistribution.length}</div>
                                <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Назначено</div>
                            </div>
                        </div>

                        <div className="mt-4 space-y-2">
                            {employeeDistribution.length > 0 ? (
                                employeeDistribution.map(employee => (
                                    <div key={employee.id} className="rounded-xl border bg-slate-50/70 px-3 py-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold">{employee.fullName}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {employee.placesCount} мест · {employee.devicesCount} оборудований
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Badge className="h-6 bg-indigo-50 text-indigo-700 hover:bg-indigo-50">
                                                    {employee.placesCount} мест
                                                </Badge>
                                                <Badge className="h-6 bg-sky-50 text-sky-700 hover:bg-sky-50">
                                                    {employee.devicesCount} оборуд.
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                                    Нет назначений по текущему фильтру
                                </div>
                            )}

                            <div className="rounded-xl border border-dashed bg-slate-50/40 px-3 py-2">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-semibold text-slate-700">Свободный пул</div>
                                        <div className="text-xs text-muted-foreground">
                                            {freePoolDistribution.placesCount} мест · {freePoolDistribution.devicesCount} оборудований
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Badge className="h-6 bg-slate-100 text-slate-700 hover:bg-slate-100">
                                                    {freePoolDistribution.placesCount} мест
                                                </Badge>
                                                <Badge className="h-6 bg-slate-200 text-slate-800 hover:bg-slate-200">
                                                    {freePoolDistribution.devicesCount} оборуд.
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {isLoading ? (
                <Card className="shadow-none">
                    <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </CardContent>
                </Card>
            ) : zones.length === 0 ? (
                <Card className="shadow-none">
                    <CardContent className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                        <Calendar className="h-8 w-8 opacity-40" />
                        <div>Ничего не найдено</div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {zones.map(zone => {
                        const isZoneOpen = expandedZones.has(zone.key)

                        return (
                            <Card key={zone.key} className="shadow-none overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => toggleZone(zone.key)}
                                    className="w-full px-4 py-3 border-b bg-slate-50/70 text-left"
                                >
                                    <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                                        <div className="flex flex-col gap-2 min-w-0">
                                            <div className="flex items-center gap-2.5">
                                                <ChevronRight className={cn("h-4 w-4 text-slate-500 transition-transform", isZoneOpen && "rotate-90")} />
                                                <div>
                                                    <div className="text-base font-semibold">{zone.name}</div>
                                                    <div className="text-xs text-muted-foreground">{zone.places.length} мест</div>
                                                </div>
                                            </div>
                                            {zone.responsibles.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 pl-6">
                                                    {zone.responsibles.slice(0, 5).map(name => (
                                                        <Badge
                                                            key={name}
                                                            variant="outline"
                                                            className="h-6 bg-white text-slate-700 border-slate-200 hover:bg-white"
                                                        >
                                                            {name}
                                                        </Badge>
                                                    ))}
                                                    {zone.responsibles.length > 5 && (
                                                        <Badge
                                                            variant="outline"
                                                            className="h-6 bg-white text-slate-500 border-slate-200 hover:bg-white"
                                                        >
                                                            +{zone.responsibles.length - 5}
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-1.5">
                                            {zone.overdue > 0 && <Badge className="h-6 bg-rose-50 text-rose-700 hover:bg-rose-50">{zone.overdue} просрочено</Badge>}
                                            {zone.today > 0 && <Badge className="h-6 bg-amber-50 text-amber-700 hover:bg-amber-50">{zone.today} сегодня</Badge>}
                                            {zone.inProgress > 0 && <Badge className="h-6 bg-blue-50 text-blue-700 hover:bg-blue-50">{zone.inProgress} в работе</Badge>}
                                            {zone.rework > 0 && <Badge className="h-6 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-50">{zone.rework} на доработке</Badge>}
                                            {zone.future > 0 && <Badge className="h-6 bg-slate-100 text-slate-700 hover:bg-slate-100">{zone.future} позже</Badge>}
                                        </div>
                                    </div>
                                </button>

                                {isZoneOpen && (
                                    <CardContent className="p-3 space-y-2">
                                        {zone.places.map(place => {
                                            const isPlaceOpen = expandedPlaces.has(place.key)
                                            const hasVisibleDevices = place.devices.length > 0

                                            return (
                                                <div key={place.key} className="rounded-xl border overflow-hidden">
                                                    <button
                                                        type="button"
                                                        onClick={() => hasVisibleDevices && togglePlace(place.key)}
                                                        className={cn(
                                                            "w-full px-3 py-3 text-left",
                                                            hasVisibleDevices ? "bg-white" : "bg-slate-50/50"
                                                        )}
                                                    >
                                                        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                                                            <div className="flex items-center gap-2.5">
                                                                <ChevronRight className={cn(
                                                                    "h-3.5 w-3.5 text-slate-500 transition-transform",
                                                                    isPlaceOpen && hasVisibleDevices && "rotate-90",
                                                                    !hasVisibleDevices && "opacity-30"
                                                                )} />
                                                                <div>
                                                                    <div className="font-medium text-sm">{place.name}</div>
                                                                    <div className="text-xs text-muted-foreground">{place.zone}</div>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap gap-1.5">
                                                                {place.overdue > 0 && <Badge className="h-6 bg-rose-50 text-rose-700 hover:bg-rose-50">{place.overdue} просрочено</Badge>}
                                                                {place.today > 0 && <Badge className="h-6 bg-amber-50 text-amber-700 hover:bg-amber-50">{place.today} сегодня</Badge>}
                                                                {place.inProgress > 0 && <Badge className="h-6 bg-blue-50 text-blue-700 hover:bg-blue-50">{place.inProgress} в работе</Badge>}
                                                                {place.rework > 0 && <Badge className="h-6 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-50">{place.rework} на доработке</Badge>}
                                                                {place.future > 0 && <Badge className="h-6 bg-slate-100 text-slate-700 hover:bg-slate-100">{place.future} позже</Badge>}
                                                            </div>
                                                        </div>
                                                    </button>

                                                    <div className="border-t px-3 py-2 bg-white/80">
                                                        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                                                            <div className="text-xs text-muted-foreground">
                                                                Ответственный за место
                                                            </div>
                                                            <div className="w-full xl:w-[220px]">
                                                                <Select
                                                                    value={place.assignedUserId || "unassigned"}
                                                                    onValueChange={(value) => handleAssignPlace(place.workstationId, value)}
                                                                >
                                                                    <SelectTrigger className="h-8 text-xs bg-white border-dashed">
                                                                        <div className="flex items-center gap-2">
                                                                            <UserPlus className="h-3 w-3 text-muted-foreground" />
                                                                            <SelectValue placeholder="Назначить" />
                                                                        </div>
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="unassigned">🤝 Свободный пул</SelectItem>
                                                                        {employees.map(employee => (
                                                                            <SelectItem key={employee.id} value={employee.id}>{employee.full_name}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {isPlaceOpen && hasVisibleDevices && (
                                                        <div className="border-t bg-slate-50/30 p-2.5 space-y-2">
                                                            {place.devices.map(device => {
                                                                const assignmentMeta = getDeviceAssignmentMeta(device, place)
                                                                const statusMeta = getDeviceStatusMeta(device)

                                                                return (
                                                                    <div key={device.key} className="rounded-xl border bg-white overflow-hidden">
                                                                        <div className="px-3 py-2.5 text-left">
                                                                            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                                                                                <div className="flex items-center gap-2.5">
                                                                                    <div className="h-8 w-8 rounded-xl border bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
                                                                                        <Monitor className="h-4 w-4" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                                            <div className="font-medium text-sm">{device.equipmentName}</div>
                                                                                            <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", assignmentMeta.badgeClass)}>
                                                                                                {assignmentMeta.badgeLabel}
                                                                                            </Badge>
                                                                                            <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", statusMeta.badgeClass)}>
                                                                                                {statusMeta.label}
                                                                                            </Badge>
                                                                                        </div>
                                                                                        <div className="text-xs text-muted-foreground">{device.equipmentTypeName}</div>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="flex flex-wrap gap-1.5">
                                                                                    {device.future > 0 && <Badge className="h-6 bg-slate-100 text-slate-700 hover:bg-slate-100">{device.future} позже</Badge>}
                                                                                </div>
                                                                            </div>

                                                                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                                                                <span>Последняя: {device.lastCleanedAt ? new Date(device.lastCleanedAt).toLocaleDateString("ru-RU") : "—"}</span>
                                                                                <span>Ответственный: {assignmentMeta.ownerLabel}</span>
                                                                                <span className={statusMeta.detailClass}>{statusMeta.detail}</span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="border-t px-3 py-2 bg-white/80">
                                                                            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    Ответственный за оборудование
                                                                                </div>
                                                                                <div className="w-full xl:w-[220px]">
                                                                                    <Select
                                                                                        value={assignmentMeta.selectValue}
                                                                                        onValueChange={(value) => handleAssignEquipment(device.equipmentId, value)}
                                                                                    >
                                                                                        <SelectTrigger className="h-8 text-xs bg-white border-dashed">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <UserPlus className="h-3 w-3 text-muted-foreground" />
                                                                                                <SelectValue placeholder="Назначить" />
                                                                                            </div>
                                                                                        </SelectTrigger>
                                                                                        <SelectContent>
                                                                                            <SelectItem value="inherit">↩️ От места</SelectItem>
                                                                                            <SelectItem value="free_pool">🤝 Свободный пул</SelectItem>
                                                                                            {employees.map(employee => (
                                                                                                <SelectItem key={employee.id} value={employee.id}>{employee.full_name}</SelectItem>
                                                                                            ))}
                                                                                        </SelectContent>
                                                                                    </Select>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </CardContent>
                                )}
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
