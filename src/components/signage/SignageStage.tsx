"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { getActiveSlides, type SignageLayout, type SignageSlide } from "@/lib/signage-layout"

export function SignageStage({
  layout,
  orientation,
  className,
  preview = false,
}: {
  layout: SignageLayout
  orientation: "landscape" | "portrait"
  className?: string
  preview?: boolean
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [transitionTick, setTransitionTick] = useState(0)
  const [hasMediaError, setHasMediaError] = useState(false)
  const activeSlides = useMemo(
    () => (preview ? layout.slides.slice().sort((a, b) => a.order - b.order) : getActiveSlides(layout)),
    [layout, preview]
  )
  const hasAnySlides = layout.slides.length > 0
  const currentSlide = activeSlides[activeIndex] ?? null
  const currentDuration = Math.max(3, currentSlide?.durationSec ?? 8)
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
    setActiveIndex(0)
  }, [layout, preview])

  useEffect(() => {
    setHasMediaError(false)
  }, [currentSlide?.id, transitionTick])

  const advanceSlide = useCallback(() => {
    if (!hasMultipleSlides) return

    setActiveIndex((current) => (current + 1) % activeSlides.length)
    setTransitionTick((current) => current + 1)
  }, [activeSlides.length, hasMultipleSlides])

  const handleMediaError = useCallback(() => {
    if (hasMultipleSlides) {
      advanceSlide()
      return
    }

    setHasMediaError(true)
  }, [advanceSlide, hasMultipleSlides])

  useEffect(() => {
    if (!currentSlide || currentSlide.mediaType === "video" || !hasMultipleSlides) return

    const timeoutId = window.setTimeout(() => {
      advanceSlide()
    }, currentDuration * 1000)

    return () => window.clearTimeout(timeoutId)
  }, [advanceSlide, currentDuration, currentSlide, hasMultipleSlides])

  return (
    <div className={stageClassName} style={{ background: layout.background }}>
      {currentSlide && !hasMediaError ? (
        <SlideFrame
          key={`${currentSlide.id}:${transitionTick}`}
          slide={currentSlide}
          loop={!hasMultipleSlides}
          onEnded={advanceSlide}
          onError={handleMediaError}
        />
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
}: {
  slide: SignageSlide
  loop: boolean
  onEnded: () => void
  onError: () => void
}) {
  const animation = getTransitionAnimation(slide.transition)

  if (slide.mediaType === "video") {
    return (
      <video
        className="absolute inset-0 size-full bg-black object-cover"
        src={slide.imageUrl}
        autoPlay
        muted
        playsInline
        preload="auto"
        loop={loop}
        onEnded={onEnded}
        onError={onError}
        style={{ animation }}
      />
    )
  }

  return (
    <img
      className="absolute inset-0 size-full bg-black object-cover"
      src={slide.imageUrl}
      alt={slide.title || ""}
      onError={onError}
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
