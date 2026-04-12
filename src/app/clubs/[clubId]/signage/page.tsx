"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { SignageStage } from "@/components/signage/SignageStage"
import { PageShell } from "@/components/layout/PageShell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { normalizeSignageLayout, type SignageLayout } from "@/lib/signage-layout"
import { cn } from "@/lib/utils"
import {
  LayoutGrid,
  Link2,
  Loader2,
  Monitor,
  MoreVertical,
  PencilLine,
  PlaySquare,
  Plus,
  RefreshCw,
  Settings2,
  Signal,
  Tv,
  Unplug,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  const [unpairDevice, setUnpairDevice] = useState<SignageDevice | null>(null)
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

  async function handleUnpairDevice() {
    if (!clubId || !unpairDevice) return

    setUnpairingDeviceId(unpairDevice.id)
    try {
      const res = await fetch(`/api/clubs/${clubId}/signage/devices/${unpairDevice.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        let errorMessage = "Не удалось отвязать экран"
        try {
          const data = await res.json()
          if (data.error) errorMessage = data.error
        } catch {
          // ignore json parse error
        }
        throw new Error(errorMessage)
      }

      setUnpairDevice(null)
      await fetchDevices(clubId)
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Не удалось отвязать экран")
    } finally {
      setUnpairingDeviceId(null)
    }
  }

  return (
    <PageShell maxWidth="5xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-12">
        <div className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
            Экраны
          </h1>
          <p className="text-slate-500 text-lg">
            Управление устройствами трансляции
          </p>
        </div>
        
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end hidden md:flex">
          <Button
            variant="outline"
            className="w-full sm:w-auto rounded-xl h-12 border-slate-200 px-6 font-medium text-slate-700 hover:bg-slate-50 hover:text-black"
            onClick={() => void fetchDevices()}
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw className={cn("mr-2 h-5 w-5", (isRefreshing || isLoading) && "animate-spin")} />
            Синхронизировать
          </Button>
          <Button
            className="w-full bg-slate-900 text-white hover:bg-slate-800 sm:w-auto rounded-xl h-12 px-6 font-medium shadow-sm"
            onClick={() => document.getElementById('pairing-section')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Plus className="mr-2 h-5 w-5" />
            Подключить экран
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 mb-12">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Всего экранов</p>
              <p className="text-3xl font-semibold text-slate-900 mt-1">{devices.length}</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Tv className="h-6 w-6 text-slate-400" />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">В сети</p>
              <p className="text-3xl font-semibold text-slate-900 mt-1">{devices.filter(d => d.is_online).length}</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <Signal className="h-6 w-6 text-emerald-500" />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-slate-200 bg-white py-24 text-center">
            <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <Monitor className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Нет подключенных экранов</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Откройте приложение плеера на устройстве и введите код привязки ниже, чтобы добавить первый экран.
            </p>
            <Button
              variant="outline"
              className="mt-4 rounded-xl border-slate-200"
              onClick={() => document.getElementById('pairing-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Перейти к привязке
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {devices.map((device) => (
              <div 
                key={device.id}
                className="group relative flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
              >
                {/* Header: Status & Actions */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-slate-50/50 px-2.5 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <div className={cn("h-1.5 w-1.5 rounded-full", device.is_online ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-slate-300")} />
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                        {device.is_online ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px] rounded-xl p-2">
                      <DropdownMenuItem asChild className="gap-3 cursor-pointer rounded-lg px-3 py-2 text-[15px]">
                        <Link href={`/clubs/${clubId}/signage/${device.id}`}>
                          <LayoutGrid className="h-4 w-4 text-[#64748B]" strokeWidth={1.5} />
                          Настройка
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1.5" />
                      <DropdownMenuItem 
                        onClick={() => {
                          setRenameDevice(device)
                          setRenameValue(device.name || device.screen_label || "")
                        }}
                        className="gap-3 cursor-pointer rounded-lg px-3 py-2 text-[15px]"
                      >
                        <PencilLine className="h-4 w-4 text-[#64748B]" strokeWidth={1.5} />
                        Переименовать
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setUnpairDevice(device)}
                        className="gap-3 cursor-pointer rounded-lg px-3 py-2 text-[15px] text-[#EF4444] focus:bg-red-50 focus:text-[#EF4444]"
                        disabled={unpairingDeviceId === device.id}
                      >
                        <Unplug className="h-4 w-4" strokeWidth={1.5} />
                        <div className="flex flex-col leading-tight">
                          <span>Отвязать</span>
                          <span>устройство</span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Title & IDs */}
                <div className="mb-4 space-y-1.5">
                  <h3 className="text-lg font-semibold text-slate-900 leading-tight">
                    {device.name || device.screen_label || "Без названия"}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="font-mono rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                      {device.pairing_code}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="truncate text-[13px]">{device.screen_label || "Монитор не выбран"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Secondary Section: Pairing */}
      <div id="pairing-section" className="rounded-3xl bg-white border border-slate-200 p-8 sm:p-12 mb-12">
        <div className="mx-auto max-w-2xl text-center space-y-8">
          <div className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50">
              <Signal className="h-6 w-6 text-slate-700" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Привязать новое устройство</h2>
            <p className="text-slate-500 text-sm">
              Запустите приложение Signage Player на целевом устройстве. 
              На экране появится уникальный код — введите его ниже.
            </p>
          </div>

          <div className="mx-auto flex max-w-md flex-col gap-4 sm:flex-row">
            <div className="flex-1 space-y-2 text-left">
              <Input
                id="pairingCode"
                value={pairingCode}
                onChange={(event) => setPairingCode(event.target.value.toUpperCase())}
                placeholder="Код: ABCD-1234"
                className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-mono text-lg placeholder:text-slate-400 focus-visible:ring-slate-200"
              />
            </div>
            <div className="flex-1 space-y-2 text-left">
              <Input
                id="deviceName"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                placeholder="Имя: ТВ у бара"
                className="h-12 rounded-xl border-slate-200 bg-slate-50/50 text-base placeholder:text-slate-400 focus-visible:ring-slate-200"
              />
            </div>
          </div>
          
          <Button
            size="lg"
            className="h-12 rounded-xl bg-slate-900 text-white hover:bg-slate-800 min-w-[200px] font-medium"
            onClick={handlePairDevice}
            disabled={isPairing || !pairingCode.trim()}
          >
            {isPairing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Plus className="mr-2 h-5 w-5" />}
            Добавить в систему
          </Button>
        </div>
      </div>

      <Dialog open={Boolean(renameDevice)} onOpenChange={(open) => !open && setRenameDevice(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border border-slate-200 shadow-2xl bg-white p-6">
          <DialogHeader className="space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <PencilLine className="h-6 w-6 text-slate-700" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">Переименовать экран</DialogTitle>
              <DialogDescription className="text-sm font-medium text-slate-500">
                Задайте понятное название для удобного поиска в списке
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="rename-device" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Название экрана
              </Label>
              <Input
                id="rename-device"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                placeholder="Например: ТВ у входа"
                className="bg-slate-50/50 border-slate-200 focus:border-slate-400 h-10 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 font-medium"
              onClick={handleRenameDevice}
              disabled={isRenaming}
            >
              {isRenaming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                'Сохранить изменения'
              )}
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
        <DialogContent className="max-w-4xl rounded-3xl border border-slate-200 shadow-2xl bg-white p-0 overflow-hidden">
          <div className="p-6 pb-4 border-b border-slate-100">
            <DialogHeader className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <PlaySquare className="h-6 w-6 text-slate-700" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-slate-900">
                    Превью: {previewDevice?.name || previewDevice?.screen_label || "Экран"}
                  </DialogTitle>
                  <DialogDescription className="text-sm font-medium text-slate-500">
                    Предварительный просмотр текущей сетки вещания
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="bg-slate-50/50 p-6 sm:p-10">
            {isPreviewLoading || !previewDevice || !previewLayout ? (
              <div className="flex h-72 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="rounded-2xl bg-[#0b0f14] p-4 shadow-xl ring-1 ring-slate-900/5">
                <div className="mx-auto max-w-[720px]">
                  <div
                    className={cn(
                      "mx-auto overflow-hidden rounded-lg",
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
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(unpairDevice)} onOpenChange={(open) => !open && setUnpairDevice(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl border border-slate-200 shadow-2xl bg-white p-6">
          <DialogHeader className="space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center">
              <Unplug className="h-6 w-6 text-rose-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">Отвязать устройство</DialogTitle>
              <DialogDescription className="text-sm font-medium text-slate-500">
                Вы собираетесь отвязать экран <strong>{unpairDevice?.name || unpairDevice?.screen_label || "Без названия"}</strong> от клуба
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl space-y-2">
              <p className="text-[11px] text-rose-700 leading-relaxed font-medium">
                После отвязки этот экран перестанет получать расписание трансляций и перейдет в режим ожидания привязки.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setUnpairDevice(null)}
              disabled={unpairingDeviceId !== null}
              className="flex-1 text-xs font-bold uppercase tracking-widest rounded-xl h-11"
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnpairDevice}
              disabled={unpairingDeviceId !== null}
              className="flex-1 text-xs font-bold uppercase tracking-widest shadow-lg shadow-rose-200 rounded-xl h-11"
            >
              {unpairingDeviceId !== null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Подтвердить'
              )}
            </Button>
          </DialogFooter>
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
