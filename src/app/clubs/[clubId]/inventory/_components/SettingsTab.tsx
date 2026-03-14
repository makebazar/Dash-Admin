"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CategoriesTab } from "./CategoriesTab"
import { WarehousesTab } from "./WarehousesTab"
import { Category, Warehouse, updateInventoryRequired, updateInventorySettings, PriceTagSettings, Product, getMetrics } from "../actions"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTransition, useState, useEffect } from "react"
import { RefreshCw, ShieldCheck, Wallet, Percent, Tag, Printer, Package, Warehouse as WarehouseIcon } from "lucide-react"
import { PriceTagTemplateTab } from "./PriceTagTemplateTab"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
                <div className="bg-slate-100/50 p-1 rounded-lg w-fit mb-4 md:mb-6">
                    <TabsList className="bg-transparent border-none h-9 md:h-10 p-0 flex gap-1">
                        <TabsTrigger 
                            value="general"
                            className="rounded-md px-4 md:px-8 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all text-slate-500 font-bold text-xs md:text-sm h-full"
                        >
                            Основные
                        </TabsTrigger>
                        <TabsTrigger 
                            value="categories"
                            className="rounded-md px-4 md:px-8 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all text-slate-500 font-bold text-xs md:text-sm h-full"
                        >
                            Категории
                        </TabsTrigger>
                        <TabsTrigger 
                            value="warehouses"
                            className="rounded-md px-4 md:px-8 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all text-slate-500 font-bold text-xs md:text-sm h-full"
                        >
                            Склады
                        </TabsTrigger>
                        <TabsTrigger 
                            value="pricetags"
                            className="rounded-md px-4 md:px-8 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all text-slate-500 font-bold text-xs md:text-sm h-full"
                        >
                            Ценники
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="general" className="mt-0">
                    <div className="space-y-4 md:space-y-6">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                                    Политики продаж
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-0.5">Настройка прав сотрудников при продаже товаров</p>
                            </div>
                            
                            <div className="divide-y divide-slate-100">
                                <div className="p-6 flex items-center justify-between hover:bg-slate-50/30 transition-colors">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <Wallet className="h-3.5 w-3.5 text-slate-400" />
                                            Продажа в счет зарплаты
                                        </Label>
                                        <p className="text-xs text-slate-500 leading-relaxed max-w-[400px]">
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
                                
                                <div className="p-6 flex items-center justify-between hover:bg-slate-50/30 transition-colors">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <Percent className="h-3.5 w-3.5 text-slate-400" />
                                            Скидка для сотрудников
                                        </Label>
                                        <p className="text-xs text-slate-500 leading-relaxed max-w-[400px]">
                                            Фиксированный процент скидки, который будет применен к цене товара при покупке в счет зарплаты
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <Input 
                                                type="number"
                                                className="w-24 text-right pr-8 font-black text-slate-900 h-10 rounded-lg border-slate-200 focus:ring-blue-500/10 focus:border-blue-500/50"
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
                                </div>

                                <div className="p-6 flex items-center justify-between hover:bg-slate-50/30 transition-colors">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <Tag className="h-3.5 w-3.5 text-slate-400" />
                                            Продажа по себестоимости
                                        </Label>
                                        <p className="text-xs text-slate-500 leading-relaxed max-w-[400px]">
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

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <Package className="h-4 w-4 text-blue-600" />
                                    Инвентаризация
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-0.5">Настройки проведения инвентаризаций при закрытии смены</p>
                            </div>

                            <div className="divide-y divide-slate-100">
                                <div className="p-6 hover:bg-slate-50/30 transition-colors">
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <Label className="text-sm font-bold text-slate-700">
                                                Режим учета продаж по складу
                                            </Label>
                                            <p className="text-xs text-slate-500 leading-relaxed max-w-[520px]">
                                                Либо продажи фиксируются по результатам инвентаризации, либо сотрудник пробивает товар в течение смены.
                                            </p>
                                        </div>
                                        <Select
                                            value={inventorySettings?.sales_capture_mode || "INVENTORY"}
                                            onValueChange={(val: any) => handleUpdateSetting('sales_capture_mode', val)}
                                            disabled={isPending}
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

                                <div className="p-6 flex items-center justify-between hover:bg-slate-50/30 transition-colors">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-bold text-slate-700">
                                            Обязательная инвентаризация
                                        </Label>
                                        <p className="text-xs text-slate-500 leading-relaxed max-w-[520px]">
                                            Если включено, администратор не сможет закрыть смену без проведения инвентаризации
                                        </p>
                                    </div>
                                    <Switch
                                        checked={inventoryRequiredValue}
                                        onCheckedChange={handleUpdateInventoryRequired}
                                        disabled={isPending}
                                        className="data-[state=checked]:bg-blue-600"
                                    />
                                </div>

                                <div className="p-6 hover:bg-slate-50/30 transition-colors">
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <Label className="text-sm font-bold text-slate-700">
                                                Правила для сотрудников
                                            </Label>
                                            <p className="text-xs text-slate-500 leading-relaxed max-w-[520px]">
                                                Ограничения для сотрудников при старте инвентаризации
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-600">Доступные склады для инвентаризации</Label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {warehouses.map(w => (
                                                    <div key={w.id} className="flex items-center justify-between gap-3 border border-slate-200 p-3 rounded-lg bg-white">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <WarehouseIcon className="h-4 w-4 text-slate-400 shrink-0" />
                                                            <span className="text-sm font-bold text-slate-800 truncate">{w.name}</span>
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
                                                    <div className="text-xs text-slate-500 italic">Склады не созданы</div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-600">Метрика выручки по умолчанию</Label>
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
                                            <p className="text-xs text-slate-500 leading-relaxed max-w-[520px]">
                                                Эта метрика будет автоматически выбрана для сотрудников при старте инвентаризации
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-sm font-bold text-slate-700">
                                                    Слепая инвентаризация
                                                </Label>
                                                <p className="text-xs text-slate-500 leading-relaxed max-w-[520px]">
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
