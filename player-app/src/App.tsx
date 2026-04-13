import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createDefaultSignageLayout, getActiveSlides, normalizeSignageLayout } from "./signage-layout"
import type {
  BootstrapPayload,
  DisplayInfo,
  ElectronSignageApi,
  RuntimeConfig,
  SignageLayout,
  SignageSlide,
} from "./types"
import "./styles.css"

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
  contentWidth: typeof window !== "undefined" ? window.innerWidth : 1920,
  contentHeight: typeof window !== "undefined" ? window.innerHeight : 1080,
  displays: [
    {
      id: "browser-display",
      label: "Browser Preview",
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1,
      rotation: 0,
      internal: false,
      primary: true,
    },
  ],
  version: "browser-preview",
  platform: "browser",
})

const browserConfig: RuntimeConfig = {
  appName: "DashAdmin экран",
  serverUrl: "https://www.mydashadmin.ru",
  isPackaged: false,
}

function getElectronApi(): ElectronSignageApi | null {
  if (typeof window === "undefined") return null
  return window.electronSignage ?? null
}

export default function App() {
  const electronApi = useMemo(() => getElectronApi(), [])
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null)
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(browserConfig)
  const [pendingDisplayId, setPendingDisplayId] = useState<string | null>(null)
  const [isReloading, setIsReloading] = useState(false)
  const [isSetupVisible, setIsSetupVisible] = useState(false)
  const lastReportedSlideIdRef = useRef<string | null>(null)
  const selectedDisplay =
    bootstrap?.displays.find((display) => display.id === bootstrap.selectedDisplayId) ?? null
  const isPortrait = bootstrap?.orientation === "portrait"
  const canRenderContent = Boolean(bootstrap?.pairedClubId) && Boolean(bootstrap?.fullscreen)
  const shouldRenderContent = canRenderContent && !isSetupVisible

  useEffect(() => {
    let disposed = false
    let unsubscribe: (() => void) | undefined

    async function load() {
      if (!electronApi) {
        setBootstrap(browserBootstrap())
        return
      }

      const [config, payload] = await Promise.all([
        electronApi.getRuntimeConfig(),
        electronApi.getBootstrap(),
      ])

      if (disposed) return

      setRuntimeConfig(config)
      setBootstrap({
        ...payload,
        layoutJson: payload.layoutJson ? normalizeSignageLayout(payload.layoutJson) : null,
      })

      unsubscribe = electronApi.onBootstrapUpdated((nextPayload) => {
        if (disposed) return
        setBootstrap({
          ...nextPayload,
          layoutJson: nextPayload.layoutJson ? normalizeSignageLayout(nextPayload.layoutJson) : null,
        })
      })

      await electronApi.syncRemote()
    }

    void load()

    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [electronApi])

  useEffect(() => {
    if (!shouldRenderContent) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "F10") {
        event.preventDefault()
        void openSetup()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [shouldRenderContent])

  async function handleDisplaySelect(displayId: string) {
    if (!electronApi) return

    try {
      setPendingDisplayId(displayId)
      const payload = await electronApi.selectDisplay(displayId)
      setBootstrap({
        ...payload,
        layoutJson: payload.layoutJson ? normalizeSignageLayout(payload.layoutJson) : null,
      })
    } finally {
      setPendingDisplayId(null)
    }
  }

  async function handleFullscreen(enabled: boolean) {
    if (!electronApi) return
    const payload = await electronApi.setFullscreen(enabled)
    setBootstrap({
      ...payload,
      layoutJson: payload.layoutJson ? normalizeSignageLayout(payload.layoutJson) : null,
    })
  }

  async function openSetup() {
    if (bootstrap?.fullscreen && electronApi) {
      const payload = await electronApi.setFullscreen(false)
      setBootstrap({
        ...payload,
        layoutJson: payload.layoutJson ? normalizeSignageLayout(payload.layoutJson) : null,
      })
    }

    setIsSetupVisible(true)
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

  const handleCurrentSlideChange = useCallback(
    async (slideId: string | null) => {
      if (!electronApi) return
      if (lastReportedSlideIdRef.current === slideId) return

      lastReportedSlideIdRef.current = slideId
      await electronApi.reportCurrentSlide(slideId)
    },
    [electronApi]
  )

  if (!bootstrap) {
    return (
      <main className="shell shell-loading">
        <div className="loading-copy">Загрузка проигрывателя...</div>
      </main>
    )
  }

  if (shouldRenderContent) {
    return (
      <main className="shell shell-player" onDoubleClick={() => void openSetup()}>
        <div className={`player-stage-frame ${isPortrait ? "is-portrait" : ""}`}>
          <SignageStage
            layout={bootstrap.layoutJson || createDefaultSignageLayout()}
            orientation={bootstrap.orientation}
            forcedSlideId={bootstrap.controlAction === "pause" ? bootstrap.controlSlideId : null}
            forcedUntil={bootstrap.controlAction === "pause" ? bootstrap.controlUntil : null}
            jumpSlideId={bootstrap.controlAction === "jump" ? bootstrap.controlSlideId : null}
            jumpRequestKey={bootstrap.controlAction === "jump" ? bootstrap.controlUpdatedAt : null}
            onCurrentSlideChange={handleCurrentSlideChange}
          />
        </div>
        <div className="player-overlay">
          <button
            type="button"
            className="player-overlay-button"
            onClick={() => void openSetup()}
          >
            Выйти из полного экрана
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="shell shell-setup">
      <div className={`setup-frame ${isPortrait ? "is-portrait" : ""}`}>
        <div className="setup-header">
          <div>
            <div className="chip">{runtimeConfig.appName}</div>
            <div className="eyebrow">Сервер</div>
            <div className="server-url">{runtimeConfig.serverUrl}</div>
          </div>

          <div className="header-actions">
            {canRenderContent ? (
              <button className="action-button action-button-primary" onClick={() => setIsSetupVisible(false)}>
                Вернуться к просмотру
              </button>
            ) : null}
            <button className="action-button" onClick={() => void handleFullscreen(!bootstrap.fullscreen)}>
              {bootstrap.fullscreen ? "Выйти из полного экрана" : "Полный экран"}
            </button>
            <button className="action-button" onClick={handleReload} disabled={!electronApi || isReloading}>
              {isReloading ? "Обновление..." : "Обновить"}
            </button>
          </div>
        </div>

        <section className="setup-main">
          <div className="pairing-copy">
            <div className="eyebrow">Код подключения</div>
            <div className="pairing-code">{bootstrap.pairingCode}</div>
            <div className="muted-copy">Введи этот код на сайте, чтобы привязать устройство к клубу.</div>
            <div className="muted-copy">
              {bootstrap.pairedClubName
                ? `Устройство привязано к клубу: ${bootstrap.pairedClubName}`
                : "Устройство еще не привязано к клубу"}
            </div>
          </div>

          <div className="display-panel">
            <div className="eyebrow">Выбор экрана</div>
            <div className="display-list">
              {bootstrap.displays.map((display, index) => (
                <DisplayButton
                  key={display.id}
                  display={display}
                  index={index}
                  selected={display.id === bootstrap.selectedDisplayId}
                  disabled={!electronApi || pendingDisplayId === display.id}
                  onSelect={handleDisplaySelect}
                />
              ))}
            </div>
          </div>
        </section>

        <div className="setup-footer">
          <span>{selectedDisplay?.label ?? "Экран не выбран"}</span>
          <span>{bootstrap.contentWidth}x{bootstrap.contentHeight}</span>
          <span>{bootstrap.orientation === "portrait" ? "Вертикальная ориентация" : "Горизонтальная ориентация"}</span>
        </div>
      </div>
    </main>
  )
}

function DisplayButton({
  display,
  index,
  selected,
  disabled,
  onSelect,
}: {
  display: DisplayInfo
  index: number
  selected: boolean
  disabled: boolean
  onSelect: (displayId: string) => void
}) {
  return (
    <button
      type="button"
      className={`display-button ${selected ? "is-selected" : ""}`}
      onClick={() => onSelect(display.id)}
      disabled={disabled}
    >
      <div>
        <div className="display-title">
          {display.label || `Экран ${index + 1}`}
          {display.primary ? <span className="display-primary">основной</span> : null}
        </div>
        <div className="display-meta">
          {display.bounds.width}x{display.bounds.height} · x:{display.bounds.x} · y:{display.bounds.y}
        </div>
      </div>
      <div className={`display-check ${selected ? "is-selected" : ""}`}>✓</div>
    </button>
  )
}

function SignageStage({
  layout,
  orientation,
  forcedSlideId = null,
  forcedUntil = null,
  jumpSlideId = null,
  jumpRequestKey = null,
  onCurrentSlideChange,
}: {
  layout: SignageLayout
  orientation: "landscape" | "portrait"
  forcedSlideId?: string | null
  forcedUntil?: string | null
  jumpSlideId?: string | null
  jumpRequestKey?: string | null
  onCurrentSlideChange?: (slideId: string | null) => void
}) {
  const [scheduleNow, setScheduleNow] = useState(() => Date.now())
  const activeSlides = useMemo(() => getActiveSlides(layout, new Date(scheduleNow)), [layout, scheduleNow])
  const [index, setIndex] = useState(0)
  const [transitionTick, setTransitionTick] = useState(0)
  const [hasMediaError, setHasMediaError] = useState(false)
  const [controlNow, setControlNow] = useState(() => Date.now())
  const [visibleSlide, setVisibleSlide] = useState<SignageSlide | null>(null)
  const [pendingSlide, setPendingSlide] = useState<SignageSlide | null>(null)
  const [pendingReady, setPendingReady] = useState(false)
  const forcedUntilTimestamp = useMemo(() => {
    if (!forcedUntil) return null
    const parsed = new Date(forcedUntil).getTime()
    return Number.isNaN(parsed) ? null : parsed
  }, [forcedUntil])
  const forcedSlide = useMemo(
    () => (forcedSlideId ? activeSlides.find((item) => item.id === forcedSlideId) ?? null : null),
    [activeSlides, forcedSlideId]
  )
  const isForced =
    Boolean(forcedSlide) && (forcedUntilTimestamp === null || forcedUntilTimestamp > controlNow)
  const targetSlide = (isForced ? forcedSlide : null) ?? activeSlides[index] ?? null
  const hasMultipleSlides = activeSlides.length > 1

  useEffect(() => {
    if (activeSlides.length === 0) {
      setIndex(0)
      return
    }

    setIndex((current) => {
      if (visibleSlide?.id) {
        const currentIndex = activeSlides.findIndex((item) => item.id === visibleSlide.id)
        if (currentIndex >= 0) return currentIndex
      }

      return Math.min(current, activeSlides.length - 1)
    })
  }, [activeSlides, visibleSlide?.id])

  useEffect(() => {
    setHasMediaError(false)
  }, [targetSlide?.id, transitionTick])

  useEffect(() => {
    onCurrentSlideChange?.(visibleSlide?.id || null)
  }, [onCurrentSlideChange, visibleSlide?.id])

  useEffect(() => {
    if (!forcedUntilTimestamp || forcedUntilTimestamp <= Date.now()) {
      setControlNow(Date.now())
      return
    }

    const timeoutId = window.setTimeout(() => {
      setControlNow(Date.now())
    }, Math.max(0, forcedUntilTimestamp - Date.now()) + 25)

    return () => window.clearTimeout(timeoutId)
  }, [forcedUntilTimestamp])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setScheduleNow(Date.now())
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!forcedSlide) return

    const nextIndex = activeSlides.findIndex((item) => item.id === forcedSlide.id)
    if (nextIndex === -1) return
    setIndex(nextIndex)
  }, [activeSlides, forcedSlide])

  useEffect(() => {
    if (!jumpRequestKey || !jumpSlideId || isForced) return

    const nextIndex = activeSlides.findIndex((item) => item.id === jumpSlideId)
    if (nextIndex === -1) return
    setIndex(nextIndex)
  }, [activeSlides, isForced, jumpRequestKey, jumpSlideId])

  useEffect(() => {
    if (!targetSlide) {
      setVisibleSlide(null)
      setPendingSlide(null)
      setPendingReady(false)
      return
    }

    setVisibleSlide((current) => {
      if (!current) return targetSlide
      return current.id === targetSlide.id ? targetSlide : current
    })

    setPendingSlide((current) => {
      if (visibleSlide?.id === targetSlide.id) return null
      if (current?.id === targetSlide.id) return current
      return visibleSlide?.id !== targetSlide.id ? targetSlide : null
    })
  }, [targetSlide, visibleSlide?.id])

  useEffect(() => {
    setPendingReady(false)
  }, [pendingSlide?.id])

  const advanceSlide = useCallback(() => {
    if (isForced || !hasMultipleSlides) return
    setIndex((current) => (current + 1) % activeSlides.length)
    setTransitionTick((current) => current + 1)
  }, [activeSlides.length, hasMultipleSlides, isForced])

  const handleMediaError = useCallback(() => {
    if (isForced) {
      setHasMediaError(true)
      return
    }

    if (hasMultipleSlides) {
      advanceSlide()
      return
    }

    setHasMediaError(true)
  }, [advanceSlide, hasMultipleSlides, isForced])

  const handlePendingReady = useCallback(() => {
    setPendingReady(true)
  }, [])

  useEffect(() => {
    if (!pendingSlide || !pendingReady) return

    const timeoutId = window.setTimeout(() => {
      setVisibleSlide(pendingSlide)
      setPendingSlide(null)
      setPendingReady(false)
      setTransitionTick((current) => current + 1)
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [pendingReady, pendingSlide])

  useEffect(() => {
    if (isForced || pendingSlide || !visibleSlide || visibleSlide.mediaType === "video" || !hasMultipleSlides) return
    const timeoutId = window.setTimeout(() => {
      advanceSlide()
    }, Math.max(3, visibleSlide.durationSec) * 1000)
    return () => window.clearTimeout(timeoutId)
  }, [advanceSlide, hasMultipleSlides, isForced, pendingSlide, visibleSlide])

  if (!visibleSlide || hasMediaError) {
    const hasAnySlides = layout.slides.length > 0
    return (
      <div className="empty-stage">
        <div className={`empty-card ${orientation === "portrait" ? "is-portrait" : ""}`}>
          <div className="empty-title">
            {hasMediaError
              ? "Не удалось загрузить контент"
              : hasAnySlides
                ? "Сейчас нет активного контента"
                : "Контента нет"}
          </div>
          <div className="empty-text">
            {hasMediaError
              ? "Открой настройки двойным кликом, `Esc` или кнопкой в правом верхнем углу и проверь URL файла или формат видео."
              : hasAnySlides
                ? "Проверь часовой период у загруженных медиафайлов."
                : "Добавь фото или видео и настрой расписание показа на сайте DashAdmin."}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="slide-stage" style={{ background: layout.background }}>
      <SlideFrame
        key={`${visibleSlide.id}:${transitionTick}`}
        slide={visibleSlide}
        loop={isForced || !hasMultipleSlides}
        onEnded={advanceSlide}
        onError={handleMediaError}
      />
      {pendingSlide && pendingSlide.id !== visibleSlide.id ? (
        <SlideFrame
          key={`pending:${pendingSlide.id}:${pendingReady ? "ready" : "loading"}`}
          slide={pendingSlide}
          loop={isForced || !hasMultipleSlides}
          onEnded={advanceSlide}
          onError={handleMediaError}
          onReady={handlePendingReady}
          overlay
          revealed={pendingReady}
        />
      ) : null}
    </div>
  )
}

function SlideFrame({
  slide,
  loop,
  onEnded,
  onError,
  onReady,
  overlay = false,
  revealed = true,
}: {
  slide: SignageSlide
  loop: boolean
  onEnded: () => void
  onError: () => void
  onReady?: () => void
  overlay?: boolean
  revealed?: boolean
}) {
  const className = [
    slide.mediaType === "video" ? "slide-video" : "slide-image",
    `transition-${slide.transition}`,
    "slide-layer",
    overlay ? "is-overlay" : "",
    revealed ? "" : "is-hidden",
  ]
    .filter(Boolean)
    .join(" ")

  if (slide.mediaType === "video") {
    return (
      <video
        className={className}
        src={slide.imageUrl}
        autoPlay
        muted
        playsInline
        preload="auto"
        loop={loop}
        onEnded={onEnded}
        onError={onError}
        onLoadedData={onReady}
        onCanPlay={onReady}
      />
    )
  }

  return (
    <img
      className={className}
      src={slide.imageUrl}
      alt={slide.title || ""}
      onError={onError}
      onLoad={onReady}
    />
  )
}
