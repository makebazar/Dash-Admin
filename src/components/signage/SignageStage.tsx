"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { getActiveSlides, type SignageLayout, type SignageSlide } from "@/lib/signage-layout"

export function SignageStage({
  layout,
  orientation,
  className,
  preview = false,
  forcedSlideId = null,
  forcedUntil = null,
  jumpSlideId = null,
  jumpRequestKey = null,
  onCurrentSlideChange,
}: {
  layout: SignageLayout
  orientation: "landscape" | "portrait"
  className?: string
  preview?: boolean
  forcedSlideId?: string | null
  forcedUntil?: string | null
  jumpSlideId?: string | null
  jumpRequestKey?: string | null
  onCurrentSlideChange?: (slide: SignageSlide | null) => void
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [transitionTick, setTransitionTick] = useState(0)
  const [hasMediaError, setHasMediaError] = useState(false)
  const [controlNow, setControlNow] = useState(() => Date.now())
  const [scheduleNow, setScheduleNow] = useState(() => Date.now())
  const [visibleSlide, setVisibleSlide] = useState<SignageSlide | null>(null)
  const [pendingSlide, setPendingSlide] = useState<SignageSlide | null>(null)
  const [pendingReady, setPendingReady] = useState(false)
  const activeSlides = useMemo(
    () =>
      preview
        ? layout.slides.slice().sort((a, b) => a.order - b.order)
        : getActiveSlides(layout, new Date(scheduleNow)),
    [layout, preview, scheduleNow]
  )
  const hasAnySlides = layout.slides.length > 0
  const forcedUntilTimestamp = useMemo(() => {
    if (!forcedUntil) return null
    const parsed = new Date(forcedUntil).getTime()
    return Number.isNaN(parsed) ? null : parsed
  }, [forcedUntil])
  const forcedSlide = useMemo(
    () => (forcedSlideId ? activeSlides.find((slide) => slide.id === forcedSlideId) ?? null : null),
    [activeSlides, forcedSlideId]
  )
  const isForced =
    Boolean(forcedSlide) &&
    (forcedUntilTimestamp === null || forcedUntilTimestamp > controlNow)
  const targetSlide = (isForced ? forcedSlide : null) ?? activeSlides[activeIndex] ?? null
  const currentDuration = Math.max(3, visibleSlide?.durationSec ?? 8)
  const hasMultipleSlides = activeSlides.length > 1

  const stageClassName = useMemo(
    () =>
      cn(
        "relative h-full w-full overflow-hidden text-white",
        preview ? "border border-white/10 shadow-2xl shadow-black/20" : "",
        className
      ),
    [className, preview]
  )

  useEffect(() => {
    if (activeSlides.length === 0) {
      setActiveIndex(0)
      return
    }

    setActiveIndex((current) => {
      if (visibleSlide?.id) {
        const visibleIndex = activeSlides.findIndex((slide) => slide.id === visibleSlide.id)
        if (visibleIndex >= 0) return visibleIndex
      }

      return Math.min(current, activeSlides.length - 1)
    })
  }, [activeSlides, preview, visibleSlide?.id])

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
    if (preview) return

    const intervalId = window.setInterval(() => {
      setScheduleNow(Date.now())
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [preview])

  useEffect(() => {
    if (!forcedSlide) return

    const forcedIndex = activeSlides.findIndex((slide) => slide.id === forcedSlide.id)
    if (forcedIndex === -1) return

    setActiveIndex(forcedIndex)
  }, [activeSlides, forcedSlide])

  useEffect(() => {
    setHasMediaError(false)
  }, [targetSlide?.id, transitionTick])

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

  useEffect(() => {
    onCurrentSlideChange?.(visibleSlide)
  }, [visibleSlide, onCurrentSlideChange])

  const advanceSlide = useCallback(() => {
    if (isForced || !hasMultipleSlides) return

    setActiveIndex((current) => (current + 1) % activeSlides.length)
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
    if (!jumpRequestKey || !jumpSlideId || isForced) return

    const nextIndex = activeSlides.findIndex((slide) => slide.id === jumpSlideId)
    if (nextIndex === -1) return

    setActiveIndex(nextIndex)
    setTransitionTick((current) => current + 1)
  }, [activeSlides, isForced, jumpRequestKey, jumpSlideId])

  useEffect(() => {
    if (isForced || pendingSlide || !visibleSlide || visibleSlide.mediaType === "video" || !hasMultipleSlides) return

    const timeoutId = window.setTimeout(() => {
      advanceSlide()
    }, currentDuration * 1000)

    return () => window.clearTimeout(timeoutId)
  }, [advanceSlide, currentDuration, hasMultipleSlides, isForced, pendingSlide, visibleSlide])

  return (
    <div className={stageClassName} style={{ background: layout.background }}>
      {visibleSlide && !hasMediaError ? (
        <>
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
        </>
      ) : (
        <EmptyStage
          message={
            hasMediaError
              ? "Не удалось загрузить контент"
              : hasAnySlides
                ? "Сейчас нет активного контента"
                : "Контента нет"
          }
          description={
            hasMediaError
              ? "Проверь URL файла, формат медиа или попробуй открыть следующий слайд."
              : hasAnySlides
                ? "Проверь часовой период у загруженных медиафайлов."
                : "Загрузи фото или видео и настрой их показ на странице экрана."
          }
          orientation={orientation}
        />
      )}
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
  const animation = getTransitionAnimation(slide.transition)
  const layerClassName = cn(
    "absolute inset-0 size-full object-cover",
    overlay
      ? "pointer-events-none z-10 transition-opacity duration-200 ease-linear"
      : "",
    revealed ? "opacity-100" : "opacity-0"
  )

  if (slide.mediaType === "video") {
    return (
      <video
        className={cn(layerClassName, "bg-black")}
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
        style={{ animation }}
      />
    )
  }

  return (
    <img
      className={cn(layerClassName, "bg-black")}
      src={slide.imageUrl}
      alt={slide.title || ""}
      onError={onError}
      onLoad={onReady}
      style={{ animation }}
    />
  )
}

function EmptyStage({
  message,
  description,
  orientation,
}: {
  message: string
  description: string
  orientation: "landscape" | "portrait"
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_30%)]">
      <div
        className={cn(
          "rounded-[28px] border border-white/10 bg-black/25 p-8 text-center backdrop-blur-md",
          orientation === "portrait" ? "max-w-[72%]" : "max-w-xl"
        )}
      >
        <div className="text-3xl font-semibold tracking-tight text-white">{message}</div>
        <div className="mt-3 text-sm leading-6 text-white/55">{description}</div>
      </div>
    </div>
  )
}

function getTransitionAnimation(transition: SignageSlide["transition"]) {
  switch (transition) {
    case "none":
      return undefined
    case "slide":
      return "signage-slide-in 700ms ease"
    case "zoom":
      return "signage-zoom-in 900ms ease"
    default:
      return "signage-fade-in 700ms ease"
  }
}

if (typeof document !== "undefined" && !document.getElementById("signage-stage-keyframes")) {
  const style = document.createElement("style")
  style.id = "signage-stage-keyframes"
  style.textContent = `
    @keyframes signage-fade-in {
      from { opacity: 0.35; }
      to { opacity: 1; }
    }
    @keyframes signage-slide-in {
      from { opacity: 0.65; transform: translateX(4%); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes signage-zoom-in {
      from { opacity: 0.75; transform: scale(1.06); }
      to { opacity: 1; transform: scale(1); }
    }
  `
  document.head.appendChild(style)
}
