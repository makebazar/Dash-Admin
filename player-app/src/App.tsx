import { useCallback, useEffect, useMemo, useState } from "react"
import { createDefaultSignageLayout, getActiveSlides, normalizeSignageLayout } from "./signage-layout"
import type { BootstrapPayload, DisplayInfo, ElectronSignageApi, RuntimeConfig, SignageLayout } from "./types"
import "./styles.css"

const browserBootstrap = (): BootstrapPayload => ({
  deviceId: "browser-preview-device",
  pairingCode: "DEMO-2026",
  deviceToken: null,
  pairedClubId: null,
  pairedClubName: null,
  layoutJson: null,
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
            revisionKey={`${bootstrap.serverUpdatedAt || "initial"}:${bootstrap.orientation}`}
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
  revisionKey,
}: {
  layout: SignageLayout
  orientation: "landscape" | "portrait"
  revisionKey: string
}) {
  const activeSlides = useMemo(() => getActiveSlides(layout), [layout])
  const [index, setIndex] = useState(0)
  const [hasMediaError, setHasMediaError] = useState(false)
  const slide = activeSlides[index] ?? null
  const hasMultipleSlides = activeSlides.length > 1

  useEffect(() => {
    setIndex(0)
  }, [revisionKey, layout])

  useEffect(() => {
    setHasMediaError(false)
  }, [slide?.id, revisionKey])

  const advanceSlide = useCallback(() => {
    if (!hasMultipleSlides) return
    setIndex((current) => (current + 1) % activeSlides.length)
  }, [activeSlides.length, hasMultipleSlides])

  const handleMediaError = useCallback(() => {
    if (hasMultipleSlides) {
      advanceSlide()
      return
    }

    setHasMediaError(true)
  }, [advanceSlide, hasMultipleSlides])

  useEffect(() => {
    if (!slide || slide.mediaType === "video" || !hasMultipleSlides) return
    const timeoutId = window.setTimeout(() => {
      advanceSlide()
    }, Math.max(3, slide.durationSec) * 1000)
    return () => window.clearTimeout(timeoutId)
  }, [advanceSlide, hasMultipleSlides, slide])

  if (!slide || hasMediaError) {
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
      {slide.mediaType === "video" ? (
        <video
          key={`${slide.id}:${revisionKey}:${index}`}
          className={`slide-video transition-${slide.transition}`}
          src={slide.imageUrl}
          autoPlay
          muted
          playsInline
          preload="auto"
          loop={!hasMultipleSlides}
          onEnded={advanceSlide}
          onError={handleMediaError}
        />
      ) : (
        <img
          key={`${slide.id}:${revisionKey}:${index}`}
          className={`slide-image transition-${slide.transition}`}
          src={slide.imageUrl}
          alt={slide.title || ""}
          onError={handleMediaError}
        />
      )}
    </div>
  )
}
