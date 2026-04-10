"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Save, Globe, Building, MapPin, Sun, Moon } from "lucide-react"
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
    const [timezone, setTimezone] = useState('Europe/Moscow')
    const [dayStartHour, setDayStartHour] = useState(8)
    const [nightStartHour, setNightStartHour] = useState(20)

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
                                <SelectContent className="max-h-[300px] rounded-xl border-slate-200 shadow-lg">
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
                                    <SelectContent className="max-h-[300px] rounded-xl border-slate-200 shadow-lg">
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
                                    <SelectContent className="max-h-[300px] rounded-xl border-slate-200 shadow-lg">
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
