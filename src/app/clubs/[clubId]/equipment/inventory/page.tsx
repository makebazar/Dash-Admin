"use client"

import { useEffect, useState, useCallback, useMemo, useRef, Fragment, type MouseEvent } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import * as XLSX from "xlsx"
import {
    Plus,
    Search,
    AlertCircle,
    LayoutGrid,
    ChevronLeft,
    Loader2,
    Info,
    Wrench,
    Archive,
    Download,
    Upload,
    RefreshCw,
    Box,
    Clock3,
    ChevronDown,
    ChevronRight
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { cn, formatLocalDate } from "@/lib/utils"
import { renderEquipmentIcon } from "@/lib/equipment-icons"
import { EQUIPMENT_STATUS_LABELS, type EquipmentStatus } from "@/lib/equipment-status"

interface Equipment {
    id: string
    name: string
    type: string
    type_name: string
    type_icon: string
    identifier: string | null
    brand: string | null
    model: string | null
    workstation_id: string | null
    workstation_name: string | null
    workstation_zone: string | null
    warranty_expires: string | null
    warranty_status: 'ACTIVE' | 'EXPIRED' | 'EXPIRING_SOON' | null
    last_cleaned_at: string | null
    cleaning_interval_days?: number
    is_active: boolean
    notes: string | null
    maintenance_enabled?: boolean
    assigned_user_id?: string | null
    open_issues_count?: number
    status: EquipmentStatus
    purchase_date?: string
    price?: number
}

interface EquipmentType {
    code: string
    name_ru: string
    icon: string
}

interface Workstation {
    id: string
    name: string
    zone: string
}

interface Employee {
    id: string
    full_name: string
    role?: string
    is_active?: boolean
    dismissed_at?: string | null
}

const INVENTORY_IMPORT_COLUMNS = [
    "ID",
    "Название",
    "Тип код",
    "Тип",
    "Серийный номер",
    "Бренд",
    "Модель",
    "Зона",
    "Место",
    "Статус",
    "Дата покупки",
    "Гарантия до",
    "Интервал чистки (дней)",
    "Обслуживание включено",
    "Примечание",
] as const

const INVENTORY_TEMPLATE_EXAMPLE = {
    ID: "",
    "Название": "Игровой ПК #12",
    "Тип код": "PC",
    "Тип": "Компьютер",
    "Серийный номер": "INV-0012",
    "Бренд": "ASUS",
    "Модель": "ROG Strix",
    "Зона": "Основной зал",
    "Место": "PC-12",
    "Статус": "ACTIVE",
    "Дата покупки": "2026-01-15",
    "Гарантия до": "2027-01-15",
    "Интервал чистки (дней)": 30,
    "Обслуживание включено": "Да",
    "Примечание": "Пример строки для импорта",
}

const INVENTORY_STATUS_IMPORT_MAP: Record<string, EquipmentStatus> = {
    active: "ACTIVE",
    "в эксплуатации": "ACTIVE",
    storage: "STORAGE",
    "на складе": "STORAGE",
    repair: "REPAIR",
    "в ремонте": "REPAIR",
    written_off: "WRITTEN_OFF",
    writtenoff: "WRITTEN_OFF",
    "списано": "WRITTEN_OFF",
}

export default function EquipmentInventory() {
    const { clubId } = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()

    const [equipment, setEquipment] = useState<Equipment[]>([])
    const [types, setTypes] = useState<EquipmentType[]>([])
    const [workstations, setWorkstations] = useState<Workstation[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [isImportExportDialogOpen, setIsImportExportDialogOpen] = useState(false)
    const importInputRef = useRef<HTMLInputElement | null>(null)

    // Pagination (by places)
    const [page, setPage] = useState(1)
    const placesPerPage = 20
    const fetchLimit = 5000

    // Stats state
    const [inventoryStats, setInventoryStats] = useState({
        total: 0,
        storage: 0,
        overdue_tasks: 0,
        active_issues: 0
    })

    // Filters
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [typeFilter, setTypeFilter] = useState("all")
    const [zoneFilter, setZoneFilter] = useState("all")
    const [workstationFilter, setWorkstationFilter] = useState("all")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const isGrouped = true

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Grouping & Expansion
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingEquipment, setEditingEquipment] = useState<Partial<Equipment> | null>(null)

    const maintenanceResponsibleEmployees = useMemo(
        () => employees.filter(emp =>
            (emp.role === "Админ" || emp.role === "Управляющий") &&
            emp.is_active !== false &&
            !emp.dismissed_at
        ),
        [employees]
    )

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
            setPage(1) // Reset to first page on search
        }, 500)
        return () => clearTimeout(timer)
    }, [search])


    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const params = new URLSearchParams({
                include_inactive: 'true',
                limit: fetchLimit.toString(),
                offset: "0"
            })

            if (debouncedSearch) params.append('search', debouncedSearch)
            if (typeFilter !== 'all') params.append('type', typeFilter)
            if (workstationFilter !== 'all') params.append('workstation_id', workstationFilter)
            if (statusFilter !== 'all') params.append('status', statusFilter)

            const [eqRes, typeRes, wsRes, statsRes, empRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/equipment?${params.toString()}`, { cache: 'no-store' }),
                fetch(`/api/equipment-types?clubId=${clubId}`, { cache: 'no-store' }),
                fetch(`/api/clubs/${clubId}/workstations`, { cache: 'no-store' }),
                fetch(`/api/clubs/${clubId}/equipment/stats`, { cache: 'no-store' }),
                fetch(`/api/clubs/${clubId}/employees`, { cache: 'no-store' })
            ])

            const eqData = await eqRes.json()
            const typeData = await typeRes.json()
            const wsData = await wsRes.json()
            const statsData = await statsRes.json()
            const empData = await empRes.json()

            if (eqRes.ok) {
                const enriched = (eqData.equipment || []).map((e: any) => ({
                    ...e,
                    maintenance_enabled: e.maintenance_enabled !== false
                }))
                setEquipment(enriched)
            }
            if (typeRes.ok) setTypes(typeData || [])
            if (wsRes.ok) setWorkstations(wsData || [])
            if (empRes.ok) setEmployees(empData.employees || [])
            if (statsRes.ok) {
                setInventoryStats({
                    total: statsData.total || 0,
                    storage: statsData.storage || 0,
                    overdue_tasks: statsData.overdue_tasks || 0,
                    active_issues: statsData.active_issues || 0
                })
            }

        } catch (error) {
            console.error("Error fetching inventory data:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId, fetchLimit, debouncedSearch, typeFilter, workstationFilter, statusFilter])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            handleCreate()
        }
    }, [searchParams])

    // Reset page when filters change
    const handleFilterChange = (setter: (val: string) => void) => (val: string) => {
        setter(val)
        setPage(1)
    }

    const zones = useMemo(() => {
        return Array.from(new Set(workstations.map(w => w.zone).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"))
    }, [workstations])
    const hasImportLocations = workstations.length > 0 && zones.length > 0

    const filteredWorkstations = useMemo(() => {
        if (zoneFilter === "all") return workstations
        return workstations.filter(w => w.zone === zoneFilter)
    }, [workstations, zoneFilter])

    useEffect(() => {
        if (workstationFilter === "all" || workstationFilter === "unassigned") return
        const ws = workstations.find(w => w.id === workstationFilter)
        if (!ws) return
        if (zoneFilter !== "all" && ws.zone !== zoneFilter) setWorkstationFilter("all")
    }, [zoneFilter, workstationFilter, workstations])

    useEffect(() => {
        if (workstationFilter !== "all" && workstationFilter !== "unassigned") {
            setExpandedGroups(new Set([workstationFilter]))
        } else if (workstationFilter === "unassigned") {
            setExpandedGroups(new Set(["unassigned"]))
        } else {
            setExpandedGroups(new Set())
        }
    }, [workstationFilter])

    const filteredEquipment = useMemo(() => {
        if (zoneFilter === "all") return equipment
        return equipment.filter(e => e.workstation_zone === zoneFilter)
    }, [equipment, zoneFilter])

    const groupedEquipment = useMemo(() => {
        const groups: Record<string, { name: string, zone?: string, items: Equipment[] }> = {
            'unassigned': { name: 'Склад (Не назначено)', items: [] }
        }

        // Initialize groups for all workstations
        workstations.forEach(ws => {
            groups[ws.id] = { name: ws.name, zone: ws.zone, items: [] }
        })

        // Distribute equipment into groups
        filteredEquipment.forEach(item => {
            const groupId = item.workstation_id || 'unassigned'
            if (!groups[groupId]) {
                groups[groupId] = { 
                    name: item.workstation_name || 'Неизвестная локация', 
                    zone: item.workstation_zone || undefined,
                    items: [] 
                }
            }
            groups[groupId].items.push(item)
        })

        // Filter out empty workstation groups, but keep unassigned if it has items or if we are filtering
        return Object.entries(groups)
            .filter(([, group]) => group.items.length > 0)
            .sort(([idA, groupA], [idB, groupB]) => {
                if (idA === 'unassigned') return -1
                if (idB === 'unassigned') return 1
                return groupA.name.localeCompare(groupB.name, "ru")
            })
    }, [filteredEquipment, workstations])

    const totalPlaces = groupedEquipment.length
    const totalPlacePages = Math.max(1, Math.ceil(totalPlaces / placesPerPage))

    useEffect(() => {
        if (page > totalPlacePages) setPage(totalPlacePages)
    }, [page, totalPlacePages])

    const pagedGroupedEquipment = useMemo(() => {
        const start = (page - 1) * placesPerPage
        return groupedEquipment.slice(start, start + placesPerPage)
    }, [groupedEquipment, page, placesPerPage])

    const toggleGroup = (groupId: string) => {
        const newSet = new Set(expandedGroups)
        if (newSet.has(groupId)) newSet.delete(groupId)
        else newSet.add(groupId)
        setExpandedGroups(newSet)
    }

    const toggleGroupSelection = (_groupId: string, items: Equipment[]) => {
        const allSelected = items.every(item => selectedIds.has(item.id))
        const newSet = new Set(selectedIds)
        if (allSelected) {
            items.forEach(item => newSet.delete(item.id))
        } else {
            items.forEach(item => newSet.add(item.id))
        }
        setSelectedIds(newSet)
    }

    // --- Actions ---

    const handleCreate = () => {
        setEditingEquipment({
            type: 'PC',
            name: '',
            is_active: true,
            status: 'STORAGE'
        })
        setIsDialogOpen(true)
    }

    const handleEdit = (item: Equipment) => {
        router.push(`/clubs/${clubId}/equipment/${item.id}`)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingEquipment?.name || !editingEquipment?.type) return

        setIsSaving(true)
        try {
            const isNew = !editingEquipment.id
            const url = isNew
                ? `/api/clubs/${clubId}/equipment`
                : `/api/clubs/${clubId}/equipment/${editingEquipment.id}`

            const res = await fetch(url, {
                method: isNew ? "POST" : "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingEquipment)
            })

            if (res.ok) {
                setIsDialogOpen(false)
                fetchData()
            }
        } catch (error) {
            console.error("Error saving equipment:", error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleSelectAll = () => {
        if (selectedIds.size === filteredEquipment.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredEquipment.map(e => e.id)))
        }
    }

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    const handleExport = () => {
        const rows = filteredEquipment.map(item => ({
            ID: item.id,
            "Название": item.name,
            "Тип код": item.type,
            "Тип": item.type_name || item.type,
            "Серийный номер": item.identifier || "",
            "Бренд": item.brand || "",
            "Модель": item.model || "",
            "Зона": item.workstation_zone || "",
            "Место": item.workstation_name || "",
            "Статус": item.status,
            "Дата покупки": item.purchase_date || "",
            "Гарантия до": item.warranty_expires || "",
            "Интервал чистки (дней)": item.cleaning_interval_days ?? "",
            "Обслуживание включено": item.maintenance_enabled === false ? "Нет" : "Да",
            "Примечание": item.notes || "",
        }))

        const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...INVENTORY_IMPORT_COLUMNS] })
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Инвентарь")
        XLSX.writeFile(workbook, `inventory_export_${formatLocalDate(new Date())}.xlsx`)
    }

    const handleDownloadTemplate = () => {
        const worksheet = XLSX.utils.json_to_sheet([INVENTORY_TEMPLATE_EXAMPLE], { header: [...INVENTORY_IMPORT_COLUMNS] })
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Шаблон")
        XLSX.writeFile(workbook, "inventory_import_template.xlsx")
    }

    const parseImportStatus = (value: unknown): EquipmentStatus => {
        const normalized = String(value || "").trim().toLowerCase()
        return INVENTORY_STATUS_IMPORT_MAP[normalized] || "STORAGE"
    }

    const parseImportBoolean = (value: unknown) => {
        const normalized = String(value || "").trim().toLowerCase()
        if (!normalized) return true
        return !["нет", "false", "0", "off", "disabled"].includes(normalized)
    }

    const normalizeImportDate = (value: unknown) => {
        const raw = String(value || "").trim()
        if (!raw) return null

        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

        const parsed = new Date(raw)
        if (Number.isNaN(parsed.getTime())) return null

        const year = parsed.getFullYear()
        const month = String(parsed.getMonth() + 1).padStart(2, "0")
        const day = String(parsed.getDate()).padStart(2, "0")
        return `${year}-${month}-${day}`
    }

    const handleImportClick = () => {
        if (!hasImportLocations) {
            alert("Перед импортом сначала создайте зоны и места в разделе рабочих мест")
            return
        }
        importInputRef.current?.click()
    }

    const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setIsImporting(true)
        try {
            const buffer = await file.arrayBuffer()
            const workbook = XLSX.read(buffer, { type: "array" })
            const sheet = workbook.Sheets[workbook.SheetNames[0]]
            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })

            if (rows.length === 0) {
                alert("Файл пустой")
                return
            }

            const typeByCode = new Map(types.map(type => [type.code.trim().toLowerCase(), type.code]))
            const typeByName = new Map(types.map(type => [type.name_ru.trim().toLowerCase(), type.code]))
            const workstationByKey = new Map<string, string>()
            const workstationByName = new Map<string, string>()

            workstations.forEach(workstation => {
                workstationByName.set(workstation.name.trim().toLowerCase(), workstation.id)
                workstationByKey.set(`${(workstation.zone || "").trim().toLowerCase()}::${workstation.name.trim().toLowerCase()}`, workstation.id)
            })

            const existingById = new Map(equipment.map(item => [item.id, item]))
            const existingByIdentifier = new Map(
                equipment
                    .filter(item => item.identifier)
                    .map(item => [String(item.identifier).trim().toLowerCase(), item])
            )

            let created = 0
            let updated = 0
            let skipped = 0
            const errors: string[] = []

            for (const [index, row] of rows.entries()) {
                const rowNumber = index + 2
                const name = String(row["Название"] || "").trim()
                const rawTypeCode = String(row["Тип код"] || "").trim().toLowerCase()
                const rawTypeName = String(row["Тип"] || "").trim().toLowerCase()
                const identifier = String(row["Серийный номер"] || "").trim()
                const importId = String(row["ID"] || "").trim()
                const zone = String(row["Зона"] || "").trim()
                const workstationName = String(row["Место"] || "").trim()

                if (!name) {
                    skipped += 1
                    continue
                }

                const resolvedType =
                    typeByCode.get(rawTypeCode) ||
                    typeByName.get(rawTypeName)

                if (!resolvedType) {
                    errors.push(`Строка ${rowNumber}: неизвестный тип "${row["Тип код"] || row["Тип"]}"`)
                    continue
                }

                let workstationId: string | null | undefined = undefined
                if (workstationName) {
                    workstationId =
                        workstationByKey.get(`${zone.toLowerCase()}::${workstationName.toLowerCase()}`) ||
                        workstationByName.get(workstationName.toLowerCase()) ||
                        null

                    if (!workstationId) {
                        errors.push(`Строка ${rowNumber}: место "${workstationName}" не найдено`)
                        continue
                    }
                } else {
                    workstationId = null
                }

                const payload = {
                    workstation_id: workstationId,
                    type: resolvedType,
                    name,
                    identifier: identifier || null,
                    brand: String(row["Бренд"] || "").trim() || null,
                    model: String(row["Модель"] || "").trim() || null,
                    purchase_date: normalizeImportDate(row["Дата покупки"]),
                    warranty_expires: normalizeImportDate(row["Гарантия до"]),
                    cleaning_interval_days: Number(row["Интервал чистки (дней)"] || 0) || undefined,
                    maintenance_enabled: parseImportBoolean(row["Обслуживание включено"]),
                    notes: String(row["Примечание"] || "").trim() || null,
                    status: parseImportStatus(row["Статус"]),
                }

                const existing =
                    (importId ? existingById.get(importId) : undefined) ||
                    (identifier ? existingByIdentifier.get(identifier.toLowerCase()) : undefined)

                const endpoint = existing
                    ? `/api/clubs/${clubId}/equipment/${existing.id}`
                    : `/api/clubs/${clubId}/equipment`

                const method = existing ? "PATCH" : "POST"
                const response = await fetch(endpoint, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                })

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}))
                    errors.push(`Строка ${rowNumber}: ${errorData.error || "не удалось сохранить запись"}`)
                    continue
                }

                const persistedEquipment = await response.json().catch(() => null)

                if (!existing && persistedEquipment?.id) {
                    const patchResponse = await fetch(`/api/clubs/${clubId}/equipment/${persistedEquipment.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            cleaning_interval_days: payload.cleaning_interval_days,
                            maintenance_enabled: payload.maintenance_enabled,
                        }),
                    })

                    if (!patchResponse.ok) {
                        const patchError = await patchResponse.json().catch(() => ({}))
                        errors.push(`Строка ${rowNumber}: запись создана, но доп. поля не обновлены (${patchError.error || "PATCH error"})`)
                    }
                }

                if (existing) {
                    updated += 1
                } else {
                    created += 1
                }
            }

            await fetchData()

            const summary = [
                `Импорт завершен`,
                `Создано: ${created}`,
                `Обновлено: ${updated}`,
                `Пропущено пустых строк: ${skipped}`,
            ]

            if (errors.length > 0) {
                summary.push(`Ошибки: ${errors.length}`)
                summary.push("")
                summary.push(errors.slice(0, 10).join("\n"))
            }

            alert(summary.join("\n"))
        } catch (error) {
            console.error("Import equipment error:", error)
            alert("Не удалось импортировать файл")
        } finally {
            event.target.value = ""
            setIsImporting(false)
        }
    }

    const handleBulkRepair = async () => {
        if (selectedIds.size === 0) return
        if (!confirm(`Отправить в ремонт ${selectedIds.size} поз.?`)) return
        
        setIsSaving(true)
        try {
            // Logic for bulk repair (e.g., creating issues or changing status)
            // For now, let's just show an alert since we don't have a bulk API yet
            alert("Функция группового ремонта будет доступна в следующем обновлении")
        } finally {
            setIsSaving(false)
        }
    }

    const handleBulkArchive = async () => {
        if (selectedIds.size === 0) return
        if (!confirm(`Списать ${selectedIds.size} поз.?`)) return
        
        setIsSaving(true)
        try {
            const ids = Array.from(selectedIds)
            await Promise.all(ids.map(id => 
                fetch(`/api/clubs/${clubId}/equipment/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "WRITTEN_OFF" })
                })
            ))
            setSelectedIds(new Set())
            fetchData()
        } catch (error) {
            console.error("Bulk archive error:", error)
        } finally {
            setIsSaving(false)
        }
    }

    // --- Render Helpers ---

    const getStatusBadge = (item: Equipment) => {
        if (item.status === "WRITTEN_OFF") {
            return <Badge variant="secondary" className="bg-slate-100 text-slate-500">Списано</Badge>
        }
        if (item.status === "REPAIR") {
            return <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">В ремонте</Badge>
        }
        if (item.status === "STORAGE") {
            return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">На складе</Badge>
        }
        return <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 shadow-none border-none">В эксплуатации</Badge>
    }

    const getEquipmentIcon = (type: string, typeIcon?: string | null) => renderEquipmentIcon(type, typeIcon, "h-5 w-5")

    const isCleaningOverdue = (item: Equipment) => {
        if (item.maintenance_enabled === false) return false
        if (!item.last_cleaned_at) return false

        const last = new Date(item.last_cleaned_at)
        if (Number.isNaN(last.valueOf())) return false

        const due = new Date(last)
        due.setHours(0, 0, 0, 0)
        due.setDate(due.getDate() + (item.cleaning_interval_days ?? 30))

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return due < today
    }

    const handleEquipmentRowClick = (event: MouseEvent<HTMLElement>, item: Equipment) => {
        const target = event.target as HTMLElement
        if (target.closest("button") || target.closest("input") || target.closest("a") || target.closest("label")) return
        handleEdit(item)
    }

    const renderWarrantyInfo = (item: Equipment, compact = false) => {
        if (!item.warranty_expires) {
            return <span className="text-xs text-muted-foreground">—</span>
        }

        return (
            <div className="flex flex-col gap-1">
                <span className={cn(
                    compact ? "text-[11px] font-medium" : "text-xs font-medium",
                    item.warranty_status === 'EXPIRED' ? "text-rose-600" :
                    item.warranty_status === 'EXPIRING_SOON' ? "text-amber-600" : "text-slate-600"
                )}>
                    {new Date(item.warranty_expires).toLocaleDateString("ru-RU")}
                </span>
                {item.warranty_status === 'EXPIRED' && (
                    <span className={cn(
                        compact ? "text-[9px] font-bold uppercase tracking-wide text-rose-600" : "text-[9px] text-rose-600 font-bold uppercase tracking-wide"
                    )}>
                        Истекла
                    </span>
                )}
            </div>
        )
    }

    // --- Stats calculation removed (now from server) ---

    return (
        <div className="mx-auto max-w-[1600px] space-y-5 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:p-6 sm:pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-8 lg:p-8">
            {/* Header & Breadcrumbs */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Инвентаризация</h1>
                        <p className="mt-1 text-sm text-muted-foreground sm:text-base">База данных оборудования и периферии</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                        <Button asChild variant="outline" className="hidden w-full md:inline-flex md:w-auto">
                            <Link href={`/clubs/${clubId}/equipment`}>
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Назад
                            </Link>
                        </Button>
                        <input
                            ref={importInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={handleImportFile}
                        />
                        <Button variant="outline" onClick={() => setIsImportExportDialogOpen(true)} className="w-full sm:w-auto">
                            <Download className="mr-2 h-4 w-4" /> Импорт / Экспорт
                        </Button>
                        <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 sm:w-auto">
                            <Plus className="mr-2 h-4 w-4" />
                            Добавить оборудование
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-6">

            {/* Dashboard Stats (New) */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="shadow-sm border-none bg-white">
                    <CardContent className="flex items-center justify-between p-4 sm:p-6">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Всего единиц</p>
                            <h3 className="text-2xl font-bold mt-1">{inventoryStats.total}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <Box className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-none bg-white">
                    <CardContent className="flex items-center justify-between p-4 sm:p-6">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">На складе</p>
                            <h3 className="text-2xl font-bold mt-1 text-amber-600">{inventoryStats.storage}</h3>
                        </div>
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                            <Archive className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-none bg-white">
                    <CardContent className="flex items-center justify-between p-4 sm:p-6">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Просрочена чистка</p>
                            <h3 className="text-2xl font-bold mt-1 text-rose-600">{inventoryStats.overdue_tasks}</h3>
                        </div>
                        <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                            <Clock3 className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-none bg-white">
                    <CardContent className="flex items-center justify-between p-4 sm:p-6">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">С проблемами</p>
                            <h3 className="text-2xl font-bold mt-1 text-orange-600">{inventoryStats.active_issues}</h3>
                        </div>
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                            <AlertCircle className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Advanced Filters Bar */}
            <div className="flex flex-col gap-4 bg-white p-4 rounded-xl shadow-sm border">
                <div className="flex flex-col gap-4">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Поиск по названию, серийному номеру..."
                            className="pl-9 bg-slate-50 border-slate-200"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,160px))_auto] xl:items-center">
                        <Select value={typeFilter} onValueChange={handleFilterChange(setTypeFilter)}>
                            <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Тип оборудования" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Все типы</SelectItem>
                                {types.map(t => (
                                    <SelectItem key={t.code} value={t.code}>{t.name_ru}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={zoneFilter} onValueChange={handleFilterChange(setZoneFilter)}>
                            <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Зона" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Все зоны</SelectItem>
                                {zones.map(z => (
                                    <SelectItem key={z} value={z}>{z}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={workstationFilter} onValueChange={handleFilterChange(setWorkstationFilter)}>
                            <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Место" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Все локации</SelectItem>
                                <SelectItem value="unassigned">Склад (Не назначено)</SelectItem>
                                {filteredWorkstations.map(w => (
                                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
                            <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Статус" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Любой статус</SelectItem>
                                <SelectItem value="ACTIVE">В эксплуатации</SelectItem>
                                <SelectItem value="STORAGE">На складе</SelectItem>
                                <SelectItem value="REPAIR">В ремонте</SelectItem>
                                <SelectItem value="WRITTEN_OFF">Списано</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button variant="ghost" className="w-full justify-center xl:w-auto" onClick={() => {
                            setSearch("")
                            setTypeFilter("all")
                            setZoneFilter("all")
                            setWorkstationFilter("all")
                            setStatusFilter("all")
                            setPage(1)
                        }}>
                            <RefreshCw className="mr-2 h-4 w-4 xl:mr-0" />
                            <span className="xl:hidden">Сбросить фильтры</span>
                        </Button>
                    </div>
                </div>
                
                {/* Bulk Actions Bar (Conditional) */}
                {selectedIds.size > 0 && (
                    <div className="animate-in fade-in slide-in-from-top-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <span className="font-medium">Выбрано: {selectedIds.size}</span>
                        <div className="hidden h-4 w-px bg-blue-200 sm:block" />
                        <Button size="sm" variant="ghost" className="justify-start hover:bg-blue-100 hover:text-blue-800 sm:justify-center" onClick={handleBulkRepair}>
                            <Wrench className="h-3.5 w-3.5 mr-2" /> Отправить в ремонт
                        </Button>
                        <Button size="sm" variant="ghost" className="justify-start hover:bg-blue-100 hover:text-blue-800 sm:justify-center" onClick={handleBulkArchive}>
                            <Archive className="h-3.5 w-3.5 mr-2" /> Списать
                        </Button>
                        <Button size="sm" variant="ghost" className="justify-start hover:bg-blue-100 hover:text-blue-800 sm:ml-auto sm:justify-center" onClick={() => setSelectedIds(new Set())}>
                            Снять выделение
                        </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Data Table */}
            <Card className="border-none shadow-sm overflow-hidden">
                <div className="space-y-3 p-3 md:hidden">
                    {isLoading ? (
                        <div className="flex h-40 flex-col items-center justify-center text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="mt-2 text-sm text-muted-foreground">Загрузка реестра...</p>
                        </div>
                    ) : (isGrouped && pagedGroupedEquipment.length > 0) ? (
                        pagedGroupedEquipment.map(([groupId, group]) => {
                            const isExpanded = expandedGroups.has(groupId)
                            const allGroupSelected = group.items.every(item => selectedIds.has(item.id))
                            const someGroupSelected = group.items.some(item => selectedIds.has(item.id)) && !allGroupSelected
                            const issuesCount = group.items.reduce((sum, item) => sum + (item.open_issues_count || 0), 0)
                            const maintenanceOffCount = group.items.filter(i => i.maintenance_enabled === false).length
                            const overdueCount = group.items.filter(i => isCleaningOverdue(i)).length

                            return (
                                <div key={groupId} className="overflow-hidden rounded-xl border bg-white">
                                    <div className="flex items-start gap-3 p-4" onClick={() => toggleGroup(groupId)}>
                                        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className={cn("rounded border-gray-300", someGroupSelected && "opacity-50")}
                                                checked={allGroupSelected}
                                                onChange={() => toggleGroupSelection(groupId, group.items)}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                {groupId === "unassigned" ? (
                                                    <Box className="h-4 w-4 shrink-0 text-amber-600" />
                                                ) : (
                                                    <LayoutGrid className="h-4 w-4 shrink-0 text-indigo-600" />
                                                )}
                                                <p className="truncate font-semibold text-slate-900">{group.name}</p>
                                                <Badge className="border-none bg-indigo-600 text-[10px] text-white">{group.items.length}</Badge>
                                            </div>
                                            {group.zone && <p className="mt-1 text-xs text-muted-foreground">{group.zone}</p>}
                                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                                <span className={cn(issuesCount > 0 ? "text-orange-700" : "text-slate-400")}>Проблемы {issuesCount}</span>
                                                <span className={cn(maintenanceOffCount > 0 ? "text-slate-700" : "text-slate-400")}>Откл. обслуж {maintenanceOffCount}</span>
                                                <span className={cn(overdueCount > 0 ? "text-amber-700" : "text-slate-400")}>Просроч. {overdueCount}</span>
                                            </div>
                                        </div>
                                        <div className="pt-1 text-slate-400">
                                            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="space-y-3 border-t bg-slate-50/70 p-3">
                                            {group.items.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className={cn(
                                                        "rounded-xl border bg-white p-3 shadow-sm",
                                                        selectedIds.has(item.id) && "border-indigo-200 bg-indigo-50/40",
                                                        !selectedIds.has(item.id) && (item.open_issues_count || 0) > 0 && "border-orange-200"
                                                    )}
                                                    onClick={(event) => handleEquipmentRowClick(event, item)}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="pt-1">
                                                            <input
                                                                type="checkbox"
                                                                className="rounded border-gray-300"
                                                                checked={selectedIds.has(item.id)}
                                                                onChange={() => toggleSelection(item.id)}
                                                            />
                                                        </div>
                                                        <div className={cn(
                                                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-slate-50 text-slate-500",
                                                            (item.open_issues_count || 0) > 0 && "border-orange-200 text-orange-700"
                                                        )}>
                                                            {getEquipmentIcon(item.type, item.type_icon)}
                                                        </div>
                                                        <div className="min-w-0 flex-1 space-y-3">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.type_name || item.type}</p>
                                                                </div>
                                                                {getStatusBadge(item)}
                                                            </div>
                                                            {(item.open_issues_count || 0) > 0 && (
                                                                <Badge className="border-none bg-orange-600 text-[10px] font-black text-white">
                                                                    <AlertCircle className="mr-1 h-3 w-3" />
                                                                    {(item.open_issues_count || 0)} проблем
                                                                </Badge>
                                                            )}
                                                            <div className="grid grid-cols-1 gap-3 text-xs">
                                                                <div>
                                                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Идентификация</p>
                                                                    {item.identifier ? (
                                                                        <code className="mt-1 inline-block rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">{item.identifier}</code>
                                                                    ) : (
                                                                        <p className="mt-1 text-muted-foreground">—</p>
                                                                    )}
                                                                    <p className="mt-1 text-[11px] text-muted-foreground">{item.brand} {item.model}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Расположение</p>
                                                                    {item.workstation_name ? (
                                                                        <div className="mt-1 flex items-center gap-2">
                                                                            <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                                                                            <div className="min-w-0">
                                                                                <p className="truncate font-medium text-slate-700">{item.workstation_name}</p>
                                                                                <p className="text-[10px] text-muted-foreground">{item.workstation_zone}</p>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="mt-1 flex items-center gap-2">
                                                                            <Box className="h-3.5 w-3.5 text-amber-500" />
                                                                            <span className="font-medium text-amber-600">Склад</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Гарантия</p>
                                                                    <div className="mt-1">{renderWarrantyInfo(item, true)}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    ) : filteredEquipment.length === 0 ? (
                        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed text-center text-muted-foreground">
                            <div className="rounded-full bg-slate-100 p-4">
                                <Search className="h-8 w-8 opacity-20" />
                            </div>
                            <p className="mt-3 text-base font-semibold">Ничего не найдено</p>
                            <p className="mt-1 max-w-xs text-sm">Попробуйте изменить параметры фильтрации или добавить новое оборудование</p>
                        </div>
                    ) : null}
                </div>

                <div className="hidden overflow-x-auto md:block">
                    <Table>
                        {!isGrouped && (
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[40px]">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-gray-300"
                                            checked={selectedIds.size === filteredEquipment.length && filteredEquipment.length > 0}
                                            onChange={handleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead className="w-[300px]">Оборудование</TableHead>
                                    <TableHead>Идентификация</TableHead>
                                    <TableHead>Расположение</TableHead>
                                    <TableHead>Состояние</TableHead>
                                    <TableHead>Гарантия</TableHead>
                                </TableRow>
                            </TableHeader>
                        )}
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                                        <p className="text-muted-foreground mt-2">Загрузка реестра...</p>
                                    </TableCell>
                                </TableRow>
                            ) : (isGrouped && groupedEquipment.length > 0) ? (
                                pagedGroupedEquipment.map(([groupId, group]) => {
                                    const isExpanded = expandedGroups.has(groupId)
                                    const allGroupSelected = group.items.every(item => selectedIds.has(item.id))
                                    const someGroupSelected = group.items.some(item => selectedIds.has(item.id)) && !allGroupSelected
                                    const issuesCount = group.items.reduce((sum, item) => sum + (item.open_issues_count || 0), 0)
                                    const maintenanceOffCount = group.items.filter(i => i.maintenance_enabled === false).length
                                    const overdueCount = group.items.filter(i => isCleaningOverdue(i)).length

                                    return (
                                        <Fragment key={groupId}>
                                            {/* Group Header Row */}
                                            <TableRow 
                                                className="bg-slate-100 hover:bg-slate-200 transition-colors border-y-2 border-slate-300 cursor-pointer"
                                                onClick={() => toggleGroup(groupId)}
                                            >
                                                <TableCell className="w-[40px]" onClick={(e) => e.stopPropagation()}>
                                                    <input 
                                                        type="checkbox" 
                                                        className={cn(
                                                            "rounded border-gray-300",
                                                            someGroupSelected && "opacity-50"
                                                        )}
                                                        checked={allGroupSelected}
                                                        onChange={() => toggleGroupSelection(groupId, group.items)}
                                                    />
                                                </TableCell>
                                                <TableCell colSpan={5} className="py-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-slate-500">
                                                                {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {groupId === 'unassigned' ? (
                                                                    <Box className="h-5 w-5 text-amber-600" />
                                                                ) : (
                                                                    <LayoutGrid className="h-5 w-5 text-indigo-600" />
                                                                )}
                                                                <span className="font-black text-sm uppercase tracking-wider text-slate-800">
                                                                    {group.name} 
                                                                    {group.zone && <span className="text-slate-500 font-bold ml-3">| {group.zone}</span>}
                                                                </span>
                                                                <Badge className="ml-3 bg-indigo-600 text-white border-none text-[10px] font-black px-2">
                                                                    {group.items.length}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-4 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                                                            <span className={cn(issuesCount > 0 ? "text-orange-700" : "text-slate-400")}>Проблемы {issuesCount}</span>
                                                            <div className="h-3 w-px bg-slate-300" />
                                                            <span className={cn(maintenanceOffCount > 0 ? "text-slate-700" : "text-slate-400")}>Откл. обслуж {maintenanceOffCount}</span>
                                                            <div className="h-3 w-px bg-slate-300" />
                                                            <span className={cn(overdueCount > 0 ? "text-amber-700" : "text-slate-400")}>Чистка просроч. {overdueCount}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>

                                            {/* Group Items */}
                                            {isExpanded && (
                                                <TableRow className="bg-white border-b border-slate-200">
                                                    <TableCell className="w-[40px]" />
                                                    <TableCell className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-2">Оборудование</TableCell>
                                                    <TableCell className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-2">Идентификация</TableCell>
                                                    <TableCell className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-2">Расположение</TableCell>
                                                    <TableCell className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-2">Состояние</TableCell>
                                                    <TableCell className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-2">Гарантия</TableCell>
                                                </TableRow>
                                            )}
                                            {isExpanded && group.items.map((item) => (
                                                <TableRow 
                                                    key={item.id} 
                                                    className={cn(
                                                        "group hover:bg-slate-50 transition-colors cursor-pointer border-l-4 border-l-transparent",
                                                        selectedIds.has(item.id) && "bg-indigo-50/50 hover:bg-indigo-50 border-l-indigo-600",
                                                        !selectedIds.has(item.id) && (item.open_issues_count || 0) > 0 && "bg-orange-50/40 hover:bg-orange-50/60 border-l-orange-500"
                                                    )}
                                                    onClick={(event) => handleEquipmentRowClick(event, item)}
                                                >
                                                    <TableCell className="pl-6">
                                                        <input 
                                                            type="checkbox" 
                                                            className="rounded border-gray-300"
                                                            checked={selectedIds.has(item.id)}
                                                            onChange={() => toggleSelection(item.id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "h-10 w-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:shadow-md transition-all border border-slate-100",
                                                                (item.open_issues_count || 0) > 0 ? "text-orange-700 border-orange-200 group-hover:border-orange-300" : "group-hover:text-indigo-600 group-hover:border-indigo-100"
                                                            )}>
                                                                {getEquipmentIcon(item.type, item.type_icon)}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-bold text-sm text-slate-800">{item.name}</p>
                                                                    {(item.open_issues_count || 0) > 0 && (
                                                                        <Badge className="bg-orange-600 text-white border-none text-[10px] font-black px-2 py-0">
                                                                            <AlertCircle className="h-3 w-3 mr-1" />
                                                                            {(item.open_issues_count || 0)} проблем
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">{item.type_name || item.type}</p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-1">
                                                            {item.identifier ? (
                                                                <code className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-lg text-slate-700 font-mono border border-slate-200 font-bold">{item.identifier}</code>
                                                            ) : <span className="text-xs text-muted-foreground">—</span>}
                                                            <p className="text-[10px] text-slate-400 font-medium tracking-tight">{item.brand} {item.model}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-600">{group.name}</span>
                                                            {group.zone && <span className="text-[10px] text-slate-400 font-medium">{group.zone}</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {getStatusBadge(item)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {renderWarrantyInfo(item)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </Fragment>
                                    )
                                })
                            ) : filteredEquipment.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="p-4 bg-slate-100 rounded-full">
                                                <Search className="h-8 w-8 opacity-20" />
                                            </div>
                                            <p className="font-semibold text-lg">Ничего не найдено</p>
                                            <p className="text-sm max-w-xs mx-auto">Попробуйте изменить параметры фильтрации или добавить новое оборудование</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredEquipment.map((item) => (
                                    <TableRow 
                                        key={item.id} 
                                        className={cn(
                                            "group hover:bg-slate-50/80 transition-colors cursor-pointer",
                                            selectedIds.has(item.id) && "bg-blue-50/50 hover:bg-blue-50/80"
                                        )}
                                        onClick={(event) => handleEquipmentRowClick(event, item)}
                                    >
                                        <TableCell>
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300"
                                                checked={selectedIds.has(item.id)}
                                                onChange={() => toggleSelection(item.id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-200">
                                                    {getEquipmentIcon(item.type, item.type_icon)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm">{item.name}</p>
                                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-slate-100 text-slate-500">{item.type_name || item.type}</Badge>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                {item.identifier ? (
                                                    <code className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono border border-slate-200">{item.identifier}</code>
                                                ) : <span className="text-xs text-muted-foreground">—</span>}
                                                <p className="text-[11px] text-muted-foreground">{item.brand} {item.model}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {item.workstation_name ? (
                                                <div className="flex items-center gap-2">
                                                    <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-medium">{item.workstation_name}</span>
                                                        <span className="text-[10px] text-muted-foreground">{item.workstation_zone}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Box className="h-3.5 w-3.5 text-amber-500" />
                                                    <span className="text-xs text-amber-600 font-medium">Склад</span>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(item)}
                                        </TableCell>
                                        <TableCell>
                                            {renderWarrantyInfo(item)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                
                {/* Pagination Controls */}
                {!isLoading && totalPlaces > 0 && (
                    <div className="flex flex-col gap-3 border-t bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <p className="text-xs text-muted-foreground">
                            Показано <span className="font-medium">{Math.min(totalPlaces, (page - 1) * placesPerPage + 1)}</span> - <span className="font-medium">{Math.min(totalPlaces, page * placesPerPage)}</span> из <span className="font-medium">{totalPlaces}</span> мест
                        </p>
                        <div className="flex items-center justify-between gap-2 sm:justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="h-8 bg-white"
                            >
                                Назад
                            </Button>
                            <div className="text-xs text-muted-foreground sm:hidden">
                                {page} / {totalPlacePages}
                            </div>
                            <div className="hidden items-center gap-1 sm:flex">
                                {[...Array(Math.min(5, totalPlacePages))].map((_, i) => {
                                    // Logic for showing pages near current page
                                    let pageNum = page;
                                    if (totalPlacePages <= 5) pageNum = i + 1;
                                    else if (page <= 3) pageNum = i + 1;
                                    else if (page >= totalPlacePages - 2) pageNum = totalPlacePages - 4 + i;
                                    else pageNum = page - 2 + i;

                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={page === pageNum ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setPage(pageNum)}
                                            className="h-8 w-8 p-0 bg-white data-[variant=default]:bg-primary"
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                                {totalPlacePages > 5 && page < totalPlacePages - 2 && (
                                    <>
                                        <span className="text-muted-foreground px-1 text-xs">...</span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(totalPlacePages)}
                                            className="h-8 w-8 p-0 bg-white"
                                        >
                                            {totalPlacePages}
                                        </Button>
                                    </>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPlacePages, p + 1))}
                                disabled={page === totalPlacePages}
                                className="h-8 bg-white"
                            >
                                Вперед
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            </div>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
                <div className="mx-auto flex max-w-7xl gap-2">
                    <Button asChild variant="outline" className="h-11 flex-1">
                        <Link href={`/clubs/${clubId}/equipment`}>
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                </div>
            </div>

            <Dialog open={isImportExportDialogOpen} onOpenChange={setIsImportExportDialogOpen}>
                <DialogContent className="sm:max-w-[640px]">
                    <DialogHeader>
                        <DialogTitle>Импорт и экспорт инвентаря</DialogTitle>
                        <DialogDescription>
                            Загружай шаблон, экспортируй текущую базу и импортируй оборудование из Excel.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 pt-2">
                        <div className="rounded-xl border bg-slate-50 p-4">
                            <div className="flex items-start gap-3">
                                <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                                <div className="space-y-2 text-sm text-slate-600">
                                    <p className="font-medium text-slate-900">Как работает импорт</p>
                                    <p>Сначала создай зоны и места в разделе рабочих мест. Импорт не создаёт локации автоматически.</p>
                                    <p>Если в файле заполнено поле `Место`, оно должно уже существовать в клубе. Иначе строка попадёт в ошибки.</p>
                                </div>
                            </div>
                        </div>

                        {!hasImportLocations ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                                <p className="font-medium">Сначала создай зоны и места</p>
                                <p className="mt-1 text-amber-800">
                                    Сейчас импорт заблокирован, потому что в клубе ещё нет подготовленных зон или рабочих мест.
                                </p>
                                <div className="mt-3">
                                    <Button asChild variant="outline" className="bg-white">
                                        <Link href={`/clubs/${clubId}/equipment/workplaces`}>
                                            Перейти к рабочим местам
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        ) : null}

                        <div className="grid gap-3 sm:grid-cols-3">
                            <button
                                type="button"
                                onClick={handleDownloadTemplate}
                                className="rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
                            >
                                <Download className="h-5 w-5 text-slate-700" />
                                <div className="mt-3 text-sm font-semibold text-slate-900">Скачать шаблон</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Пустой `.xlsx` с колонками и примером строки
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={handleExport}
                                className="rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
                            >
                                <Download className="h-5 w-5 text-slate-700" />
                                <div className="mt-3 text-sm font-semibold text-slate-900">Экспорт XLSX</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Выгрузить текущий инвентарь с основными полями
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={handleImportClick}
                                disabled={!hasImportLocations || isImporting}
                                className={cn(
                                    "rounded-xl border bg-white p-4 text-left shadow-sm transition",
                                    hasImportLocations ? "hover:border-slate-300 hover:shadow-md" : "cursor-not-allowed opacity-60"
                                )}
                            >
                                {isImporting ? (
                                    <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
                                ) : (
                                    <Upload className="h-5 w-5 text-slate-700" />
                                )}
                                <div className="mt-3 text-sm font-semibold text-slate-900">Импорт файла</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Загрузить `.xlsx`, `.xls` или `.csv` и обновить инвентарь
                                </div>
                            </button>
                        </div>

                        <div className="rounded-xl border bg-white p-4">
                            <p className="text-sm font-medium text-slate-900">Поддерживаемые колонки</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {INVENTORY_IMPORT_COLUMNS.join(" • ")}
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsImportExportDialogOpen(false)}>
                            Закрыть
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-[700px] flex-col gap-0 overflow-hidden p-0">
                    <DialogHeader className="border-b bg-slate-50 p-4 pb-2 sm:p-6">
                        <DialogTitle className="text-xl">Новое оборудование</DialogTitle>
                        <DialogDescription>
                            Заполните данные для регистрации нового оборудования
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto bg-white">
                        <form id="eq-form" onSubmit={handleSave} className="space-y-8 p-4 sm:p-6">
                            <section className="space-y-6">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-950">Основные данные</h3>
                                    <p className="text-sm text-muted-foreground">Краткая информация о новом оборудовании.</p>
                                </div>

                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Название <span className="text-rose-500">*</span></Label>
                                        <Input
                                            placeholder="Название модели"
                                            value={editingEquipment?.name || ""}
                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, name: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Тип</Label>
                                        <Select
                                            value={editingEquipment?.type}
                                            onValueChange={(val) => setEditingEquipment(prev => ({ ...prev, type: val }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Выберите тип" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {types.map(t => (
                                                    <SelectItem key={t.code} value={t.code}>{t.name_ru}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Серийный номер / ID</Label>
                                        <Input
                                            placeholder="SN12345678"
                                            value={editingEquipment?.identifier || ""}
                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, identifier: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Бренд</Label>
                                        <Input
                                            placeholder="Напр: ASUS, Logitech"
                                            value={editingEquipment?.brand || ""}
                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, brand: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Модель</Label>
                                        <Input
                                            placeholder="Напр: G502 Hero"
                                            value={editingEquipment?.model || ""}
                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, model: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Локация (Рабочее место)</Label>
                                        <Select
                                            value={editingEquipment?.workstation_id || "unassigned"}
                                            onValueChange={(val) => setEditingEquipment(prev => ({ ...prev, workstation_id: val === 'unassigned' ? null : val }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Склад" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned">Склад (Не назначено)</SelectItem>
                                                {workstations.map(w => (
                                                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Статус оборудования</Label>
                                        <Select
                                            value={editingEquipment?.status}
                                            onValueChange={(val: EquipmentStatus) => setEditingEquipment(prev => ({
                                                ...prev,
                                                status: val,
                                                is_active: val !== "WRITTEN_OFF",
                                            }))}
                                        >
                                            <SelectTrigger className="bg-slate-50">
                                                <SelectValue placeholder="Выберите статус" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ACTIVE">{EQUIPMENT_STATUS_LABELS.ACTIVE}</SelectItem>
                                                <SelectItem value="STORAGE">{EQUIPMENT_STATUS_LABELS.STORAGE}</SelectItem>
                                                <SelectItem value="REPAIR">{EQUIPMENT_STATUS_LABELS.REPAIR}</SelectItem>
                                                <SelectItem value="WRITTEN_OFF">{EQUIPMENT_STATUS_LABELS.WRITTEN_OFF}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <Separator />

                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Дата покупки</Label>
                                        <Input
                                            type="date"
                                            value={editingEquipment?.purchase_date || ""}
                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, purchase_date: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Срок гарантии до</Label>
                                        <Input
                                            type="date"
                                            value={editingEquipment?.warranty_expires || ""}
                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, warranty_expires: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Цена (₽)</Label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            value={editingEquipment?.price || ""}
                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, price: Number(e.target.value) }))}
                                        />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Заметки / Примечания</Label>
                                        <Textarea
                                            placeholder="Любая дополнительная информация..."
                                            className="resize-none"
                                            value={editingEquipment?.notes || ""}
                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, notes: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-6">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-950">Обслуживание</h3>
                                    <p className="text-sm text-muted-foreground">Первичная настройка обслуживания для нового оборудования.</p>
                                </div>

                                <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                                    <Info className="h-5 w-5 shrink-0 text-blue-500" />
                                    <div className="text-sm text-blue-700">
                                        <p className="font-semibold">Настройка обслуживания</p>
                                        <ul className="mt-1 ml-4 list-disc space-y-1 opacity-80">
                                            <li>Если ответственный не назначен, задачи на чистку создаваться не будут.</li>
                                            <li>Назначьте конкретного сотрудника или выберите свободный пул.</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base font-bold">Обслуживание</Label>
                                            <p className="text-xs text-muted-foreground">Включает напоминания о необходимости чистки</p>
                                        </div>
                                        <Switch
                                            checked={editingEquipment?.maintenance_enabled}
                                            onCheckedChange={(val) => setEditingEquipment(prev => ({
                                                ...prev,
                                                maintenance_enabled: val,
                                                assigned_user_id: val ? prev?.assigned_user_id : null
                                            }))}
                                        />
                                    </div>

                                    {editingEquipment?.maintenance_enabled && (
                                        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                            <div className="space-y-2">
                                                <Label>Ответственный за обслуживание</Label>
                                                <Select
                                                    value={editingEquipment?.assigned_user_id ? editingEquipment.assigned_user_id : (editingEquipment?.maintenance_enabled ? "free_pool" : "none")}
                                                    onValueChange={(val) => {
                                                        if (val === "free_pool") {
                                                            setEditingEquipment(prev => ({
                                                                ...prev,
                                                                assigned_user_id: null,
                                                                maintenance_enabled: true
                                                            }))
                                                            return
                                                        }
                                                        const userId = val === "none" ? null : val
                                                        setEditingEquipment(prev => ({
                                                            ...prev,
                                                            assigned_user_id: userId,
                                                            maintenance_enabled: !!userId
                                                        }))
                                                    }}
                                                >
                                                    <SelectTrigger className="bg-white">
                                                        <SelectValue placeholder="Не назначено" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Не назначено</SelectItem>
                                                        <SelectItem value="free_pool">🤝 Свободный пул</SelectItem>
                                                        {maintenanceResponsibleEmployees.map(emp => (
                                                            <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-[10px] italic text-muted-foreground">
                                                    При выборе сотрудника обслуживание включается автоматически.
                                                </p>
                                            </div>

                                            <div className="space-y-2 border-t border-slate-200/50 pt-2">
                                                <Label>Интервал обслуживания</Label>
                                                <div className="rounded-xl border bg-white px-4 py-3">
                                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-900">Будет взят из стандарта типа</p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                После сохранения карточки система подставит клубный стандарт для выбранного типа оборудования.
                                                            </p>
                                                        </div>
                                                        <Link
                                                            href={`/clubs/${clubId}/equipment/settings`}
                                                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                                                        >
                                                            Открыть настройки
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </form>
                    </div>

                    <DialogFooter className="flex-col-reverse gap-2 border-t bg-slate-50 p-4 sm:flex-row sm:justify-end sm:p-6">
                        <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Отмена</Button>
                        <Button className="w-full sm:w-auto" form="eq-form" type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Добавить в реестр
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
