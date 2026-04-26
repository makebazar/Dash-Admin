"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Save } from "lucide-react"

type MaintenanceSettings = {
    require_photos_on_completion: boolean
    min_photos: number
    require_notes_on_completion: boolean
}

const DEFAULT_SETTINGS: MaintenanceSettings = {
    require_photos_on_completion: true,
    min_photos: 1,
    require_notes_on_completion: false,
}

export function MaintenanceCompletionSettingsTab({ clubId }: { clubId: string }) {
    const [settings, setSettings] = useState<MaintenanceSettings>(DEFAULT_SETTINGS)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    const fetchSettings = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/settings/maintenance`, { cache: "no-store" })
            const data = await res.json()
            if (!res.ok) {
                throw new Error(data?.error || "Не удалось загрузить настройки обслуживания")
            }
            setSettings({
                require_photos_on_completion: data.require_photos_on_completion !== false,
                min_photos: Math.max(0, Number(data.min_photos) || 0),
                require_notes_on_completion: data.require_notes_on_completion === true,
            })
        } catch (error) {
            console.error(error)
            setSettings(DEFAULT_SETTINGS)
        } finally {
            setIsLoading(false)
        }
    }, [clubId])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    const saveSettings = async () => {
        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/settings/maintenance`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            })
            const data = await res.json()
            if (!res.ok) {
                throw new Error(data?.error || "Не удалось сохранить настройки обслуживания")
            }
            setSettings({
                require_photos_on_completion: data.require_photos_on_completion !== false,
                min_photos: Math.max(0, Number(data.min_photos) || 0),
                require_notes_on_completion: data.require_notes_on_completion === true,
            })
        } catch (error: any) {
            console.error(error)
            alert(error?.message || "Не удалось сохранить настройки")
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    const normalizedMinPhotos = settings.require_photos_on_completion
        ? Math.max(1, Math.floor(Number(settings.min_photos) || 1))
        : 0

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>Завершение обслуживания</CardTitle>
                <CardDescription>
                    Настрой требования к отчёту сотрудника при выполнении задач обслуживания.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="flex items-start justify-between gap-6">
                    <div className="space-y-1">
                        <Label className="text-base">Фото обязательны</Label>
                        <p className="text-sm text-muted-foreground">
                            Если выключено — задачу можно завершить без фотоотчёта.
                        </p>
                    </div>
                    <Switch
                        checked={settings.require_photos_on_completion}
                        onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, require_photos_on_completion: checked }))}
                    />
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] items-start">
                    <div className="space-y-1">
                        <Label className="text-base">Минимум фото</Label>
                        <p className="text-sm text-muted-foreground">
                            Сколько фото нужно приложить к завершению задачи.
                        </p>
                    </div>
                    <Input
                        type="number"
                        inputMode="numeric"
                        value={String(settings.min_photos)}
                        disabled={!settings.require_photos_on_completion}
                        min={0}
                        max={10}
                        onChange={(e) => setSettings((prev) => ({ ...prev, min_photos: Number(e.target.value) || 0 }))}
                        onBlur={() => setSettings((prev) => ({ ...prev, min_photos: normalizedMinPhotos }))}
                        className="h-11 rounded-xl"
                    />
                </div>

                <div className="flex items-start justify-between gap-6">
                    <div className="space-y-1">
                        <Label className="text-base">Комментарий обязателен</Label>
                        <p className="text-sm text-muted-foreground">
                            Если включено — сотрудник должен оставить текстовый комментарий при завершении.
                        </p>
                    </div>
                    <Switch
                        checked={settings.require_notes_on_completion}
                        onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, require_notes_on_completion: checked }))}
                    />
                </div>

                <div className="flex justify-end">
                    <Button
                        type="button"
                        onClick={saveSettings}
                        disabled={isSaving}
                        className="rounded-xl h-11 px-6 bg-slate-900 text-white hover:bg-slate-800"
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Сохранить
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

