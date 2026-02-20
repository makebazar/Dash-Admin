"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2, Save, Globe, Building, MapPin, Sun, Moon, Package, Warehouse } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Common Russian timezones
const TIMEZONES = [
    { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
    { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
    { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
    { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
    { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
    { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
    { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
    { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
    { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
    { value: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
    { value: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
]

// Hours for selection
const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface InventorySettings {
    employee_allowed_warehouse_ids?: number[]
    employee_default_metric_key?: string
}

interface ClubSettings {
    id: number
    name: string
    address: string
    timezone: string
    day_start_hour: number
    night_start_hour: number
    inventory_required: boolean
    inventory_settings: InventorySettings
}

export default function GeneralSettingsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const [clubId, setClubId] = useState('')
    const [settings, setSettings] = useState<ClubSettings | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // Form state
    const [name, setName] = useState('')
    const [address, setAddress] = useState('')
    const [timezone, setTimezone] = useState('Europe/Moscow')
    const [dayStartHour, setDayStartHour] = useState(8)
    const [nightStartHour, setNightStartHour] = useState(20)
    const [inventoryRequired, setInventoryRequired] = useState(false)
    const [inventorySettings, setInventorySettings] = useState<InventorySettings>({})

    // Additional Data for UI
    const [warehouses, setWarehouses] = useState<{ id: number, name: string }[]>([])
    const [metrics, setMetrics] = useState<{ key: string, label: string }[]>([])

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchSettings(p.clubId)
        })
    }, [params])

    const fetchSettings = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${id}/settings`)
            const data = await res.json()
            if (res.ok && data.club) {
                setSettings(data.club)
                setName(data.club.name || '')
                setAddress(data.club.address || '')
                setTimezone(data.club.timezone || 'Europe/Moscow')
                setDayStartHour(data.club.day_start_hour ?? 8)
                setNightStartHour(data.club.night_start_hour ?? 20)
                setInventoryRequired(data.club.inventory_required ?? false)
                setInventorySettings(data.club.inventory_settings || {})
                
                // Set additional data
                if (data.warehouses) setWarehouses(data.warehouses)
                if (data.metrics) setMetrics(data.metrics)
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    address,
                    timezone,
                    day_start_hour: dayStartHour,
                    night_start_hour: nightStartHour,
                    inventory_required: inventoryRequired,
                    inventory_settings: inventorySettings
                })
            })

            if (res.ok) {
                const data = await res.json()
                setSettings(data.club)
                alert('Настройки сохранены!')
            } else {
                const data = await res.json()
                alert(data.error || 'Ошибка сохранения')
            }
        } catch (error) {
            console.error('Error:', error)
            alert('Ошибка сохранения')
        } finally {
            setIsSaving(false)
        }
    }

    const handleWarehouseToggle = (warehouseId: number) => {
        setInventorySettings(prev => {
            const current = prev.employee_allowed_warehouse_ids || []
            if (current.includes(warehouseId)) {
                return { ...prev, employee_allowed_warehouse_ids: current.filter(id => id !== warehouseId) }
            } else {
                return { ...prev, employee_allowed_warehouse_ids: [...current, warehouseId] }
            }
        })
    }

    const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}:00`

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="p-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Общие настройки</h1>
                <p className="text-muted-foreground">Основная информация о клубе</p>
            </div>

            <div className="grid gap-6 max-w-2xl">
                {/* Club Info Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building className="h-5 w-5" />
                            Информация о клубе
                        </CardTitle>
                        <CardDescription>Название и адрес вашего заведения</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Название клуба</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Например: Colizeum"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Адрес</Label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="address"
                                    value={address}
                                    onChange={e => setAddress(e.target.value)}
                                    placeholder="ул. Пушкина, д. 10"
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Timezone Card */}
                <Card className="border-purple-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Globe className="h-5 w-5 text-purple-500" />
                            Часовой пояс
                        </CardTitle>
                        <CardDescription>
                            Все время в отчетах будет отображаться в выбранном часовом поясе
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <Label htmlFor="timezone">Часовой пояс клуба</Label>
                            <select
                                id="timezone"
                                value={timezone}
                                onChange={e => setTimezone(e.target.value)}
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                {TIMEZONES.map(tz => (
                                    <option key={tz.value} value={tz.value}>
                                        {tz.label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground mt-2">
                                Текущее время в этом часовом поясе:{' '}
                                <span className="font-mono font-medium">
                                    {new Date().toLocaleTimeString('ru-RU', { timeZone: timezone, hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Shift Hours Card */}
                <Card className="border-orange-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sun className="h-5 w-5 text-orange-500" />
                            <Moon className="h-4 w-4 text-blue-500" />
                            Дневные и ночные смены
                        </CardTitle>
                        <CardDescription>
                            Настройте границы для автоматического определения типа смены
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Sun className="h-4 w-4 text-orange-500" />
                                    Начало дневной смены
                                </Label>
                                <select
                                    value={dayStartHour}
                                    onChange={e => setDayStartHour(parseInt(e.target.value))}
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                >
                                    {HOURS.map(h => (
                                        <option key={h} value={h}>
                                            {formatHour(h)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Moon className="h-4 w-4 text-blue-500" />
                                    Начало ночной смены
                                </Label>
                                <select
                                    value={nightStartHour}
                                    onChange={e => setNightStartHour(parseInt(e.target.value))}
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                >
                                    {HOURS.map(h => (
                                        <option key={h} value={h}>
                                            {formatHour(h)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-4 text-sm">
                            <p className="text-muted-foreground">
                                <span className="font-medium text-foreground">Пример:</span> При настройках выше
                            </p>
                            <ul className="mt-2 space-y-1 text-muted-foreground">
                                <li className="flex items-center gap-2">
                                    <Sun className="h-3 w-3 text-orange-500" />
                                    Дневная смена: с {formatHour(dayStartHour)} до {formatHour(nightStartHour)}
                                </li>
                                <li className="flex items-center gap-2">
                                    <Moon className="h-3 w-3 text-blue-500" />
                                    Ночная смена: с {formatHour(nightStartHour)} до {formatHour(dayStartHour)}
                                </li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                {/* Inventory Settings Card */}
                <Card className="border-blue-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-blue-500" />
                            Инвентаризация
                        </CardTitle>
                        <CardDescription>
                            Настройки проведения инвентаризаций при закрытии смены
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="inventory-required" className="flex flex-col space-y-1">
                                <span>Обязательная инвентаризация</span>
                                <span className="font-normal text-xs text-muted-foreground">
                                    Если включено, администратор не сможет закрыть смену без проведения инвентаризации
                                </span>
                            </Label>
                            <Switch
                                id="inventory-required"
                                checked={inventoryRequired}
                                onCheckedChange={setInventoryRequired}
                            />
                        </div>
                        
                        <div className="border-t pt-4 space-y-4">
                            <h4 className="text-sm font-medium">Правила для сотрудников</h4>
                            
                            {/* Allowed Warehouses */}
                            <div className="space-y-3">
                                <Label>Доступные склады для инвентаризации</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {warehouses.map(w => (
                                        <div key={w.id} className="flex items-center space-x-2 border p-2 rounded-md hover:bg-slate-50">
                                            <Switch
                                                id={`wh-${w.id}`}
                                                checked={(inventorySettings.employee_allowed_warehouse_ids || []).includes(w.id)}
                                                onCheckedChange={() => handleWarehouseToggle(w.id)}
                                            />
                                            <Label htmlFor={`wh-${w.id}`} className="cursor-pointer flex items-center gap-2">
                                                <Warehouse className="h-4 w-4 text-muted-foreground" />
                                                {w.name}
                                            </Label>
                                        </div>
                                    ))}
                                    {warehouses.length === 0 && (
                                        <p className="text-sm text-muted-foreground">Склады не созданы</p>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Отметьте склады, которые сотрудники могут инвентаризировать.
                                </p>
                            </div>

                            {/* Default Metric */}
                            <div className="space-y-2">
                                <Label>Метрика выручки по умолчанию</Label>
                                <Select 
                                    value={inventorySettings.employee_default_metric_key || "none"} 
                                    onValueChange={(val) => setInventorySettings(prev => ({ ...prev, employee_default_metric_key: val === "none" ? undefined : val }))}
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
                                <p className="text-xs text-muted-foreground">
                                    Эта метрика будет автоматически выбрана для сотрудников при старте инвентаризации.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Save Button */}
                <Button onClick={handleSave} disabled={isSaving} className="w-full" size="lg">
                    {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    Сохранить настройки
                </Button>
            </div>
        </div>
    )
}
