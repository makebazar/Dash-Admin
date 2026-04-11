"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { SignageStage } from "@/components/signage/SignageStage"
import { PageHeader, PageShell } from "@/components/layout/PageShell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { normalizeSignageLayout, type SignageLayout } from "@/lib/signage-layout"
import { cn } from "@/lib/utils"
import {
  Eye,
  Link2,
  Loader2,
  Monitor,
  PencilLine,
  RefreshCw,
  Tv,
  Unplug,
  Wifi,
  WifiOff,
} from "lucide-react"

type SignageDevice = {
  id: number
  club_id: number | null
  device_id: string
  pairing_code: string
  name: string | null
  status: "pending" | "paired" | "offline"
  orientation: "landscape" | "portrait"
  selected_display_id: string | null
  screen_label: string | null
  display_info: unknown
  last_seen_at: string | null
  paired_at: string | null
  created_at: string
  updated_at: string
  is_online: boolean
}

export default function ClubSignagePage({
  params,
}: {
  params: Promise<{ clubId: string }>
}) {
  const [clubId, setClubId] = useState("")
  const [devices, setDevices] = useState<SignageDevice[]>([])
  const [pairingCode, setPairingCode] = useState("")
  const [deviceName, setDeviceName] = useState("")
  const [renameDevice, setRenameDevice] = useState<SignageDevice | null>(null)
  const [previewDevice, setPreviewDevice] = useState<SignageDevice | null>(null)
  const [previewLayout, setPreviewLayout] = useState<SignageLayout | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [unpairingDeviceId, setUnpairingDeviceId] = useState<number | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPairing, setIsPairing] = useState(false)

  useEffect(() => {
    params.then(({ clubId: nextClubId }) => {
      setClubId(nextClubId)
      void fetchDevices(nextClubId)
    })
  }, [params])

  async function fetchDevices(targetClubId = clubId) {
    if (!targetClubId) return

    const initialLoad = devices.length === 0 && !isRefreshing
    if (initialLoad) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const res = await fetch(`/api/clubs/${targetClubId}/signage/devices`, { cache: "no-store" })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Не удалось загрузить устройства")
      }

      setDevices(Array.isArray(data.devices) ? data.devices : [])
    } catch (error) {
      console.error(error)
      alert("Не удалось загрузить экраны")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  async function handlePairDevice() {
    if (!clubId) return
    const normalizedCode = pairingCode.trim().toUpperCase()

    if (!normalizedCode) {
      alert("Укажи код привязки")
      return
    }

    setIsPairing(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/signage/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairingCode: normalizedCode,
          name: deviceName.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Не удалось привязать устройство")
      }

      setPairingCode("")
      setDeviceName("")
      await fetchDevices(clubId)
      alert("Устройство привязано")
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Не удалось привязать устройство")
    } finally {
      setIsPairing(false)
    }
  }

  async function handleOpenPreview(device: SignageDevice) {
    if (!clubId) return

    setPreviewDevice(device)
    setPreviewLayout(null)
    setIsPreviewLoading(true)

    try {
      const res = await fetch(`/api/clubs/${clubId}/signage/devices/${device.id}/layout`, {
        cache: "no-store",
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Не удалось загрузить превью")
      }

      setPreviewLayout(normalizeSignageLayout(data.layout, data.orientation))
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Не удалось загрузить превью")
      setPreviewDevice(null)
    } finally {
      setIsPreviewLoading(false)
    }
  }

  async function handleRenameDevice() {
    if (!clubId || !renameDevice) return
    const nextName = renameValue.trim()

    if (!nextName) {
      alert("Укажи новое название экрана")
      return
    }

    setIsRenaming(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/signage/devices/${renameDevice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Не удалось переименовать экран")
      }

      setRenameDevice(null)
      setRenameValue("")
      await fetchDevices(clubId)
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Не удалось переименовать экран")
    } finally {
      setIsRenaming(false)
    }
  }

  async function handleUnpairDevice(device: SignageDevice) {
    if (!clubId) return

    const confirmed = window.confirm(
      `Отвязать экран "${device.name || device.screen_label || `#${device.id}`}" от клуба?`
    )
    if (!confirmed) return

    setUnpairingDeviceId(device.id)
    try {
      const res = await fetch(`/api/clubs/${clubId}/signage/devices/${device.id}`, {
        method: "DELETE",
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Не удалось отвязать экран")
      }

      await fetchDevices(clubId)
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Не удалось отвязать экран")
    } finally {
      setUnpairingDeviceId(null)
    }
  }

  return (
    <PageShell maxWidth="7xl">
      <PageHeader
        title="Экраны"
        description="Привязка signage player к клубу и контроль онлайн-статуса устройств."
      >
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => void fetchDevices()}
          disabled={isRefreshing || isLoading}
        >
          <RefreshCw className={cn("h-4 w-4", (isRefreshing || isLoading) && "animate-spin")} />
          Обновить
        </Button>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2 text-slate-500">
              <Link2 className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-[0.24em]">Привязка</span>
            </div>
            <CardTitle className="text-2xl text-slate-900">Подключить новый экран</CardTitle>
            <CardDescription>
              Открой player на ПК, возьми код подключения и введи его здесь.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pairingCode">Код привязки</Label>
              <Input
                id="pairingCode"
                value={pairingCode}
                onChange={(event) => setPairingCode(event.target.value.toUpperCase())}
                placeholder="Например: ABCD-1234"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deviceName">Название экрана</Label>
              <Input
                id="deviceName"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                placeholder="Например: Зал 1 / ТВ у входа"
                className="h-11 rounded-xl"
              />
            </div>

            <Button
              className="h-11 w-full rounded-xl gap-2"
              onClick={handlePairDevice}
              disabled={isPairing}
            >
              {isPairing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Привязать устройство
            </Button>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              После привязки для каждого экрана можно открыть отдельный редактор контента.
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2 text-slate-500">
              <Tv className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-[0.24em]">Устройства</span>
            </div>
            <CardTitle className="text-2xl text-slate-900">Подключенные экраны</CardTitle>
            <CardDescription>
              Список player-устройств, которые уже привязаны к этому клубу.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : devices.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
                <Monitor className="h-6 w-6 text-slate-400" />
                <div className="space-y-1">
                  <div className="font-medium text-slate-900">Пока нет подключенных экранов</div>
                  <div className="text-sm text-slate-500">
                    Запусти player на ПК и привяжи его кодом слева.
                  </div>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Экран</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Ориентация</TableHead>
                    <TableHead>Монитор</TableHead>
                    <TableHead>Последний пинг</TableHead>
                    <TableHead className="text-right">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">
                            {device.name || device.screen_label || "Без названия"}
                          </div>
                          <div className="text-xs text-slate-500">
                            Код: {device.pairing_code} · ID: {device.device_id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {device.is_online ? (
                            <Wifi className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <WifiOff className="h-4 w-4 text-slate-400" />
                          )}
                          <Badge
                            variant="outline"
                            className={cn(
                              "border-transparent",
                              device.is_online
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            )}
                          >
                            {device.is_online ? "Онлайн" : "Оффлайн"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {device.orientation === "portrait" ? "Вертикально" : "Горизонтально"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-700">
                          {device.screen_label || device.selected_display_id || "Не выбран"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-700">
                          {formatLastSeen(device.last_seen_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => void handleOpenPreview(device)}
                          >
                            <Eye className="h-4 w-4" />
                            Превью
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              setRenameDevice(device)
                              setRenameValue(device.name || device.screen_label || "")
                            }}
                          >
                            <PencilLine className="h-4 w-4" />
                            Переименовать
                          </Button>
                          <Button asChild variant="outline" size="sm" className="gap-2">
                            <Link href={`/clubs/${clubId}/signage/${device.id}`}>
                              <PencilLine className="h-4 w-4" />
                              Редактировать
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-red-600 hover:text-red-700"
                            onClick={() => void handleUnpairDevice(device)}
                            disabled={unpairingDeviceId === device.id}
                          >
                            {unpairingDeviceId === device.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Unplug className="h-4 w-4" />
                            )}
                            Отвязать
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(renameDevice)} onOpenChange={(open) => !open && setRenameDevice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать экран</DialogTitle>
            <DialogDescription>
              Задай удобное название, чтобы экран проще было отличать в списке.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-device">Название экрана</Label>
            <Input
              id="rename-device"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="Например: ТВ у входа"
              className="h-11 rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDevice(null)}>
              Отмена
            </Button>
            <Button onClick={handleRenameDevice} disabled={isRenaming}>
              {isRenaming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(previewDevice)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewDevice(null)
            setPreviewLayout(null)
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Превью: {previewDevice?.name || previewDevice?.screen_label || "Экран"}
            </DialogTitle>
            <DialogDescription>
              Быстрый просмотр текущего layout без перехода в редактор.
            </DialogDescription>
          </DialogHeader>

          {isPreviewLoading || !previewDevice || !previewLayout ? (
            <div className="flex h-72 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="rounded-[28px] bg-[#0b0f14] p-5">
              <div className="mx-auto max-w-[720px]">
                <div
                  className={cn(
                    "mx-auto overflow-hidden",
                    previewDevice.orientation === "portrait" ? "w-[240px]" : "w-full"
                  )}
                >
                  <div
                    className={cn(
                      "mx-auto",
                      previewDevice.orientation === "portrait" ? "aspect-[9/16]" : "aspect-[16/9]"
                    )}
                  >
                    <SignageStage
                      layout={previewLayout}
                      orientation={previewDevice.orientation}
                      preview
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}

function formatLastSeen(value: string | null) {
  if (!value) return "Еще не выходил на связь"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Нет данных"

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}
