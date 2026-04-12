"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { SignageStage } from "@/components/signage/SignageStage"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  createDefaultSignageLayout,
  type SignageLayout,
  type SignageSlide,
} from "@/lib/signage-layout"
import { cn } from "@/lib/utils"
import { Check, Monitor, RectangleHorizontal, RectangleVertical, RefreshCw, Tv } from "lucide-react"

type DisplayInfo = {
  id: string
  label: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  workArea: {
    x: number
    y: number
    width: number
    height: number
  }
  scaleFactor: number
  rotation: number
  internal: boolean
  primary: boolean
}

type BootstrapPayload = {
  deviceId: string
  pairingCode: string
  deviceToken: string | null
  pairedClubId: number | null
  pairedClubName: string | null
  layoutJson: SignageLayout | null
  currentSlideId: string | null
  controlAction: "jump" | "pause" | null
  controlSlideId: string | null
  controlUntil: string | null
  controlUpdatedAt: string | null
  serverUpdatedAt: string | null
  fullscreen: boolean
  orientation: "landscape" | "portrait"
  selectedDisplayId: string | null
  contentWidth: number
  contentHeight: number
  displays: DisplayInfo[]
  version: string
  platform: string
}

type ElectronSignageApi = {
  getBootstrap: () => Promise<BootstrapPayload>
  listDisplays: () => Promise<DisplayInfo[]>
  selectDisplay: (displayId: string) => Promise<BootstrapPayload>
  setFullscreen: (enabled: boolean) => Promise<BootstrapPayload>
  setOrientation: (orientation: "landscape" | "portrait") => Promise<BootstrapPayload>
  updateServerState: (payload: {
    deviceToken: string | null
    pairedClubId: number | null
    pairedClubName: string | null
    layoutJson: SignageLayout | null
    serverUpdatedAt: string | null
    orientation: "landscape" | "portrait"
  }) => Promise<void>
  reloadWindow: () => Promise<boolean>
  onBootstrapUpdated: (callback: (payload: BootstrapPayload) => void) => () => void
}

const browserBootstrap = (): BootstrapPayload => ({
  deviceId: "browser-preview-device",
  pairingCode: "DEMO-2026",
  deviceToken: null,
  pairedClubId: null,
  pairedClubName: null,
  layoutJson: null,
  currentSlideId: null,
  controlAction: null,
  controlSlideId: null,
  controlUntil: null,
  controlUpdatedAt: null,
  serverUpdatedAt: null,
  fullscreen: false,
  orientation: "landscape",
  selectedDisplayId: "browser-display",
  contentWidth: 1920,
  contentHeight: 1080,
  version: "web-preview",
  platform: "browser",
  displays: [
    {
      id: "browser-display",
      label: "Browser Preview",
      bounds: {
        x: 0,
        y: 0,
        width: typeof window !== "undefined" ? window.innerWidth : 1920,
        height: typeof window !== "undefined" ? window.innerHeight : 1080,
      },
      workArea: {
        x: 0,
        y: 0,
        width: typeof window !== "undefined" ? window.innerWidth : 1920,
        height: typeof window !== "undefined" ? window.innerHeight : 1080,
      },
      scaleFactor: 1,
      rotation: 0,
      internal: false,
      primary: true,
    },
  ],
})

function getElectronApi(): ElectronSignageApi | null {
  if (typeof window === "undefined") return null

  const candidate = (window as Window & { electronSignage?: ElectronSignageApi }).electronSignage
  return candidate ?? null
}

export default function PlayerPage() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null)
  const [pendingDisplayId, setPendingDisplayId] = useState<string | null>(null)
  const [isReloading, setIsReloading] = useState(false)
  const lastReportedSlideIdRef = useRef<string | null>(null)

  const electronApi = useMemo(() => getElectronApi(), [])
  const selectedDisplay = bootstrap?.displays.find(
    (display) => display.id === bootstrap.selectedDisplayId
  ) ?? null
  const isPortrait = bootstrap?.orientation === "portrait"

  const applyServerState = useCallback(
    async (serverDevice: {
      deviceToken: string | null
      clubId: number | null
      clubName: string | null
      layoutJson: SignageLayout | null
      currentSlideId: string | null
      controlAction: "jump" | "pause" | null
      controlSlideId: string | null
      controlUntil: string | null
      controlUpdatedAt: string | null
      serverUpdatedAt: string | null
      orientation: "landscape" | "portrait"
    }) => {
      setBootstrap((current) =>
        current
          ? {
              ...current,
              deviceToken: serverDevice.deviceToken,
              pairedClubId: serverDevice.clubId,
              pairedClubName: serverDevice.clubName,
              layoutJson: serverDevice.layoutJson,
              currentSlideId: serverDevice.currentSlideId,
              controlAction: serverDevice.controlAction,
              controlSlideId: serverDevice.controlSlideId,
              controlUntil: serverDevice.controlUntil,
              controlUpdatedAt: serverDevice.controlUpdatedAt,
              serverUpdatedAt: serverDevice.serverUpdatedAt,
              orientation: serverDevice.orientation,
            }
          : current
      )

      if (electronApi) {
        await electronApi.updateServerState({
          deviceToken: serverDevice.deviceToken,
          pairedClubId: serverDevice.clubId,
          pairedClubName: serverDevice.clubName,
          layoutJson: serverDevice.layoutJson,
          serverUpdatedAt: serverDevice.serverUpdatedAt,
          orientation: serverDevice.orientation,
        })
      }
    },
    [electronApi]
  )

  const syncDeviceWithServer = useCallback(
    async (payload: BootstrapPayload) => {
      const res = await fetch("/api/signage/device/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: payload.deviceId,
          deviceToken: payload.deviceToken,
          pairingCode: payload.pairingCode,
          selectedDisplayId: payload.selectedDisplayId,
          orientation: payload.orientation,
          displays: payload.displays,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Signage bootstrap request failed")
      }

      await applyServerState({
        deviceToken: data?.device?.deviceToken || null,
        clubId: data?.device?.clubId ?? null,
        clubName: data?.device?.clubName || null,
        layoutJson: data?.device?.layoutJson || null,
        currentSlideId: data?.device?.currentSlideId || null,
        controlAction: data?.device?.controlAction === "pause" ? "pause" : data?.device?.controlAction === "jump" ? "jump" : null,
        controlSlideId: data?.device?.controlSlideId || null,
        controlUntil: data?.device?.controlUntil || null,
        controlUpdatedAt: data?.device?.controlUpdatedAt || null,
        serverUpdatedAt: data?.device?.serverUpdatedAt || null,
        orientation: data?.device?.orientation === "portrait" ? "portrait" : "landscape",
      })
    },
    [applyServerState]
  )

  useEffect(() => {
    let disposed = false
    let unsubscribe: (() => void) | undefined

    async function loadBootstrap() {
      if (!electronApi) {
        setBootstrap(browserBootstrap())
        return
      }

      const payload = await electronApi.getBootstrap()
      if (!disposed) {
        setBootstrap(payload)
      }

      unsubscribe = electronApi.onBootstrapUpdated((nextPayload) => {
        if (!disposed) {
          setBootstrap(nextPayload)
        }
      })
    }

    loadBootstrap()

    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [electronApi])

  useEffect(() => {
    if (!electronApi || !bootstrap) return

    let cancelled = false

    const syncDevice = async () => {
      try {
        await syncDeviceWithServer(bootstrap)
      } catch (error) {
        if (cancelled) return
        console.error("Signage bootstrap sync error:", error)
      }
    }

    void syncDevice()

    return () => {
      cancelled = true
    }
  }, [
    electronApi,
    bootstrap?.deviceId,
    bootstrap?.deviceToken,
    bootstrap?.pairingCode,
    bootstrap?.selectedDisplayId,
    bootstrap?.orientation,
    syncDeviceWithServer,
  ])

  useEffect(() => {
    if (!electronApi || !bootstrap?.deviceId) return

    const params = new URLSearchParams({
      deviceId: bootstrap.deviceId,
    })

    if (bootstrap.deviceToken) {
      params.set("deviceToken", bootstrap.deviceToken)
    } else if (bootstrap.pairingCode) {
      params.set("pairingCode", bootstrap.pairingCode)
    }

    const eventSource = new EventSource(`/api/signage/device/stream?${params.toString()}`)

    const syncFromServer = async () => {
      try {
        await syncDeviceWithServer(bootstrap)
      } catch (error) {
        console.error("Signage stream sync error:", error)
      }
    }

    const handleUpdate = () => {
      void syncFromServer()
    }

    eventSource.addEventListener("update", handleUpdate)

    return () => {
      eventSource.removeEventListener("update", handleUpdate)
      eventSource.close()
    }
  }, [
    electronApi,
    bootstrap?.deviceId,
    bootstrap?.deviceToken,
    bootstrap?.pairingCode,
    bootstrap?.selectedDisplayId,
    bootstrap?.orientation,
    syncDeviceWithServer,
  ])

  useEffect(() => {
    if (!electronApi || !bootstrap) return

    const sendHeartbeat = async () => {
      try {
        await fetch("/api/signage/device/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: bootstrap.deviceId,
            deviceToken: bootstrap.deviceToken,
          }),
        })
      } catch (error) {
        console.error("Signage heartbeat error:", error)
      }
    }

    void sendHeartbeat()
    const intervalId = window.setInterval(sendHeartbeat, 30000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [electronApi, bootstrap?.deviceId, bootstrap?.deviceToken])

  const handleCurrentSlideChange = useCallback(
    async (slide: SignageSlide | null) => {
      if (!bootstrap?.deviceId || !bootstrap.deviceToken) return

      const nextSlideId = slide?.id || null
      if (lastReportedSlideIdRef.current === nextSlideId) return
      lastReportedSlideIdRef.current = nextSlideId

      try {
        await fetch("/api/signage/device/current-slide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: bootstrap.deviceId,
            deviceToken: bootstrap.deviceToken,
            currentSlideId: nextSlideId,
          }),
        })
      } catch (error) {
        console.error("Signage current slide sync error:", error)
      }
    },
    [bootstrap?.deviceId, bootstrap?.deviceToken]
  )

  async function handleDisplaySelect(displayId: string) {
    if (!electronApi) return

    try {
      setPendingDisplayId(displayId)
      const payload = await electronApi.selectDisplay(displayId)
      setBootstrap(payload)
    } finally {
      setPendingDisplayId(null)
    }
  }

  async function handleFullscreen(enabled: boolean) {
    if (!electronApi) return
    const payload = await electronApi.setFullscreen(enabled)
    setBootstrap(payload)
  }

  async function handleOrientationChange(orientation: "landscape" | "portrait") {
    if (!electronApi) return
    const payload = await electronApi.setOrientation(orientation)
    setBootstrap(payload)
  }

  async function handleReload() {
    if (!electronApi) return

    try {
      setIsReloading(true)
      await electronApi.reloadWindow()
    } finally {
      setIsReloading(false)
    }
  }

  if (!bootstrap) {
    return (
      <main className="min-h-screen bg-[#0b0f14] text-white">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
          <div className="text-sm text-white/60">Загрузка проигрывателя...</div>
        </div>
      </main>
    )
  }

  const shouldRenderContent =
    Boolean(bootstrap.pairedClubId) && bootstrap.fullscreen

  if (shouldRenderContent) {
    return (
      <main className="h-screen w-screen overflow-hidden bg-black">
        <div className="relative h-full w-full overflow-hidden">
          <div
            className={cn(
              "overflow-hidden",
              isPortrait
                ? "absolute left-1/2 top-1/2 h-[100vw] w-[100vh] -translate-x-1/2 -translate-y-1/2 rotate-90"
                : "relative h-full w-full"
            )}
          >
            <SignageStage
              key={`${bootstrap.serverUpdatedAt || "initial"}:${bootstrap.orientation}`}
              layout={bootstrap.layoutJson || createDefaultSignageLayout(bootstrap.orientation)}
              orientation={bootstrap.orientation}
              className="h-full w-full"
              forcedSlideId={bootstrap.controlAction === "pause" ? bootstrap.controlSlideId : null}
              forcedUntil={bootstrap.controlAction === "pause" ? bootstrap.controlUntil : null}
              jumpSlideId={bootstrap.controlAction === "jump" ? bootstrap.controlSlideId : null}
              jumpRequestKey={bootstrap.controlAction === "jump" ? bootstrap.controlUpdatedAt : null}
              onCurrentSlideChange={handleCurrentSlideChange}
            />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#0b0f14] text-white">
      <div className="relative h-full w-full overflow-hidden">
        <div
          className={cn(
            "overflow-hidden",
            isPortrait
              ? "absolute left-1/2 top-1/2 h-[100vw] w-[100vh] -translate-x-1/2 -translate-y-1/2 rotate-90"
              : "relative h-full w-full"
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.08),_transparent_26%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_20%)]" />
          <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col justify-between px-6 py-8 lg:px-10 lg:py-10">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white/70 backdrop-blur"
                >
                  {electronApi ? "Приложение Windows" : "Предпросмотр в браузере"}
                </Badge>
                <div className="text-sm uppercase tracking-[0.28em] text-white/35">DashAdmin Экран</div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => handleFullscreen(!bootstrap.fullscreen)}
                  disabled={!electronApi}
                >
                  <Tv className="size-4" />
                  {bootstrap.fullscreen ? "Выйти из полного экрана" : "Полный экран"}
                </Button>
                <Button
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={handleReload}
                  disabled={!electronApi || isReloading}
                >
                  <RefreshCw className={cn("size-4", isReloading && "animate-spin")} />
                  Обновить
                </Button>
              </div>
            </div>

            <section className="grid items-end gap-10 py-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
              <div className="space-y-6">
                <div className="text-sm uppercase tracking-[0.34em] text-white/40">
                  Код подключения
                </div>
                <div className="text-6xl font-semibold tracking-[0.18em] text-white sm:text-7xl lg:text-8xl">
                  {bootstrap.pairingCode}
                </div>
                <div className="max-w-md text-sm leading-6 text-white/45">
                  Введи этот код на сайте, чтобы привязать устройство к клубу.
                </div>
                <div className="text-sm text-white/55">
                  {bootstrap.pairedClubName
                    ? `Устройство привязано к клубу: ${bootstrap.pairedClubName}`
                    : "Устройство еще не привязано к клубу"}
                </div>

                <div className="pt-4">
                  <div className="mb-3 text-sm uppercase tracking-[0.28em] text-white/40">
                    Формат вывода контента
                  </div>
                  <div className="flex items-end gap-6">
                    <div className="relative flex h-[220px] w-[264px] items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.03] shadow-inner shadow-black/20 transition-all">
                      <div
                        className={cn(
                          "relative rounded-[18px] border border-white/8 bg-[#0f141b] transition-all duration-300",
                          bootstrap.orientation === "portrait"
                            ? "h-[168px] w-[96px] rotate-90"
                            : "h-[96px] w-[168px]"
                        )}
                      >
                        <div className="absolute inset-2 rounded-[12px] border border-white/6" />
                      </div>
                    </div>
                    <div className="space-y-2 pb-2">
                      <div className="text-base font-medium text-white">
                        {bootstrap.orientation === "portrait" ? "Контент повернут на 90 градусов" : "Контент в стандартной ориентации"}
                      </div>
                      <div className="text-sm text-white/45">
                        Формат рендера: {bootstrap.contentWidth}x{bootstrap.contentHeight}
                      </div>
                      <div className="text-sm text-white/45">
                        При вертикальном режиме весь слой вывода разворачивается под повернутый экран.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm lg:p-6">
                <div className="mb-4 flex items-center gap-2 text-sm uppercase tracking-[0.28em] text-white/40">
                  <Monitor className="size-4" />
                  Настройки экрана
                </div>

                <OrientationButtons
                  orientation={bootstrap.orientation}
                  disabled={!electronApi}
                  onChange={handleOrientationChange}
                />

                <DisplayList
                  displays={bootstrap.displays}
                  selectedDisplayId={bootstrap.selectedDisplayId}
                  pendingDisplayId={pendingDisplayId}
                  disabled={!electronApi}
                  onSelect={handleDisplaySelect}
                />
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs uppercase tracking-[0.24em] text-white/30">
              <div>{selectedDisplay?.label ?? "Экран не выбран"}</div>
              <div>{bootstrap.contentWidth}x{bootstrap.contentHeight}</div>
              <div>{bootstrap.fullscreen ? "Полный экран включен" : "Полный экран выключен"}</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function OrientationButtons({
  orientation,
  disabled,
  onChange,
}: {
  orientation: "landscape" | "portrait"
  disabled: boolean
  onChange: (orientation: "landscape" | "portrait") => void
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange("landscape")}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
          "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]",
          orientation === "landscape" && "border-white/25 bg-white/10 text-white",
          disabled && "cursor-not-allowed opacity-70"
        )}
      >
        <RectangleHorizontal className="size-4" />
        Горизонтально
      </button>
      <button
        type="button"
        onClick={() => onChange("portrait")}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
          "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]",
          orientation === "portrait" && "border-white/25 bg-white/10 text-white",
          disabled && "cursor-not-allowed opacity-70"
        )}
      >
        <RectangleVertical className="size-4" />
        Вертикально
      </button>
    </div>
  )
}

function DisplayList({
  displays,
  selectedDisplayId,
  pendingDisplayId,
  disabled,
  onSelect,
}: {
  displays: DisplayInfo[]
  selectedDisplayId: string | null
  pendingDisplayId: string | null
  disabled: boolean
  onSelect: (displayId: string) => void
}) {
  return (
    <div className="space-y-3">
      {displays.map((display, index) => {
        const selected = display.id === selectedDisplayId

        return (
          <button
            key={display.id}
            type="button"
            onClick={() => onSelect(display.id)}
            disabled={disabled || pendingDisplayId === display.id}
            className={cn(
              "group w-full rounded-2xl border px-4 py-4 text-left transition",
              "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
              selected && "border-white/30 bg-white/[0.07]",
              disabled && "cursor-not-allowed opacity-70"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3 text-xl font-medium text-white">
                  <span>{display.label || `Экран ${index + 1}`}</span>
                  {display.primary ? (
                    <span className="text-xs uppercase tracking-[0.24em] text-white/35">
                      основной
                    </span>
                  ) : null}
                </div>
                <div className="text-sm text-white/45">
                  {display.bounds.width}x{display.bounds.height} · x:{display.bounds.x} · y:
                  {display.bounds.y}
                </div>
              </div>

              <div
                className={cn(
                  "mt-1 flex size-9 items-center justify-center rounded-full border transition",
                  selected
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-white/10 text-white/20 group-hover:border-white/20 group-hover:text-white/50"
                )}
              >
                <Check className="size-4" />
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
