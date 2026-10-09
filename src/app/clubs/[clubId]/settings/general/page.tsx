"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Save, Globe, Building, MapPin, Sun, Moon, Plus, Trash2, Link2 } from "lucide-react"
import { PageShell } from "@/components/layout/PageShell"

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

interface ClubSettings {
    id: number
    name: string
    address: string
    timezone: string
    day_start_hour: number
    night_start_hour: number
}

export default function GeneralSettingsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const [clubId, setClubId] = useState('')
    const [settings, setSettings] = useState<ClubSettings | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // Form state
    const [name, setName] = useState('')
    const [address, setAddress] = useState('')
    const [ipAddress, setIpAddress] = useState('')
    const [isDetectingIp, setIsDetectingIp] = useState(false)
    const [timezone, setTimezone] = useState('Europe/Moscow')
    const [dayStartHour, setDayStartHour] = useState(8)
    const [nightStartHour, setNightStartHour] = useState(20)
    const [gracePeriod, setGracePeriod] = useState(5)
    const [thresholds, setThresholds] = useState<{ minutes: number; penalty: number }[]>([])
    const [dashlockIntegrationEnabled, setDashlockIntegrationEnabled] = useState(false)
    const [dashlockApiKey, setDashlockApiKey] = useState('')

    // SmartShell Integration state
    const [smartshellIntegrationEnabled, setSmartshellIntegrationEnabled] = useState(false)
    const [smartshellApiKey, setSmartshellApiKey] = useState('')
    const [smartshellLogin, setSmartshellLogin] = useState('')
    const [smartshellPassword, setSmartshellPassword] = useState('')
    const [smartshellCompanyId, setSmartshellCompanyId] = useState<number | null>(null)
    const [smartshellClubsList, setSmartshellClubsList] = useState<any[]>([])
    const [isTestingSmartshell, setIsTestingSmartshell] = useState(false)
    const [smartshellTestResult, setSmartshellTestResult] = useState<{ success: boolean; message: string } | null>(null)

    const handleDetectIp = async () => {
        setIsDetectingIp(true)
        try {
            const res = await fetch('https://api.ipify.org?format=json')
            const data = await res.json()
            if (data.ip) {
                setIpAddress(data.ip)
            }
        } catch {
            alert('Не удалось автоматически определить IP. Пожалуйста, укажите вручную.')
        } finally {
            setIsDetectingIp(false)
        }
    }

    const generateApiKey = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = 'da_';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setDashlockApiKey(result);
    }

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
                setIpAddress(data.club.ip_address || '')
                setTimezone(data.club.timezone || 'Europe/Moscow')
                setDayStartHour(data.club.day_start_hour ?? 8)
                setNightStartHour(data.club.night_start_hour ?? 20)
                const latSettings = data.club.lateness_settings || {}
                setGracePeriod(latSettings.grace_period ?? 5)
                setThresholds(latSettings.thresholds || [])
                const invSettings = data.club.inventory_settings || {}
                setDashlockIntegrationEnabled(invSettings.dashlock_integration_enabled ?? false)
                setDashlockApiKey(invSettings.api_key || '')
                setSmartshellIntegrationEnabled(invSettings.smartshell_integration_enabled ?? false)
                setSmartshellApiKey(invSettings.smartshell_api_key || '')
                setSmartshellLogin(invSettings.smartshell_login || '')
                setSmartshellPassword(invSettings.smartshell_password || '')
                setSmartshellCompanyId(invSettings.smartshell_company_id ? Number(invSettings.smartshell_company_id) : null)
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleTestSmartshell = async () => {
        if (!smartshellApiKey && !(smartshellLogin && smartshellPassword)) {
            setSmartshellTestResult({ success: false, message: 'Укажите логин и пароль сотрудника или API ключ SmartShell' })
            return
        }
        setIsTestingSmartshell(true)
        setSmartshellTestResult(null)
        try {
            const res = await fetch(`/api/clubs/${clubId}/integrations/smartshell/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_key: smartshellApiKey,
                    login: smartshellLogin,
                    password: smartshellPassword,
                    company_id: smartshellCompanyId
                })
            })
            const data = await res.json()
            if (res.ok) {
                setSmartshellTestResult({ success: true, message: data.message || 'Подключение успешно!' })
                if (data.clubs && Array.isArray(data.clubs)) {
                    setSmartshellClubsList(data.clubs)
                }
            } else {
                setSmartshellTestResult({ success: false, message: data.error || 'Ошибка подключения' })
            }
        } catch (e: any) {
            setSmartshellTestResult({ success: false, message: e.message || 'Сетевая ошибка' })
        } finally {
            setIsTestingSmartshell(false)
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
                    ip_address: ipAddress,
                    timezone,
                    day_start_hour: dayStartHour,
                    night_start_hour: nightStartHour,
                    lateness_settings: {
                        grace_period: gracePeriod,
                        thresholds: thresholds
                    },
                    inventory_settings: {
                        ...(settings as any)?.inventory_settings,
                        dashlock_integration_enabled: dashlockIntegrationEnabled,
                        api_key: dashlockApiKey,
                        smartshell_integration_enabled: smartshellIntegrationEnabled,
                        smartshell_api_key: smartshellApiKey,
                        smartshell_login: smartshellLogin,
                        smartshell_password: smartshellPassword,
                        smartshell_company_id: smartshellCompanyId ? Number(smartshellCompanyId) : null,
                    }
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

    const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}:00`

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <PageShell maxWidth="5xl">
            <div className="space-y-8 pb-28 sm:pb-12 max-w-2xl">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                    <div className="min-w-0">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Общие настройки</h1>
                        <p className="text-slate-500 text-lg mt-2">Основная информация о клубе</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Club Info Card */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
                    <div className="mb-6">
                        <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                            <Building className="h-5 w-5 text-slate-500" />
                            Информация о клубе
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Название и адрес вашего заведения</p>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Название клуба</Label>
                            <Input
                                id="name"
                                className="h-11 rounded-xl"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Например: Игровой клуб Центр"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Адрес</Label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="address"
                                    className="h-11 rounded-xl pl-10"
                                    value={address}
                                    onChange={e => setAddress(e.target.value)}
                                    placeholder="ул. Пушкина, д. 10"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Club IP & DashFrag Agent Settings Card */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                    <div className="mb-6 relative z-10">
                        <h3 className="text-xl font-bold text-slate-900">
                            Внешний IP-адрес клуба (DashFrag Agent)
                        </h3>
                        <p className="text-sm text-slate-500 mt-1 font-medium">
                            Для проверки присутствия игрока в сети клуба и безопасности зачисления бонусов
                        </p>
                    </div>
                    
                    <div className="space-y-5 relative z-10">
                        <div className="space-y-2">
                            <Label htmlFor="ipAddress">Публичный IP-адрес провайдера (WAN IP)</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="ipAddress"
                                    className="h-11 rounded-xl font-mono text-sm"
                                    value={ipAddress}
                                    onChange={e => setIpAddress(e.target.value)}
                                    placeholder="Например: 185.220.101.45"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleDetectIp}
                                    disabled={isDetectingIp}
                                    className="h-11 rounded-xl px-4 border-slate-200 hover:bg-slate-50 shrink-0"
                                >
                                    {isDetectingIp && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Определить мой текущий IP
                                </Button>
                            </div>
                            <p className="text-xs text-slate-500">
                                Все компьютеры клуба выходят в интернет через один общий внешний IP роутера.
                            </p>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 text-sm space-y-3">
                            <h4 className="font-bold text-slate-900">
                                Как узнать IP-адрес вашего клуба:
                            </h4>
                            <ol className="list-decimal list-inside space-y-2 text-slate-600 text-xs sm:text-sm">
                                <li>Откройте любой ПК в клубе или ПК администратора.</li>
                                <li>Перейдите на сайт <a href="https://2ip.ru" target="_blank" rel="noreferrer" className="text-emerald-600 font-semibold underline">2ip.ru</a> или <a href="https://ipify.org" target="_blank" rel="noreferrer" className="text-emerald-600 font-semibold underline">ipify.org</a>.</li>
                                <li>Скопируйте ваш внешне отображаемый IP-адрес (например, <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-mono">185.220.101.45</code>).</li>
                                <li>Вставьте скопированный IP в поле выше и нажмите <strong>«Сохранить настройки»</strong>.</li>
                                <li>Вы также можете просто нажать кнопку <strong>«Определить мой текущий IP»</strong> выше, если открыли админку прямо из клуба.</li>
                            </ol>
                        </div>
                    </div>
                </div>

                {/* Timezone Card */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                    <div className="mb-6 relative z-10">
                        <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                            <Globe className="h-5 w-5 text-purple-500" />
                            Часовой пояс
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Все время в отчетах будет отображаться в выбранном часовом поясе</p>
                    </div>
                    <div className="relative z-10">
                        <div className="space-y-2">
                            <Label htmlFor="timezone">Часовой пояс клуба</Label>
                            <Select value={timezone} onValueChange={setTimezone}>
                                <SelectTrigger id="timezone" className="h-11 w-full rounded-xl border-slate-200 bg-white text-sm text-slate-900 shadow-sm hover:bg-slate-50 focus:ring-slate-900">
                                    <SelectValue placeholder="Выберите часовой пояс" />
                                </SelectTrigger>
                                <SelectContent className="max-h-75 rounded-xl border-slate-200 shadow-lg">
                                    {TIMEZONES.map(tz => (
                                        <SelectItem key={tz.value} value={tz.value} className="rounded-lg">
                                            {tz.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-2">
                                Текущее время в этом часовом поясе:{' '}
                                <span className="font-mono font-medium">
                                    {new Date().toLocaleTimeString('ru-RU', { timeZone: timezone, hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Shift Hours Card */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                    <div className="mb-6 relative z-10">
                        <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                            <Sun className="h-5 w-5 text-orange-500" />
                            Дневные и ночные смены
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Настройте границы для автоматического определения типа смены</p>
                    </div>
                    <div className="space-y-6 relative z-10">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-slate-700">
                                    <Sun className="h-4 w-4 text-orange-500" />
                                    Начало дневной смены
                                </Label>
                                <Select value={dayStartHour.toString()} onValueChange={(val) => setDayStartHour(parseInt(val))}>
                                    <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white text-sm text-slate-900 shadow-sm hover:bg-slate-50 focus:ring-slate-900">
                                        <SelectValue placeholder="Время" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-75 rounded-xl border-slate-200 shadow-lg">
                                        {HOURS.map(h => (
                                            <SelectItem key={h} value={h.toString()} className="rounded-lg">
                                                {formatHour(h)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-slate-700">
                                    <Moon className="h-4 w-4 text-blue-500" />
                                    Начало ночной смены
                                </Label>
                                <Select value={nightStartHour.toString()} onValueChange={(val) => setNightStartHour(parseInt(val))}>
                                    <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white text-sm text-slate-900 shadow-sm hover:bg-slate-50 focus:ring-slate-900">
                                        <SelectValue placeholder="Время" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-75 rounded-xl border-slate-200 shadow-lg">
                                        {HOURS.map(h => (
                                            <SelectItem key={h} value={h.toString()} className="rounded-lg">
                                                {formatHour(h)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-5 text-sm border border-slate-100">
                            <p className="text-slate-600">
                                <span className="font-bold text-slate-900">Пример:</span> При настройках выше
                            </p>
                            <ul className="mt-3 space-y-2 text-slate-600">
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
                    </div>
                </div>

                {/* Lateness settings */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 relative overflow-hidden">
                    <div className="mb-6">
                        <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                            Дисциплина и опоздания
                        </h3>
                        <p className="text-sm text-slate-500 mt-1 font-medium">Настройте правила контроля опозданий сотрудников</p>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="gracePeriod">Допустимое опоздание (минут)</Label>
                            <Input
                                id="gracePeriod"
                                type="number"
                                className="h-11 rounded-xl"
                                value={gracePeriod}
                                onChange={e => setGracePeriod(parseInt(e.target.value) || 0)}
                                placeholder="5"
                            />
                            <p className="text-xs text-muted-foreground">Сотрудники, опоздавшие на это время или меньше, не будут считаться опоздавшими.</p>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <Label>Пороги штрафов за опоздание</Label>
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    className="rounded-xl flex items-center gap-1"
                                    onClick={() => setThresholds([...thresholds, { minutes: 15, penalty: 100 }])}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Добавить порог
                                </Button>
                            </div>
                            
                            {thresholds.length === 0 ? (
                                <div className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-2xl border border-dashed">
                                    Пороги штрафов не заданы. Вы можете добавить их для автоматического расчета.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {thresholds.map((t, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <div className="flex-1 flex items-center gap-2">
                                                <span className="text-xs text-slate-500 whitespace-nowrap">Опоздание от</span>
                                                <Input
                                                    type="number"
                                                    className="h-10 rounded-xl"
                                                    value={t.minutes}
                                                    onChange={e => {
                                                        const newT = [...thresholds];
                                                        newT[idx].minutes = parseInt(e.target.value) || 0;
                                                        setThresholds(newT);
                                                    }}
                                                />
                                                <span className="text-xs text-slate-500">мин</span>
                                            </div>
                                            <div className="flex-1 flex items-center gap-2">
                                                <span className="text-xs text-slate-500 whitespace-nowrap">Штраф</span>
                                                <Input
                                                    type="number"
                                                    className="h-10 rounded-xl"
                                                    value={t.penalty}
                                                    onChange={e => {
                                                        const newT = [...thresholds];
                                                        newT[idx].penalty = parseInt(e.target.value) || 0;
                                                        setThresholds(newT);
                                                    }}
                                                />
                                                <span className="text-xs text-slate-500">₽</span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl h-10 w-10 p-0 shrink-0"
                                                onClick={() => {
                                                    setThresholds(thresholds.filter((_, i) => i !== idx));
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* SmartShell Integration Card */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b">
                        <div>
                            <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                                <Link2 className="h-5 w-5 text-emerald-600" />
                                Интеграция со SmartShell API
                            </h3>
                            <p className="text-sm text-slate-500 mt-1 font-medium">
                                Синхронизация рабочих смен и данных сотрудников из SmartShell
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={smartshellIntegrationEnabled}
                                onChange={(e) => setSmartshellIntegrationEnabled(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>

                    {smartshellIntegrationEnabled && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="smartshellLogin">Логин / Телефон сотрудника SmartShell</Label>
                                    <Input
                                        id="smartshellLogin"
                                        type="text"
                                        className="h-11 rounded-xl"
                                        value={smartshellLogin}
                                        onChange={(e) => setSmartshellLogin(e.target.value)}
                                        placeholder="79963058814"
                                    />
                                    <p className="text-xs text-slate-400">Номер телефона администратора клуба</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="smartshellPassword">Пароль сотрудника SmartShell</Label>
                                    <Input
                                        id="smartshellPassword"
                                        type="password"
                                        className="h-11 rounded-xl"
                                        value={smartshellPassword}
                                        onChange={(e) => setSmartshellPassword(e.target.value)}
                                        placeholder="••••••••"
                                    />
                                    <p className="text-xs text-slate-400">Используется для авторизации и подтверждения закрытия смен</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="smartshellCompanyId">ID Клуба SmartShell (Company ID)</Label>
                                <div className="flex gap-2">
                                    {smartshellClubsList.length > 0 ? (
                                        <Select
                                            value={smartshellCompanyId ? String(smartshellCompanyId) : ''}
                                            onValueChange={(val) => setSmartshellCompanyId(Number(val))}
                                        >
                                            <SelectTrigger className="h-11 rounded-xl flex-1">
                                                <SelectValue placeholder="Выберите клуб из списка" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {smartshellClubsList.map((c) => (
                                                    <SelectItem key={c.id} value={String(c.id)}>
                                                        {c.city} — {c.address} (ID: {c.id})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Input
                                            id="smartshellCompanyId"
                                            type="number"
                                            className="h-11 rounded-xl flex-1"
                                            value={smartshellCompanyId ?? ''}
                                            onChange={(e) => setSmartshellCompanyId(e.target.value ? Number(e.target.value) : null)}
                                            placeholder="10436"
                                        />
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleTestSmartshell}
                                        disabled={isTestingSmartshell}
                                        className="h-11 rounded-xl px-4 border-slate-200 hover:bg-slate-50"
                                    >
                                        {isTestingSmartshell ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Globe className="mr-2 h-4 w-4 text-emerald-600" />
                                        )}
                                        Проверить соединение
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <Label htmlFor="smartshellApiKey" className="text-xs text-slate-500 font-medium">API ключ SmartShell (опционально)</Label>
                                <Input
                                    id="smartshellApiKey"
                                    type="password"
                                    className="h-10 rounded-xl font-mono text-xs"
                                    value={smartshellApiKey}
                                    onChange={(e) => setSmartshellApiKey(e.target.value)}
                                    placeholder="VX3HDdTOzDQ..."
                                />
                            </div>

                            {smartshellTestResult && (
                                <div className={`p-3.5 rounded-xl text-sm font-medium ${smartshellTestResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                                    {smartshellTestResult.message}
                                </div>
                            )}
                        </div>
                    )}
                </div>


                {/* Save Button */}
                <div className="pt-4">
                    <Button onClick={handleSave} disabled={isSaving} className="w-full rounded-xl h-12 text-base font-medium bg-slate-900 text-white hover:bg-slate-800 shadow-sm">
                        {isSaving ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-5 w-5" />
                        )}
                        Сохранить настройки
                    </Button>
                </div>
            </div>
            </div>
        </PageShell>
    )
}
