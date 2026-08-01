"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CategoriesTab } from "./CategoriesTab"
import { WarehousesTab } from "./WarehousesTab"
import { Category, Warehouse, updateInventorySettings, PriceTagSettings, Product, getEmployees, getMetrics, createSupplier, deleteSupplier, getSuppliers } from "../actions"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useTransition, useState, useEffect, useMemo } from "react"
import { RefreshCw, Plus, Trash2 } from "lucide-react"
import { PriceTagTemplateTab } from "./PriceTagTemplateTab"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { normalizeInventorySettings } from "@/lib/inventory-settings"

interface SettingsTabProps {
    products: Product[]
    categories: Category[]
    warehouses: Warehouse[]
    currentUserId: string
    inventorySettings: {
        employee_allowed_warehouse_ids?: number[],
        employee_default_metric_key?: string,
        blind_inventory_enabled?: boolean,
        supplies_enabled?: boolean,
        stock_enabled?: boolean,
        cashbox_enabled?: boolean,
        employee_stock_operations_enabled?: boolean,
        employee_writeoff_enabled?: boolean,
        employee_transfer_enabled?: boolean,
        report_reconciliation_enabled?: boolean,
        cashbox_warehouse_id?: number | null,
        cashbox_warehouse_ids?: number[],
        handover_warehouse_id?: number | null,
        handover_warehouse_ids?: number[],
        sales_capture_mode?: 'SHIFT',
        inventory_timing?: 'END_SHIFT',
        shift_accountability_mode?: 'DISABLED' | 'WAREHOUSE',
        allow_salary_deduction?: boolean,
        employee_discount_percent?: number,
        employee_discount_overrides?: Record<string, number>,
        allow_cost_price_sale?: boolean,
        price_tag_settings?: PriceTagSettings,
        block_desktop_handover?: boolean
    }
}

export function SettingsTab({ products, categories, warehouses, currentUserId, inventorySettings }: SettingsTabProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const params = useParams()
    const clubId = params.clubId as string
    const [isPending, startTransition] = useTransition()
    const [metrics, setMetrics] = useState<{ key: string, label: string }[]>([])
    const [employees, setEmployees] = useState<{ id: string; full_name: string; role: string }[]>([])
    const normalizedSettings = useMemo(() => normalizeInventorySettings(inventorySettings), [inventorySettings])
    const defaultWarehouseId = warehouses.find((warehouse) => warehouse.is_default)?.id ?? warehouses[0]?.id ?? null
    const [suppliers, setSuppliers] = useState<{ id: number, name: string }[]>([])
    const [newSupplierName, setNewSupplierName] = useState("")
    const [isAddingSupplier, startAddingSupplier] = useTransition()
    
    // Local state for discount input to avoid too many DB updates while typing
    const [discountValue, setDiscountValue] = useState(inventorySettings?.employee_discount_percent?.toString() || "0")
    const [employeeDiscountOverrides, setEmployeeDiscountOverrides] = useState<Record<string, string>>({})
    const [newBlockedFrom, setNewBlockedFrom] = useState("")
    const [newBlockedTo, setNewBlockedTo] = useState("")

    const blockedRoutes = normalizedSettings.transfer_blocked_routes || []

    const handleAddBlockedRoute = () => {
        if (!newBlockedFrom || !newBlockedTo || newBlockedFrom === newBlockedTo) return
        const fromId = Number(newBlockedFrom)
        const toId = Number(newBlockedTo)
        if (blockedRoutes.some(r => r.from_id === fromId && r.to_id === toId)) return
        const nextRoutes = [...blockedRoutes, { from_id: fromId, to_id: toId }]
        handleUpdateSetting('transfer_blocked_routes', nextRoutes)
        setNewBlockedFrom("")
        setNewBlockedTo("")
    }

    const handleRemoveBlockedRoute = (fromId: number, toId: number) => {
        const nextRoutes = blockedRoutes.filter(r => !(r.from_id === fromId && r.to_id === toId))
        handleUpdateSetting('transfer_blocked_routes', nextRoutes)
    }

    useEffect(() => {
        setDiscountValue(normalizedSettings?.employee_discount_percent?.toString() || "0")
    }, [normalizedSettings?.employee_discount_percent])

    useEffect(() => {
        const raw = normalizedSettings?.employee_discount_overrides || {}
        const next: Record<string, string> = {}
        for (const [key, value] of Object.entries(raw)) {
            next[key] = String(value)
        }
        setEmployeeDiscountOverrides(next)
    }, [normalizedSettings?.employee_discount_overrides])

    useEffect(() => {
        getMetrics()
            .then(setMetrics)
            .catch(console.error)
    }, [])

    useEffect(() => {
        getSuppliers(clubId).then(setSuppliers).catch(console.error)
    }, [clubId])

    const handleAddSupplier = () => {
        const name = newSupplierName.trim()
        if (!name) return
        startAddingSupplier(async () => {
            await createSupplier(clubId, name)
            setNewSupplierName("")
            const updated = await getSuppliers(clubId)
            setSuppliers(updated)
        })
    }

    const handleDeleteSupplier = (id: number) => {
        startAddingSupplier(async () => {
            await deleteSupplier(clubId, id)
            setSuppliers(prev => prev.filter(s => s.id !== id))
        })
    }

    useEffect(() => {
        if (!normalizedSettings?.allow_salary_deduction) {
            setEmployees([])
            return
        }
        getEmployees(clubId)
            .then(setEmployees)
            .catch(console.error)
    }, [clubId, normalizedSettings?.allow_salary_deduction])

    useEffect(() => {
        if (isPending) return
        if (!normalizedSettings.stock_enabled || !normalizedSettings.report_reconciliation_enabled) return
        if (normalizedSettings.employee_default_metric_key) return
        if (metrics.length === 0) return

        saveSettings({
            ...normalizedSettings,
            employee_default_metric_key: metrics[0].key,
        })
    }, [isPending, metrics, normalizedSettings])

    // Default to categories if on 'settings' or something else
    const currentSubTab = searchParams.get("tab")
    const activeValue = ['categories', 'warehouses', 'general', 'pricetags', 'suppliers'].includes(currentSubTab || '') 
        ? currentSubTab! 
        : 'general'

    const saveSettings = (nextSettings: typeof normalizedSettings) => {
        startTransition(async () => {
            try {
                await updateInventorySettings(clubId, currentUserId, nextSettings)
                router.refresh()
            } catch (err) {
                console.error(err)
            }
        })
    }

    const handleUpdateSetting = (key: string, value: any) => {
        saveSettings({
            ...normalizedSettings,
            [key]: value
        })
    }

    const handleDiscountBlur = () => {
        const val = Number(discountValue)
        if (isNaN(val)) return
        handleUpdateSetting('employee_discount_percent', val)
    }

    const handleEmployeeDiscountBlur = (employeeId: string) => {
        const raw = (employeeDiscountOverrides[employeeId] ?? "").trim()
        const nextOverrides = { ...(normalizedSettings.employee_discount_overrides || {}) }

        if (!raw) {
            if (employeeId in nextOverrides) {
                delete nextOverrides[employeeId]
                handleUpdateSetting('employee_discount_overrides', nextOverrides)
            }
            return
        }

        const val = Number(raw)
        if (Number.isNaN(val)) return
        nextOverrides[employeeId] = Math.min(100, Math.max(0, val))
        handleUpdateSetting('employee_discount_overrides', nextOverrides)
    }

    const handleFeatureToggle = (key: 'supplies_enabled' | 'stock_enabled' | 'cashbox_enabled' | 'report_reconciliation_enabled' | 'shift_accountability_mode', checked: boolean) => {
        const nextSettings = {
            ...normalizedSettings,
            [key]: key === 'shift_accountability_mode' ? (checked ? 'WAREHOUSE' : 'DISABLED') : checked,
        }

        if (key === 'stock_enabled' && !checked) {
            nextSettings.stock_enabled = false
            nextSettings.cashbox_enabled = false
            nextSettings.employee_stock_operations_enabled = false
            nextSettings.employee_writeoff_enabled = false
            nextSettings.employee_transfer_enabled = false
            nextSettings.report_reconciliation_enabled = false
            nextSettings.cashbox_warehouse_id = null
            nextSettings.cashbox_warehouse_ids = []
            nextSettings.shift_accountability_mode = 'DISABLED'
            nextSettings.handover_warehouse_id = null
            nextSettings.handover_warehouse_ids = []
        }

        if (key === 'cashbox_enabled') {
            nextSettings.cashbox_enabled = checked
            if (checked) {
                nextSettings.stock_enabled = true
                const nextCashboxWarehouseIds = (nextSettings.cashbox_warehouse_ids || []).length > 0
                    ? (nextSettings.cashbox_warehouse_ids || [])
                    : (defaultWarehouseId ? [defaultWarehouseId] : [])
                nextSettings.cashbox_warehouse_ids = nextCashboxWarehouseIds
                nextSettings.cashbox_warehouse_id = nextCashboxWarehouseIds[0] ?? null
            } else {
                nextSettings.report_reconciliation_enabled = false
                nextSettings.cashbox_warehouse_id = null
                nextSettings.cashbox_warehouse_ids = []
                nextSettings.shift_accountability_mode = 'DISABLED'
                nextSettings.handover_warehouse_id = null
                nextSettings.handover_warehouse_ids = []
            }
        }

        if (key === 'report_reconciliation_enabled') {
            nextSettings.report_reconciliation_enabled = checked
            if (checked) {
                nextSettings.stock_enabled = true
                nextSettings.cashbox_enabled = true
                const nextCashboxWarehouseIds = (nextSettings.cashbox_warehouse_ids || []).length > 0
                    ? (nextSettings.cashbox_warehouse_ids || [])
                    : (defaultWarehouseId ? [defaultWarehouseId] : [])
                nextSettings.cashbox_warehouse_ids = nextCashboxWarehouseIds
                nextSettings.cashbox_warehouse_id = nextCashboxWarehouseIds[0] ?? null
                nextSettings.employee_default_metric_key = nextSettings.employee_default_metric_key ?? metrics[0]?.key
            }
        }

        if (key === 'shift_accountability_mode') {
            nextSettings.shift_accountability_mode = checked ? 'WAREHOUSE' : 'DISABLED'
            if (checked) {
                nextSettings.stock_enabled = true
                nextSettings.cashbox_enabled = true
                const nextCashboxWarehouseIds = (nextSettings.cashbox_warehouse_ids || []).length > 0
                    ? (nextSettings.cashbox_warehouse_ids || [])
                    : (defaultWarehouseId ? [defaultWarehouseId] : [])
                nextSettings.cashbox_warehouse_ids = nextCashboxWarehouseIds
                nextSettings.cashbox_warehouse_id = nextCashboxWarehouseIds[0] ?? null
                const nextHandoverWarehouseIds = (nextSettings.handover_warehouse_ids || []).length > 0
                    ? (nextSettings.handover_warehouse_ids || [])
                    : nextCashboxWarehouseIds
                nextSettings.handover_warehouse_ids = nextHandoverWarehouseIds
                nextSettings.handover_warehouse_id = nextHandoverWarehouseIds.length === 1
                    ? (nextHandoverWarehouseIds[0] ?? null)
                    : null
            } else {
                nextSettings.handover_warehouse_id = null
                nextSettings.handover_warehouse_ids = []
            }
        }
        saveSettings(nextSettings)
    }

    const handleCashboxWarehouseToggle = (warehouseId: number, checked: boolean) => {
        const currentIds = Array.isArray(normalizedSettings.cashbox_warehouse_ids)
            ? normalizedSettings.cashbox_warehouse_ids
            : []
        const nextIds = checked
            ? Array.from(new Set([...currentIds, warehouseId]))
            : currentIds.filter((id) => Number(id) !== Number(warehouseId))
        const nextPrimary = nextIds[0] ?? null
        const nextSettings = {
            ...normalizedSettings,
            cashbox_warehouse_ids: nextIds,
            cashbox_warehouse_id: nextPrimary,
        }
        if (normalizedSettings.shift_accountability_mode === 'WAREHOUSE') {
            const currentHandoverIds = Array.isArray(normalizedSettings.handover_warehouse_ids)
                ? normalizedSettings.handover_warehouse_ids
                : []
            const nextHandoverIds = currentHandoverIds.filter((id) => nextIds.includes(Number(id)))
            nextSettings.handover_warehouse_ids = nextHandoverIds
            nextSettings.handover_warehouse_id = nextHandoverIds.length === 1 ? (nextHandoverIds[0] ?? null) : null
        }
        saveSettings(nextSettings)
    }

    const handleHandoverWarehouseToggle = (warehouseId: number, checked: boolean) => {
        const currentIds = Array.isArray(normalizedSettings.handover_warehouse_ids)
            ? normalizedSettings.handover_warehouse_ids
            : []
        const nextIds = checked
            ? Array.from(new Set([...currentIds, warehouseId]))
            : currentIds.filter((id) => Number(id) !== Number(warehouseId))
        const nextSettings = {
            ...normalizedSettings,
            handover_warehouse_ids: nextIds,
            handover_warehouse_id: nextIds.length === 1 ? (nextIds[0] ?? null) : null,
        }
        saveSettings(nextSettings)
    }

    const isShiftAccountabilityEnabled = normalizedSettings.shift_accountability_mode === "WAREHOUSE"
    const isStockEnabled = normalizedSettings.stock_enabled
    const isCashboxEnabled = normalizedSettings.cashbox_enabled
    const isSuppliesEnabled = normalizedSettings.supplies_enabled
    return (
        <div className="space-y-4 md:space-y-6">
            <Tabs 
                value={activeValue} 
                onValueChange={(val) => {
                    const url = new URL(window.location.href)
                    url.searchParams.set("tab", val)
                    router.push(url.pathname + url.search, { scroll: false })
                }}
                className="w-full"
            >
                <div className="w-full overflow-x-auto no-scrollbar scrollbar-none mb-4 md:mb-6 pb-0.5">
                    <div className="bg-accent/50 p-1 rounded-lg w-max min-w-full sm:w-fit inline-flex">
                        <TabsList className="bg-transparent border-none h-9 md:h-10 p-0 flex gap-1 w-full">
                            <TabsTrigger 
                                value="general"
                                className="rounded-md px-3 sm:px-4 md:px-8 shrink-0 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all text-muted-foreground font-bold text-xs md:text-sm h-full"
                            >
                                Основные
                            </TabsTrigger>
                            <TabsTrigger 
                                value="categories"
                                className="rounded-md px-3 sm:px-4 md:px-8 shrink-0 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all text-muted-foreground font-bold text-xs md:text-sm h-full"
                            >
                                Категории
                            </TabsTrigger>
                            <TabsTrigger 
                                value="warehouses"
                                className="rounded-md px-3 sm:px-4 md:px-8 shrink-0 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all text-muted-foreground font-bold text-xs md:text-sm h-full"
                            >
                                Склады
                            </TabsTrigger>
                            <TabsTrigger 
                                value="suppliers"
                                className="rounded-md px-3 sm:px-4 md:px-8 shrink-0 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all text-muted-foreground font-bold text-xs md:text-sm h-full"
                            >
                                Поставщики
                            </TabsTrigger>
                            <TabsTrigger 
                                value="pricetags"
                                className="rounded-md px-3 sm:px-4 md:px-8 shrink-0 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all text-muted-foreground font-bold text-xs md:text-sm h-full"
                            >
                                Ценники
                            </TabsTrigger>
                        </TabsList>
                    </div>
                </div>

                <TabsContent value="general" className="mt-0">
                    <div className="space-y-6">
                        {/* Section 1: Режим работы склада */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                                <h4 className="font-bold text-slate-900 text-sm">Режим работы склада</h4>
                                <p className="text-xs text-slate-500 mt-0.5">Включение основных возможностей учета остатков, поставок и списаний.</p>
                            </div>
                            
                            <div className="divide-y divide-slate-100 px-6">
                                {/* Поставки */}
                                <div className="py-4 flex items-center justify-between gap-4">
                                    <div className="space-y-0.5">
                                        <div className="font-semibold text-slate-900 text-sm">Использовать поставки</div>
                                        <div className="text-xs text-slate-500">Нужно для закупок, поставщиков и себестоимости.</div>
                                    </div>
                                    <Switch
                                        checked={isSuppliesEnabled}
                                        onCheckedChange={(checked) => handleFeatureToggle('supplies_enabled', checked)}
                                        disabled={isPending}
                                    />
                                </div>

                                {/* Остатки */}
                                <div className="py-4 flex items-center justify-between gap-4">
                                    <div className="space-y-0.5">
                                        <div className="font-semibold text-slate-900 text-sm">Вести остатки по складам</div>
                                        <div className="text-xs text-slate-500">Включает склады, движения, списания, перемещения, ревизии и аналитику.</div>
                                    </div>
                                    <Switch
                                        checked={isStockEnabled}
                                        onCheckedChange={(checked) => handleFeatureToggle('stock_enabled', checked)}
                                        disabled={isPending}
                                    />
                                </div>

                                {/* Списания сотруднику */}
                                {isStockEnabled && (
                                    <div className="py-4 flex items-center justify-between gap-4">
                                        <div className="space-y-0.5">
                                            <div className="font-semibold text-slate-900 text-sm">Разрешать списание сотруднику</div>
                                            <div className="text-xs text-slate-500">Показывает сотруднику кнопку списания в его кабинете.</div>
                                        </div>
                                        <Switch
                                            checked={normalizedSettings.employee_writeoff_enabled}
                                            onCheckedChange={(checked) => handleUpdateSetting('employee_writeoff_enabled', checked)}
                                            disabled={isPending}
                                        />
                                    </div>
                                )}

                                {/* Перемещения сотруднику */}
                                {isStockEnabled && (
                                    <div className="py-4 space-y-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="space-y-0.5">
                                                <div className="font-semibold text-slate-900 text-sm">Разрешать перемещение сотруднику</div>
                                                <div className="text-xs text-slate-500">Показывает сотруднику кнопку перемещения в его кабинете.</div>
                                            </div>
                                            <Switch
                                                checked={normalizedSettings.employee_transfer_enabled}
                                                onCheckedChange={(checked) => handleUpdateSetting('employee_transfer_enabled', checked)}
                                                disabled={isPending}
                                            />
                                        </div>

                                        {normalizedSettings.employee_transfer_enabled && (
                                            <div className="mt-3 mb-2 pl-4 border-l-2 border-slate-200 space-y-3 pb-2">
                                                <div>
                                                    <div className="text-xs font-semibold text-slate-800">Заблокированные маршруты для сотрудников</div>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">Запрещает перемещение товаров между выбранной парой складов.</p>
                                                </div>

                                                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                                                    <Select value={newBlockedFrom} onValueChange={setNewBlockedFrom}>
                                                        <SelectTrigger className="w-full sm:w-[180px] h-10 border-slate-200">
                                                            <SelectValue placeholder="Откуда" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {warehouses.filter(w => w.is_active).map(w => (
                                                                <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>

                                                    <span className="hidden sm:inline text-slate-400 font-bold text-sm">→</span>

                                                    <Select value={newBlockedTo} onValueChange={setNewBlockedTo}>
                                                        <SelectTrigger className="w-full sm:w-[180px] h-10 border-slate-200">
                                                            <SelectValue placeholder="Куда" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {warehouses.filter(w => w.is_active && w.id.toString() !== newBlockedFrom).map(w => (
                                                                <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>

                                                    <Button
                                                        onClick={handleAddBlockedRoute}
                                                        disabled={isPending || !newBlockedFrom || !newBlockedTo || newBlockedFrom === newBlockedTo}
                                                        className="w-full sm:w-auto h-10 px-4 shrink-0 bg-slate-900 text-white hover:bg-slate-800"
                                                    >
                                                        <Plus className="h-4 w-4 mr-1" />
                                                        Заблокировать
                                                    </Button>
                                                </div>

                                                {blockedRoutes.length > 0 && (
                                                    <div className="divide-y divide-slate-100 pt-1 max-w-lg">
                                                        {blockedRoutes.map((route, idx) => {
                                                            const fromWh = warehouses.find(w => Number(w.id) === route.from_id)
                                                            const toWh = warehouses.find(w => Number(w.id) === route.to_id)
                                                            return (
                                                                <div key={idx} className="flex items-center justify-between py-2 text-xs">
                                                                    <div className="flex items-center gap-2 font-medium text-slate-800">
                                                                        <span className="text-rose-600 font-bold">✕</span>
                                                                        <span>{fromWh?.name || `#${route.from_id}`}</span>
                                                                        <span className="text-slate-400">→</span>
                                                                        <span>{toWh?.name || `#${route.to_id}`}</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleRemoveBlockedRoute(route.from_id, route.to_id)}
                                                                        disabled={isPending}
                                                                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 2: Касса и продажи */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                                <h4 className="font-bold text-slate-900 text-sm">Касса и продажи</h4>
                                <p className="text-xs text-slate-500 mt-0.5">Настройки кассы DashAdmin, продаж сотрудникам и сверки отчетов.</p>
                            </div>

                            <div className="divide-y divide-slate-100 px-6">
                                {/* Касса DashAdmin */}
                                <div className="py-4 flex items-center justify-between gap-4">
                                    <div className="space-y-0.5">
                                        <div className="font-semibold text-slate-900 text-sm">Использовать кассу DashAdmin</div>
                                        <div className="text-xs text-slate-500">Касса нужна только если клуб пробивает продажи внутри DashAdmin.</div>
                                    </div>
                                    <Switch
                                        checked={isCashboxEnabled}
                                        onCheckedChange={(checked) => handleFeatureToggle('cashbox_enabled', checked)}
                                        disabled={isPending}
                                    />
                                </div>

                                {/* Склады кассы */}
                                {isCashboxEnabled && (
                                    <div className="py-4 space-y-2">
                                        <div className="font-semibold text-slate-900 text-sm">Склады кассы</div>
                                        <div className="divide-y divide-slate-100">
                                            {warehouses.filter((w) => w.is_active).map((warehouse) => {
                                                const selected = (normalizedSettings.cashbox_warehouse_ids || []).includes(Number(warehouse.id))
                                                return (
                                                    <label key={warehouse.id} className="flex items-center gap-3 py-2 cursor-pointer select-none">
                                                        <Checkbox
                                                            checked={selected}
                                                            onCheckedChange={(val) => handleCashboxWarehouseToggle(Number(warehouse.id), Boolean(val))}
                                                            disabled={isPending}
                                                        />
                                                        <span className="text-sm text-slate-800 font-medium">{warehouse.name}</span>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                        <p className="text-xs text-slate-400">Касса спишет чек со склада из этого списка, на котором достаточно остатков.</p>
                                    </div>
                                )}

                                {/* Продажи в счет ЗП */}
                                {isCashboxEnabled && (
                                    <div className="py-4 space-y-3">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="space-y-0.5">
                                                <div className="font-semibold text-slate-900 text-sm">Разрешать продажу в счет ЗП сотруднику</div>
                                                <div className="text-xs text-slate-500">Позволяет покупать товары через кассу с вычетом из будущей выплаты.</div>
                                            </div>
                                            <Switch 
                                                checked={normalizedSettings?.allow_salary_deduction ?? false}
                                                onCheckedChange={(checked) => saveSettings({
                                                    ...normalizedSettings,
                                                    allow_salary_deduction: checked,
                                                    allow_cost_price_sale: checked ? (normalizedSettings?.allow_cost_price_sale ?? false) : false,
                                                })}
                                                disabled={isPending}
                                            />
                                        </div>

                                        {normalizedSettings?.allow_salary_deduction && (
                                            <div className="mt-3 mb-2 pl-4 border-l-2 border-slate-200 space-y-4 pb-2">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="space-y-0.5">
                                                        <div className="text-xs font-semibold text-slate-800">Общая скидка для сотрудников</div>
                                                        <div className="text-[11px] text-slate-500">Процент скидки в кассе при покупке в счет ЗП.</div>
                                                    </div>
                                                    <div className="relative w-24">
                                                        <Input 
                                                            type="number"
                                                            className="w-24 text-right pr-7 h-10 text-slate-900 font-bold border-slate-200"
                                                            value={discountValue}
                                                            onChange={(e) => setDiscountValue(e.target.value)}
                                                            onBlur={handleDiscountBlur}
                                                            disabled={isPending}
                                                            min="0"
                                                            max="100"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                                                    </div>
                                                </div>

                                                {employees.length > 0 && (
                                                    <div className="space-y-2 pt-1">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Персональные скидки</div>
                                                        <div className="divide-y divide-slate-100">
                                                            {employees.map((emp) => (
                                                                <div key={emp.id} className="flex items-center justify-between gap-4 py-2">
                                                                    <div>
                                                                        <div className="text-xs font-medium text-slate-800">{emp.full_name}</div>
                                                                        <div className="text-[10px] text-slate-400">{emp.role}</div>
                                                                    </div>
                                                                    <div className="relative w-20">
                                                                        <Input
                                                                            type="number"
                                                                            className="w-20 text-right pr-6 h-9 text-xs font-bold border-slate-200"
                                                                            value={employeeDiscountOverrides[emp.id] ?? ""}
                                                                            placeholder={String(normalizedSettings.employee_discount_percent ?? 0)}
                                                                            onChange={(e) => setEmployeeDiscountOverrides((prev) => ({
                                                                                ...prev,
                                                                                [emp.id]: e.target.value,
                                                                            }))}
                                                                            onBlur={() => handleEmployeeDiscountBlur(emp.id)}
                                                                            disabled={isPending}
                                                                            min="0"
                                                                            max="100"
                                                                        />
                                                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">%</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between gap-4 pt-1">
                                                    <div className="space-y-0.5">
                                                        <div className="text-xs font-semibold text-slate-800">Продажа по себестоимости</div>
                                                        <div className="text-[11px] text-slate-500">По закупке вместо розничной цены.</div>
                                                    </div>
                                                    <Switch 
                                                        checked={normalizedSettings?.allow_cost_price_sale ?? false}
                                                        onCheckedChange={(checked) => handleUpdateSetting('allow_cost_price_sale', checked)}
                                                        disabled={isPending}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Сверка отчетов */}
                                <div className="py-4 space-y-3">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="space-y-0.5">
                                            <div className="font-semibold text-slate-900 text-sm">Сверка отчетов</div>
                                            <div className="text-xs text-slate-500">Сравнивает итог из отчета смены с расчетом продаж по кассе.</div>
                                        </div>
                                        <Switch
                                            checked={normalizedSettings.report_reconciliation_enabled}
                                            onCheckedChange={(checked) => handleFeatureToggle('report_reconciliation_enabled', checked)}
                                            disabled={isPending || !isCashboxEnabled}
                                        />
                                    </div>

                                    {normalizedSettings.report_reconciliation_enabled && (
                                        <div className="mt-3 mb-2 pl-4 border-l-2 border-slate-200 space-y-1.5 max-w-sm pb-2">
                                            <Label className="text-xs font-semibold text-slate-800">Метрика для сверки</Label>
                                            <Select
                                                value={normalizedSettings?.employee_default_metric_key || ""}
                                                onValueChange={(val) => handleUpdateSetting('employee_default_metric_key', val)}
                                                disabled={isPending}
                                            >
                                                <SelectTrigger className="h-10 border-slate-200">
                                                    <SelectValue placeholder="Выберите метрику" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {metrics.map(m => (
                                                        <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Передача смены */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                                <h4 className="font-bold text-slate-900 text-sm">Передача смены</h4>
                                <p className="text-xs text-slate-500 mt-0.5">Настройки сдачи и приемки зон сотрудниками при сменах.</p>
                            </div>

                            <div className="divide-y divide-slate-100 px-6">
                                {/* Использовать передачу зон */}
                                <div className="py-4 space-y-3">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="space-y-0.5">
                                            <div className="font-semibold text-slate-900 text-sm">Использовать передачу зон</div>
                                            <div className="text-xs text-slate-500">Приемка и сдача барной зоны при сменах.</div>
                                        </div>
                                        <Switch
                                            checked={isShiftAccountabilityEnabled}
                                            onCheckedChange={(checked) => handleFeatureToggle('shift_accountability_mode', checked)}
                                            disabled={isPending}
                                        />
                                    </div>

                                    {isShiftAccountabilityEnabled && (
                                        <div className="mt-3 mb-2 pl-4 border-l-2 border-slate-200 space-y-4 pb-2">
                                            {/* Склады передачи */}
                                            <div className="space-y-2">
                                                <div className="text-xs font-semibold text-slate-800">Склады передачи</div>
                                                <div className="divide-y divide-slate-100">
                                                    {warehouses.filter((w) => w.is_active).map((warehouse) => {
                                                        const selected = (normalizedSettings.handover_warehouse_ids || []).includes(Number(warehouse.id))
                                                        return (
                                                            <label key={warehouse.id} className="flex items-center gap-3 py-2 cursor-pointer select-none">
                                                                <Checkbox
                                                                    checked={selected}
                                                                    onCheckedChange={(val) => handleHandoverWarehouseToggle(Number(warehouse.id), Boolean(val))}
                                                                    disabled={isPending}
                                                                />
                                                                <span className="text-sm text-slate-800 font-medium">{warehouse.name}</span>
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            {/* Объем проверки */}
                                            <div className="space-y-2 max-w-md">
                                                <div className="text-xs font-semibold text-slate-800">Объем проверки при передаче</div>
                                                <Select
                                                    value={normalizedSettings?.handover_scope_mode || "ALL_ITEMS"}
                                                    onValueChange={(val) => handleUpdateSetting('handover_scope_mode', val)}
                                                    disabled={isPending}
                                                >
                                                    <SelectTrigger className="h-10 border-slate-200">
                                                        <SelectValue placeholder="Выберите объем проверки" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="ALL_ITEMS">Все товары зоны (Полный переучет)</SelectItem>
                                                        <SelectItem value="SOLD_ITEMS_ONLY">Только продававшиеся за смену</SelectItem>
                                                        <SelectItem value="RANDOM_SAMPLE">Выборочная проверка (Случайные N товаров)</SelectItem>
                                                        <SelectItem value="SOLD_PLUS_RANDOM">Продававшиеся за смену + N случайных</SelectItem>
                                                    </SelectContent>
                                                </Select>

                                                {(normalizedSettings?.handover_scope_mode === "RANDOM_SAMPLE" || normalizedSettings?.handover_scope_mode === "SOLD_PLUS_RANDOM") && (
                                                    <div className="pt-2 flex items-center justify-between gap-4">
                                                        <div className="text-xs text-slate-600">Количество случайных товаров (N)</div>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            max={50}
                                                            className="w-20 text-right h-9 font-bold text-xs border-slate-200"
                                                            defaultValue={normalizedSettings?.handover_random_sample_size ?? 10}
                                                            onBlur={(e) => {
                                                                const val = Math.min(50, Math.max(1, parseInt(e.target.value) || 10))
                                                                handleUpdateSetting('handover_random_sample_size', val)
                                                            }}
                                                            disabled={isPending}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Слепая инвентаризация */}
                                            <div className="flex items-center justify-between gap-4 pt-1">
                                                <div className="space-y-0.5">
                                                    <div className="text-xs font-semibold text-slate-800">Слепая инвентаризация</div>
                                                    <div className="text-[11px] text-slate-500">Сотрудник не видит ожидаемые остатки при переучете.</div>
                                                </div>
                                                <Switch
                                                    checked={normalizedSettings?.blind_inventory_enabled ?? true}
                                                    onCheckedChange={(checked) => handleUpdateSetting('blind_inventory_enabled', checked)}
                                                    disabled={isPending}
                                                />
                                            </div>

                                            {/* Блокировать ПК */}
                                            <div className="flex items-center justify-between gap-4 pt-1">
                                                <div className="space-y-0.5">
                                                    <div className="text-xs font-semibold text-slate-800">Блокировать доступ с ПК в терминал</div>
                                                    <div className="text-[11px] text-slate-500">Вход только со смартфона.</div>
                                                </div>
                                                <Switch
                                                    checked={normalizedSettings?.block_desktop_handover ?? true}
                                                    onCheckedChange={(checked) => handleUpdateSetting('block_desktop_handover', checked)}
                                                    disabled={isPending}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>
                
                <TabsContent value="categories" className="mt-6">
                    <CategoriesTab categories={categories} currentUserId={currentUserId} />
                </TabsContent>
                
                <TabsContent value="warehouses" className="mt-6">
                    <WarehousesTab
                        warehouses={warehouses}
                        currentUserId={currentUserId}
                        cashboxWarehouseIds={normalizedSettings.cashbox_warehouse_ids}
                        handoverWarehouseIds={normalizedSettings.handover_warehouse_ids}
                    />
                </TabsContent>
                
                <TabsContent value="suppliers" className="mt-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Поставщики</h4>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                    placeholder="Название поставщика..."
                                    value={newSupplierName}
                                    onChange={(e) => setNewSupplierName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSupplier()}
                                    className="h-10 border-slate-200"
                                />
                                <Button
                                    onClick={handleAddSupplier}
                                    disabled={isAddingSupplier || !newSupplierName.trim()}
                                    className="h-10 px-4 shrink-0 bg-slate-900 text-white hover:bg-slate-800"
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Добавить
                                </Button>
                            </div>
                            {suppliers.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-4 text-center">Поставщики не добавлены</p>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {suppliers.map(sup => (
                                        <li key={sup.id} className="flex items-center justify-between py-2.5 px-1">
                                            <span className="text-sm text-slate-800">{sup.name}</span>
                                            <button
                                                onClick={() => handleDeleteSupplier(sup.id)}
                                                disabled={isAddingSupplier}
                                                className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="pricetags" className="mt-6">
                     <PriceTagTemplateTab 
                         products={products}
                         initialSettings={inventorySettings?.price_tag_settings as any}
                         onSave={(settings) => handleUpdateSetting('price_tag_settings', settings)}
                         isPending={isPending}
                     />
                 </TabsContent>
            </Tabs>
        </div>
    )
}
