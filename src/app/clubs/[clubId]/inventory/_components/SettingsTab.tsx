"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CategoriesTab } from "./CategoriesTab"
import { WarehousesTab } from "./WarehousesTab"
import { Category, Warehouse, updateInventorySettings, PriceTagSettings, Product, getEmployees, getMetrics } from "../actions"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useTransition, useState, useEffect, useMemo } from "react"
import { RefreshCw, Wallet, Percent, Tag, Package } from "lucide-react"
import { PriceTagTemplateTab } from "./PriceTagTemplateTab"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
        handover_warehouse_id?: number | null,
        sales_capture_mode?: 'SHIFT',
        inventory_timing?: 'END_SHIFT',
        shift_accountability_mode?: 'DISABLED' | 'WAREHOUSE',
        allow_salary_deduction?: boolean,
        employee_discount_percent?: number,
        employee_discount_overrides?: Record<string, number>,
        allow_cost_price_sale?: boolean,
        price_tag_settings?: PriceTagSettings
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
    
    // Local state for discount input to avoid too many DB updates while typing
    const [discountValue, setDiscountValue] = useState(inventorySettings?.employee_discount_percent?.toString() || "0")
    const [employeeDiscountOverrides, setEmployeeDiscountOverrides] = useState<Record<string, string>>({})

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
    const activeValue = ['categories', 'warehouses', 'general', 'pricetags'].includes(currentSubTab || '') 
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
            nextSettings.shift_accountability_mode = 'DISABLED'
            nextSettings.handover_warehouse_id = null
        }

        if (key === 'cashbox_enabled') {
            nextSettings.cashbox_enabled = checked
            if (checked) {
                nextSettings.stock_enabled = true
                nextSettings.cashbox_warehouse_id = nextSettings.cashbox_warehouse_id ?? defaultWarehouseId
            } else {
                nextSettings.report_reconciliation_enabled = false
                nextSettings.cashbox_warehouse_id = null
                nextSettings.shift_accountability_mode = 'DISABLED'
                nextSettings.handover_warehouse_id = null
            }
        }

        if (key === 'report_reconciliation_enabled') {
            nextSettings.report_reconciliation_enabled = checked
            if (checked) {
                nextSettings.stock_enabled = true
                nextSettings.cashbox_enabled = true
                nextSettings.cashbox_warehouse_id = nextSettings.cashbox_warehouse_id ?? defaultWarehouseId
                nextSettings.employee_default_metric_key = nextSettings.employee_default_metric_key ?? metrics[0]?.key
            }
        }

        if (key === 'shift_accountability_mode') {
            nextSettings.shift_accountability_mode = checked ? 'WAREHOUSE' : 'DISABLED'
            if (checked) {
                nextSettings.stock_enabled = true
                nextSettings.cashbox_enabled = true
                nextSettings.cashbox_warehouse_id = nextSettings.cashbox_warehouse_id ?? defaultWarehouseId
                nextSettings.handover_warehouse_id = nextSettings.handover_warehouse_id ?? nextSettings.cashbox_warehouse_id ?? defaultWarehouseId
            } else {
                nextSettings.handover_warehouse_id = null
            }
        }
        saveSettings(nextSettings)
    }

    const handleWarehouseBindingChange = (key: 'cashbox_warehouse_id' | 'handover_warehouse_id', value: string) => {
        const parsedWarehouseId = value === "none" ? null : Number(value)
        const nextSettings = {
            ...normalizedSettings,
            [key]: parsedWarehouseId,
        }

        if (key === 'cashbox_warehouse_id' && normalizedSettings.shift_accountability_mode === 'WAREHOUSE') {
            nextSettings.handover_warehouse_id = parsedWarehouseId
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
                <div className="bg-accent/50 p-1 rounded-lg w-fit mb-4 md:mb-6">
                    <TabsList className="bg-transparent border-none h-9 md:h-10 p-0 flex gap-1">
                        <TabsTrigger 
                            value="general"
                            className="rounded-md px-4 md:px-8 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all text-muted-foreground font-bold text-xs md:text-sm h-full"
                        >
                            Основные
                        </TabsTrigger>
                        <TabsTrigger 
                            value="categories"
                            className="rounded-md px-4 md:px-8 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all text-muted-foreground font-bold text-xs md:text-sm h-full"
                        >
                            Категории
                        </TabsTrigger>
                        <TabsTrigger 
                            value="warehouses"
                            className="rounded-md px-4 md:px-8 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all text-muted-foreground font-bold text-xs md:text-sm h-full"
                        >
                            Склады
                        </TabsTrigger>
                        <TabsTrigger 
                            value="pricetags"
                            className="rounded-md px-4 md:px-8 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all text-muted-foreground font-bold text-xs md:text-sm h-full"
                        >
                            Ценники
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="general" className="mt-0">
                    <div className="space-y-4 md:space-y-6">
                        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-border/50 bg-muted/50">
                                <h4 className="font-bold text-foreground flex items-center gap-2">
                                    <Package className="h-4 w-4 text-blue-600" />
                                    Режим работы
                                </h4>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Товары и цены остаются базой, а поставки, остатки, касса и передача зон включаются только там, где клубу это реально нужно.</p>
                            </div>

                            <div className="divide-y divide-slate-100">
                                <div className="p-6 hover:bg-muted/30 transition-colors">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-foreground">Использовать поставки</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Нужно для закупок, поставщиков и себестоимости.
                                                </div>
                                            </div>
                                            <Switch
                                                checked={isSuppliesEnabled}
                                                onCheckedChange={(checked) => handleFeatureToggle('supplies_enabled', checked)}
                                                disabled={isPending}
                                                className="data-[state=checked]:bg-blue-600"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-foreground">Вести остатки по складам</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Включает склады, движения, списания, перемещения, ревизии и аналитику по остаткам.
                                                </div>
                                            </div>
                                            <Switch
                                                checked={isStockEnabled}
                                                onCheckedChange={(checked) => handleFeatureToggle('stock_enabled', checked)}
                                                disabled={isPending}
                                                className="data-[state=checked]:bg-blue-600"
                                            />
                                        </div>

                                        {isStockEnabled && (
                                            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                                                <div className="space-y-1">
                                                    <div className="font-semibold text-foreground">Разрешать списание сотруднику</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Показывает сотруднику кнопку списания в его кабинете.
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={normalizedSettings.employee_writeoff_enabled}
                                                    onCheckedChange={(checked) => handleUpdateSetting('employee_writeoff_enabled', checked)}
                                                    disabled={isPending}
                                                    className="data-[state=checked]:bg-blue-600"
                                                />
                                            </div>
                                        )}

                                        {isStockEnabled && (
                                            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                                                <div className="space-y-1">
                                                    <div className="font-semibold text-foreground">Разрешать перемещение сотруднику</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Показывает сотруднику кнопку перемещения в его кабинете.
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={normalizedSettings.employee_transfer_enabled}
                                                    onCheckedChange={(checked) => handleUpdateSetting('employee_transfer_enabled', checked)}
                                                    disabled={isPending}
                                                    className="data-[state=checked]:bg-blue-600"
                                                />
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-foreground">Использовать кассу DashAdmin</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Касса нужна только если клуб пробивает продажи внутри DashAdmin. При выключенном учете остатков касса автоматически недоступна.
                                                </div>
                                            </div>
                                            <Switch
                                                checked={isCashboxEnabled}
                                                onCheckedChange={(checked) => handleFeatureToggle('cashbox_enabled', checked)}
                                                disabled={isPending}
                                                className="data-[state=checked]:bg-blue-600"
                                            />
                                        </div>

                                        {isCashboxEnabled && (
                                            <div className="rounded-xl border border-border p-4 space-y-2">
                                                <Label className="text-sm font-semibold text-foreground">Склад кассы</Label>
                                                <Select
                                                    value={normalizedSettings.cashbox_warehouse_id ? String(normalizedSettings.cashbox_warehouse_id) : "none"}
                                                    onValueChange={(value) => handleWarehouseBindingChange('cashbox_warehouse_id', value)}
                                                    disabled={isPending}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Выберите склад для кассы" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Не выбран</SelectItem>
                                                        {warehouses.filter((warehouse) => warehouse.is_active).map((warehouse) => (
                                                            <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                                                                {warehouse.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-xs text-muted-foreground">
                                                    Все продажи из кассы будут списываться только с этого склада.
                                                </p>
                                            </div>
                                        )}

                                        {isCashboxEnabled && (
                                            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                                                <div className="space-y-1">
                                                    <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                                                        <Wallet className="h-3.5 w-3.5 text-muted-foreground/70" />
                                                        Разрешать продажу в счет ЗП сотруднику
                                                    </Label>
                                                    <p className="text-xs text-muted-foreground leading-relaxed max-w-[520px]">
                                                        Сотрудник сможет покупать товары через кассу с вычетом суммы из будущей выплаты.
                                                    </p>
                                                </div>
                                                <Switch 
                                                    checked={normalizedSettings?.allow_salary_deduction ?? false}
                                                    onCheckedChange={(checked) => saveSettings({
                                                        ...normalizedSettings,
                                                        allow_salary_deduction: checked,
                                                        allow_cost_price_sale: checked ? (normalizedSettings?.allow_cost_price_sale ?? false) : false,
                                                    })}
                                                    disabled={isPending}
                                                    className="data-[state=checked]:bg-blue-600"
                                                />
                                            </div>
                                        )}

                                        {isCashboxEnabled && normalizedSettings?.allow_salary_deduction && (
                                            <div className="rounded-xl border border-border p-4 space-y-2">
                                                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                                    <Percent className="h-3.5 w-3.5 text-muted-foreground/70" />
                                                    Скидка для сотрудников
                                                </Label>
                                                <p className="text-xs text-muted-foreground leading-relaxed max-w-[520px]">
                                                    Фиксированный процент скидки, который будет применен в кассе при покупке в счет зарплаты.
                                                </p>
                                                <div className="relative max-w-24">
                                                    <Input 
                                                        type="number"
                                                        className="w-24 text-right pr-8 font-black text-foreground h-10 rounded-lg border-border focus:ring-blue-500/10 focus:border-blue-500/50"
                                                        value={discountValue}
                                                        onChange={(e) => setDiscountValue(e.target.value)}
                                                        onBlur={handleDiscountBlur}
                                                        disabled={isPending}
                                                        min="0"
                                                        max="100"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 font-bold text-xs">%</span>
                                                </div>
                                                {employees.length > 0 && (
                                                    <div className="pt-3 space-y-2">
                                                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                                            Персональные скидки
                                                        </div>
                                                        <div className="space-y-2">
                                                            {employees.map((emp) => (
                                                                <div
                                                                    key={emp.id}
                                                                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-3 py-2"
                                                                >
                                                                    <div className="min-w-0">
                                                                        <div className="text-sm font-semibold text-foreground truncate">
                                                                            {emp.full_name}
                                                                        </div>
                                                                        <div className="text-[10px] text-muted-foreground">
                                                                            {emp.role}
                                                                        </div>
                                                                    </div>
                                                                    <div className="relative w-24 shrink-0">
                                                                        <Input
                                                                            type="number"
                                                                            className="w-24 text-right pr-8 font-black text-foreground h-10 rounded-lg border-border focus:ring-blue-500/10 focus:border-blue-500/50"
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
                                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 font-bold text-xs">%</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <p className="text-[10px] italic text-muted-foreground">
                                                            Оставь поле пустым, чтобы использовать общий процент скидки.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {isCashboxEnabled && normalizedSettings?.allow_salary_deduction && (
                                            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                                                <div className="space-y-1">
                                                    <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                                                        <Tag className="h-3.5 w-3.5 text-muted-foreground/70" />
                                                        Продажа в счет ЗП по себестоимости
                                                    </Label>
                                                    <p className="text-xs text-muted-foreground leading-relaxed max-w-[520px]">
                                                        Разрешить продажу в счет зарплаты по закупочной цене вместо обычной цены товара.
                                                    </p>
                                                </div>
                                                <Switch 
                                                    checked={normalizedSettings?.allow_cost_price_sale ?? false}
                                                    onCheckedChange={(checked) => handleUpdateSetting('allow_cost_price_sale', checked)}
                                                    disabled={isPending}
                                                    className="data-[state=checked]:bg-blue-600"
                                                />
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-foreground">Сверка отчетов</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Сравнивает итог из отчета смены с расчетом продаж по кассе. Используй только если клуб пробивает продажи в DashAdmin.
                                                </div>
                                            </div>
                                            <Switch
                                                checked={normalizedSettings.report_reconciliation_enabled}
                                                onCheckedChange={(checked) => handleFeatureToggle('report_reconciliation_enabled', checked)}
                                                disabled={isPending || !isCashboxEnabled}
                                                className="data-[state=checked]:bg-blue-600"
                                            />
                                        </div>

                                        {normalizedSettings.report_reconciliation_enabled && (
                                            <div className="rounded-xl border border-border p-4 space-y-2">
                                                <Label className="text-sm font-semibold text-foreground">Метрика для сверки</Label>
                                                <Select
                                                    value={normalizedSettings?.employee_default_metric_key || ""}
                                                    onValueChange={(val) => handleUpdateSetting('employee_default_metric_key', val)}
                                                    disabled={isPending}
                                                >
                                                    <SelectTrigger>
                                                    <SelectValue placeholder="Выберите метрику для сверки" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {metrics.map(m => (
                                                            <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-xs text-muted-foreground">
                                                    Эта метрика используется для сверки итогов при закрытии смены.
                                                </p>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-foreground">Использовать передачу зон</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Приемка и сдача барной зоны. Работает только вместе с учетом остатков и кассой DashAdmin, иначе продажи не попадут в расчет передачи.
                                                </div>
                                            </div>
                                            <Switch
                                                checked={isShiftAccountabilityEnabled}
                                                onCheckedChange={(checked) => handleFeatureToggle('shift_accountability_mode', checked)}
                                                disabled={isPending}
                                                className="data-[state=checked]:bg-blue-600"
                                            />
                                        </div>

                                        {isShiftAccountabilityEnabled && (
                                            <div className="rounded-xl border border-border p-4 space-y-2">
                                                <Label className="text-sm font-semibold text-foreground">Склад передачи</Label>
                                                <Select
                                                    value={normalizedSettings.handover_warehouse_id ? String(normalizedSettings.handover_warehouse_id) : "none"}
                                                    onValueChange={(value) => handleWarehouseBindingChange('handover_warehouse_id', value)}
                                                    disabled={isPending}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Выберите склад для передачи" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Не выбран</SelectItem>
                                                        {warehouses.filter((warehouse) => warehouse.is_active).map((warehouse) => (
                                                            <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                                                                {warehouse.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-xs text-muted-foreground">
                                                    Этот же склад участвует в приемке и сдаче смены. Для безопасной работы держи его таким же, как склад кассы.
                                                </p>
                                            </div>
                                        )}

                                        {isShiftAccountabilityEnabled && (
                                            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                                                <div className="space-y-1">
                                                    <Label className="text-sm font-bold text-foreground">
                                                        Слепая инвентаризация
                                                    </Label>
                                                    <p className="text-xs text-muted-foreground leading-relaxed max-w-[520px]">
                                                        На сдаче зоны сотрудник не увидит ожидаемые остатки и не получит автозаполненные количества.
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={normalizedSettings?.blind_inventory_enabled ?? true}
                                                    onCheckedChange={(checked) => handleUpdateSetting('blind_inventory_enabled', checked)}
                                                    disabled={isPending}
                                                    className="data-[state=checked]:bg-blue-600"
                                                />
                                            </div>
                                        )}

                                    </div>
                                </div>

                            </div>

                            {isPending && (
                                <div className="p-3 bg-blue-50/50 border-t border-blue-100 flex items-center justify-center gap-2 text-[10px] text-blue-600 font-bold uppercase tracking-widest">
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    Сохранение настроек...
                                </div>
                            )}
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
                        cashboxWarehouseId={normalizedSettings.cashbox_warehouse_id}
                        handoverWarehouseId={normalizedSettings.handover_warehouse_id}
                    />
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
