"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CategoriesTab } from "./CategoriesTab"
import { WarehousesTab } from "./WarehousesTab"
import { Category, Warehouse, updateInventoryRequired, updateInventorySettings, PriceTagSettings, Product, getMetrics, getShiftAccountabilitySetupStatus, ShiftAccountabilitySetupStatus } from "../actions"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useTransition, useState, useEffect } from "react"
import { RefreshCw, ShieldCheck, Wallet, Percent, Tag, Package, Warehouse as WarehouseIcon, AlertTriangle, CheckCircle2 } from "lucide-react"
import { PriceTagTemplateTab } from "./PriceTagTemplateTab"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface SettingsTabProps {
    products: Product[]
    categories: Category[]
    warehouses: Warehouse[]
    employees: { id: string, full_name: string, role: string }[]
    currentUserId: string
    inventoryRequired: boolean
    inventorySettings: {
        employee_allowed_warehouse_ids?: number[],
        employee_default_metric_key?: string,
        blind_inventory_enabled?: boolean,
        sales_capture_mode?: 'INVENTORY' | 'SHIFT',
        inventory_timing?: 'END_SHIFT' | 'START_SHIFT',
        shift_accountability_mode?: 'DISABLED' | 'WAREHOUSE',
        allow_salary_deduction?: boolean,
        employee_discount_percent?: number,
        allow_cost_price_sale?: boolean,
        price_tag_settings?: PriceTagSettings
    }
}

export function SettingsTab({ products, categories, warehouses, employees, currentUserId, inventoryRequired, inventorySettings }: SettingsTabProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const params = useParams()
    const clubId = params.clubId as string
    const [isPending, startTransition] = useTransition()
    const [metrics, setMetrics] = useState<{ key: string, label: string }[]>([])
    const [inventoryRequiredValue, setInventoryRequiredValue] = useState(inventoryRequired)
    const [accountabilityStatus, setAccountabilityStatus] = useState<ShiftAccountabilitySetupStatus | null>(null)
    
    // Local state for discount input to avoid too many DB updates while typing
    const [discountValue, setDiscountValue] = useState(inventorySettings?.employee_discount_percent?.toString() || "0")

    useEffect(() => {
        setDiscountValue(inventorySettings?.employee_discount_percent?.toString() || "0")
    }, [inventorySettings?.employee_discount_percent])

    useEffect(() => {
        setInventoryRequiredValue(inventoryRequired)
    }, [inventoryRequired])

    useEffect(() => {
        getMetrics()
            .then(setMetrics)
            .catch(console.error)
    }, [])

    useEffect(() => {
        getShiftAccountabilitySetupStatus(clubId)
            .then(setAccountabilityStatus)
            .catch(console.error)
    }, [clubId, inventorySettings])

    // Default to categories if on 'settings' or something else
    const currentSubTab = searchParams.get("tab")
    const activeValue = ['categories', 'warehouses', 'general', 'pricetags'].includes(currentSubTab || '') 
        ? currentSubTab! 
        : 'general'

    const handleUpdateSetting = (key: string, value: any) => {
        const newSettings = {
            ...inventorySettings,
            [key]: value
        }
        
        startTransition(async () => {
            try {
                await updateInventorySettings(clubId, currentUserId, newSettings)
                router.refresh()
            } catch (err) {
                console.error(err)
            }
        })
    }

    const handleDiscountBlur = () => {
        const val = Number(discountValue)
        if (isNaN(val)) return
        handleUpdateSetting('employee_discount_percent', val)
    }

    const handleUpdateInventoryRequired = (nextValue: boolean) => {
        setInventoryRequiredValue(nextValue)
        startTransition(async () => {
            try {
                await updateInventoryRequired(clubId, currentUserId, nextValue)
                router.refresh()
            } catch (err) {
                console.error(err)
                setInventoryRequiredValue(inventoryRequired)
            }
        })
    }

    const handleWarehouseToggle = (warehouseId: number) => {
        const current = inventorySettings?.employee_allowed_warehouse_ids || []
        const next = current.includes(warehouseId)
            ? current.filter(id => id !== warehouseId)
            : [...current, warehouseId]
        handleUpdateSetting('employee_allowed_warehouse_ids', next)
    }

    const isShiftAccountabilityEnabled = (inventorySettings?.shift_accountability_mode || "DISABLED") === "WAREHOUSE"

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
                                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                                    Политики продаж
                                </h4>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Настройка прав сотрудников при продаже товаров</p>
                            </div>
                            
                            <div className="divide-y divide-slate-100">
                                <div className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                                            <Wallet className="h-3.5 w-3.5 text-muted-foreground/70" />
                                            Продажа в счет зарплаты
                                        </Label>
                                        <p className="text-xs text-muted-foreground leading-relaxed max-w-[400px]">
                                            Разрешить сотрудникам покупать товары с автоматическим вычетом суммы из их будущей выплаты
                                        </p>
                                    </div>
                                    <Switch 
                                        checked={inventorySettings?.allow_salary_deduction ?? false}
                                        onCheckedChange={(checked) => handleUpdateSetting('allow_salary_deduction', checked)}
                                        disabled={isPending}
                                        className="data-[state=checked]:bg-blue-600"
                                    />
                                </div>
                                
                                <div className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                                            <Percent className="h-3.5 w-3.5 text-muted-foreground/70" />
                                            Скидка для сотрудников
                                        </Label>
                                        <p className="text-xs text-muted-foreground leading-relaxed max-w-[400px]">
                                            Фиксированный процент скидки, который будет применен к цене товара при покупке в счет зарплаты
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
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
                                    </div>
                                </div>

                                <div className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                                            <Tag className="h-3.5 w-3.5 text-muted-foreground/70" />
                                            Продажа по себестоимости
                                        </Label>
                                        <p className="text-xs text-muted-foreground leading-relaxed max-w-[400px]">
                                            Добавить кнопку в интерфейс сотрудника для быстрой продажи товара по его закупочной цене
                                        </p>
                                    </div>
                                    <Switch 
                                        checked={inventorySettings?.allow_cost_price_sale ?? false}
                                        onCheckedChange={(checked) => handleUpdateSetting('allow_cost_price_sale', checked)}
                                        disabled={isPending}
                                        className="data-[state=checked]:bg-blue-600"
                                    />
                                </div>
                            </div>

                            {isPending && (
                                <div className="p-3 bg-blue-50/50 border-t border-blue-100 flex items-center justify-center gap-2 text-[10px] text-blue-600 font-bold uppercase tracking-widest">
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    Сохранение настроек...
                                </div>
                            )}
                        </div>

                        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-border/50 bg-muted/50">
                                <h4 className="font-bold text-foreground flex items-center gap-2">
                                    <Package className="h-4 w-4 text-blue-600" />
                                    Инвентаризация
                                </h4>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Настройки проведения инвентаризаций при закрытии смены</p>
                            </div>

                            <div className="divide-y divide-slate-100">
                                <div className="p-6 hover:bg-muted/30 transition-colors">
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <Label className="text-sm font-bold text-foreground">
                                                Система сменной ответственности
                                            </Label>
                                            <p className="text-xs text-muted-foreground leading-relaxed max-w-[520px]">
                                                Явно включает новую модель приемки и сдачи холодильника/витрины вместо старой shift-инвентаризации.
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-foreground">Активировать систему</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Когда включено, сотрудники проходят приемку/сдачу зон, а старая shift-инвентаризация отключается.
                                                </div>
                                            </div>
                                            <Switch
                                                checked={isShiftAccountabilityEnabled}
                                                onCheckedChange={(checked) => handleUpdateSetting('shift_accountability_mode', checked ? 'WAREHOUSE' : 'DISABLED')}
                                                disabled={isPending}
                                                className="data-[state=checked]:bg-blue-600"
                                            />
                                        </div>

                                        <div className={cn(
                                            "rounded-xl border p-4 space-y-3",
                                            !isShiftAccountabilityEnabled
                                                ? "border-border bg-muted"
                                                : accountabilityStatus?.ready
                                                    ? "border-green-200 bg-green-50"
                                                    : "border-amber-200 bg-amber-50"
                                        )}>
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    {!isShiftAccountabilityEnabled ? (
                                                        <Package className="h-4 w-4 text-muted-foreground" />
                                                    ) : accountabilityStatus?.ready ? (
                                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                    ) : (
                                                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                                                    )}
                                                    <span className="font-semibold text-foreground">
                                                        {!isShiftAccountabilityEnabled
                                                            ? "Система отключена"
                                                            : accountabilityStatus?.ready
                                                                ? "Система готова к включению"
                                                                : "Система включена, но конфигурация не завершена"}
                                                    </span>
                                                </div>
                                                <Badge variant="outline">
                                                    {accountabilityStatus?.warehouses_count ?? 0} зон/складов
                                                </Badge>
                                            </div>

                                            {accountabilityStatus?.configured_warehouses?.length ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {accountabilityStatus.configured_warehouses.map((warehouse) => (
                                                        <Badge key={warehouse.id} variant="secondary" className="bg-card text-foreground border border-border">
                                                            {warehouse.name} · {warehouse.shift_zone_label}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : null}

                                            {isShiftAccountabilityEnabled && accountabilityStatus?.issues?.length ? (
                                                <div className="space-y-2">
                                                    {accountabilityStatus.issues.map((issue) => (
                                                        <div key={issue} className="text-xs text-amber-900">
                                                            • {issue}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">
                                                    {!isShiftAccountabilityEnabled
                                                        ? "Новая система не влияет на смены, пока не включена."
                                                        : "Сотрудники будут работать через приемку/сдачу барной зоны. Можно подключить один или несколько складов к бару."}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 hover:bg-muted/30 transition-colors">
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <Label className="text-sm font-bold text-foreground">
                                                Режим учета продаж по складу
                                            </Label>
                                            <p className="text-xs text-muted-foreground leading-relaxed max-w-[520px]">
                                                Либо продажи фиксируются по результатам инвентаризации, либо сотрудник пробивает товар в течение смены.
                                            </p>
                                        </div>
                                        <Select
                                            value={inventorySettings?.sales_capture_mode || "INVENTORY"}
                                            onValueChange={(val: any) => handleUpdateSetting('sales_capture_mode', val)}
                                            disabled={isPending || isShiftAccountabilityEnabled}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Выберите режим" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="INVENTORY">Фиксировать продажи через инвентаризацию</SelectItem>
                                                <SelectItem value="SHIFT">Пробитие товара в течение смены</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-bold text-foreground">
                                            Обязательная инвентаризация
                                        </Label>
                                        <p className="text-xs text-muted-foreground leading-relaxed max-w-[520px]">
                                            Если включено, администратор не сможет закрыть смену без проведения инвентаризации
                                        </p>
                                    </div>
                                    <Switch
                                        checked={inventoryRequiredValue}
                                        onCheckedChange={handleUpdateInventoryRequired}
                                        disabled={isPending || isShiftAccountabilityEnabled}
                                        className="data-[state=checked]:bg-blue-600"
                                    />
                                </div>

                                <div className="p-6 hover:bg-muted/30 transition-colors">
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <Label className="text-sm font-bold text-foreground">
                                                Когда проводить обязательную инвентаризацию
                                            </Label>
                                            <p className="text-xs text-muted-foreground leading-relaxed max-w-[520px]">
                                                Выбери, в какой момент сотрудник должен пройти обязательную инвентаризацию: перед завершением смены или сразу после её начала.
                                            </p>
                                        </div>
                                        <Select
                                            value={inventorySettings?.inventory_timing || "END_SHIFT"}
                                            onValueChange={(val: 'END_SHIFT' | 'START_SHIFT') => handleUpdateSetting('inventory_timing', val)}
                                            disabled={isPending || !inventoryRequiredValue || isShiftAccountabilityEnabled}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Выберите момент инвентаризации" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="END_SHIFT">В конце смены</SelectItem>
                                                <SelectItem value="START_SHIFT">В начале смены</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {!inventoryRequiredValue ? (
                                            <p className="text-[11px] text-amber-600">
                                                Сначала включи обязательную инвентаризацию, чтобы выбрать момент её проведения.
                                            </p>
                                        ) : isShiftAccountabilityEnabled ? (
                                            <p className="text-[11px] text-amber-600">
                                                Пока включена система сменной ответственности, эта настройка не используется.
                                            </p>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="p-6 hover:bg-muted/30 transition-colors">
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <Label className="text-sm font-bold text-foreground">
                                                Правила для сотрудников
                                            </Label>
                                            <p className="text-xs text-muted-foreground leading-relaxed max-w-[520px]">
                                                Ограничения для сотрудников при старте инвентаризации
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-muted-foreground">Доступные склады для инвентаризации</Label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {warehouses.map(w => (
                                                    <div key={w.id} className="flex items-center justify-between gap-3 border border-border p-3 rounded-lg bg-card">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <WarehouseIcon className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                                                            <span className="text-sm font-bold text-foreground truncate">{w.name}</span>
                                                        </div>
                                                        <Switch
                                                            checked={(inventorySettings?.employee_allowed_warehouse_ids || []).includes(w.id)}
                                                            onCheckedChange={() => handleWarehouseToggle(w.id)}
                                                            disabled={isPending}
                                                            className="data-[state=checked]:bg-blue-600"
                                                        />
                                                    </div>
                                                ))}
                                                {warehouses.length === 0 && (
                                                    <div className="text-xs text-muted-foreground italic">Склады не созданы</div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-muted-foreground">Метрика выручки по умолчанию</Label>
                                            <Select
                                                value={inventorySettings?.employee_default_metric_key || "none"}
                                                onValueChange={(val) => handleUpdateSetting('employee_default_metric_key', val === "none" ? undefined : val)}
                                                disabled={isPending}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Выберите метрику" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Не выбрано</SelectItem>
                                                    {metrics.map(m => (
                                                        <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground leading-relaxed max-w-[520px]">
                                                Эта метрика будет автоматически выбрана для сотрудников при старте инвентаризации
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-sm font-bold text-foreground">
                                                    Слепая инвентаризация
                                                </Label>
                                                <p className="text-xs text-muted-foreground leading-relaxed max-w-[520px]">
                                                    Если включено, сотрудники не будут видеть ожидаемые остатки при пересчете
                                                </p>
                                            </div>
                                            <Switch
                                                checked={inventorySettings?.blind_inventory_enabled ?? true}
                                                onCheckedChange={(checked) => handleUpdateSetting('blind_inventory_enabled', checked)}
                                                disabled={isPending}
                                                className="data-[state=checked]:bg-blue-600"
                                            />
                                        </div>
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
                    <WarehousesTab warehouses={warehouses} employees={employees} currentUserId={currentUserId} />
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
