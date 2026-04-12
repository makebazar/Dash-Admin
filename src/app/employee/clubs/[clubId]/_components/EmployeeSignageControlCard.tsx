"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Loader2, PauseCircle } from "lucide-react"

type SignageDeviceListItem = {
  id: number
  name: string | null
  orientation: "landscape" | "portrait"
  screenLabel: string | null
  selectedDisplayId: string | null
  isOnline: boolean
  currentSlideId: string | null
  isStopped: boolean
  stopUntil: string | null
}

type SignageSlideItem = {
  id: string
  title: string
  durationSec: number
  order: number
}

type SignageDeviceDetails = {
  id: number
  name: string | null
  screenLabel: string | null
  selectedDisplayId: string | null
  isOnline: boolean
  currentSlideId: string | null
  isStopped: boolean
  stopUntil: string | null
}

function formatMonitorLabel(device: SignageDeviceListItem | SignageDeviceDetails) {
  return device.name || device.screenLabel || device.selectedDisplayId || `Экран #${device.id}`
}

function formatStopLeft(stopUntil: string | null, now: number) {
  if (!stopUntil) return null
  const diffMs = new Date(stopUntil).getTime() - now
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null
  const totalSeconds = Math.ceil(diffMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export function EmployeeSignageControlCard({
  clubId,
  enabled,
}: {
  clubId: string
  enabled: boolean
}) {
  const [devices, setDevices] = useState<SignageDeviceListItem[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [device, setDevice] = useState<SignageDeviceDetails | null>(null)
  const [slides, setSlides] = useState<SignageSlideItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeviceLoading, setIsDeviceLoading] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState<"next" | "prev" | "stop" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const loadDevices = useCallback(
    async (preferredDeviceId?: string) => {
      if (!enabled || !clubId) return []

      const res = await fetch(`/api/employee/clubs/${clubId}/signage/devices`, {
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Не удалось загрузить экраны")
      }

      const nextDevices = Array.isArray(data.devices) ? (data.devices as SignageDeviceListItem[]) : []
      setDevices(nextDevices)

      const requestedId = preferredDeviceId || selectedDeviceId
      const resolvedSelectedId =
        nextDevices.length === 1
          ? String(nextDevices[0].id)
          : requestedId && nextDevices.some((item) => String(item.id) === String(requestedId))
            ? String(requestedId)
            : ""

      if (resolvedSelectedId !== selectedDeviceId) {
        setSelectedDeviceId(resolvedSelectedId)
      }

      return nextDevices
    },
    [clubId, enabled, selectedDeviceId]
  )

  const loadDeviceDetails = useCallback(
    async (deviceId: string) => {
      if (!enabled || !clubId || !deviceId) return

      setIsDeviceLoading(true)
      try {
        const res = await fetch(`/api/employee/clubs/${clubId}/signage/devices/${deviceId}/control`, {
          cache: "no-store",
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || "Не удалось загрузить управление экраном")
        }

        setDevice(data.device || null)
        setSlides(Array.isArray(data.slides) ? data.slides : [])
        setError(null)
      } catch (nextError: any) {
        setDevice(null)
        setSlides([])
        setError(nextError?.message || "Не удалось загрузить управление экраном")
      } finally {
        setIsDeviceLoading(false)
      }
    },
    [clubId, enabled]
  )

  useEffect(() => {
    if (!enabled || !clubId) {
      setDevices([])
      setSelectedDeviceId("")
      setDevice(null)
      setSlides([])
      setError(null)
      setIsLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const nextDevices = await loadDevices()
        if (cancelled) return

        const autoSelectedId =
          nextDevices.length === 1 ? String(nextDevices[0].id) : selectedDeviceId

        if (autoSelectedId) {
          await loadDeviceDetails(autoSelectedId)
        } else {
          setDevice(null)
          setSlides([])
          setError(nextDevices.length === 0 ? null : "Выбери монитор для управления")
        }
      } catch (nextError: any) {
        if (cancelled) return
        setError(nextError?.message || "Не удалось загрузить экраны")
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [clubId, enabled, loadDeviceDetails, loadDevices, selectedDeviceId])

  useEffect(() => {
    if (!enabled || !selectedDeviceId) return
    void loadDeviceDetails(selectedDeviceId)
  }, [enabled, loadDeviceDetails, selectedDeviceId])

  useEffect(() => {
    if (!enabled || !clubId) return

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [clubId, enabled])

  useEffect(() => {
    if (!enabled || !clubId) return

    const intervalId = window.setInterval(() => {
      void loadDevices(selectedDeviceId)
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [clubId, enabled, loadDevices, selectedDeviceId])

  const currentSlideIndex = useMemo(
    () => slides.findIndex((slide) => slide.id === device?.currentSlideId),
    [device?.currentSlideId, slides]
  )
  const currentSlide =
    slides[currentSlideIndex >= 0 ? currentSlideIndex : 0] ?? null
  const stopLeft = formatStopLeft(device?.stopUntil || null, now)

  const handleAction = useCallback(
    async (action: "next" | "prev" | "stop") => {
      if (!selectedDeviceId) return

      setIsActionLoading(action)
      try {
        const res = await fetch(`/api/employee/clubs/${clubId}/signage/devices/${selectedDeviceId}/control`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            currentSlideId: currentSlide?.id || device?.currentSlideId || null,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || "Не удалось отправить команду")
        }

        setDevice(data.device || null)
        setSlides(Array.isArray(data.slides) ? data.slides : [])
        setDevices((current) =>
          current.map((item) =>
            String(item.id) === String(selectedDeviceId)
              ? { ...item, ...(data.device || {}) }
              : item
          )
        )
        setError(null)
      } catch (nextError: any) {
        setError(nextError?.message || "Не удалось отправить команду")
      } finally {
        setIsActionLoading(null)
      }
    },
    [clubId, currentSlide?.id, device?.currentSlideId, selectedDeviceId]
  )

  if (!enabled) return null
  if (!isLoading && devices.length === 0) return null

  return (
    <Card className="overflow-hidden border-border bg-card shadow-sm">
      <CardContent className="p-3 md:p-4">
        {isLoading ? (
          <div className="flex h-20 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {devices.length > 1 && (
              <div className="mb-3 flex items-center gap-2">
                <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                  <SelectTrigger className="h-10 rounded-xl border-border bg-background">
                    <SelectValue placeholder="Выбери монитор" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {formatMonitorLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedDeviceId && (
              <div className="rounded-2xl border border-border bg-background px-3 py-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {device ? formatMonitorLabel(device) : "Монитор"}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {device?.isOnline ? "Онлайн" : "Оффлайн"}
                        <span className="mx-1.5 text-border">•</span>
                      {currentSlide
                        ? `Слайд ${Math.max(currentSlideIndex, 0) + 1} из ${slides.length}`
                        : "Нет активных слайдов"}
                      </div>
                      <div className="mt-1 truncate text-sm font-medium text-foreground">
                        {currentSlide?.title || "Без названия"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 xl:shrink-0">
                    {device?.isStopped && stopLeft && (
                      <Badge variant="outline" className="h-9 rounded-xl border-rose-500/30 bg-rose-500/10 px-3 text-rose-600 dark:text-rose-400">
                        Стоп {stopLeft}
                      </Badge>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 rounded-xl border-border bg-card"
                      disabled={!device?.isOnline || isDeviceLoading || Boolean(isActionLoading) || slides.length === 0}
                      onClick={() => void handleAction("prev")}
                    >
                      {isActionLoading === "prev" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ChevronLeft className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl border-rose-500/30 bg-rose-500/10 px-3 text-rose-600 hover:bg-rose-500/15 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                      disabled={!device?.isOnline || isDeviceLoading || Boolean(isActionLoading) || slides.length === 0}
                      onClick={() => void handleAction("stop")}
                    >
                      {isActionLoading === "stop" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <PauseCircle className="mr-2 h-4 w-4" />
                      )}
                      Стоп
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 rounded-xl border-border bg-card"
                      disabled={!device?.isOnline || isDeviceLoading || Boolean(isActionLoading) || slides.length === 0}
                      onClick={() => void handleAction("next")}
                    >
                      {isActionLoading === "next" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {error && (
                  <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                    {error}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
