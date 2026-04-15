"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createSignageSlide,
  normalizeSignageLayout,
  type SignageLayout,
  type SignageSlide,
  type SignageTransition,
} from "@/lib/signage-layout"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ImagePlus,
  Loader2,
  RectangleHorizontal,
  RectangleVertical,
  Save,
  Trash2,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"

const IMAGE_FILE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif", "heic", "heif"])
const VIDEO_FILE_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "ogv", "ogg"])
const SLIDE_TRANSITION_OPTIONS: SignageTransition[] = ["none", "fade", "slide", "zoom"]
const WEEKDAY_OPTIONS = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 0, label: "Вс" },
]

function getSlideTransitionLabel(transition: SignageTransition) {
  switch (transition) {
    case "none":
      return "Без"
    case "slide":
      return "Slide"
    case "zoom":
      return "Zoom"
    default:
      return "Fade"
  }
}

function getFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)(?:\?.*)?$/)
  return match?.[1] || ""
}

function getMediaTypeFromFile(file: File): SignageSlide["mediaType"] | null {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"
  const extension = getFileExtension(file.name)
  if (IMAGE_FILE_EXTENSIONS.has(extension)) return "image"
  if (VIDEO_FILE_EXTENSIONS.has(extension)) return "video"
  return null
}

function formatTimeValue(hour: number, minute: number) {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
}

function parseTimeValue(value: string) {
  const match = value.trim().match(/^(\d{2}):(\d{2})$/)
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null

  return { hour, minute }
}

function normalizeTimeInput(value: string) {
  const direct = parseTimeValue(value)
  if (direct) {
    return formatTimeValue(direct.hour, direct.minute)
  }

  const digits = value.replace(/\D/g, "")
  if (digits.length === 3) {
    const parsed = parseTimeValue(`0${digits[0]}:${digits.slice(1)}`)
    return parsed ? formatTimeValue(parsed.hour, parsed.minute) : null
  }

  if (digits.length === 4) {
    const parsed = parseTimeValue(`${digits.slice(0, 2)}:${digits.slice(2)}`)
    return parsed ? formatTimeValue(parsed.hour, parsed.minute) : null
  }

  return null
}

function getWeekdaysSummary(weekdays: number[]) {
  const normalized = [...weekdays].sort((a, b) => a - b)
  if (normalized.length === 7) return "Каждый день"
  return WEEKDAY_OPTIONS.filter((weekday) => normalized.includes(weekday.value))
    .map((weekday) => weekday.label)
    .join(", ")
}

function getTimeRangeSummary(slide: SignageSlide) {
  if (slide.startHour === slide.endHour && slide.startMinute === slide.endMinute) {
    return "24 часа"
  }

  return `${formatTimeValue(slide.startHour, slide.startMinute)} - ${formatTimeValue(slide.endHour, slide.endMinute)}`
}

function TimeTextInput({
  value,
  onCommit,
  className,
}: {
  value: string
  onCommit: (value: string) => void
  className?: string
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  function commit() {
    const normalized = normalizeTimeInput(draft)
    if (!normalized) {
      setDraft(value)
      return
    }

    setDraft(normalized)
    if (normalized !== value) {
      onCommit(normalized)
    }
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder="00:00"
      value={draft}
      onChange={(e) => {
        const nextValue = e.target.value.replace(/[^\d:]/g, "").slice(0, 5)
        setDraft(nextValue)
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          commit()
        }
      }}
      className={className}
    />
  )
}

type SignageDevice = {
  id: number
  name: string | null
  orientation: "landscape" | "portrait"
  screen_label: string | null
  selected_display_id: string | null
  display_info?: DisplaySnapshot[] | null
  is_online: boolean
}

type DisplaySnapshot = {
  id?: string
  label?: string
  bounds?: {
    width?: number
    height?: number
  }
  primary?: boolean
}

function getDeviceContentSize(device: SignageDevice | null) {
  if (!device || !Array.isArray(device.display_info) || device.display_info.length === 0) {
    return null
  }

  const selectedDisplay =
    device.display_info.find((display) => String(display.id || "") === String(device.selected_display_id || "")) ||
    device.display_info.find((display) => display.primary) ||
    device.display_info[0]

  const rawWidth = selectedDisplay?.bounds?.width
  const rawHeight = selectedDisplay?.bounds?.height
  if (!rawWidth || !rawHeight) return null

  return device.orientation === "portrait"
    ? { width: Math.min(rawWidth, rawHeight), height: Math.max(rawWidth, rawHeight) }
    : { width: Math.max(rawWidth, rawHeight), height: Math.min(rawWidth, rawHeight) }
}

export default function ClubSignageDeviceEditorPage({
  params,
}: {
  params: Promise<{ clubId: string; deviceId: string }>
}) {
  const [clubId, setClubId] = useState("")
  const [deviceId, setDeviceId] = useState("")
  const [device, setDevice] = useState<SignageDevice | null>(null)
  const [layoutDraft, setLayoutDraft] = useState<SignageLayout | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isUpdatingOrientation, setIsUpdatingOrientation] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const noticeTimeoutRef = useRef<number | null>(null)
  const deviceContentSize = getDeviceContentSize(device)

  function showNotice(type: "success" | "error", message: string) {
    if (noticeTimeoutRef.current) {
      window.clearTimeout(noticeTimeoutRef.current)
      noticeTimeoutRef.current = null
    }
    setNotice({ type, message })
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice(null)
      noticeTimeoutRef.current = null
    }, 2600)
  }

  useEffect(() => {
    params.then(({ clubId: nextClubId, deviceId: nextDeviceId }) => {
      setClubId(nextClubId)
      setDeviceId(nextDeviceId)
      void fetchEditorData(nextClubId, nextDeviceId)
    })
  }, [params])

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) {
        window.clearTimeout(noticeTimeoutRef.current)
      }
    }
  }, [])

  async function fetchEditorData(targetClubId = clubId, targetDeviceId = deviceId) {
    if (!targetClubId || !targetDeviceId) return

    setIsLoading(true)
    try {
      const [devicesRes, layoutRes] = await Promise.all([
        fetch(`/api/clubs/${targetClubId}/signage/devices`, { cache: "no-store" }),
        fetch(`/api/clubs/${targetClubId}/signage/devices/${targetDeviceId}/layout`, {
          cache: "no-store",
        }),
      ])

      const devicesData = await devicesRes.json()
      const layoutData = await layoutRes.json()

      if (!devicesRes.ok) {
        throw new Error(devicesData.error || "Не удалось загрузить устройства")
      }

      if (!layoutRes.ok) {
        throw new Error(layoutData.error || "Не удалось загрузить layout")
      }

      const matchedDevice = Array.isArray(devicesData.devices)
        ? devicesData.devices.find((item: SignageDevice) => String(item.id) === String(targetDeviceId))
        : null

      setDevice(matchedDevice || null)
      setLayoutDraft(normalizeSignageLayout(layoutData.layout, layoutData.orientation))
    } catch (error: any) {
      console.error(error)
      showNotice("error", error?.message || "Не удалось загрузить редактор экрана")
      setDevice(null)
      setLayoutDraft(null)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSaveLayout() {
    if (!clubId || !deviceId || !layoutDraft || !device) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/signage/devices/${deviceId}/layout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orientation: device.orientation,
          layout: layoutDraft,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Не удалось сохранить layout")
      }

      setLayoutDraft(normalizeSignageLayout(data.layout, data.orientation))
      showNotice("success", "Изменения сохранены")
    } catch (error: any) {
      console.error(error)
      showNotice("error", error?.message || "Не удалось сохранить изменения")
    } finally {
      setIsSaving(false)
    }
  }

  function updateLayout(mutator: (layout: SignageLayout) => SignageLayout) {
    setLayoutDraft((current) => (current ? mutator(current) : current))
  }

  async function handleOrientationChange(orientation: "landscape" | "portrait") {
    if (!clubId || !deviceId || !device) return
    if (device.orientation === orientation) return

    setIsUpdatingOrientation(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/signage/devices/${deviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orientation }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Не удалось обновить ориентацию")
      }

      setDevice((current) =>
        current
          ? {
              ...current,
              orientation,
            }
          : current
      )
    } catch (error: any) {
      console.error(error)
      showNotice("error", error?.message || "Не удалось обновить ориентацию")
    } finally {
      setIsUpdatingOrientation(false)
    }
  }

  async function handleMediaUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    setIsUploading(true)
    try {
      const uploadedSlides: SignageSlide[] = []

      for (const file of files) {
        const mediaType = getMediaTypeFromFile(file)
        if (!mediaType) {
          throw new Error(`Файл "${file.name}" не является изображением или видео`)
        }

        const formData = new FormData()
        formData.append("file", file)
        formData.append("preserveOriginal", "1")
        formData.append("transcodeVideo", mediaType === "video" ? "1" : "0")

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || "Не удалось загрузить медиафайл")
        }

        uploadedSlides.push(
          createSignageSlide({
            imageUrl: data.url,
            mediaType,
            title: file.name.replace(/\.[^/.]+$/, ""),
            transition: layoutDraft?.transition ?? "fade",
            order: layoutDraft?.slides.length ? layoutDraft.slides.length + uploadedSlides.length : uploadedSlides.length,
            durationSec: 8,
            startHour: 0,
            endHour: 0,
            startMinute: 0,
            endMinute: 0,
            enabled: true,
          })
        )
      }

      updateLayout((layout) => ({
        ...layout,
        slides: [...layout.slides, ...uploadedSlides].map((slide, index) => ({
          ...slide,
          order: index,
        })),
      }))
      event.target.value = ""
    } catch (error: any) {
      console.error(error)
      showNotice("error", error?.message || "Не удалось загрузить медиафайл")
    } finally {
      setIsUploading(false)
    }
  }

  function updateSlide(slideId: string, patch: Partial<SignageSlide>) {
    updateLayout((layout) => ({
      ...layout,
      slides: layout.slides.map((slide) =>
        slide.id === slideId
          ? createSignageSlide({
              ...slide,
              ...patch,
              imageUrl: patch.imageUrl || slide.imageUrl,
              mediaType: patch.mediaType || slide.mediaType,
            })
          : slide
      ),
    }))
  }

  function toggleSlideWeekday(slideId: string, weekday: number) {
    const targetSlide = layoutDraft?.slides.find((slide) => slide.id === slideId)
    if (!targetSlide) return

    const currentWeekdays = Array.isArray(targetSlide.weekdays) && targetSlide.weekdays.length > 0
      ? targetSlide.weekdays
      : [0, 1, 2, 3, 4, 5, 6]

    const hasWeekday = currentWeekdays.includes(weekday)
    const nextWeekdays = hasWeekday
      ? currentWeekdays.filter((day) => day !== weekday)
      : [...currentWeekdays, weekday].sort((a, b) => a - b)

    if (nextWeekdays.length === 0) return
    updateSlide(slideId, { weekdays: nextWeekdays })
  }

  function updateSlideTime(slideId: string, field: "start" | "end", value: string) {
    const parsed = parseTimeValue(value)
    if (!parsed) return

    updateSlide(
      slideId,
      field === "start"
        ? { startHour: parsed.hour, startMinute: parsed.minute }
        : { endHour: parsed.hour, endMinute: parsed.minute }
    )
  }

  function moveSlide(slideId: string, direction: -1 | 1) {
    updateLayout((layout) => {
      const slides = [...layout.slides].sort((a, b) => a.order - b.order)
      const index = slides.findIndex((slide) => slide.id === slideId)
      if (index === -1) return layout
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= slides.length) return layout

      ;[slides[index], slides[targetIndex]] = [slides[targetIndex], slides[index]]

      return {
        ...layout,
        slides: slides.map((slide, order) => ({ ...slide, order })),
      }
    })
  }

  function removeSlide(slideId: string) {
    updateLayout((layout) => ({
      ...layout,
      slides: layout.slides
        .filter((slide) => slide.id !== slideId)
        .map((slide, order) => ({ ...slide, order })),
    }))
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-white overflow-hidden text-slate-900 font-sans">
      {notice && (
        <div className="fixed left-1/2 top-4 z-50 w-[90vw] max-w-sm -translate-x-1/2">
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-medium shadow-md backdrop-blur bg-white/90 text-center",
              notice.type === "success"
                ? "border-emerald-200 text-emerald-900"
                : "border-rose-200 text-rose-900"
            )}
          >
            {notice.message}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
            <Link href={`/clubs/${clubId}/signage`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <h1 className="text-sm font-semibold leading-none text-slate-900">
              {device?.name || device?.screen_label || "Настройка экрана"}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
              {device && (
                <>
                  <span className="flex items-center gap-1">
                    <span className={cn("h-1.5 w-1.5 rounded-full", device.is_online ? "bg-emerald-500" : "bg-slate-300")} />
                    {device.is_online ? "Online" : "Offline"}
                  </span>
                  <span>•</span>
                  <span>{device.screen_label || device.selected_display_id || "Монитор не выбран"}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-8 bg-slate-900 px-4 text-xs font-medium text-white hover:bg-slate-800"
            onClick={handleSaveLayout}
            disabled={isSaving || !layoutDraft}
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Сохранить
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex flex-1 overflow-hidden">
        <section className="mx-auto flex h-full w-full max-w-[980px] flex-col border-x border-slate-200 bg-slate-50/50">
          {isLoading || !layoutDraft || !device ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {/* Settings Group */}
              <div className="grid grid-cols-1 gap-4 border-b border-slate-200 p-4">
                {/* Orientation */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Ориентация</Label>
                  <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                    <button
                      type="button"
                      onClick={() => void handleOrientationChange("landscape")}
                      disabled={isUpdatingOrientation}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                        device.orientation === "landscape" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      <RectangleHorizontal className="h-3.5 w-3.5" />
                      Гор.
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOrientationChange("portrait")}
                      disabled={isUpdatingOrientation}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                        device.orientation === "portrait" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      <RectangleVertical className="h-3.5 w-3.5" />
                      Верт.
                    </button>
                  </div>
                </div>

                {/* Background Color */}
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                  <Label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 pl-1">Фон экрана</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative h-6 w-10 overflow-hidden rounded border border-slate-200">
                      <input
                        type="color"
                        value={layoutDraft.background}
                        onChange={(e) => updateLayout((layout) => ({ ...layout, background: e.target.value }))}
                        className="absolute -inset-2 h-10 w-14 cursor-pointer border-0 p-0"
                      />
                    </div>
                    <Input
                      value={layoutDraft.background}
                      onChange={(e) => updateLayout((layout) => ({ ...layout, background: e.target.value }))}
                      className="h-7 w-20 border-none bg-transparent px-1 font-mono text-xs uppercase focus-visible:ring-0"
                    />
                  </div>
                </div>
              </div>

              {/* Upload & Playlist Header */}
              <div className="flex flex-col gap-3 border-b border-slate-200 p-4">
                <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50">
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  Загрузить медиа
                  <input
                    type="file"
                    accept="image/*,video/*,.mp4,.webm,.mov,.m4v,.ogv,.ogg"
                    multiple
                    className="hidden"
                    onChange={handleMediaUpload}
                    disabled={isUploading}
                  />
                </label>

                {deviceContentSize ? (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
                    Рекомендуемый размер контента:{" "}
                    <span className="font-semibold text-slate-900">
                      {deviceContentSize.width} x {deviceContentSize.height} px
                    </span>
                  </div>
                ) : null}
                
                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Плейлист</div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{layoutDraft.slides.length} файлов</span>
                    <span>•</span>
                    <span>Видео до конца, фото по таймеру</span>
                  </div>
                </div>
              </div>

              {/* Playlist Items */}
              <div className="flex-1 overflow-y-auto p-2">
                {layoutDraft.slides.length === 0 ? (
                  <div className="flex h-32 items-center justify-center text-xs text-slate-400">
                    Нет добавленных медиафайлов
                  </div>
                ) : (
                  <div className="space-y-2">
                        {layoutDraft.slides
                          .slice()
                          .sort((a, b) => a.order - b.order)
                          .map((slide, index) => (
                            <div
                              key={slide.id}
                              className={cn(
                                "group rounded-2xl border px-3 py-3 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.28)] transition-all",
                                slide.enabled
                                  ? "border-slate-200 bg-white hover:border-slate-300"
                                  : "border-slate-200/70 bg-slate-50/90 opacity-75"
                              )}
                            >
                              <div className="flex gap-3">
                                <div className="flex w-28 shrink-0 flex-col gap-2">
                                  <div className="relative flex min-h-[132px] flex-1 items-center justify-center overflow-hidden rounded-xl bg-slate-950 ring-1 ring-black/5">
                                    {slide.mediaType === "video" ? (
                                      <video
                                        src={slide.imageUrl}
                                        className="h-full w-full object-contain"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        preload="metadata"
                                        disablePictureInPicture
                                      />
                                    ) : (
                                      <img src={slide.imageUrl} alt={slide.title || ""} className="h-full w-full object-contain" />
                                    )}
                                    <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/45 via-black/15 to-transparent" />
                                    <div className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700 shadow-sm">
                                      #{index + 1}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => moveSlide(slide.id, -1)}
                                      disabled={index === 0}
                                      className="flex h-8 flex-1 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-30"
                                    >
                                      <ArrowUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveSlide(slide.id, 1)}
                                      disabled={index === layoutDraft.slides.length - 1}
                                      className="flex h-8 flex-1 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-30"
                                    >
                                      <ArrowDown className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="min-w-0 flex-1 space-y-3">
                                  <div className="flex items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <Input
                                          value={slide.title || ""}
                                          onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
                                          placeholder="Название слайда"
                                          className="h-10 rounded-xl border-slate-200 bg-slate-50/80 px-3 text-sm font-semibold text-slate-900 shadow-none focus-visible:bg-white focus-visible:ring-0"
                                        />
                                        <Switch
                                          checked={slide.enabled}
                                          onCheckedChange={(checked) => updateSlide(slide.id, { enabled: checked })}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removeSlide(slide.id)}
                                          className="rounded-xl border border-rose-200 p-2 text-rose-500 transition hover:bg-rose-50"
                                        >
                                          <Trash2 className="h-4 w-4" strokeWidth={1.6} />
                                        </button>
                                      </div>
                                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-slate-500">
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 uppercase tracking-wide">
                                          {slide.mediaType === "video" ? "Видео" : "Изображение"}
                                        </span>
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                                          {slide.mediaType === "video" ? "Видео до конца файла" : `Показ ${slide.durationSec} сек`}
                                        </span>
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                                          {getTimeRangeSummary(slide)}
                                        </span>
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                                          {getWeekdaysSummary(slide.weekdays)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-start gap-2">
                                    <div
                                      className={cn(
                                        "flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-2",
                                        index === 1 && slide.mediaType === "video" ? "h-[54px]" : ""
                                      )}
                                    >
                                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        Показ
                                      </span>
                                      {slide.mediaType === "video" ? (
                                        <span
                                          className={cn(
                                            "rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200",
                                            index === 1 ? "block text-center leading-[25px]" : ""
                                          )}
                                        >
                                          Авто
                                        </span>
                                      ) : (
                                        <>
                                          <Input
                                            type="number"
                                            min={3}
                                            value={slide.durationSec || ""}
                                            onChange={(e) =>
                                              updateSlide(slide.id, {
                                                durationSec: e.target.value ? Number(e.target.value) : 0,
                                              })
                                            }
                                            className="h-8 w-[50px] rounded-lg border-slate-200 bg-white px-2 text-center text-xs font-semibold text-slate-900 focus-visible:ring-0"
                                          />
                                          <span className="text-[11px] font-medium text-slate-500">сек</span>
                                        </>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-2">
                                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        Время
                                      </span>
                                      <TimeTextInput
                                        value={formatTimeValue(slide.startHour, slide.startMinute)}
                                        onCommit={(value) => updateSlideTime(slide.id, "start", value)}
                                        className="h-8 w-[70px] rounded-lg border-slate-200 bg-white px-2 text-center font-mono text-xs font-semibold text-slate-900 focus-visible:ring-0"
                                      />
                                      <span className="text-xs font-medium text-slate-400">-</span>
                                      <TimeTextInput
                                        value={formatTimeValue(slide.endHour, slide.endMinute)}
                                        onCommit={(value) => updateSlideTime(slide.id, "end", value)}
                                        className="h-8 w-[79px] rounded-lg border-slate-200 bg-white px-2 text-center font-mono text-xs font-semibold text-slate-900 focus-visible:ring-0"
                                      />
                                    </div>

                                    <div className="flex h-[45px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-2 py-2">
                                      <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        Переход
                                      </span>
                                      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
                                        {SLIDE_TRANSITION_OPTIONS.map((transition) => (
                                          <button
                                            key={transition}
                                            type="button"
                                            onClick={() => updateSlide(slide.id, { transition })}
                                            className={cn(
                                              "rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
                                              slide.transition === transition
                                                ? "bg-slate-900 text-white shadow-sm"
                                                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                            )}
                                          >
                                            {getSlideTransitionLabel(transition)}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div
                                      className={cn(
                                        "flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-2 py-2",
                                        index === 1 ? "h-[54px]" : "h-[53px]"
                                      )}
                                    >
                                      <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        Дни
                                      </span>
                                      <div className="flex flex-wrap gap-1">
                                        {WEEKDAY_OPTIONS.map((weekday) => {
                                          const isActive = slide.weekdays.includes(weekday.value)
                                          return (
                                            <button
                                              key={weekday.value}
                                              type="button"
                                              onClick={() => toggleSlideWeekday(slide.id, weekday.value)}
                                              className={cn(
                                                "min-w-8 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors",
                                                isActive
                                                  ? "border-slate-900 bg-slate-900 text-white"
                                                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900"
                                              )}
                                            >
                                              {weekday.label}
                                            </button>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
