"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Settings2, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MaintenanceSettings = {
  require_photo_before: boolean;
  min_photos_before: number;
  require_photo_after: boolean;
  min_photos_after: number;
  require_notes_on_completion: boolean;
  block_desktop_access: boolean;
};

type TypeSettings = {
  id?: string;
  equipment_type_code: string;
  type_name?: string;
  require_photo_before: boolean;
  min_photos_before: number;
  require_photo_after: boolean;
  min_photos_after: number;
  require_comment_mode: "ALWAYS" | "ON_ISSUE" | "NEVER";
};

type EquipmentType = {
  code: string;
  name_ru: string;
};

const DEFAULT_SETTINGS: MaintenanceSettings = {
  require_photo_before: false,
  min_photos_before: 0,
  require_photo_after: true,
  min_photos_after: 1,
  require_notes_on_completion: false,
  block_desktop_access: false,
};

export function MaintenanceCompletionSettingsTab({
  clubId,
}: {
  clubId: string;
}) {
  const [settings, setSettings] =
    useState<MaintenanceSettings>(DEFAULT_SETTINGS);
  const [typeSettings, setTypeSettings] = useState<TypeSettings[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [settingsRes, typesRes, eqTypesRes] = await Promise.all([
        fetch(`/api/clubs/${clubId}/settings/maintenance`, {
          cache: "no-store",
        }),
        fetch(`/api/clubs/${clubId}/settings/maintenance/types`, {
          cache: "no-store",
        }),
        fetch(`/api/clubs/${clubId}/equipment-types`),
      ]);

      const settingsData = await settingsRes.json();
      const typesData = await typesRes.json();
      const eqTypesData = await eqTypesRes.json();

      if (settingsRes.ok) {
        setSettings({
          require_photo_before: !!settingsData.require_photo_before,
          min_photos_before: Number(settingsData.min_photos_before) || 0,
          require_photo_after: settingsData.require_photo_after !== false,
          min_photos_after: Number(settingsData.min_photos_after) || 0,
          require_notes_on_completion:
            !!settingsData.require_notes_on_completion,
          block_desktop_access: !!settingsData.block_desktop_access,
        });
      }

      if (typesRes.ok) setTypeSettings(typesData);
      if (eqTypesRes.ok) setEquipmentTypes(eqTypesData);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/settings/maintenance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Не удалось сохранить общие настройки");
      alert("Общие настройки сохранены");
    } catch (error: any) {
      alert(error?.message || "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  const saveTypeSetting = async (item: TypeSettings) => {
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/settings/maintenance/types`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        },
      );
      if (!res.ok) throw new Error("Не удалось сохранить настройку типа");
      fetchData();
    } catch (error: any) {
      alert(error?.message || "Ошибка сохранения");
    }
  };

  const deleteTypeSetting = async (typeCode: string) => {
    if (!confirm("Удалить переопределение настроек для этого типа?")) return;
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/settings/maintenance/types/${typeCode}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Общие настройки завершения</CardTitle>
          <CardDescription>
            Действуют по умолчанию для всех типов оборудования.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Section: Photo Before */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-1">
                <Label className="text-base font-semibold">
                  Запрашивать фото до обслуживания
                </Label>
                <p className="text-sm text-muted-foreground">
                  Показывать этап фотоотчёта перед началом выполнения задачи.
                </p>
              </div>
              <Switch
                checked={settings.require_photo_before}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    require_photo_before: checked,
                    // If disabling ask, also reset min to 0
                    min_photos_before: checked ? prev.min_photos_before : 0,
                  }))
                }
              />
            </div>

            {settings.require_photo_before && (
              <div className="pl-6 border-l-2 border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">
                      Фото до обязательны
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Сотрудник не сможет продолжить без снимков.
                    </p>
                  </div>
                  <Switch
                    checked={settings.min_photos_before > 0}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({
                        ...prev,
                        min_photos_before: checked
                          ? Math.max(1, prev.min_photos_before)
                          : 0,
                      }))
                    }
                  />
                </div>

                {settings.min_photos_before > 0 && (
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] items-center animate-in fade-in slide-in-from-top-1">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">
                        Минимум фото (До)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Количество снимков состояния устройства до работ.
                      </p>
                    </div>
                    <Input
                      type="number"
                      value={settings.min_photos_before ?? 1}
                      min={1}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          min_photos_before: Math.max(
                            1,
                            Number(e.target.value),
                          ),
                        }))
                      }
                      className="h-10 rounded-xl"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-border" />

          {/* Section: Photo After */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-1">
                <Label className="text-base font-semibold">
                  Запрашивать фото после обслуживания
                </Label>
                <p className="text-sm text-muted-foreground">
                  Показывать этап фотоотчёта после завершения работ.
                </p>
              </div>
              <Switch
                checked={settings.require_photo_after}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    require_photo_after: checked,
                    min_photos_after: checked ? prev.min_photos_after : 0,
                  }))
                }
              />
            </div>

            {settings.require_photo_after && (
              <div className="pl-6 border-l-2 border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">
                      Фото после обязательны
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Сотрудник не сможет завершить задачу без снимков.
                    </p>
                  </div>
                  <Switch
                    checked={settings.min_photos_after > 0}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({
                        ...prev,
                        min_photos_after: checked
                          ? Math.max(1, prev.min_photos_after)
                          : 0,
                      }))
                    }
                  />
                </div>

                {settings.min_photos_after > 0 && (
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] items-center animate-in fade-in slide-in-from-top-1">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">
                        Минимум фото (После)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Количество снимков результата работы.
                      </p>
                    </div>
                    <Input
                      type="number"
                      value={settings.min_photos_after ?? 1}
                      min={1}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          min_photos_after: Math.max(1, Number(e.target.value)),
                        }))
                      }
                      className="h-10 rounded-xl"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-border" />

          <div className="flex items-start justify-between gap-6">
            <div className="space-y-1">
              <Label className="text-base font-semibold">
                Комментарий обязателен
              </Label>
              <p className="text-sm text-muted-foreground">
                Требовать текстовый отчёт.
              </p>
            </div>
            <Switch
              checked={settings.require_notes_on_completion}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({
                  ...prev,
                  require_notes_on_completion: checked,
                }))
              }
            />
          </div>

          <div className="flex items-start justify-between gap-6">
            <div className="space-y-1">
              <Label className="text-base font-semibold">
                Блокировать доступ с ПК
              </Label>
              <p className="text-sm text-muted-foreground">
                Запретить использование терминала обслуживания на настольных
                устройствах.
              </p>
            </div>
            <Switch
              checked={settings.block_desktop_access}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({
                  ...prev,
                  block_desktop_access: checked,
                }))
              }
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={saveSettings}
              disabled={isSaving}
              className="rounded-xl h-11 bg-slate-900 text-white"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Сохранить общие
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-indigo-100 bg-indigo-50/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-indigo-950">
              Настройки по типам оборудования
            </CardTitle>
            <CardDescription>
              Переопределите правила для конкретных устройств (например, фото
              "До" для системных блоков).
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg bg-white"
            onClick={() => {
              const unconfigured = equipmentTypes.find(
                (t) =>
                  !typeSettings.find((s) => s.equipment_type_code === t.code),
              );
              if (unconfigured) {
                setTypeSettings((prev) => [
                  ...prev,
                  {
                    equipment_type_code: unconfigured.code,
                    type_name: unconfigured.name_ru,
                    require_photo_before: false,
                    min_photos_before: 0,
                    require_photo_after: true,
                    min_photos_after: 1,
                    require_comment_mode: "ON_ISSUE",
                  },
                ]);
              }
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Добавить правило
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {typeSettings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-2xl">
              Нет индивидуальных настроек. Все устройства следуют общим
              правилам.
            </div>
          ) : (
            <div className="grid gap-4">
              {typeSettings.map((item, idx) => (
                <div
                  key={item.equipment_type_code}
                  className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                        <Settings2 className="h-5 w-5" />
                      </div>
                      <Select
                        value={item.equipment_type_code}
                        onValueChange={(val) => {
                          const name = equipmentTypes.find(
                            (t) => t.code === val,
                          )?.name_ru;
                          setTypeSettings((prev) =>
                            prev.map((s, i) =>
                              i === idx
                                ? {
                                    ...s,
                                    equipment_type_code: val,
                                    type_name: name,
                                  }
                                : s,
                            ),
                          );
                        }}
                      >
                        <SelectTrigger className="w-[200px] font-bold border-none bg-transparent hover:bg-slate-50">
                          <SelectValue placeholder="Тип" />
                        </SelectTrigger>
                        <SelectContent>
                          {equipmentTypes.map((t) => (
                            <SelectItem key={t.code} value={t.code}>
                              {t.name_ru}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-500"
                      onClick={() =>
                        deleteTypeSetting(item.equipment_type_code)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-8 pt-2">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-semibold text-zinc-900">
                          Фото До
                        </Label>
                        <Switch
                          checked={item.require_photo_before}
                          onCheckedChange={(checked) =>
                            setTypeSettings((prev) =>
                              prev.map((s, i) =>
                                i === idx
                                  ? {
                                      ...s,
                                      require_photo_before: checked,
                                      min_photos_before: checked
                                        ? s.min_photos_before
                                        : 0,
                                    }
                                  : s,
                              ),
                            )
                          }
                        />
                      </div>
                      {item.require_photo_before && (
                        <div className="pl-4 border-l-2 border-indigo-50 space-y-3 animate-in fade-in slide-in-from-top-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Обязательно
                            </span>
                            <Switch
                              className="scale-75"
                              checked={item.min_photos_before > 0}
                              onCheckedChange={(checked) =>
                                setTypeSettings((prev) =>
                                  prev.map((s, i) =>
                                    i === idx
                                      ? {
                                          ...s,
                                          min_photos_before: checked
                                            ? Math.max(1, s.min_photos_before)
                                            : 0,
                                        }
                                      : s,
                                  ),
                                )
                              }
                            />
                          </div>
                          {item.min_photos_before > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                Мин. кол-во
                              </span>
                              <Input
                                type="number"
                                className="w-16 h-7 text-center text-xs rounded-lg"
                                value={item.min_photos_before ?? 1}
                                min={1}
                                onChange={(e) =>
                                  setTypeSettings((prev) =>
                                    prev.map((s, i) =>
                                      i === idx
                                        ? {
                                            ...s,
                                            min_photos_before: Math.max(
                                              1,
                                              Number(e.target.value),
                                            ),
                                          }
                                        : s,
                                    ),
                                  )
                                }
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-semibold text-zinc-900">
                          Фото После
                        </Label>
                        <Switch
                          checked={item.require_photo_after}
                          onCheckedChange={(checked) =>
                            setTypeSettings((prev) =>
                              prev.map((s, i) =>
                                i === idx
                                  ? {
                                      ...s,
                                      require_photo_after: checked,
                                      min_photos_after: checked
                                        ? s.min_photos_after
                                        : 0,
                                    }
                                  : s,
                              ),
                            )
                          }
                        />
                      </div>
                      {item.require_photo_after && (
                        <div className="pl-4 border-l-2 border-indigo-50 space-y-3 animate-in fade-in slide-in-from-top-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Обязательно
                            </span>
                            <Switch
                              className="scale-75"
                              checked={item.min_photos_after > 0}
                              onCheckedChange={(checked) =>
                                setTypeSettings((prev) =>
                                  prev.map((s, i) =>
                                    i === idx
                                      ? {
                                          ...s,
                                          min_photos_after: checked
                                            ? Math.max(1, s.min_photos_after)
                                            : 0,
                                        }
                                      : s,
                                  ),
                                )
                              }
                            />
                          </div>
                          {item.min_photos_after > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                Мин. кол-во
                              </span>
                              <Input
                                type="number"
                                className="w-16 h-7 text-center text-xs rounded-lg"
                                value={item.min_photos_after ?? 1}
                                min={1}
                                onChange={(e) =>
                                  setTypeSettings((prev) =>
                                    prev.map((s, i) =>
                                      i === idx
                                        ? {
                                            ...s,
                                            min_photos_after: Math.max(
                                              1,
                                              Number(e.target.value),
                                            ),
                                          }
                                        : s,
                                    ),
                                  )
                                }
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <Label className="font-semibold">Комментарий</Label>
                    <Select
                      value={item.require_comment_mode}
                      onValueChange={(val: any) =>
                        setTypeSettings((prev) =>
                          prev.map((s, i) =>
                            i === idx ? { ...s, require_comment_mode: val } : s,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="w-[180px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALWAYS">Всегда</SelectItem>
                        <SelectItem value="ON_ISSUE">При инциденте</SelectItem>
                        <SelectItem value="NEVER">Не нужен</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      className="bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg"
                      onClick={() => saveTypeSetting(item)}
                    >
                      <Save className="mr-2 h-4 w-4" /> Сохранить для{" "}
                      {item.type_name}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
