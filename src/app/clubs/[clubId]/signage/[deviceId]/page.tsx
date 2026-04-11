"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { SignageStage } from "@/components/signage/SignageStage"
import { PageHeader, PageShell } from "@/components/layout/PageShell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createSignageSlide,
  normalizeSignageLayout,
  normalizeSignageTransition,
  type SignageLayout,
  type SignageSlide,
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
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react"

type SignageDevice = {
  id: number
  name: string | null
  orientation: "landscape" | "portrait"
  screen_label: string | null
  selected_display_id: string | null
  is_online: boolean
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

  useEffect(() => {
    params.then(({ clubId: nextClubId, deviceId: nextDeviceId }) => {
      setClubId(nextClubId)
      setDeviceId(nextDeviceId)
      void fetchEditorData(nextClubId, nextDeviceId)
    })
  }, [params])

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
      alert(error?.message || "Не удалось загрузить редактор экрана")
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
      alert("Layout сохранен")
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Не удалось сохранить layout")
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
      alert(error?.message || "Не удалось обновить ориентацию")
    } finally {
      setIsUpdatingOrientation(false)
    }
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    setIsUploading(true)
    try {
      const uploadedSlides: SignageSlide[] = []

      for (const file of files) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("preserveOriginal", "1")

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || "Не удалось загрузить фото")
        }

        uploadedSlides.push(
          createSignageSlide({
            imageUrl: data.url,
            title: file.name.replace(/\.[^/.]+$/, ""),
            order: layoutDraft?.slides.length ? layoutDraft.slides.length + uploadedSlides.length : uploadedSlides.length,
            durationSec: 8,
            startHour: 0,
            endHour: 0,
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
      alert(error?.message || "Не удалось загрузить фото")
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
            })
          : slide
      ),
    }))
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
    <PageShell maxWidth="7xl">
      <PageHeader
        title={device?.name || device?.screen_label || "Редактор экрана"}
        description="Редактирование контента выбранного signage-экрана."
      >
        <Button asChild variant="outline" className="gap-2">
          <Link href={`/clubs/${clubId}/signage`}>
            <ArrowLeft className="h-4 w-4" />
            Назад к экранам
          </Link>
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => void fetchEditorData()}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Обновить
        </Button>
      </PageHeader>

      {device ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <Badge variant="outline">
            {device.orientation === "portrait" ? "Вертикально" : "Горизонтально"}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "border-transparent",
              device.is_online ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
            )}
          >
            {device.is_online ? "Онлайн" : "Оффлайн"}
          </Badge>
          <div className="text-sm text-slate-600">
            Монитор: {device.screen_label || device.selected_display_id || "Не выбран"}
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant={device.orientation === "landscape" ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => void handleOrientationChange("landscape")}
              disabled={isUpdatingOrientation}
            >
              {isUpdatingOrientation && device.orientation !== "landscape" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RectangleHorizontal className="h-4 w-4" />
              )}
              Горизонтально
            </Button>
            <Button
              type="button"
              variant={device.orientation === "portrait" ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => void handleOrientationChange("portrait")}
              disabled={isUpdatingOrientation}
            >
              {isUpdatingOrientation && device.orientation !== "portrait" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RectangleVertical className="h-4 w-4" />
              )}
              Вертикально
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[460px_1fr]">
        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardHeader className="space-y-3">
            <CardTitle className="text-2xl text-slate-900">Плейлист экрана</CardTitle>
            <CardDescription>
              Загрузка фото, порядок показа, длительность, часы активности и анимация перехода.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading || !layoutDraft || !device ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="transition">Анимация перехода</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["fade", "slide", "zoom"] as const).map((transition) => (
                      <button
                        key={transition}
                        type="button"
                        onClick={() =>
                          updateLayout((layout) => ({
                            ...layout,
                            transition: normalizeSignageTransition(transition),
                          }))
                        }
                        className={cn(
                          "rounded-xl border px-3 py-3 text-sm transition",
                          layoutDraft.transition === transition
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        )}
                      >
                        {transition === "fade"
                          ? "Плавно"
                          : transition === "slide"
                            ? "Сдвиг"
                            : "Зум"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="background">Цвет фона</Label>
                  <div className="flex gap-3">
                    <Input
                      id="background"
                      type="color"
                      value={layoutDraft.background}
                      onChange={(event) =>
                        updateLayout((layout) => ({ ...layout, background: event.target.value }))
                      }
                      className="h-11 w-16 rounded-xl p-1"
                    />
                    <Input
                      value={layoutDraft.background}
                      onChange={(event) =>
                        updateLayout((layout) => ({ ...layout, background: event.target.value }))
                      }
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Загрузить фото</Label>
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-3 text-center">
                      <div className="rounded-full bg-white p-3 shadow-sm">
                        {isUploading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                        ) : (
                          <ImagePlus className="h-5 w-5 text-slate-500" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">Добавить изображения</div>
                        <div className="text-sm text-slate-500">
                          Можно выбрать сразу несколько фото.
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handlePhotoUpload}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Фото в показе</Label>
                    <div className="text-sm text-slate-500">{layoutDraft.slides.length} шт.</div>
                  </div>

                  {layoutDraft.slides.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                      Пока фото не загружены. После сохранения player покажет экран "Контента нет".
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {layoutDraft.slides
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((slide, index) => (
                          <div key={slide.id} className="rounded-2xl border border-slate-200 p-4">
                            <div className="mb-4 flex items-start gap-4">
                              <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-slate-100 p-2">
                                {/* In the editor show the original photo proportions without crop/squeeze. */}
                                <img
                                  src={slide.imageUrl}
                                  alt={slide.title || "Фото"}
                                  className="h-full w-full rounded-lg object-contain"
                                  loading="lazy"
                                />
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <Input
                                  value={slide.title}
                                  onChange={(event) =>
                                    updateSlide(slide.id, { title: event.target.value })
                                  }
                                  placeholder="Название фото"
                                  className="h-10 rounded-xl"
                                />
                                <div className="text-xs text-slate-500 break-all">{slide.imageUrl}</div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => moveSlide(slide.id, -1)}
                                  disabled={index === 0}
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => moveSlide(slide.id, 1)}
                                  disabled={index === layoutDraft.slides.length - 1}
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => removeSlide(slide.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="space-y-2">
                                <Label>Порядок</Label>
                                <Input value={String(index + 1)} readOnly className="h-10 rounded-xl" />
                              </div>
                              <div className="space-y-2">
                                <Label>Показ, сек</Label>
                                <Input
                                  type="number"
                                  min={3}
                                  max={3600}
                                  value={slide.durationSec}
                                  onChange={(event) =>
                                    updateSlide(slide.id, {
                                      durationSec: Number(event.target.value || 8),
                                    })
                                  }
                                  className="h-10 rounded-xl"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Статус</Label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={cn(
                                    "h-10 w-full rounded-xl",
                                    slide.enabled
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : "border-slate-200 bg-slate-50 text-slate-600"
                                  )}
                                  onClick={() => updateSlide(slide.id, { enabled: !slide.enabled })}
                                >
                                  {slide.enabled ? "Активно" : "Выключено"}
                                </Button>
                              </div>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>С какого часа</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={23}
                                  value={slide.startHour}
                                  onChange={(event) =>
                                    updateSlide(slide.id, {
                                      startHour: Number(event.target.value || 0),
                                    })
                                  }
                                  className="h-10 rounded-xl"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>До какого часа</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={23}
                                  value={slide.endHour}
                                  onChange={(event) =>
                                    updateSlide(slide.id, {
                                      endHour: Number(event.target.value || 0),
                                    })
                                  }
                                  className="h-10 rounded-xl"
                                />
                              </div>
                            </div>

                            <div className="mt-2 text-xs text-slate-500">
                              Если часы одинаковые, фото считается активным весь день.
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <Button
                  className="h-11 w-full gap-2 rounded-xl"
                  onClick={handleSaveLayout}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Сохранить layout
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardHeader className="space-y-3">
            <CardTitle className="text-2xl text-slate-900">Превью экрана</CardTitle>
            <CardDescription>
              Превью текущего слайдшоу с учетом порядка и настроенной анимации перехода.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {layoutDraft && device ? (
              <div className="rounded-[28px] bg-[#0b0f14] p-5">
                <div className="mx-auto max-w-[560px]">
                  <div
                    className={cn(
                      "mx-auto overflow-hidden",
                      device.orientation === "portrait" ? "w-[220px]" : "w-full"
                    )}
                  >
                    <div
                      className={cn(
                        "mx-auto",
                        device.orientation === "portrait" ? "aspect-[9/16]" : "aspect-[16/9]"
                      )}
                    >
                      <SignageStage layout={layoutDraft} orientation={device.orientation} preview />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                Не удалось загрузить превью экрана.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
